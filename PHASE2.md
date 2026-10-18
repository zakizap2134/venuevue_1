# Phase 2: owner management and reporting

Branch: `feature/phase2-management`, based on Phase 1 commit `a504a92`.
This branch includes the unmerged Phase 1 implementation. Do not apply Phase 2 alone to the original main branch. No remote push or merge is performed by these changes. Phase 3 is not started.

## Upgrade

1. Stop all register activity, reconcile pending orders, and take a host database backup. Keep the previous code checkout as well. Schema changes are not transactional.
2. If Phase 1 is not installed, follow [PHASE1.md](PHASE1.md), including its migration and owner bootstrap. Do not reload demo seeds over existing inventory.
3. With the application's database environment configured, run:

   ```sh
   php backend/tools/migrate_phase2.php
   npm ci
   npm run build
   ```

4. Deploy the matching `backend` and `dist` together. Sign in as Owner/Admin. Check Overview, stock, reports and a test sale on a disposable copy before using live data.

Phase 2 adds nullable supplier/lot fields and the `restore_jobs` / `safety_backups` tables. The migration is rerunnable. PHP needs PDO MySQL and OpenSSL; MySQL tables must use InnoDB. Preserve the existing deployment protections for internal PHP libraries and CLI tools.

## Owner workflow

| Screen | Supported operations |
|---|---|
| Overview | Actual confirmed sales count, gross/net/VAT, eligible ingredient stock, low-stock alerts and recent receipts for today in Manila time. |
| Inventory | Create/edit ingredients, units, thresholds, active state and opened shelf life; receive containers; allocate legacy stock; positive/negative adjustments; waste with reason. |
| Catalogue | Create/edit products and variants; S/M/L, HOT/ICED/NA, unique SKU, VAT-inclusive price and active state. Delete unused records only. |
| Recipes | Maintain explicit ingredient quantities for each variant. Clearing a recipe disables that variant for sale until configured again. |
| Batches | Search ingredient/supplier/lot, view received/remaining/sealed/opened quantities and expiration, include exhausted batches, correct metadata or quarantine with an audit reason. |
| Sales | Daily summary, date-range report, sale/item gross/net/VAT detail, output VAT figure, CSV with totals and printable report. |
| Audit | Search/date-filter actor-attributed audit events and stock movements, 30 records per page. |
| Backup & restore | Encrypted download, password-verified preview, explicit restore confirmation and downloadable pre-restore safety copies. |

Baristas remain register-only. All management mutation APIs independently enforce owner access. Inventory movements store actor and timestamp. Quantities are changed only through movements, not arbitrary batch edits. Used ingredients cannot change base units; used catalogue records should be archived, not deleted. Existing opened containers retain their original use-by timestamps when shelf-life settings change.

The daily summary is a **course-project Z-reading-style report**, not a certified fiscal Z-reading, cash-drawer close or BIR compliance claim. The remittance figure is output VAT from these sales, not a calculation of tax payable after input credits. Historical sales without VAT snapshots are excluded and explicitly disclosed in the UI. Stored sale-time VAT remains unchanged by current price/recipe edits or restore.

## Backup and restore procedure

Application backups contain business tables and account hashes, encrypted using AES-256-GCM with a separately entered 12–200-character backup password. Files are authenticated; wrong passwords and modified ciphertext are rejected. Keep the password separately. It cannot be recovered by the application.

1. Stop sales on **every tablet**. Resolve pending/review orders and record the intended restore point. Do not blindly replay device orders against an older database snapshot: the restored database cannot know about confirmations made after its backup.
2. Enter the current owner password and a backup password in Management → Backup & restore. Download a backup and keep it off the host.
3. To restore, choose the matching encrypted JSON file, enter its backup password, and select Preview restore. Review its date and per-table row counts.
4. Type `RESTORE`. The preview token is tied to this session and expires in 10 minutes. The server first saves an encrypted snapshot of the current database, then replaces allowed business tables inside one transaction. No uploaded SQL is executed, no foreign-key checks are disabled, and failure rolls back the replacement.
5. All sessions are revoked after success. Sign in again. The restoring owner's current password and recovery-code hash are retained; other account records come from the snapshot. The backup must contain the same active owner username.
6. Download the numbered pre-restore safety backup after signing in. It uses the password entered for that restore. Verify inventory, receipts, staff accounts and VAT totals before reopening registers. Reconcile device pending orders manually first.

Application limits: 24 MB plaintext / 100,000 rows, same schema version, and a matching owner account. Safety backups and preview jobs are not recursively included in application backups. Safety copies remain on the same database host, so they do not protect against disk loss. Keep off-host backups; review their storage usage with the host administrator. The interface lists the newest 20 safety copies.

For host-level disaster recovery or larger databases, use the installed MySQL/MariaDB backup tooling (for example `mysqldump --single-transaction --routines --triggers -u <operator> -p <database> > <backup.sql>`), with a least-privileged backup account and restricted file permissions. Confirm the actual database name from configuration. Test restoration into a separate empty database using the matching code/schema before relying on a backup. Host SQL restore is an administrator procedure, not an application upload feature.

## Verification and demo

```sh
npm test
npm run build
# Requires an isolated local database server, root test access, PHP and mysql CLI.
VV_TEST_DB_PORT=3307 python tests/integration.py --phase2
# Optional real-browser checks; install the Playwright Chromium browser first.
VV_TEST_DB_PORT=3307 VV_BROWSER_TEST=1 VV_PHASE2_BROWSER=1 python tests/integration.py --phase2
```

The runner **drops and recreates `venuevue_phase1_test`**. Use only a disposable test server; never a client database server/data directory. See Phase 1's test instructions for runtime overrides. Browser tests exercise a real restore only in this isolated test database.

Demo: owner creates ingredient → product → variant → recipe → delivery → register cash checkout → remaining batch stock → waste/adjustment → audit actor → daily VAT report/CSV → encrypted backup preview. Demonstrate restore only on a disposable copy, not the client's working data.

Actual client recipe/price/stock validation, Windows/XAMPP installation and physical-tablet acceptance testing remain deployment gates. Automated tests do not replace those checks.
