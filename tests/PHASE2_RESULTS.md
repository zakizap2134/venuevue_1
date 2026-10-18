# Phase 2 verification — October 18, 2026

Environment: isolated MariaDB, PHP 8.3 with PDO MySQL/OpenSSL, Node 24, Chromium headless shell. Only the disposable `venuevue_phase1_test` database was recreated. No client database, remote branch or production deployment was changed.

## Passed

- Production Vite build and all eight IndexedDB pending-order unit tests.
- Full Phase 1 integration regression: cash sale/receipt, recipe deductions, rollback on injected ledger failure, idempotent duplicate bursts, concurrent oversell prevention, FEFO/opened stock and expiration boundaries, exact VAT rounding, staff/owner recovery and stock-ledger reconciliation.
- Phase 1 browser regression: actual checkout, interrupted order survives reload and reconnect, owner screens, receipt/report and tablet-width layout.
- Phase 2 migration reruns without duplicate-column/table failures.
- Ingredient CRUD and safe unit/history restrictions; variant size/temperature/SKU/price/active editing; explicit recipe save/clear; deletion of unused records and refusal to delete sale-referenced variants.
- Supplier/lot stock-in, batch sealed/opened totals, metadata corrections, quarantine, owner-attributed negative adjustment.
- Database-backed dashboard matches report totals; owner-only access; searched and empty audit/stock history.
- Encrypted backup requires current owner credentials; rejects wrong backup password and modified ciphertext.
- Restore requires typed confirmation. An injected SQL trigger failure after table deletion rolls back records **and sessions**, preserving a product created after the backup.
- Successful restore removes post-snapshot records, preserves current owner credentials, revokes old sessions, creates a downloadable safety backup and rejects reuse of the preview token.
- Restored historical VAT rows exactly match the snapshot and prior transaction IDs remain idempotent.
- Phase 2 real-browser flow: create ingredient/product/variant/recipe/delivery without SQL → sell configured variant → check remaining batch quantity → correct supplier → record waste → find actor in audit → show empty filter result → daily report and real CSV download → encrypted backup download → preview → guarded restore.
- No browser JavaScript errors; no document horizontal overflow at 768px. Overview, batch and report screenshots reviewed.

## Still required before deployment

- Windows/XAMPP and physical-tablet acceptance testing.
- Client sign-off on recipe quantities, prices, expiration dates and opening practices.
- Test the upgrade and off-host disaster recovery procedure on a copy of the actual database.
- Verify existing pending orders before any restore; an older snapshot cannot retain later confirmations.

The daily report is a course-project summary, not certified fiscal functionality. Phase 3 was not started.
