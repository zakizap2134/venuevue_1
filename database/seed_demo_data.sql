-- =============================================================================
-- VenueVue 2.3 - demo master data for the order-ingestion engine
-- =============================================================================
-- Purpose
--   `backend/sync.php` resolves prices from `products`, aggregates ingredient
--   requirements from `recipe_items`, locks and decrements `ingredients`, and
--   raises low-stock alerts. With empty master tables the engine is not
--   demonstrable: every order fails with 422 ("Product not found or inactive").
--   This file loads the minimum master data needed to exercise the engine, using
--   the exact figures from the plan's worked example (§4.1.7) so that the
--   documented outcome can be reproduced and checked:
--
--     One 16oz Iced Salted Caramel Latte (product 12, P170.00)
--   + one Americano (product 5, P120.00), during event 7, cash P500.00
--       => total_amount 290.00, change_due 210.00
--       => espresso beans aggregated to 36 g from the two recipes
--       => 201 Created with duplicate:false, or 200 OK with duplicate:true on
--          an identical replay (no second deduction)
--
--   It also provisions two deliberate fixtures so the engine's failure paths are
--   testable without editing data mid-run:
--     * `Matcha Powder` (15 g on hand, 20 g required per Matcha Latte)  -> 409
--     * `Caramel Syrup` sits at or below its minimum                    -> the
--       `low_stock` array in every 201 response is non-empty
--
-- THIS IS DEMONSTRATION DATA, NOT PRODUCTION DATA.
--   It is safe to run against the development database on this XAMPP install.
--   To remove it and return to empty master tables, see the block at the end of
--   this file. `users`, `api_sessions` and `audit_logs` are deliberately NOT
--   touched - the operator accounts created by backend/tools/create_user.php
--   stay exactly as they are.
--
-- Prerequisite: migration 003_sync_engine_tables.sql must have been applied.
--
-- Idempotent: yes. Every insert uses an explicit primary key and re-running
-- updates the canonical values rather than duplicating them. Ingredient stock
-- levels ARE reset on each run, which is intentional: it makes the file a
-- reliable fixture reset after a test pass has drawn stock down.
--
-- Run from the XAMPP shell (note the redirection, not `-e`):
--   cmd /c ""C:\xampp\mysql\bin\mysql.exe" -u root venuevue ^< database\seed_demo_data.sql"
-- =============================================================================

USE `venuevue`;

SET NAMES utf8mb4;

-- -----------------------------------------------------------------------------
-- 1. EVENTS - the worked example's event 7
-- -----------------------------------------------------------------------------
INSERT INTO `events` (`event_id`, `event_name`, `venue`, `event_date`, `start_time`, `end_time`, `duration_hours`, `status`, `notes`)
VALUES (7, 'Acoustic Night', 'TravelBean MNL - Function Hall', '2026-11-14', '16:00:00', '23:00:00', 7.00, 'ACTIVE',
        'Demo event used by the order-ingestion worked example.')
ON DUPLICATE KEY UPDATE `event_name` = VALUES(`event_name`), `status` = VALUES(`status`);

INSERT INTO `events` (`event_id`, `event_name`, `venue`, `event_date`, `status`)
VALUES (8, 'Weekend Pop-up Market', 'TravelBean MNL - Courtyard', '2026-11-21', 'PLANNED')
ON DUPLICATE KEY UPDATE `event_name` = VALUES(`event_name`), `status` = VALUES(`status`);


-- -----------------------------------------------------------------------------
-- 2. PRODUCTS - the worked example's menu lines plus the 409 fixture
--    Explicit ids 5 and 12 match the worked example exactly.
-- -----------------------------------------------------------------------------
INSERT INTO `products` (`product_id`, `product_name`, `category`, `unit_price`, `is_active`) VALUES
    (5,  'Americano',                 'Coffee',    120.00, 1),
    (12, 'Iced Salted Caramel Latte', 'Signature', 170.00, 1),
    (20, 'Matcha Latte',              'Signature',  180.00, 1),
    (21, 'Spanish Latte',             'Signature',  165.00, 1),
    (22, 'Bottled Water',             'Add-ons',     40.00, 1)
ON DUPLICATE KEY UPDATE
    `product_name` = VALUES(`product_name`),
    `category`     = VALUES(`category`),
    `unit_price`   = VALUES(`unit_price`),
    `is_active`    = VALUES(`is_active`);


