<?php

declare(strict_types=1);

/**
 * VenueVue 2.3 - User Authentication & Session Management.
 *
 * Shared backend bootstrap. Every API entry point (auth.php and any endpoint
 * that includes auth_middleware.php) starts with:
 *
 *     require_once __DIR__ . '/config.php';
 *     bootstrap_api();          // CORS + JSON error handling
 *
 * Everything here is 100% self-hosted: PHP 8 + MySQL 8 on the local XAMPP
 * stack. There is no Supabase, no cloud identity provider and no outbound
 * network call anywhere in this module.
 *
 * Connection settings come from the environment so the same code runs on the
 * XAMPP default install and on a hardened host:
 *
 *   VENUEVUE_DB_HOST  (default 127.0.0.1)
 *   VENUEVUE_DB_PORT  (default 3306)
 *   VENUEVUE_DB_NAME  (default venuevue)
 *   VENUEVUE_DB_USER  (default root)
 *   VENUEVUE_DB_PASS  (default empty - XAMPP's out-of-the-box root password)
 */

/* =============================================================================
 * Configuration
 * ========================================================================== */

/**
 * Origins allowed to call the API from a browser.
 *
 * The POS shell is served from http://192.168.137.1 on the same Apache
 * instance, so in production the front end is same-origin and never sends an
 * Origin header at all. This list only matters for the Vite dev server (or a
 * second tablet origin) - anything absent from it receives no
 * Access-Control-Allow-Origin header and is blocked by the browser.
 */
const VENUEVUE_ALLOWED_ORIGINS = [
    'http://192.168.137.1',
];

/** Lifetime of an issued session, in hours (api_sessions.expires_at). */
const VENUEVUE_SESSION_TTL_HOURS = 24;

/**
 * Brute-force throttle: after this many LOGIN_FAIL entries from one IP address
 * (or against one account) inside the window below, further attempts are
 * refused with HTTP 429 until the window rolls over.
 */
const VENUEVUE_MAX_FAILED_ATTEMPTS = 10;
const VENUEVUE_FAILED_ATTEMPT_WINDOW_MINUTES = 15;

/** Roles the POS understands. Must match users.role exactly (no other casing). */
const VENUEVUE_ALLOWED_ROLES = ['BARISTA', 'OWNER'];

/**
 * Read an environment variable with a fallback for the XAMPP default install.
 */
function env(string $key, string $default = ''): string
{
    $value = getenv($key);

    return ($value === false || $value === '') ? $default : $value;
}

/**
 * Database connection settings, resolved from the environment.
 *
 * @return array{host: string, port: int, name: string, user: string, pass: string}
 */
function venuevue_db_config(): array
{
    return [
        'host' => env('VENUEVUE_DB_HOST', '127.0.0.1'),
        'port' => (int) env('VENUEVUE_DB_PORT', '3306'),
        'name' => env('VENUEVUE_DB_NAME', 'venuevue'),
        'user' => env('VENUEVUE_DB_USER', 'root'),
        'pass' => env('VENUEVUE_DB_PASS', ''),
    ];
}

/**
 * Shared PDO handle (lazily created once per request).
 *
 * Emulated prepares are disabled so every value is bound on the server side,
 * and exceptions are enabled so a broken query can never be mistaken for an
 * empty result set.
 */
function get_pdo(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $config = venuevue_db_config();

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        $config['host'],
        $config['port'],
        $config['name']
    );

    $pdo = new PDO($dsn, $config['user'], $config['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        // Keep INT columns as PHP ints (user_id, entity_id, is_active...).
        PDO::ATTR_STRINGIFY_FETCHES => false,
    ]);

    return $pdo;
}

/* =============================================================================
 * HTTP plumbing
 * ========================================================================== */

/**
 * Prepare the request for a JSON API response.
 *
 * Call once, first thing, in every entry point.
 */
function bootstrap_api(): void
{
    // Never let a warning or notice leak HTML into a JSON body; PHP still logs
    // them (log_errors is on by default in XAMPP).
    ini_set('display_errors', '0');

    send_cors_headers();

    // A preflight never reaches the endpoint logic.
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }

    // Any uncaught throwable becomes a JSON 500 instead of a stack trace.
    set_exception_handler(static function (Throwable $exception): void {
        error_log('[venuevue] unhandled ' . $exception::class . ': ' . $exception->getMessage());
        json_response(500, ['success' => false, 'error' => 'Internal server error']);
    });
}

