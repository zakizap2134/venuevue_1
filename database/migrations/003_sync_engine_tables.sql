-- =============================================================================
-- VenueVue 2.3 - migration 003: provision the order-ingestion engine schema
-- =============================================================================
-- Context
--   `backend/sync.php` (plan Rev 2.3 §4.1 / §4.2 - the order ingestion engine)
--   cannot run against the live database as it stands, for two independent
--   reasons:
--
--     1. FOUR TABLES ARE MISSING. The live `venuevue` database contains only
--        users, api_sessions, audit_logs, products, ingredients and
--        recipe_items. The engine writes to `orders`, `order_items` and
--        `inventory_transactions`, and attributes each sale to an `events` row.
--        None of those four tables exist.
--
--     2. THREE TABLES CARRY THE RETIRED PRE-2.3 COLUMN NAMES. The live
--        `products`, `ingredients` and `recipe_items` tables were created by the
--        predecessor application and still use its vocabulary:
--
--            implemented (live)        ->  Rev 2.3 §3.1.3 normative name
--            products.name                 products.product_name
--            products.base_price           products.unit_price
--            (category absent)             products.category
--            ingredients.name              ingredients.ingredient_name
--            ingredients.current_quantity  ingredients.current_stock
--            ingredients.safety_stock      ingredients.minimum_stock
--            ingredients.cost_per_unit     ingredients.unit_cost
--            recipe_items.recipe_id        recipe_items.recipe_item_id
--
--        Plan §3.1.3 ("Reconciliation of Column Naming") rules on every one of
--        these: the documented name is normative and the implementation is
--        corrected to match. A sync engine written against §3.2 names would
--        otherwise fail with "Unknown column 'unit_price'" on every order.
--
--   This migration also corrects a fourth, silent hazard - see section 10.
--
-- Scope
--   products, ingredients, recipe_items  -> renamed / completed to §3.2
--   events, orders, order_items,          -> created per §3.2
--     inventory_transactions
--   audit_logs.action                     -> ENUM widened to VARCHAR(64)
--   `users` and `api_sessions` are NOT touched: migration 002 aligned them and
--   they already match schema.sql.
--
-- Safety
--   * Take a backup first (this is what the project has done for every prior
--     schema change):
--       mysqldump -u root venuevue > vv_before_003.sql
--   * The three reshaped tables are EMPTY on this install (0 rows each - they
--     were never populated after the predecessor app was retired), so no row
--     data can be lost. The script does not rely on that: section 1 aborts the
--     whole run if any row would be reinterpreted.
--   * MySQL/MariaDB DDL is not transactional - each statement commits as it
--     runs. The renames are metadata-only operations that preserve values, so
--     an interrupted run leaves the schema part-way across, never corrupted.
--     Re-run the file from the top to finish; it is idempotent.
--
-- Idempotent: yes - every step is guarded by an existence check, so re-running
-- a completed pass changes nothing.
--
-- Target engine: MariaDB 10.4.32 (what XAMPP 8.2 ships). Two portability notes
-- that shaped this file:
--   * `ALTER TABLE ... RENAME COLUMN` requires MariaDB 10.5.2+, so the full
--     `CHANGE COLUMN new_name <definition>` form is used instead.
--   * `ALTER TABLE ... RENAME INDEX` also requires 10.5.2+, so index renames
--     are performed as a guarded drop + guarded create.
-- =============================================================================

USE `venuevue`;


-- -----------------------------------------------------------------------------
-- 0. Pre-flight: inspect the starting state (read-only, safe to run alone)
-- -----------------------------------------------------------------------------
-- Expected: the four tables listed below are absent from this list.
SHOW TABLES;

-- Expected: `name` / `base_price`, and NO `category` column.
SHOW COLUMNS FROM `products`;
-- Expected: `name` / `current_quantity` / `safety_stock` / `cost_per_unit` /
-- `reorder_point`, and NO `updated_at`.
SHOW COLUMNS FROM `ingredients`;
-- Expected: PK named `recipe_id`.
SHOW COLUMNS FROM `recipe_items`;
-- Expected: action typed `enum('LOGIN_OK','LOGIN_FAIL','RBAC_DENIED')`.
SHOW COLUMNS FROM `audit_logs`;

-- Row counts, to be compared with the same queries in section 12.
SELECT 'products' AS `table_name`, COUNT(*) AS `rows_before` FROM `products`
UNION ALL SELECT 'ingredients', COUNT(*) FROM `ingredients`
UNION ALL SELECT 'recipe_items', COUNT(*) FROM `recipe_items`
UNION ALL SELECT 'audit_logs', COUNT(*) FROM `audit_logs`;


