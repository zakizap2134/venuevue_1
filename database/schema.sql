-- =============================================================================
-- VenueVue 2.3 - User Authentication & Session Management schema
-- MySQL 8.0+ (InnoDB / utf8mb4). 100% self-hosted; no cloud dependencies.
--
-- Run once, e.g. from the XAMPP shell:
--   mysql -u root -p < database/schema.sql
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `venuevue`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_general_ci;

USE `venuevue`;

-- -----------------------------------------------------------------------------
-- users: POS accounts. Roles are strictly 'BARISTA' or 'OWNER'.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
    `user_id`       INT UNSIGNED   NOT NULL AUTO_INCREMENT,
    `username`      VARCHAR(64)    NOT NULL,
    `password_hash` VARCHAR(255)   NOT NULL COMMENT 'bcrypt digest (PASSWORD_DEFAULT / password_hash())',
    `role`          ENUM('BARISTA', 'OWNER') NOT NULL DEFAULT 'BARISTA',
    `is_active`     TINYINT(1)     NOT NULL DEFAULT 1 COMMENT '1 = enabled, 0 = locked / disabled',
    `created_at`    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_id`),
    UNIQUE KEY `uq_users_username` (`username`),
    KEY `idx_users_role_active` (`role`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- -----------------------------------------------------------------------------
-- api_sessions: only the SHA-256 digest of the bearer token is stored here.
-- The 64-char hex plaintext is returned to the client exactly once at login.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `api_sessions` (
    `session_id` CHAR(36)     NOT NULL COMMENT 'RFC 4122 v4 UUID',
    `user_id`    INT UNSIGNED NOT NULL,
    `token_hash` CHAR(64)     NOT NULL COMMENT 'SHA-256 digest of the raw token',
    `tablet_id`  VARCHAR(64)  NOT NULL,
    `issued_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `expires_at` DATETIME NOT NULL,
    PRIMARY KEY (`session_id`),
    UNIQUE KEY `uq_api_sessions_token_hash` (`token_hash`),
    KEY `idx_api_sessions_user_expires` (`user_id`, `expires_at`),
    KEY `idx_api_sessions_expires` (`expires_at`),
    CONSTRAINT `fk_api_sessions_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- -----------------------------------------------------------------------------
-- audit_logs: authentication & authorization trail.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_logs` (
    `audit_log_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id`      INT UNSIGNED    NULL     DEFAULT NULL COMMENT 'NULL when the actor is unknown',
    `action`       ENUM('LOGIN_OK', 'LOGIN_FAIL', 'RBAC_DENIED') NOT NULL,
    `entity_type`  VARCHAR(64)     NULL     DEFAULT NULL,
    `entity_id`    INT UNSIGNED    NULL     DEFAULT NULL,
    `details`      TEXT            NULL     COMMENT 'free-form JSON context',
    `ip_address`   VARCHAR(45)     NOT NULL,
    `created_at`   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`audit_log_id`),
    KEY `idx_audit_logs_user_action_created` (`user_id`, `action`, `created_at`),
    KEY `idx_audit_logs_action_ip_created` (`action`, `ip_address`, `created_at`),
    KEY `idx_audit_logs_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =============================================================================
-- Optional housekeeping (run daily via cron / Windows Task Scheduler) to prune
-- sessions that have already lapsed:
--
--   DELETE FROM api_sessions WHERE expires_at <= NOW();
--
-- Seed demo accounts from the XAMPP shell - never store plaintext passwords:
--
--   php -r "echo password_hash('change-me-owner', PASSWORD_DEFAULT), PHP_EOL;"
--   php -r "echo password_hash('change-me-barista', PASSWORD_DEFAULT), PHP_EOL;"
--
-- then paste each digest into the INSERT below before running it.
-- =============================================================================
--
-- INSERT INTO `users` (`username`, `password_hash`, `role`, `is_active`)
-- VALUES
--   ('owner',   '<paste bcrypt digest>', 'OWNER',   1),
--   ('barista', '<paste bcrypt digest>', 'BARISTA', 1);