/**
 * Emit the CORS headers. The allowed origin is echoed back only when it
 * matches the LAN allow-list; unlisted origins get no CORS grant at all.
 */
function send_cors_headers(): void
{
    $origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');

    if ($origin !== '' && in_array($origin, VENUEVUE_ALLOWED_ORIGINS, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        // The response varies by Origin, so caches must not serve one origin's
        // grant to another.
        header('Vary: Origin');
    }

    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Authorization, Content-Type, Accept');
    header('Access-Control-Max-Age: 600');
}

/**
 * Write a JSON response body and terminate the request.
 *
 * `never` (PHP 8.1+) tells the compiler and readers that execution stops here,
 * which is what allows callers such as `fail()` to be used mid-function.
 *
 * @param array<string, mixed> $payload
 */
function json_response(int $status, array $payload): never
{
    if (!headers_sent()) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        // Session tokens must never be cached by a proxy or the tablet.
        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');
        header('Referrer-Policy: no-referrer');
    }

    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    exit;
}

/**
 * Fail the request with the module's standard error envelope.
 *
 * @param array<string, mixed> $extra Additional top-level response fields.
 */
function fail(int $status, string $message, array $extra = []): never
{
    json_response($status, ['success' => false, 'error' => $message] + $extra);
}

/**
 * Reject anything that is not a POST.
 */
function require_post(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: POST');
        fail(405, 'Method not allowed. Use POST.');
    }
}

/**
 * Decode the request body as a JSON object.
 *
 * @return array<string, mixed>
 */
function read_json_body(): array
{
    $raw = file_get_contents('php://input');

    if ($raw === false || trim($raw) === '') {
        fail(400, 'Request body must be a JSON object.');
    }

    $decoded = json_decode($raw, true);

    if (!is_array($decoded)) {
        fail(400, 'Malformed JSON in request body.');
    }

    return $decoded;
}

/**
 * Best-effort client address for the audit trail.
 *
 * X-Forwarded-For is deliberately ignored: the LAN has no reverse proxy, so the
 * only trustworthy source is the socket address, and honouring a client-supplied
 * header would let an attacker forge the audit trail.
 */
function client_ip(): string
{
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');

    return filter_var($ip, FILTER_VALIDATE_IP) !== false ? $ip : '0.0.0.0';
}

/**
 * Truncated User-Agent, stored as supporting context in audit details.
 */
function client_user_agent(): string
{
    return substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255);
}

/**
 * Request path, stored as supporting context in audit details.
 */
function request_path(): string
{
    $path = (string) ($_SERVER['REQUEST_URI'] ?? '');

    return substr($path, 0, 255);
}

/* =============================================================================
 * Audit trail
 * ========================================================================== */

/**
 * Append a row to `audit_logs`.
 *
 * This is called on both the success and the failure paths, so it is written
 * defensively: a logging failure is reported to the PHP error log but never
 * turns a valid sign-in into a 500.
 *
 * @param int|null             $userId     NULL when the actor is unknown.
 * @param string               $action     'LOGIN_OK' | 'LOGIN_FAIL' | 'RBAC_DENIED'.
 * @param array<string, mixed> $details    Free-form context; JSON-encoded. Never
 *                                         put a password or a raw token here.
 * @param string|null          $ipAddress  Defaults to client_ip().
 */
function audit_log(
    PDO $pdo,
    ?int $userId,
    string $action,
    ?string $entityType = null,
    ?int $entityId = null,
    array $details = [],
    ?string $ipAddress = null
): void {
    try {
        $statement = $pdo->prepare(
            'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
             VALUES (:user_id, :action, :entity_type, :entity_id, :details, :ip_address)'
        );

        $statement->execute([
            ':user_id' => $userId,
            ':action' => $action,
            ':entity_type' => $entityType,
            ':entity_id' => $entityId,
            ':details' => $details === []
                ? null
                : json_encode($details, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            ':ip_address' => $ipAddress ?? client_ip(),
        ]);
    } catch (PDOException $exception) {
        error_log('[venuevue] audit_log(' . $action . ') failed: ' . $exception->getMessage());
    }
}

/* =============================================================================
 * Session helpers
 * ========================================================================== */

/**
 * RFC 4122 version 4 UUID, used for api_sessions.session_id (CHAR(36)).
 */
function uuid_v4(): string
{
    $bytes = random_bytes(16);

    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40); // version 4
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80); // RFC 4122 variant

    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
}