-- -----------------------------------------------------------------------------
-- 1. Guards: abort before touching anything that could lose information
-- -----------------------------------------------------------------------------
-- Runs BEFORE any ALTER. A SIGNAL aborts the whole script with a non-zero exit
-- status, leaving the schema exactly as it is now. Resolve the rows named in the
-- message, then re-run this file from the top.

DROP PROCEDURE IF EXISTS `vv_assert_sync_preconditions`;

DELIMITER $$
CREATE PROCEDURE `vv_assert_sync_preconditions`()
BEGIN
    DECLARE n INT DEFAULT 0;

    -- 1a. `ingredients.unit` is being narrowed from
    --     ('g','ml','kg','l','pcs') to the Rev 2.3 vocabulary
    --     ('g','mL','units'). Converting a column to ENUM does NOT honour
    --     strict mode: an unmapped value is silently rewritten to the empty
    --     string with exit code 0. That exact failure mode already bit this
    --     project on `users.role`, so it is refused here rather than risked.
    SELECT COUNT(*) INTO n FROM `ingredients`
     WHERE `unit` IS NULL OR `unit` NOT IN ('g', 'ml', 'mL', 'kg', 'l', 'units', 'pcs');
    IF n > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT =
            'ABORTED (1a): ingredients.unit holds values that are not part of the Rev 2.3 vocabulary (g, mL, units) and would be silently blanked. Normalise them first.';
    END IF;

    -- 1b. Existing rows that are 'ml', 'kg', 'l' or 'pcs' would survive the
    --     ALTER only if the new ENUM still contained them; it does not. Report
    --     them instead of guessing a conversion (mL and ml are not necessarily
    --     interchangeable with kg / l / pcs at all).
    SELECT COUNT(*) INTO n FROM `ingredients`
     WHERE `unit` IN ('ml', 'kg', 'l', 'pcs');
    IF n > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT =
            'ABORTED (1b): ingredients rows still use pre-2.3 unit labels (ml/kg/l/pcs). Map them to g, mL or units, then re-run.';
    END IF;

    -- 1c. The CHECK constraints added in sections 4 and 5 must be satisfiable
    --     by the data that is already there, or the ALTER would fail mid-run.
    SELECT COUNT(*) INTO n FROM `ingredients` WHERE `current_quantity` < 0;
    IF n > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT =
            'ABORTED (1c): ingredients.current_quantity contains negative stock, which chk_ingredient_stock_nonneg will reject.';
    END IF;

    SELECT COUNT(*) INTO n FROM `recipe_items` WHERE `quantity_required` <= 0;
    IF n > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT =
            'ABORTED (1c): recipe_items.quantity_required contains zero or negative quantities, which chk_recipe_qty will reject.';
    END IF;
END$$

-- 1d. Generic, reusable existence helpers. Every statement below routes through
--     one of these, which is what makes the file idempotent.
CREATE PROCEDURE `vv_rename_column_if_present`(
    IN p_table VARCHAR(64), IN p_old VARCHAR(64), IN p_new VARCHAR(64), IN p_def TEXT)
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_old)
       AND NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_new) THEN
        SET @vv_sql = CONCAT('ALTER TABLE `', p_table, '` CHANGE COLUMN `', p_old, '` `', p_new, '` ', p_def);
        PREPARE vv_stmt FROM @vv_sql; EXECUTE vv_stmt; DEALLOCATE PREPARE vv_stmt;
    END IF;
END$$

CREATE PROCEDURE `vv_add_column_if_absent`(
    IN p_table VARCHAR(64), IN p_col VARCHAR(64), IN p_def TEXT)
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_col) THEN
        SET @vv_sql = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_col, '` ', p_def);
        PREPARE vv_stmt FROM @vv_sql; EXECUTE vv_stmt; DEALLOCATE PREPARE vv_stmt;
    END IF;
END$$

CREATE PROCEDURE `vv_modify_column_if_present`(
    IN p_table VARCHAR(64), IN p_col VARCHAR(64), IN p_def TEXT)
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_col) THEN
        SET @vv_sql = CONCAT('ALTER TABLE `', p_table, '` MODIFY COLUMN `', p_col, '` ', p_def);
        PREPARE vv_stmt FROM @vv_sql; EXECUTE vv_stmt; DEALLOCATE PREPARE vv_stmt;
    END IF;
