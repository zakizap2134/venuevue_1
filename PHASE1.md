# Phase 1: sales and inventory

Implementation branch: `feature/phase1-sales-inventory`, based on `ac70e70`.
This document records the Phase 1 checkpoint. See [PHASE2.md](PHASE2.md) for subsequent management, reporting and backup/restore work. Phase 3 has not been started.

## Confirmed rules

- Exactly two roles: OWNER (Owner/Admin) and BARISTA. Both can use Register; only OWNER can use Management or its APIs. Baristas see only their own local pending records.
- Each product variant has its own S/M/L size (12/16/22 oz), temperature (HOT, ICED, or NA), price and explicit recipe. Milk substitutions, add-ons, discounts and VAT-exempt items have no selling UI.
- Inventory uses ingredient base units `g`, `mL`, or `units`, measured to three decimal places. On-hand includes expired stock until an owner records waste; eligible stock excludes expired or quarantined quantities. Low-stock warnings use eligible quantities.
- A delivery batch contains individual containers. Enter the number of containers and the quantity in each (e.g. 5 cartons × 1,000 mL). Each container keeps its own opened-at/use-by clock. Batch sealed/opened totals are derived from container remainders. No batch-wide clock incorrectly expires unopened cartons.
- Opened eligible containers are consumed before sealed ones. Within each group, use earliest expiration first (NULL expiration last), then use-by, then container ID. This resolves the overlap between the requested opened-first rule and FEFO.
- Expiration dates use Asia/Manila. Expiring today is eligible through end of day; opened use-by is an exact timestamp and is blocked at or after that instant. One authoritative server timestamp, captured after obtaining the workflow lock, governs the entire sale. Pending orders are assessed when confirmed, not backdated to a device clock.
- Owner UI offers the requested 48/72/720/168-hour presets; each ingredient can be edited. Existing open containers retain their original use-by snapshot when an ingredient's setting changes.
- All prices include 12% VAT. Centavos are integers. Each line is rounded half-up; the last line receives the residual necessary to reconcile to rounded invoice-level net. A many-line basket can produce a residual greater than one cent. Impossible negative/out-of-range final allocations are rejected. Historical totals and rate are stored, never derived from current settings.

## Data and transaction design

Existing `orders` and `order_items` names are retained. `order_items` implements the requested sale-item fields (`variant_id`, `quantity`, `unit_price`, `line_gross`, `line_net`, `line_vat`); `orders` stores sale-level gross/net/VAT/rate. `product_variants`, `recipes`, `stock_batches` and `stock_containers` are additive tables. Existing `recipe_items` is retained as legacy data; it no longer authorizes checkout.

A single InnoDB workflow-lock row serializes stock/catalogue writes for the small, local multi-tablet installation. This favors correctness over high-throughput parallelism. All app writers acquire it first. Sales validate active variants, displayed prices, explicit recipes, cash and all eligible ingredient quantities before the first write. Sale, items, opening metadata, container and batch quantities, ingredient cache, movement ledger and required audit writes commit in one transaction. Ledger/audit failure rolls everything back.

Transaction UUID plus a hash of the normalized request prevents a retry from changing the sale or claiming another staff member's sale. A committed replay returns its stored receipt before revalidating menu prices, availability or expiration. A rejected sale receives a review outcome. No partial deductions occur.

The client stores each submitted order in IndexedDB **before** calling sync.php. Records persist across reloads, carry one stable UUID, and are scoped by staff ID. Network errors, timeouts, non-JSON errors and server failures remain PENDING. A 401 requires the same user to sign in again. A definitive 400/403/409/422 becomes REVIEW. The immutable rejected record can be marked reviewed; a corrected basket is a new transaction. CONFIRMED records retain the authoritative receipt.

Browsers cannot guarantee retention after someone clears site data, uses a temporary/private profile, or loses the device. Use the same browser/profile and origin on each tablet. Plain LAN HTTP cannot provide service-worker offline shell loading: a reload while the host is unreachable may wait until the host returns, but the saved order remains in IndexedDB. The app retries while Register is open, every 15 seconds, on reconnection events, and manually.

## Setup and migration

Back up the local database first; DDL is not transactional. Stop old application writers during migration. Do not execute migrations or test fixtures against a live client database without a verified backup.

Fresh installation, from the repository root (MySQL client may be `mariadb` on Linux):

```sh
mysql -u root -p < database/schema.sql
mysql -u root -p venuevue < database/migrations/001_catalogue_prerequisites.sql
mysql -u root -p venuevue < database/migrations/003_sync_engine_tables.sql
php backend/tools/migrate_phase1.php
php backend/tools/create_user.php
npm ci
npm run build
```

