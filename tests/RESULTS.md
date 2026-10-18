# Phase 1 verification — October 18, 2026

Result: PASS in the disposable local test environment. This is engineering verification, not client acceptance or a claim that the entire project is complete.

Runtime: PHP 8.3.6 with PDO MySQL, MariaDB 10.11.14 (InnoDB), Node 24.19, Chromium Headless Shell 134. React production assets were built with the repository's Vite configuration. Playwright 1.64.1 drove the installed headless browser via `VV_CHROMIUM_PATH` because the environment could not download the matching latest browser archive.

- Production build: passed (`npm run build`).
- Pending-order tests: 8 passed (`npm test`).
- PHP syntax: all backend PHP files passed.
- Database/API/browser assertions: all passed, listed below.
- Visual review: Register desktop, Register tablet, Management desktop and Sales desktop screenshots. No horizontal page overflow at 768px tablet width; tables scroll within their panels. Browser reported no JavaScript page errors.
- Original-engine baseline (before endpoint replacement): confirmation, duplicate handling, insufficient-stock rollback and injected SQL failure rollback passed. Reproduced a defect where replay of a committed sale failed after a menu-price change. Phase 1 fixes that behavior.

## Completed checks

- fresh owner bootstrap creates account and offline recovery code
- phase 1 migration resumes safely
- Barista cannot read management or mutate inventory
- legacy batch allocation preserves stock total and rejects over-allocation
- explicit variant recipes determine availability independently
- milestone: recipe → restock → cash sale → correct stock / VAT / opening clock
- replays return stored VAT after price changes; changed payload / other user / stale price rejected
- injected ledger failure rolls back headers, items, containers, batch totals and stock
- stock and underpayment rejection leave inventory untouched
- opened first then FEFO; expiration today usable; expired delivery excluded
- opened use-by blocked and explicit waste movement records actor / quantity
- concurrent distinct sales cannot oversell
- concurrent duplicate burst creates one sale and one deduction
- worked VAT example, sale detail, period report and CSV use persisted snapshots
- last line absorbs rounding residual without centavo drift
- zero quantities and client-controlled price fields rejected
- staff reset revokes sessions; same staff can recover pending confirmation after login
- owner offline code is single-use, rotates, and revokes existing sessions
- provisioning script cannot bypass owner recovery on an existing installation
- physical stock = batch remainder = movement ledger after all scenarios
- browser real cash checkout and receipt
- browser pending order survives reload and confirms after reconnect
- browser owner forms, sales report, tablet layout and no JavaScript errors
- fixed sale-time expiration and exact opened use-by boundaries

## Remaining deployment checks

Run Windows/XAMPP and actual tablet UAT with the client's confirmed recipes, prices, unit quantities and expiry practices. Back up before migration, configure real variants, and reconcile legacy aggregate stock into known batches. Full browser reload while the host is offline still depends on shell availability; saved IndexedDB orders survive and reconcile once the application can reach the host again.

Phase 2 and Phase 3 have not been started. Backup/restore UI and broader later-phase functionality are not included.
