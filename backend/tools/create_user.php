<?php

declare(strict_types=1);

/**
 * VenueVue 2.3 - credential helper (command line only).
 *
 * Creates a POS account, or resets the password of an existing one, without
 * needing phpMyAdmin. It hashes the password with the same algorithm the login
 * endpoint verifies against (PASSWORD_BCRYPT via password_hash()), so an
 * account created here can sign in immediately.
 *
 * Usage (run from the project root):
 *
 *     php backend/tools/create_user.php <username> <password> <ROLE>
 *     php backend/tools/create_user.php --list
 *
 * ROLE must be BARISTA or OWNER, exactly as stored in `users.role`.
 *
 * Examples:
 *
 *     php backend/tools/create_user.php owner   owner123   OWNER
 *     php backend/tools/create_user.php barista barista123 BARISTA
 *
 * The database it talks to is the one `backend/config.php` resolves, so the
 * usual VENUEVUE_DB_* environment variables apply. That makes it safe to point
 * at a scratch database while testing:
 *
 *     $env:VENUEVUE_DB_NAME = 'venuevue_demo'
 *     php backend/tools/create_user.php barista barista123 BARISTA
 *
 * WARNING: this writes to the `users` table. It never prints or stores a
 * password in any form other than the hash in that column.
 */

// Never reachable over HTTP: Apache would happily execute .php files under
// /backend, so refuse to run unless we really are the CLI binary.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit("Not found.\n");
}

require_once __DIR__ . '/../config.php';

/* -----------------------------------------------------------------------------
 * Argument parsing
 * -------------------------------------------------------------------------- */

$argv = $_SERVER['argv'] ?? [];
array_shift($argv); // drop the script name

if ($argv === [] || in_array($argv[0], ['-h', '--help', 'help'], true)) {
    fwrite(STDOUT, <<<TXT
VenueVue credential helper

  php backend/tools/create_user.php <username> <password> <ROLE>
  php backend/tools/create_user.php --list

  <username>  1-64 characters (matches users.username)
  <password>  8-200 characters
  <ROLE>      BARISTA or OWNER

TXT);
    exit($argv === [] ? 1 : 0);
}

$config = venuevue_db_config();

try {
    $pdo = get_pdo();
} catch (PDOException $e) {
    fwrite(STDERR, "Cannot connect to MySQL ({$config['host']}:{$config['port']}, database '{$config['name']}').\n");
    fwrite(STDERR, "Is MySQL started in the XAMPP control panel, and has the schema been imported?\n");
    exit(1);
}

/* -----------------------------------------------------------------------------
 * --list : show the accounts that exist, so you can see what to sign in with
 * -------------------------------------------------------------------------- */

if ($argv[0] === '--list' || $argv[0] === '-l') {
    $rows = $pdo->query(
        'SELECT user_id, username, role, is_active, created_at FROM users ORDER BY user_id'
    )->fetchAll();

    if ($rows === []) {
        fwrite(STDOUT, "No users yet. Create one:\n  php backend/tools/create_user.php owner owner123 OWNER\n");
        exit(0);
    }

    // A role outside the Rev 2.3 vocabulary means the database has not been
    // migrated yet; the login endpoint rejects those accounts, so warn before
    // printing the table rather than after it (keeps the table readable).
    foreach ($rows as $row) {
        if (!in_array($row['role'], VENUEVUE_ALLOWED_ROLES, true)) {
            $shown = $row['role'] === '' ? '(empty)' : $row['role'];
            fwrite(STDERR, "WARNING: '{$row['username']}' has role '{$shown}', which is not "
                . implode(' or ', VENUEVUE_ALLOWED_ROLES) . ".\n"
                . "This account cannot sign in. Run database/migrations/002_auth_rev23_align.sql.\n\n");
        }
    }

    printf("%-5s %-32s %-9s %-8s %s\n", 'ID', 'USERNAME', 'ROLE', 'ACTIVE', 'CREATED');
    foreach ($rows as $row) {
        printf(
            "%-5s %-32s %-9s %-8s %s\n",
            $row['user_id'],
            $row['username'],
            $row['role'] === '' ? '(empty)' : $row['role'],
            ((int) $row['is_active'] === 1 ? 'yes' : 'no'),
            $row['created_at'] ?? '-'
        );
    }

    fflush(STDOUT);
    exit(0);
}

/* -----------------------------------------------------------------------------
 * Create / update
 * -------------------------------------------------------------------------- */

if (count($argv) !== 3) {
    fwrite(STDERR, "Expected 3 arguments, got " . count($argv) . ". Run with --help for usage.\n");
    exit(1);
}

[$username, $password, $role] = $argv;

