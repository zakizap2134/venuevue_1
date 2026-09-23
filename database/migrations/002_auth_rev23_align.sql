-- =============================================================================
-- VenueVue 2.3 - migration 002: align `users` with the Rev 2.3 auth module
-- =============================================================================
-- Context
--   The authentication module (backend/auth.php + backend/auth_middleware.php)
--   validates `users.role` against the strict vocabulary from Rev 2.3:
--       ENUM('BARISTA', 'OWNER')
--   The live development database predates that revision and stores lowercase
--   values:
--       enum('admin', 'barista')
--   Any account whose role is not 'BARISTA' or 'OWNER' is refused by
--   auth.php with HTTP 403 (audit_logs.action = 'RBAC_DENIED',
--   details.reason = 'unknown_role'). Run this migration before pointing the
--   POS tablets at the new backend.
--
-- Scope
--   `users` only. The live `api_sessions` and `audit_logs` tables already match
--   database/schema.sql, so they are not touched here.
--
-- Safety
--   * Take a backup first:
--       mysqldump -u root -p venuevue users > users_backup.sql
--   * MySQL DDL is not transactional - each statement commits as it runs.
--     The statements are ordered so that a failure leaves the column widened
--     to VARCHAR (never partially converted, never truncated).
--   * Section 3 re-tightens the column to the ENUM. Do NOT rely on the server
--     to protect you there: converting VARCHAR -> ENUM does not honour strict
--     mode, and an unmapped value is replaced with the empty string. Verified
--     on MariaDB 10.4.32 (what this XAMPP ships) - it blanks the value with no
--     warning and exit code 0. Section 3 is therefore gated by an explicit
--     guard (section 2b) that aborts the script *before* the ALTER runs,
--     leaving the column as VARCHAR with every value intact. Resolve the rows
--     it names, then re-run this file from the top.
--
-- Idempotent: yes. Verified - re-running after a successful pass leaves the
-- roles unchanged and loses no rows.
-- =============================================================================

USE `venuevue`;


-- -----------------------------------------------------------------------------
-- 0. Pre-flight: inspect what is actually there (read-only, safe to run alone)
-- -----------------------------------------------------------------------------
-- Expected: `role` typed as enum with lowercase members, `username` varchar(50),
-- an extra `last_login` column, and no `updated_at`.
SHOW COLUMNS FROM `users`;

-- Expected: an empty set. Any row listed here will block the section-3 ALTER.
SELECT `user_id`, `username`, `role`
FROM   `users`
WHERE  LOWER(`role`) NOT IN ('admin', 'barista', 'owner');

-- Record the starting row count so you can confirm nothing was lost.
SELECT COUNT(*) AS `users_before` FROM `users`;


-- -----------------------------------------------------------------------------
-- 1. Widen `role` to a plain VARCHAR so the labels can be rewritten in place.
--    ('admin'/'barista' are valid VARCHAR values; no data is altered yet.)
-- -----------------------------------------------------------------------------
ALTER TABLE `users`
    MODIFY COLUMN `role` VARCHAR(20) NOT NULL;


-- -----------------------------------------------------------------------------
-- 2. Normalise the legacy vocabulary to Rev 2.3.
--    Mapping assumption: the legacy 'admin' role is the venue owner. Adjust the
--    CASE below if your 'admin' accounts are actually store managers/baristas.
-- -----------------------------------------------------------------------------
UPDATE `users`
SET    `role` = CASE LOWER(TRIM(`role`))
                    WHEN 'admin'  THEN 'OWNER'
                    WHEN 'owner'  THEN 'OWNER'
                    WHEN 'barista' THEN 'BARISTA'
                    ELSE UPPER(TRIM(`role`))   -- unmapped; section 2b will abort on it
                END;


-- -----------------------------------------------------------------------------
-- 2b. Guard: refuse to continue if any value is still outside Rev 2.3.
--     Without this, the section-3 ALTER would silently rewrite the offending
--     value as '' (see the Safety note in the header). SIGNAL aborts the whole
--     script, so the column remains VARCHAR and the original value survives.
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `vv_assert_user_roles_mapped`;

DELIMITER $$
CREATE PROCEDURE `vv_assert_user_roles_mapped`()
BEGIN
    DECLARE unmapped INT DEFAULT 0;

    SELECT COUNT(*) INTO unmapped
    FROM   `users`
    WHERE  `role` NOT IN ('BARISTA', 'OWNER');

    IF unmapped > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'aborted: users.role holds values outside (BARISTA, OWNER) - see the SELECT in section 6';
    END IF;
