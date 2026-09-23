<?php

declare(strict_types=1);

/**
 * VenueVue 2.3 - bearer-token authentication middleware.
 *
 * Include this from any endpoint that must be reached only by a signed-in
 * tablet:
 *
 *     require_once __DIR__ . '/config.php';
 *     bootstrap_api();                       // CORS + JSON error handling first
 *     require_once __DIR__ . '/auth_middleware.php';
 *
 *     $pdo     = get_pdo();
 *     $session = authenticate_request($pdo); // 401s and exits on its own
 *     require_role($pdo, $session, 'OWNER'); // 403s and exits on its own
 *
 * The middleware never trusts the client beyond the opaque token: the token is
 * digested with SHA-256 and matched against api_sessions, and the account's
 * expiry, active flag and role are re-read from the database on every request.
 */

require_once __DIR__ . '/config.php';

/* =============================================================================
 * Token extraction
 * ========================================================================== */

/**
 * Read the raw bearer token from the request headers.
 *
 * Apache does not always expose Authorization as $_SERVER['HTTP_AUTHORIZATION']
 * (mod_php usually does, CGI/FastCGI gateways expose it as
 * REDIRECT_HTTP_AUTHORIZATION or only through getallheaders()), so all three
 * routes are tried before giving up.
 *
 * @return string|null Lowercase 64-char hex token, or NULL when the header is
 *                     absent or malformed.
 */
function bearer_token_from_request(): ?string
{
    $candidates = [
        (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? ''),
        (string) ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? ''),
    ];

    if (function_exists('getallheaders')) {
        foreach (getallheaders() as $name => $value) {
            if (strcasecmp((string) $name, 'Authorization') === 0) {
                $candidates[] = (string) $value;
                break;
            }
        }
    }

    foreach ($candidates as $header) {
        // Only the exact "Bearer <64 hex>" shape is accepted; anything else is
        // rejected before it can reach a query. The scheme is matched
        // case-insensitively because RFC 7235 defines auth-schemes that way.
        if (preg_match('/^\s*Bearer\s+([0-9a-fA-F]{64})\s*$/i', $header, $matches) === 1) {
            return strtolower($matches[1]);
        }
    }

    return null;
}

/* =============================================================================
 * Denial helper
 * ========================================================================== */

/**
 * Log the refusal to `audit_logs` and terminate with HTTP 401.
 *
 * @param int|null    $userId    Known actor, when the token resolved to a row.
 * @param string      $reason    Machine-readable cause, stored in details.
 * @param string|null $sessionId Resolved session, when one was found.
 */
function deny_request(PDO $pdo, ?int $userId, string $reason, ?string $sessionId = null): never
{
    // api_sessions.session_id is a UUID, so it goes in `details` rather than the
    // integer entity_id column.
    audit_log($pdo, $userId, 'RBAC_DENIED', $sessionId === null ? null : 'api_sessions', null, [
        'reason' => $reason,
        'session_id' => $sessionId,
        'path' => request_path(),
        'user_agent' => client_user_agent(),
    ]);

    // One message for every cause: the client must not be able to tell an
    // expired session from a forged token.
    fail(401, 'Invalid or expired session token');
}

/* =============================================================================
 * Authentication
 * ========================================================================== */

/**
 * Authenticate the current request.
 *
 * Never returns when the request is unauthenticated - the caller is terminated
 * inside deny_request() by fail(401, 'Invalid or expired session token').
 *
 * @return array{user_id: int, role: string, tablet_id: string, username: string, session_id: string, expires_at: string}
 */
function authenticate_request(PDO $pdo): array
{
    $token = bearer_token_from_request();

    if ($token === null) {
        deny_request($pdo, null, 'missing_or_malformed_authorization_header');
    }

    $statement = $pdo->prepare(
        'SELECT s.session_id,
                s.user_id,
                s.tablet_id,
                s.expires_at,
                u.username,
                u.role,
                u.is_active,
                (s.expires_at > NOW()) AS is_unexpired
           FROM api_sessions AS s
           INNER JOIN users AS u ON u.user_id = s.user_id
          WHERE s.token_hash = :token_hash
          LIMIT 1'
    );

    // The lookup is by digest, so a database leak reveals no usable token.
    $statement->execute([':token_hash' => hash('sha256', $token)]);
    $session = $statement->fetch();

    // Unknown token: no row to attribute the denial to.
    if (!is_array($session)) {
        deny_request($pdo, null, 'unknown_session_token');
    }

    $userId = (int) $session['user_id'];
    $sessionId = (string) $session['session_id'];

    if ((int) $session['is_unexpired'] !== 1) {
        deny_request($pdo, $userId, 'session_expired', $sessionId);
    }

    if ((int) $session['is_active'] !== 1) {
        deny_request($pdo, $userId, 'user_inactive', $sessionId);
    }

    $role = (string) $session['role'];

    if (!in_array($role, VENUEVUE_ALLOWED_ROLES, true)) {
        deny_request($pdo, $userId, 'unknown_role', $sessionId);
    }

    return [
        'user_id' => $userId,
        'role' => $role,
        'tablet_id' => (string) $session['tablet_id'],
        // Extra context for downstream audit entries; the module's contract is
        // the three keys above.
        'username' => (string) $session['username'],
        'session_id' => $sessionId,
        'expires_at' => (string) $session['expires_at'],
    ];
}

/* =============================================================================
 * Authorization
 * ========================================================================== */

/**
 * Gate an endpoint on the caller's role.
 *
 * Authentication failures are 401; an authenticated caller that lacks the role
 * gets 403 plus an RBAC_DENIED audit entry.
 *
 * @param string|array<int, string> $allowedRoles One role or a list of roles.
 */
function require_role(PDO $pdo, array $session, string|array $allowedRoles): void
{
    $roles = is_array($allowedRoles) ? $allowedRoles : [$allowedRoles];
    $role = (string) ($session['role'] ?? '');

    if (in_array($role, $roles, true)) {
        return;
    }

    $userId = (int) ($session['user_id'] ?? 0);

    audit_log($pdo, $userId > 0 ? $userId : null, 'RBAC_DENIED', 'api_sessions', null, [
        'reason' => 'role_not_permitted',
        'role' => $role,
        'required_roles' => array_values($roles),
        'path' => request_path(),
        'session_id' => $session['session_id'] ?? null,
    ]);

    fail(403, 'Your role is not permitted to perform this action');
}

/* =============================================================================
 * Session lifecycle
 * ========================================================================== */

/**
 * Delete the caller's session row (server-side sign-out).
 *
 * The front end clears localStorage on logout; calling this as well makes the
 * token unusable immediately instead of leaving it valid until it lapses.
 * Deleting a session that is already gone is not an error.
 *
 * @param array $session The array returned by authenticate_request().
 */
function revoke_session(PDO $pdo, array $session): void
{
    $sessionId = (string) ($session['session_id'] ?? '');

    if ($sessionId === '') {
        return;
    }

    $statement = $pdo->prepare('DELETE FROM api_sessions WHERE session_id = :session_id');
    $statement->execute([':session_id' => $sessionId]);
}
