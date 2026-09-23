<?php

declare(strict_types=1);

/**
 * VenueVue 2.3 - POST /backend/auth.php
 *
 * Self-hosted sign-in for the tablet POS. Verifies a username/password pair
 * against `users.password_hash` with the native password_verify() and, on
 * success, mints a bearer token for the device.
 *
 * Request  (application/json):
 *   { "username": "barista", "password": "...", "tablet_id": "T-01" }
 *
 * Response 200:
 *   { "success": true, "token": "<64-char hex>", "user": { ... } }
 * Response 401:
 *   { "success": false, "error": "Invalid username or password" }
 *
 * Token handling: the raw token is returned exactly once and never stored. The
 * database only ever sees its SHA-256 digest, so a stolen database dump cannot
 * be replayed as a live session.
 */

require_once __DIR__ . '/config.php';

/**
 * Valid bcrypt digest of a random throwaway string, used to equalise the cost
 * of verifying a password for a username that does not exist.
 */
const VENUEVUE_DUMMY_HASH = '$2y$10$C4jqz4Pti0wUik4T4HXd/eRRzz840zybcsDwf/1FiTMnBaOHDK6He';

bootstrap_api();
require_post();

/* =============================================================================
 * Input
 * ========================================================================== */

$payload = read_json_body();

// Cast defensively: a JSON number or nested object must not reach the database
// layer as-is, and (string) on an array/object would raise a warning.
$username = trim(is_string($payload['username'] ?? null) ? $payload['username'] : '');
$password = is_string($payload['password'] ?? null) ? $payload['password'] : '';
$tabletId = trim(is_string($payload['tablet_id'] ?? null) ? $payload['tablet_id'] : '');

if ($username === '' || $password === '' || $tabletId === '') {
    fail(400, 'username, password and tablet_id are all required.');
}

// Length limits mirror the schema (users.username is VARCHAR(64)); checking them
// before the query keeps oversized payloads away from the database entirely.
if (strlen($username) > 64) {
    fail(422, 'username must be 64 characters or fewer.');
}

if (strlen($password) > 200) {
    fail(422, 'password must be 200 characters or fewer.');
}

// Tablet ids are printed on the hardware (T-01, T-02, ...); anything else is a
// client bug or tampering.
if (preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/', $tabletId) !== 1) {
    fail(422, 'tablet_id must be 1-64 characters: letters, digits, dot, dash or underscore.');
}

$pdo = get_pdo();

/* =============================================================================
 * Brute-force throttle
 * ========================================================================== */

/**
 * Count LOGIN_FAIL rows created inside the throttle window, optionally scoped
 * to a single column/value pair.
 */
$count_recent_failures = static function (PDO $pdo, string $column, string|int $value): int {
    // $column is one of two literals chosen below - never caller input.
    $statement = $pdo->prepare(
        'SELECT COUNT(*)
           FROM audit_logs
          WHERE action = :action
            AND ' . $column . ' = :value
            AND created_at >= DATE_SUB(NOW(), INTERVAL ' . VENUEVUE_FAILED_ATTEMPT_WINDOW_MINUTES . ' MINUTE)'
    );

    $statement->execute([':action' => 'LOGIN_FAIL', ':value' => $value]);

    return (int) $statement->fetchColumn();
};

if ($count_recent_failures($pdo, 'ip_address', client_ip()) >= VENUEVUE_MAX_FAILED_ATTEMPTS) {
    audit_log($pdo, null, 'LOGIN_FAIL', 'users', null, [
        'reason' => 'throttled',
        'username' => $username,
        'tablet_id' => $tabletId,
        'user_agent' => client_user_agent(),
    ]);

    // Deliberately vague: an attacker learns nothing about which accounts exist.
    fail(429, 'Too many failed sign-in attempts. Wait a few minutes and try again.');
}

/* =============================================================================
 * Credential verification
 * ========================================================================== */

$statement = $pdo->prepare(
    'SELECT user_id, username, password_hash, role, is_active
       FROM users
      WHERE username = :username
      LIMIT 1'
);

$statement->execute([':username' => $username]);
$user = $statement->fetch();

/**
 * Always run a verification, even for an unknown username, so the response time
 * of "no such account" matches "wrong password" and cannot be used to enumerate
 * accounts.
 */