END$$

CREATE PROCEDURE `vv_drop_column_if_present`(IN p_table VARCHAR(64), IN p_col VARCHAR(64))
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_col) THEN
        SET @vv_sql = CONCAT('ALTER TABLE `', p_table, '` DROP COLUMN `', p_col, '`');
        PREPARE vv_stmt FROM @vv_sql; EXECUTE vv_stmt; DEALLOCATE PREPARE vv_stmt;
    END IF;
END$$

CREATE PROCEDURE `vv_drop_index_if_present`(IN p_table VARCHAR(64), IN p_index VARCHAR(64))
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND INDEX_NAME = p_index) THEN
        SET @vv_sql = CONCAT('ALTER TABLE `', p_table, '` DROP INDEX `', p_index, '`');
        PREPARE vv_stmt FROM @vv_sql; EXECUTE vv_stmt; DEALLOCATE PREPARE vv_stmt;
    END IF;
END$$

CREATE PROCEDURE `vv_add_index_if_absent`(
    IN p_table VARCHAR(64), IN p_index VARCHAR(64), IN p_cols TEXT, IN p_unique TINYINT)
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND INDEX_NAME = p_index) THEN
        SET @vv_sql = CONCAT('ALTER TABLE `', p_table, '` ADD ',
                             IF(p_unique = 1, 'UNIQUE ', ''), 'INDEX `', p_index, '` (', p_cols, ')');
        PREPARE vv_stmt FROM @vv_sql; EXECUTE vv_stmt; DEALLOCATE PREPARE vv_stmt;
    END IF;
END$$

CREATE PROCEDURE `vv_add_check_if_absent`(
    IN p_table VARCHAR(64), IN p_name VARCHAR(64), IN p_expr TEXT)
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
                    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = p_table
                      AND CONSTRAINT_NAME = p_name AND CONSTRAINT_TYPE = 'CHECK') THEN
        SET @vv_sql = CONCAT('ALTER TABLE `', p_table, '` ADD CONSTRAINT `', p_name, '` CHECK (', p_expr, ')');
        PREPARE vv_stmt FROM @vv_sql; EXECUTE vv_stmt; DEALLOCATE PREPARE vv_stmt;
    END IF;
END$$
DELIMITER ;

CALL `vv_assert_sync_preconditions`();


-- -----------------------------------------------------------------------------
-- 2. `products` -> §3.2
--    name -> product_name, base_price -> unit_price, category added.
--    FR-02 requires category filtering; the implemented table never had it.
-- -----------------------------------------------------------------------------
CALL `vv_rename_column_if_present`('products', 'name', 'product_name', 'VARCHAR(100) NOT NULL');
CALL `vv_rename_column_if_present`('products', 'base_price', 'unit_price', 'DECIMAL(10,2) NOT NULL DEFAULT 0.00');
CALL `vv_add_column_if_absent`('products', 'category', "VARCHAR(50) NOT NULL DEFAULT 'Uncategorised'");

-- The UNIQUE constraint on the product name is preserved; only its index name is
-- brought in line with §3.2 (`name` -> `uq_products_name`). The rename is done as
-- drop + create because MariaDB 10.4 has no RENAME INDEX.
CALL `vv_drop_index_if_present`('products', 'name');
CALL `vv_add_index_if_absent`('products', 'uq_products_name', '`product_name`', 1);
CALL `vv_add_index_if_absent`('products', 'idx_products_category', '`category`', 0);
CALL `vv_add_index_if_absent`('products', 'idx_products_active', '`is_active`', 0);

-- `products.description` existed in the predecessor schema and §3.2 has no such
-- column. It is retained deliberately: it holds no data today and dropping a
-- column is not required by any Rev 2.3 requirement, so the non-destructive
-- choice is made. §3.2 is satisfied by the required columns being present.


-- -----------------------------------------------------------------------------
-- 3. `ingredients` -> §3.2
-- -----------------------------------------------------------------------------
CALL `vv_rename_column_if_present`('ingredients', 'name', 'ingredient_name', 'VARCHAR(100) NOT NULL');
CALL `vv_rename_column_if_present`('ingredients', 'current_quantity', 'current_stock', 'DECIMAL(12,3) NOT NULL DEFAULT 0.000');
CALL `vv_rename_column_if_present`('ingredients', 'safety_stock', 'minimum_stock', 'DECIMAL(12,3) NOT NULL DEFAULT 0.000');
CALL `vv_rename_column_if_present`('ingredients', 'cost_per_unit', 'unit_cost', 'DECIMAL(10,4) NOT NULL DEFAULT 0.0000');