`create_user.php` prompts for the initial owner username and password and issues an offline recovery code. It only runs when the account table is empty; existing accounts cannot be reset or replaced through it. Never use test passwords for a client install. DB connection variables are `VENUEVUE_DB_HOST`, `VENUEVUE_DB_PORT`, `VENUEVUE_DB_NAME`, `VENUEVUE_DB_USER`, `VENUEVUE_DB_PASS`.

For an existing Rev 2.3 database already migrated through 003, run **only** `php backend/tools/migrate_phase1.php` after backup. The Phase 1 migration can resume safely after interruption. Migration 003's preconditions were also fixed for reruns and case-sensitive legacy-unit detection. Do not run old demo seed files after moving to batch stock: they reset aggregate quantities without updating batches.

No size, temperature, recipe, expiration, container size or historical VAT is guessed during migration. Existing products need explicit variants and recipes. Existing aggregate stock is shown as **unallocated** and is not sellable. In Management → Inventory, select “Allocate existing legacy stock,” verify actual containers/expiration, and enter them. This records paired adjustment movements with net zero change to on-hand. Unknown or spoiled legacy stock must be reconciled from a physical count before use. Historical orders without VAT snapshots remain untouched and are excluded from new VAT reports.

For development, start PHP on localhost port 8000 and Vite on 5173 (the existing Windows launcher does this). Vite proxies `/backend` to PHP. For production, serve `dist` and `backend` under the same Apache origin, use SPA fallback for frontend routes only, and keep `tests`, SQL, documentation and development tooling outside the web root. PHP tools are CLI-only and Apache denies internal `lib`/`tools` paths.

## Owner recovery

1. While signed in, open Management → Staff & recovery and issue a recovery code using the current owner password.
2. Store the displayed code offline, separate from the database backup. Only its password hash is stored. Issuing another invalidates the previous code.
3. If locked out, access the trusted host console and run `php backend/tools/recover_owner.php`.
4. Enter the owner username, code, and new password at the prompts. Input is visible; use a private console. Secrets are not command arguments or audit details.
5. Successful recovery consumes the code, replaces the password, revokes all owner sessions and prints a replacement recovery code. Store the new code offline.

There is no email dependency or unauthenticated web reset. Without a previously issued code, recovery requires the operator's separate database-administration/backup procedure; no password bypass is included. Staff resets are owner-only, cannot target OWNER, and revoke all sessions for that Barista. Their local pending orders can resume after reauthentication as the same staff user.

## Tests and demo

```sh
npm test
npm run build
# Disposable test database only; mysql/php must be installed.
VV_TEST_DB_PORT=3307 python tests/integration.py
# Include browser checks after installing the Playwright browser:
npx playwright install chromium
VV_TEST_DB_PORT=3307 VV_BROWSER_TEST=1 python tests/integration.py
# Reproduce original-engine behavior from the recorded base commit:
VV_TEST_DB_PORT=3307 python tests/integration.py --baseline
```

The runner creates/drops only `venuevue_phase1_test`, uses test-only accounts, and requires a local MySQL/MariaDB instance reachable as root on the test port. Optional `VV_TEST_START_DB=1`, `MYSQLD`, `MYSQL_BASE`, `MYSQL_DATA`, `MYSQL`, and `PHP` let a developer start an already initialized disposable local server. Never set its data directory to a production directory.

Demo sequence: create ingredients → create product and explicit variant → save recipe → receive separately dated containers → open Register → select size → enter cash → Charge → Confirm sale → show itemized receipt → Management stock/movements → Sales totals/CSV. Then demonstrate a pending order retry and an expired container blocked from checkout.

## Scope and limitations

- This phase includes the requested live sales history, daily/period VAT totals and CSV because they are necessary to verify the confirmed tax rules. The daily summary is a project report, not a certified fiscal Z-reading or a claim of BIR compliance. Tax treatment follows the supplied business rules.
- Backup/restore UI, broader settings and later-phase features have not been implemented here. Owner permissions do not imply those features are complete. Backups remain a documented host operation.
- Stock is opened automatically at first consumption as specified. The operator must not open a container in advance without reflecting the actual handling workflow; a separate manual-open feature is not part of this phase.
- Validation uses a disposable local database and test ingredients. Client recipe quantities, prices, expiration dates and physical stock still require client validation. Real Windows/XAMPP and tablet-device UAT remain necessary before deployment.