$storedHash = is_array($user) ? (string) $user['password_hash'] : VENUEVUE_DUMMY_HASH;
$passwordMatches = password_verify($password, $storedHash);

$accountExists = is_array($user);
$accountActive = $accountExists && (int) $user['is_active'] === 1;

if (!$accountExists || !$passwordMatches || !$accountActive) {
    // The stored digest is only meaningful when the account exists.
    $failureReason = match (true) {
        !$accountExists => 'unknown_username',
        !$passwordMatches => 'bad_password',
        default => 'account_inactive',
    };

    // Keep the reason in the audit trail for operators, never in the response.
    audit_log(
        $pdo,
        $accountExists ? (int) $user['user_id'] : null,
        'LOGIN_FAIL',
        'users',
        $accountExists ? (int) $user['user_id'] : null,
        [
            'reason' => $failureReason,
            'username' => $username,
            'tablet_id' => $tabletId,
            'user_agent' => client_user_agent(),
        ]
    );

    fail(401, 'Invalid username or password');
}

$userId = (int) $user['user_id'];
$role = (string) $user['role'];

// A row whose role is outside the module's vocabulary (for example legacy
// lowercase data) must never be handed a session.
if (!in_array($role, VENUEVUE_ALLOWED_ROLES, true)) {
    audit_log($pdo, $userId, 'RBAC_DENIED', 'users', $userId, [
        'reason' => 'unknown_role',
        'role' => $role,
        'tablet_id' => $tabletId,
    ]);

    fail(403, 'This account\'s role is not recognised by the POS. Contact the owner.');
}

/**
 * Opportunistically upgrade the stored digest when PHP's default cost changes.
 * This is the only moment the plaintext password is available, so it is the
 * only moment a rehash is possible.
 */
if (password_needs_rehash($storedHash, PASSWORD_DEFAULT)) {
    try {
        $rehash = $pdo->prepare('UPDATE users SET password_hash = :hash WHERE user_id = :user_id');
        $rehash->execute([
            ':hash' => password_hash($password, PASSWORD_DEFAULT),
            ':user_id' => $userId,
        ]);
    } catch (PDOException $exception) {
        // A failed upgrade must not block a legitimate sign-in.
        error_log('[venuevue] password rehash failed: ' . $exception->getMessage());
    }
}

/* =============================================================================
 * Issue the session
 * ========================================================================== */

// 32 random bytes -> 64 hex characters, the format the front end validates.
$token = bin2hex(random_bytes(32));

// Only this digest is persisted; the raw token exists solely in the response.
$tokenHash = hash('sha256', $token);

$sessionId = uuid_v4();

// Let MySQL compute the expiry so api_sessions.expires_at and the NOW()
// comparison in auth_middleware.php share a single clock.
$expiresAt = (string) $pdo->query(
    'SELECT DATE_ADD(NOW(), INTERVAL ' . VENUEVUE_SESSION_TTL_HOURS . ' HOUR)'
)->fetchColumn();

$insert = $pdo->prepare(
    'INSERT INTO api_sessions (session_id, user_id, token_hash, tablet_id, expires_at)
     VALUES (:session_id, :user_id, :token_hash, :tablet_id, :expires_at)'
);

try {
    $insert->execute([
        ':session_id' => $sessionId,
        ':user_id' => $userId,
        ':token_hash' => $tokenHash,
        ':tablet_id' => $tabletId,
        ':expires_at' => $expiresAt,
    ]);
} catch (PDOException $exception) {
    // The unique index on token_hash makes a collision a hard error rather than
    // a silently shared session; surface it as a retryable server fault.
    error_log('[venuevue] session insert failed: ' . $exception->getMessage());
    fail(500, 'Could not start a session. Please try again.');
}

audit_log($pdo, $userId, 'LOGIN_OK', 'api_sessions', null, [
    'session_id' => $sessionId,
    'tablet_id' => $tabletId,
    'role' => $role,
    'expires_at' => $expiresAt,
    'user_agent' => client_user_agent(),
]);

/* =============================================================================
 * Response - the raw token is returned here and nowhere else
 * ========================================================================== */

json_response(200, [
    'success' => true,
    'token' => $token,
    'user' => [
        'user_id' => $userId,
        'username' => (string) $user['username'],
        'role' => $role,
    ],
    'expires_at' => $expiresAt,
]);