END$$

DELIMITER ;

CALL `vv_assert_user_roles_mapped`();

-- Reached only when the guard passed. If it aborted instead, this routine is
-- left behind in the schema (SIGNAL ends the script before the DROP); re-running
-- this file removes it via the DROP IF EXISTS above, so the residue is harmless.
DROP PROCEDURE `vv_assert_user_roles_mapped`;


-- -----------------------------------------------------------------------------
-- 3. Re-tighten to the Rev 2.3 ENUM, matching database/schema.sql exactly.
--    Only reached when section 2b proved every row is already mapped.
-- -----------------------------------------------------------------------------
ALTER TABLE `users`
    MODIFY COLUMN `role` ENUM('BARISTA', 'OWNER') NOT NULL DEFAULT 'BARISTA';


-- -----------------------------------------------------------------------------
-- 4. Align `username` with schema.sql (VARCHAR(64)).
--    NOTE: the live rows hold email-style usernames such as
--    'owner@venuevue.local'. They still authenticate as typed - only the column
--    width changes here. If you want short operator handles ('owner',
--    'barista'), update the values deliberately and separately; that is not a
--    schema concern and is intentionally left out of this migration.
-- -----------------------------------------------------------------------------
ALTER TABLE `users`
    MODIFY COLUMN `username` VARCHAR(64) NOT NULL;

-- The live install already carries a UNIQUE KEY named `username` and the
-- single-column indexes `idx_users_active` / `idx_users_role`. schema.sql names
-- them `uq_users_username` / `idx_users_role_active`; reconciling the names is
-- cosmetic (the columns are already covered) and is left as an explicit choice:
-- CREATE UNIQUE INDEX `uq_users_username` ON `users` (`username`);
-- CREATE INDEX `idx_users_role_active` ON `users` (`role`, `is_active`);

-- Rev 2.3 tracks `updated_at`; a drifted table may lack it.
-- ALTER TABLE `users`
--     ADD COLUMN `updated_at` TIMESTAMP NOT NULL
--         DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;


-- -----------------------------------------------------------------------------
-- 5. OPTIONAL - drop the legacy `last_login` column.
--    Rev 2.3 derives last-login from audit_logs, so the column is redundant.
--    Commented out because it destroys data; uncomment only after you have
--    confirmed nothing else reads it.
-- -----------------------------------------------------------------------------
-- ALTER TABLE `users` DROP COLUMN `last_login`;


-- -----------------------------------------------------------------------------
-- 6. Post-verification
-- -----------------------------------------------------------------------------
-- Expected: role is `enum('BARISTA','OWNER')`, username is varchar(64).
SHOW COLUMNS FROM `users`;

-- Expected: zero rows.
SELECT `user_id`, `username`, `role`
FROM   `users`
WHERE  `role` NOT IN ('BARISTA', 'OWNER');

-- Expected: same value as `users_before` in section 0.
SELECT COUNT(*) AS `users_after` FROM `users`;

-- Expected: one row per operator, roles in the Rev 2.3 vocabulary.
SELECT `user_id`, `username`, `role`, `is_active` FROM `users` ORDER BY `user_id`;


-- =============================================================================
-- Rollback (only valid while the values are still 'BARISTA'/'OWNER')
-- =============================================================================
--   ALTER TABLE `users` MODIFY COLUMN `role` VARCHAR(20) NOT NULL;
--   UPDATE `users` SET `role` = CASE `role`
--       WHEN 'OWNER' THEN 'admin' WHEN 'BARISTA' THEN 'barista' END;
--   ALTER TABLE `users` MODIFY COLUMN `role` ENUM('admin','barista') NOT NULL;
--
-- The full pre-migration state is recoverable from the mysqldump in the header.
--
-- =============================================================================
-- If an existing password hash is unknown, reset it with PHP (never hand-write
-- a bcrypt digest):
--
--   C:\xampp\php\php.exe -r "echo password_hash('NewStrongPass1!', PASSWORD_DEFAULT), PHP_EOL;"
--
-- then:
--   UPDATE users SET password_hash = '<paste>' WHERE username = 'owner';
-- =============================================================================