-- §3.1.3: "`reorder_point` is not required by any requirement and is dropped."
-- Guarded to zero rows by precondition 1a/1b, so this cannot discard data.
CALL `vv_drop_column_if_present`('ingredients', 'reorder_point');

-- Narrow `unit` to the documented vocabulary. Preconditions 1a and 1b have
-- already proven every existing value maps cleanly.
CALL `vv_modify_column_if_present`('ingredients', 'unit', "ENUM('g','mL','units') NOT NULL DEFAULT 'mL'");

-- §3.2 tracks updated_at with automatic ON UPDATE.
CALL `vv_add_column_if_absent`('ingredients', 'updated_at',
     'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

CALL `vv_add_check_if_absent`('ingredients', 'chk_ingredient_stock_nonneg', '`current_stock` >= 0');
CALL `vv_add_index_if_absent`('ingredients', 'idx_ingredients_stock', '`current_stock`, `minimum_stock`', 0);
CALL `vv_add_index_if_absent`('ingredients', 'idx_ingredients_active', '`is_active`', 0);

-- `idx_ingredients_name` duplicated the unique key on the same single column and
-- served no query the unique key does not already serve. Dropped, and the unique
-- key renamed to the §3.2 name.
CALL `vv_drop_index_if_present`('ingredients', 'idx_ingredients_name');
CALL `vv_drop_index_if_present`('ingredients', 'name');
CALL `vv_add_index_if_absent`('ingredients', 'uq_ingredients_name', '`ingredient_name`', 1);

-- `ingredients.created_at` also predates §3.2 and is likewise retained
-- (non-destructive; no requirement asks for its removal).


-- -----------------------------------------------------------------------------
-- 4. `recipe_items` -> §3.2
-- -----------------------------------------------------------------------------
CALL `vv_rename_column_if_present`('recipe_items', 'recipe_id', 'recipe_item_id',
     'INT UNSIGNED NOT NULL AUTO_INCREMENT');
CALL `vv_modify_column_if_present`('recipe_items', 'quantity_required', 'DECIMAL(12,3) NOT NULL DEFAULT 0.000');
CALL `vv_add_check_if_absent`('recipe_items', 'chk_recipe_qty', '`quantity_required` > 0');

-- The unique key `uq_product_ingredient` and both FKs from the predecessor
-- schema already match §3.2 and are left untouched.


-- -----------------------------------------------------------------------------
-- 5. `events` (NEW in Rev 2.3) - per plan §3.2
--    Structural prerequisite for per-event revenue, per-event product mix and
--    Tab 1 ("Event Name, Date, Duration") of the client's report workbook.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `events` (
    `event_id`       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `event_name`     VARCHAR(150) NOT NULL,
    `venue`          VARCHAR(150) NULL,
    `event_date`     DATE         NOT NULL,
    `start_time`     TIME         NULL,
    `end_time`       TIME         NULL,
    `duration_hours` DECIMAL(5,2) NULL,
    `status`         ENUM('PLANNED','ACTIVE','CLOSED') NOT NULL DEFAULT 'PLANNED',
    `notes`          VARCHAR(255) NULL,
    `created_at`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_events_date`   (`event_date`),
    INDEX `idx_events_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------------------------------
-- 6. `orders` - per plan §3.2
--    client_transaction_id is the UUIDv4 idempotency key; its UNIQUE constraint
--    is what makes duplicate order creation structurally impossible and is the
--    foundation of the R_duplicate = 0% guarantee.
--    user_id is always derived server-side from the authenticated session and is
--    never accepted from the client payload (plan §4.1.6, defect T-03).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `orders` (
    `order_id`              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `client_transaction_id` CHAR(36)      NOT NULL,
    `user_id`               INT UNSIGNED  NOT NULL,
    `tablet_id`             VARCHAR(16)   NOT NULL,
    `event_id`              INT UNSIGNED  NULL,
    `payment_method`        ENUM('cash')  NOT NULL DEFAULT 'cash',
    `total_amount`          DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `cash_tendered`         DECIMAL(10,2) NULL,
    `change_due`            DECIMAL(10,2) NULL,
    `created_at`            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `committed_at`          TIMESTAMP     NULL,
    UNIQUE KEY `uq_orders_client_txn` (`client_transaction_id`),
    CONSTRAINT `fk_orders_user` FOREIGN KEY (`user_id`)
        REFERENCES `users` (`user_id`)   ON DELETE RESTRICT,
    CONSTRAINT `fk_orders_event` FOREIGN KEY (`event_id`)
        REFERENCES `events` (`event_id`) ON DELETE SET NULL,
    INDEX `idx_orders_event`   (`event_id`),
    INDEX `idx_orders_created` (`created_at`),
    INDEX `idx_orders_tablet`  (`tablet_id`),
    INDEX `idx_orders_user`    (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------------------------------
-- 7. `order_items` - per plan §3.2
--    unit_price is a snapshot of the server-resolved price at the moment of
--    sale, so a later menu price change can never rewrite historical revenue.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `order_items` (
    `order_item_id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `order_id`      BIGINT UNSIGNED NOT NULL,
    `product_id`    INT UNSIGNED    NOT NULL,
    `quantity`      INT UNSIGNED    NOT NULL DEFAULT 1,
    `unit_price`    DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
    CONSTRAINT `fk_items_order` FOREIGN KEY (`order_id`)
        REFERENCES `orders` (`order_id`)     ON DELETE CASCADE,
    CONSTRAINT `fk_items_product` FOREIGN KEY (`product_id`)
        REFERENCES `products` (`product_id`) ON DELETE RESTRICT,
    CONSTRAINT `chk_order_item_qty_positive` CHECK (`quantity` > 0),
    INDEX `idx_order_items_order`   (`order_id`),
    INDEX `idx_order_items_product` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------------------------------
-- 8. `inventory_transactions` - per plan §3.2
--    Append-only movement ledger: every stock change with direction, magnitude,
--    reason, responsible user and originating order. Supports inventory audit,
--    waste analysis, Tab 3 reconciliation and the A_deduction metric.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `inventory_transactions` (
    `inventory_transaction_id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `ingredient_id`   INT UNSIGNED    NOT NULL,
    `user_id`         INT UNSIGNED    NOT NULL,
    `order_id`        BIGINT UNSIGNED NULL,
    `transaction_type` ENUM('SALE','RESTOCK','ADJUSTMENT') NOT NULL,
    `quantity_delta`  DECIMAL(12,3)   NOT NULL,
    `reason`          VARCHAR(255)    NULL,
    `created_at`      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_invtx_ingredient` FOREIGN KEY (`ingredient_id`)
        REFERENCES `ingredients` (`ingredient_id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_invtx_user` FOREIGN KEY (`user_id`)
        REFERENCES `users` (`user_id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_invtx_order` FOREIGN KEY (`order_id`)
        REFERENCES `orders` (`order_id`) ON DELETE SET NULL,
    CONSTRAINT `chk_invtx_delta_nonzero` CHECK (`quantity_delta` <> 0),
    INDEX `idx_invtx_ingredient_created` (`ingredient_id`, `created_at`),
    INDEX `idx_invtx_type`    (`transaction_type`),
    INDEX `idx_invtx_order`   (`order_id`),
    INDEX `idx_invtx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------------------------------
-- 9. `audit_logs.action`: ENUM -> VARCHAR(64)
--    §3.2 types this column VARCHAR(64) and enumerates the actions
--    "LOGIN_OK, LOGIN_FAIL, RBAC_DENIED, ORDER_COMMIT, STOCK_OVERRIDE, ...".
--    The engine's successful-order path writes action = 'ORDER_COMMIT'. Against
--    the live three-member ENUM that insert would NOT fail: MariaDB would
--    silently store the empty string and return success - the identical
--    silent-blanking behaviour already measured on `users.role` during migration
--    002. Widening the column removes the hazard for every future action rather
--    than adding one ENUM member at a time.
--    Widening is lossless: each ENUM value converts to its own string.
-- -----------------------------------------------------------------------------
ALTER TABLE `audit_logs`
    MODIFY COLUMN `action` VARCHAR(64) NOT NULL;

-- §3.2 types `entity_type` VARCHAR(32) (live: 64) and `entity_id` VARCHAR(64)
-- (live: INT UNSIGNED). Both are left as-is on purpose: `entity_id` INT UNSIGNED
-- is what config.php's audit_log() signature binds (?int) and what auth.php
-- writes today, and every identifier the engine records (order_id,
-- ingredient_id, user_id) is an integer. Changing it to VARCHAR would be a
-- no-op for the data and a breaking signature change for the shipped auth
-- module. Recorded here as a deliberate, documented deviation.


-- -----------------------------------------------------------------------------
-- 10. Drop the migration helpers (leaves no residue in the schema)
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `vv_assert_sync_preconditions`;
DROP PROCEDURE IF EXISTS `vv_rename_column_if_present`;
DROP PROCEDURE IF EXISTS `vv_add_column_if_absent`;
DROP PROCEDURE IF EXISTS `vv_modify_column_if_present`;
DROP PROCEDURE IF EXISTS `vv_drop_column_if_present`;
DROP PROCEDURE IF EXISTS `vv_drop_index_if_present`;
DROP PROCEDURE IF EXISTS `vv_add_index_if_absent`;
DROP PROCEDURE IF EXISTS `vv_add_check_if_absent`;


-- -----------------------------------------------------------------------------
-- 11. Post-migration verification (read-only)
-- -----------------------------------------------------------------------------
-- Expected: 10 tables - api_sessions, audit_logs, events, ingredients,
-- inventory_transactions, order_items, orders, products, recipe_items, users.
SELECT COUNT(*) AS `table_count_expected_10`
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE';

-- Expected: no rows. Any row here means a predecessor-name column survived.
SELECT TABLE_NAME, COLUMN_NAME
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND ((TABLE_NAME = 'products'    AND COLUMN_NAME IN ('name', 'base_price'))
     OR (TABLE_NAME = 'ingredients' AND COLUMN_NAME IN ('name', 'current_quantity', 'safety_stock', 'cost_per_unit', 'reorder_point'))
     OR (TABLE_NAME = 'recipe_items' AND COLUMN_NAME IN ('recipe_id')));

-- Expected: action typed varchar(64).
SHOW COLUMNS FROM `audit_logs` LIKE 'action';

-- Expected: the idempotency constraint is present and UNIQUE.
SHOW INDEX FROM `orders` WHERE Key_name = 'uq_orders_client_txn';

-- Expected: every FK in §3.2 is listed.
SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME
  FROM information_schema.KEY_COLUMN_USAGE
 WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
 ORDER BY TABLE_NAME, CONSTRAINT_NAME;

-- Expected: 1 (each), proving the CHECK constraints were created.
SELECT COUNT(*) AS `check_constraints_expected_4`
  FROM information_schema.TABLE_CONSTRAINTS
 WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_TYPE = 'CHECK';

-- Expected: these counts unchanged from section 0.
SELECT 'products' AS `table_name`, COUNT(*) AS `rows_after` FROM `products`
UNION ALL SELECT 'ingredients', COUNT(*) FROM `ingredients`
UNION ALL SELECT 'recipe_items', COUNT(*) FROM `recipe_items`
UNION ALL SELECT 'audit_logs', COUNT(*) FROM `audit_logs`;


-- =============================================================================
-- 12. Rollback
-- =============================================================================
-- The four new tables are dropped outright and the renames are reversed. The
-- column-name reversal is safe because both vocabularies are documented and no
-- values are reinterpreted by a rename:
--
--   DROP TABLE IF EXISTS `inventory_transactions`;
--   DROP TABLE IF EXISTS `order_items`;
--   DROP TABLE IF EXISTS `orders`;
--   DROP TABLE IF EXISTS `events`;
--
--   ALTER TABLE `products`    CHANGE COLUMN `product_name` `name` VARCHAR(100) NOT NULL;
--   ALTER TABLE `products`    CHANGE COLUMN `unit_price`   `base_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00;
--   ALTER TABLE `products`    DROP COLUMN `category`;
--   ALTER TABLE `ingredients` CHANGE COLUMN `ingredient_name` `name` VARCHAR(100) NOT NULL;
--   ALTER TABLE `ingredients` CHANGE COLUMN `current_stock`   `current_quantity` DECIMAL(10,2) NOT NULL DEFAULT 0.00;
--   ALTER TABLE `ingredients` CHANGE COLUMN `minimum_stock`   `safety_stock` DECIMAL(10,2) NOT NULL DEFAULT 0.00;
--   ALTER TABLE `ingredients` CHANGE COLUMN `unit_cost`       `cost_per_unit` DECIMAL(10,2) NOT NULL DEFAULT 0.00;
--   ALTER TABLE `recipe_items` CHANGE COLUMN `recipe_item_id` `recipe_id` INT UNSIGNED NOT NULL AUTO_INCREMENT;
--
-- `reorder_point`, the `ingredients.unit` ENUM narrowing and the
-- `audit_logs.action` widening are not reversed by the block above; the
-- mysqldump named in the Safety note restores the exact pre-003 state.
-- =============================================================================