-- -----------------------------------------------------------------------------
-- 3. INGREDIENTS - units per Rev 2.3 ('g', 'mL', 'units')
--    Stock levels are the fixture baseline and are reset on every run.
-- -----------------------------------------------------------------------------
INSERT INTO `ingredients`
    (`ingredient_id`, `ingredient_name`, `unit`, `current_stock`, `minimum_stock`, `unit_cost`, `is_active`) VALUES
    (1, 'Espresso Beans', 'g',     2000.000,  500.000, 0.9000, 1),
    (2, 'Full-cream Milk', 'mL',   5000.000, 1000.000, 0.0700, 1),
    (3, 'Caramel Syrup',  'mL',     120.000,  250.000, 0.3200, 1),   -- deliberately below minimum
    (4, 'Cup (16oz)',     'units',  300.000,  100.000, 6.5000, 1),
    (5, 'Dome Lid',       'units',  300.000,  100.000, 1.8000, 1),
    (6, 'Straw',          'units',  500.000,  150.000, 0.4000, 1),
    (7, 'Matcha Powder',  'g',       15.000,   50.000, 3.1000, 1)    -- deliberately short: 409 fixture
ON DUPLICATE KEY UPDATE
    `ingredient_name` = VALUES(`ingredient_name`),
    `unit`            = VALUES(`unit`),
    `current_stock`   = VALUES(`current_stock`),
    `minimum_stock`   = VALUES(`minimum_stock`),
    `unit_cost`       = VALUES(`unit_cost`),
    `is_active`       = VALUES(`is_active`);


-- -----------------------------------------------------------------------------
-- 4. RECIPE_ITEMS - consumption per single unit sold (plan §4.1.7)
--    Espresso Beans appear in two recipes on purpose: that is what exercises the
--    per-ingredient aggregation step (18 g + 18 g = 36 g, one lock, one ledger
--    row, one decrement).
-- -----------------------------------------------------------------------------
INSERT INTO `recipe_items` (`product_id`, `ingredient_id`, `quantity_required`) VALUES
    -- Americano: espresso only
    (5,  1,  18.000),
    -- Iced Salted Caramel Latte
    (12, 1,  18.000),
    (12, 2, 200.000),
    (12, 3,  30.000),
    (12, 4,   1.000),
    (12, 5,   1.000),
    (12, 6,   1.000),
    -- Matcha Latte: 20 g matcha against 15 g on hand -> HTTP 409
    (20, 7,  20.000),
    (20, 2, 200.000),
    (20, 4,   1.000),
    (20, 5,   1.000),
    -- No recipe rows at all for Spanish Latte (21) or Bottled Water (22):
    -- a product with an empty recipe must still be sellable.
    (21, 1,  18.000),
    (21, 2, 150.000),
    (21, 4,   1.000)
ON DUPLICATE KEY UPDATE `quantity_required` = VALUES(`quantity_required`);


-- -----------------------------------------------------------------------------
-- 5. Verification (read-only)
-- -----------------------------------------------------------------------------
-- Expected: products 5, 12, 20, 21, 22 with the prices from the worked example.
SELECT `product_id`, `product_name`, `category`, `unit_price`, `is_active`
  FROM `products` ORDER BY `product_id`;

-- Expected: the two deliberately low rows (Caramel Syrup, Matcha Powder) are
-- exactly the ones returned by the engine's low_stock query.
SELECT `ingredient_id`, `ingredient_name`, `unit`, `current_stock`, `minimum_stock`
  FROM `ingredients` WHERE `current_stock` <= `minimum_stock` ORDER BY `ingredient_id`;

-- Expected for product 12: six rows; product 5: one row totalling 18 g of
-- ingredient 1.
SELECT `product_id`, COUNT(*) AS `recipe_lines`, SUM(`quantity_required`) AS `total_required`
  FROM `recipe_items` GROUP BY `product_id` ORDER BY `product_id`;


-- =============================================================================
-- 6. Removing the demo data
-- =============================================================================
-- Order matters: ledger -> line items -> orders -> recipes -> master data.
-- `orders` has a RESTRICT foreign key to `users`, so operator accounts survive;
-- `order_items` and `inventory_transactions` cascade or follow their parents.
--
--   DELETE FROM `inventory_transactions`;
--   DELETE FROM `order_items`;
--   DELETE FROM `orders`;
--   DELETE FROM `recipe_items`;
--   DELETE FROM `products`;
--   DELETE FROM `ingredients`;
--   DELETE FROM `events`;
--
-- Then reset the auto-increment counters if you want a pristine start:
--   ALTER TABLE `products`  AUTO_INCREMENT = 1;
--   ALTER TABLE `events`    AUTO_INCREMENT = 1;
--   ALTER TABLE `ingredients` AUTO_INCREMENT = 1;
-- =============================================================================