$username = trim($username);
$role = strtoupper(trim($role));

// The schema is the source of truth for these limits; failing here gives a clear
// message instead of a MySQL error or a silently truncated value.
if ($username === '' || strlen($username) > 64) {
    fwrite(STDERR, "username must be 1-64 characters.\n");
    exit(1);
}

if (strlen($password) < 8 || strlen($password) > 200) {
    fwrite(STDERR, "password must be 8-200 characters.\n");
    exit(1);
}

if (!in_array($role, VENUEVUE_ALLOWED_ROLES, true)) {
    fwrite(STDERR, "role must be " . implode(' or ', VENUEVUE_ALLOWED_ROLES) . " (got '{$role}').\n");
    exit(1);
}

$hash = password_hash($password, PASSWORD_BCRYPT);

// Remember whether this username already existed, so a failed write can be
// rolled back precisely (see below) without touching accounts that were
// already in the table.
$probe = $pdo->prepare('SELECT user_id FROM users WHERE username = ?');
$probe->execute([$username]);
$preExisting = $probe->fetch() !== false;

try {
    // ON DUPLICATE KEY UPDATE makes this idempotent: re-running with the same
    // username resets that account's password and reactivates it, which is the
    // recovery path when a staff member is locked out (is_active was set to 0).
    $stmt = $pdo->prepare(
        'INSERT INTO users (username, password_hash, role, is_active)
         VALUES (:username, :password_hash, :role, 1)
         ON DUPLICATE KEY UPDATE
             password_hash = VALUES(password_hash),
             role          = VALUES(role),
             is_active     = 1'
    );
    $stmt->execute([
        ':username' => $username,
        ':password_hash' => $hash,
        ':role' => $role,
    ]);
} catch (PDOException $e) {
    fwrite(STDERR, "Failed to write the account: {$e->getMessage()}\n");

    // The most common cause by far is a drifted role column, so check for it and
    // say so plainly rather than leaving a raw driver error on screen.
    foreach (['Data truncated', 'Incorrect enum', 'Incorrect string value'] as $needle) {
        if (stripos($e->getMessage(), $needle) !== false) {
            fwrite(STDERR, "\nThe users.role column does not accept '{$role}'.\n");
            fwrite(STDERR, "This database predates Rev 2.3. Apply database/migrations/002_auth_rev23_align.sql first.\n");
            break;
        }
    }

    exit(1);
}

// MariaDB silently coerces an out-of-range ENUM value to '' and reports success,
// so execute() returning without throwing does NOT prove the row holds what we
// asked for. Read it back and confirm before claiming success.
$lookup = $pdo->prepare('SELECT user_id, role, is_active FROM users WHERE username = ?');
$lookup->execute([$username]);
$stored = $lookup->fetch();

if ($stored === false) {
    fwrite(STDERR, "The account was written but could not be read back. Check the users table.\n");
    exit(1);
}

$userId = (int) $stored['user_id'];
$storedRole = (string) $stored['role'];

if ($storedRole !== $role || (int) $stored['is_active'] !== 1) {
    fwrite(STDERR, sprintf(
        "FAILED: asked for role '%s' but the database stored '%s'.\n",
        $role,
        $storedRole === '' ? '(empty)' : $storedRole
    ));

    // Undo our own mess. A row holding an unmapped role would otherwise block
    // migration 002_auth_rev23_align.sql, whose guard deliberately aborts rather
    // than let an unrecognised role be blanked. Only new rows are removed, so an
    // account that already existed is left exactly as it was found.
    if (!$preExisting) {
        $delete = $pdo->prepare('DELETE FROM users WHERE user_id = ?');
        $delete->execute([$userId]);
        if ($delete->rowCount() > 0) {
            fwrite(STDERR, "Rolled back: the incomplete row was removed, the table is unchanged.\n");
        }
    }

    fwrite(STDERR, "The users.role column does not accept the Rev 2.3 role vocabulary yet.\n");
    fwrite(STDERR, "Apply database/migrations/002_auth_rev23_align.sql, then run this command again.\n");
    exit(1);
}

printf(
    "OK  user_id=%d  username=%s  role=%s  password=%s  active=yes\n",
    $userId,
    $username,
    $storedRole,
    str_repeat('*', strlen($password))
);

fwrite(STDOUT, "Sign in at the login screen, or test the API directly:\n");
fwrite(STDOUT, "  curl -X POST http://127.0.0.1/backend/auth.php -H \"Content-Type: application/json\" "
    . "-d \"{\\\"username\\\":\\\"{$username}\\\",\\\"password\\\":\\\"<password>\\\",\\\"tablet_id\\\":\\\"T-01\\\"}\"\n");
