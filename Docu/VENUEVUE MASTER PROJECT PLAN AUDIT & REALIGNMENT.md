# VENUEVUE — MASTER PROJECT PLAN AUDIT & REALIGNMENT

**Project:** VenueVue — Internet-Independent Point-of-Sale & Recipe-Driven Inventory Management System
**Client:** TravelBean MNL (Rhona Mae Aganan, Owner; Jimwell Mamangun, Co-Owner / Ops Manager)
**Team:** CTRL + STAY — Zapico, Zaki (PM / Lead Developer); Gregorio, Rhea Mae (System Analyst / QA Lead); Roquid, Jenny Lyn (QA / Testing Specialist)
**Institution:** Cavite State University — CEIT, Department of Computer Studies / IT
**Audit date:** 23 September 2026
**Window under audit:** 3 August 2026 → 18 December 2026 · **19.57 weeks** (not 20 weeks / 5 months — see §2.6)

> **Scope note.** All 14 project documents and both source trees were read in full. Every technical claim is sourced to `file:line`; every date is computed from the 3 August 2026 Monday start. No file was modified. Findings marked **NEW** were absent from every prior WBS revision.

---

## SECTION 0 — AUDIT BASIS

### 0.1 Document register, with true revision numbers

The filenames **lie about their revisions.** `Project Plan 2.0.docx` internally declares **Rev 2.1**; `Project Plan 2.0 (1).docx` declares **Rev 2.0**.

| # | File | Internal revision | Date | Authority |
|---|---|---|---|---|
| D1 | `PROJECT PLAN (DOCUMENT REVISION 2.2 — ARCHITECTURE-RECONCILED).docx` | **Rev 2.2** (Reconciled Baseline & Specification Freeze) | 23 Sep 2026 | **PRIMARY BASELINE** |
| D2 | `VENUEVUE SYSTEM ARCHITECTURE & TECHNICAL SPECIFICATIONS.docx` | none | ~22 Sep 2026 | **PRIMARY** |
| D3 | `Project Plan 2.0.docx` | **Rev 2.1** (Reconciled & Architecture-Aligned) | 23 Sep 2026 | Superseded by D1 |
| D4 | `Project Plan 2.0 (1).docx` | **Rev 2.0** | 22 Sep 2026 | Superseded |
| D5 | `CTRL+STAY - PROJECT PLAN revised.pdf` | Rev 1 (08/29) | 28 Aug 2026 | Superseded |
| D6 | `VenueVue Software Project Plan FIrst.docx` | **Rev. 3.0** | 9 May 2026 | Historical (SE I) |
| D7 | `CTRL + STAY PROJECT TECHNICAL DOCUMENTATION (REVISED) (2).pdf` | PTD | 9 May 2026 | Historical (SE I) |
| D8 | `Venue Vue Sample Agreement.pdf` | unsigned | undated | **PRIMARY (legal)** |
| D9 | `CTRL+STAY SWOT ANALYSIS (REVISED).pdf` | — | 3 May 2026 | Reference |
| D10 | `4. PROJECT PLAN.docx.pdf` | — | — | **BLANK TEMPLATE** |
| D11 | `7. SAMPLE LETTER OF AGREEMENT.docx` | — | — | **WRONG PROJECT (barangay)** |

### 0.2 Three byte-identical duplicate pairs

| File A | File B |
|---|---|
| `Project Plan 2.0.docx` | `you should revised this based on the neeede to re....docx` |
| `Act as the Project Manager (Zapico, Zaki) of grou....docx` | `VENUEVUE SYSTEM ARCHITECTURE & TECHNICAL SPECIFICATIONS.docx` |
| `Venue Vue Sample Agreement.pdf` | `Venue Vue Sample Agreement portrait.pdf` |

**The `Document Change Control` table in D5 is empty, and D3 has no change-control entry for Rev 2.1.** Nothing in the workspace states which document is authoritative. A prompt-named file now contains a byte-copy of Rev 2.1 — the instruction file appears to have been overwritten by its own output.

### 0.3 Non-monotonic version lineage

```
Rev 3.0 (9 May 2026)  ──►  Rev 1.0 (28 Aug) ──► 1.1 (10 Sep) ──► 1.2 (22 Sep)
                                                              ──► 2.0 (22 Sep) ──► 2.1 (23 Sep) ──► 2.2 (23 Sep)
```
A **Rev 3.0 that precedes a Rev 1.0** in the same project is a versioning break. Two revisions share 22 September; two share 23 September. There is no unique key on the document set.

### 0.4 Code artefacts

| Artefact | Stack | Dart LOC | `flutter analyze` | State |
|---|---|---|---|---|
| `CTRL Stay coding` (`venuevue_mobile`) | Flutter + sqflite + provider + uuid | 531 | **2 issues (0 errors, 0 warnings)** | **Only runnable client** |
| `VenueVue\flutevue` | Flutter + sqflite + provider (no uuid) | 1,274 | 5 issues (2 warnings) + **runtime-fatal** | **Crashes on launch** |
| `VenueVue\backend\sync.php` | PHP 8 + PDO | 233 lines | — | Ingest only |
| `VenueVue\sql\ddl_core_tables.sql` | MySQL 8 DDL | 77 lines | — | **6 tables, not 8** |
| `venuevue - Copy` | React 19 + TanStack + Vite 8 + **Supabase** | — | — | Live, demo-only |

> **⚠ CR-00 — act today.** `CTRL Stay coding\` and `VenueVue\` were **moved to the Recycle Bin mid-audit** (~10:33). All code findings are from the recovered read-only copies at `C:\$Recycle.Bin\S-1-5-21-3815034255-820720262-2530389398-1001\$RF00UAI` and `...\$RFUPVBI`. **If that bin is emptied the Flutter clients, the only PHP backend, and the only DDL script are permanently gone.**

### 0.5 Absent artefact register — 7 of 10 contractual deliverables do not exist

| Promised (D1 §2.2 / D5 Table 2.4) | Found? |
|---|---|
| Software Requirements Specification (SRS) | **No** |
| Figma wireframes (7 screens) | **No** |
| Trello board / task-tracking export | **No** |
| ERD artefact (visual) | **No** — DDL text only |
| User Operational Manual | **No** |
| System Installation Guide | **No** |
| Test Plan / Execution Logs / UAT Certificate | **No** |
| Database ERD & DDL "8 Relational Tables" | **Partial — 6 tables** |
| PhpSpreadsheet 4-tab `.xlsx` templates | **No** |
| Project Plan & Charter | **Yes — 6 competing versions** |

---

## SECTION 1 — EXECUTIVE SUMMARY & CRITICAL RISKS

### 1.1 The two decisions that gate everything

**DECISION 1 — Which architecture?** There are four incompatible definitions live at once:

| Source | Front-end | Local store | Server | Reporting |
|---|---|---|---|---|
| **Your brief** | Flutter | **SQLite** | PHP (XAMPP) | PhpSpreadsheet |
| **D1 Rev 2.2 / D2 (frozen)** | **React 19 SPA** | **IndexedDB** queue | PHP 8 / **MySQL 8** | PhpSpreadsheet |
| **D7 PTD (May)** | HTML5/CSS3/JS | **"No SQLite, no MySQL on tablet"** | PHP 8 / MySQL 8 | PhpSpreadsheet |
| **What is built** | Flutter **+** React 19 | SQLite **+** Supabase cloud | PHP 8 / **no PHP on the React side** | **Nothing** |

D1 §3.2 and D2 §3.4 record a deliberate pivot away from Flutter. **But the pivot rationale is not defensible as written:** D4 §4.2 claims *"During early planning, native mobile builds (such as Flutter APKs) were evaluated"* — yet the earliest artefact (D6, Rev 3.0, May 2026) **never mentions Flutter at all**; it went straight to browser-based HTML5/CSS3/JS. The pivot is retroactively narrated, and a panel can challenge it.

> **RECOMMENDATION: adopt D1 Rev 2.2 as the single frozen baseline; archive both Flutter trees; strip Supabase and rebase `venuevue - Copy` on the PHP/MySQL API.** Rationale and exact text in **§3.1**. This is defensible because the client Letter of Agreement §1.1 specifies *"a standalone local server environment (PHP/MySQL)"*, and every graded artefact assumes it.
>
> *If Flutter + SQLite is genuinely binding, you must revert D1 §3.2, D2 §3.4, D2 §3.1, D8 §1.1, and D1 §2.2 — and discard the only client with real screens. Viable, but re-defend it to the panel first.*

**DECISION 2 — Does VenueVue actually have an event entity?** See CR-09. The product is *named* VenueVue, the client's #5 problem is *"Lack of historical event performance data"*, and the flagship deliverable is a workbook whose Tab 1 lists *"Event Name, Date, Duration … Net Profit Estimates"* — **yet no schema in any revision contains an event table, an `event_id`, or an ingredient cost column.** As designed, **the client's headline ask cannot be produced.** This is the single most consequential finding in the audit.

### 1.2 Critical risks

| ID | Risk | Evidence | Impact |
|---|---|---|---|
| **CR-00** | **All source code sits only in the Recycle Bin** | `$RF00UAI`, `$RFUPVBI` | Total loss on bin empty. **Act today.** |
| **CR-01** | **Order sync is 100% non-functional — 0% of orders ever reach the database** | Both clients POST a flat map; `sync.php:71` requires `$input['order']` → **HTTP 400**. Neither client ever sends `items`, which `sync.php:88/114` requires. A also omits `user_id`/`status`/`payment_method`, which `sync.php:88` demands | The project's #1 client problem is unsolved. Inventory is never deducted server-side. Objectives 1, 2, 6 all fail. |
| **CR-02** | **No authentication of any kind on the API** | `sync.php` jumps from DB connect to `json_decode`; no token/session/role check; `Access-Control-Allow-Origin: *` (`:38`); plaintext HTTP | Any device on the hotspot can inject orders and drain/inflate stock. Objective 7, T10/T11 fail. |
| **CR-03** | **"8-table schema — Completed Aug 28" is false** | `ddl_core_tables.sql` has **6** `CREATE TABLE`s. `INVENTORY_TRANSACTIONS` and `AUDIT_LOGS` absent; `orders` has **no `client_transaction_id`** and **no unique key** | D1 §4.3/§4.4/§4.6 unrealisable. No inventory ledger, no audit trail, no idempotency surface. |
| **CR-04** | **PhpSpreadsheet reporting does not exist — 0% built** | Zero matches for `PhpSpreadsheet\|Spreadsheet\|xlsx\|Excel\|phpoffice` in **any** source file; only **one** `.php` file exists (`sync.php`, POST-ingest only, no read endpoint); no `composer.json`, no `vendor/`, no `.xlsx` on disk | Objective 5, FR-07, deliverable §2.2, T14 — the product's headline client value — is entirely absent. |
| **CR-05** | **A cloud dependency contradicts the central premise** | `venuevue - Copy` uses hosted **Supabase** (Postgres + GoTrue); **0 `.php` files**; "Supabase" appears in **none** of the 14 documents | D1 §1.1 establishes cloud POS is unusable at these venues. A cloud backend falsifies the thesis. |
| **CR-06** | **Zero schedule float; one slip loses the deadline** | D1 §6.2 chains Nov 6→13→20→27→Dec 11→18. Testing gets **6 days** | Dec 18 is a hard wall. |
| **CR-07** | **Three parallel implementations, 3 people** | Flutter A (531 LOC, runs), Flutter B (1,274 LOC, **crashes**), React (cloud) | Effort split three ways; no artefact complete. Root cause of the 20% status. |
| **CR-08** | **Committed `.env` in a published public repo** | `.env` not gitignored; committed; pushed to `github.com/zakizap2134/venuevueFin.git`; migration seeds 3 demo accounts with hardcoded passwords | Leaked publishable key + project ref + credentials. R.A. 10173 exposure that D8 §5.1 promises to control. |
| **CR-09** | **No event entity and no ingredient cost — the client's headline ask is unbuildable** | No `EVENTS` table and no `event_id` on `ORDERS` in **any** revision (6-table or 8-table). No unit-cost column on `INGREDIENTS`. Yet D2 §2.2 Tab 1 specifies *"Event Name, Date, Duration … Net Profit Estimates"* and D1 §1.4 promises *"actionable profit analytics"* | Per-event reporting, high-margin-event analysis, and net profit are **impossible** under the frozen schema. The 4 Excel tabs contain no per-event breakdown. |
| **CR-10** | **Negative quantities inflate stock (exploitable)** | `sync.php:115-120` uses `empty()`; `empty(-5)` is `false`, so **−5 passes**. `:135-136` computes negative totals; `:181/194-195` performs a **negative deduction that increases** `current_quantity` | Silent inventory corruption; also defeats the low-stock logic the system exists to provide. |
| **CR-11** | **Every order is attributed to user ID 1** | `pos_screen.dart:331` and `checkout_dialog.dart:47` both hardcode `userId: 1`. No login code exists in either client | RBAC is decorative; the audit trail cannot attribute sales. Objective 7 is unmeasurable. |
| **CR-12** | **Codebase B crashes on launch; its checkout orphans every line item** | B's `main.dart:5-7` has no `MultiProvider`, yet `pos_screen.dart:13/104` calls `Provider.of<CartProvider>` → `ProviderNotFoundException`. `pos_screen.dart:330` writes `orderId: 0`; `:344/:355` insert **unawaited**; `checkout_dialog.dart` (191 lines) is **dead code** | The larger "advanced" client does not run and cannot persist line items. |

### 1.3 Corrected verdict on the two Flutter codebases **NEW**

Earlier size-based reasoning suggested B (`flutevue`, 1,274 LOC) was the advanced one. **It is the broken one.**

| | A — `venuevue_mobile` | B — `flutevue` |
|---|---|---|
| `flutter analyze` | 2 info, **0 errors/warnings** | 5 issues; **runtime-fatal** |
| Provider wiring | ✅ `ChangeNotifierProvider` in `main.dart:10-13` | ❌ **missing** → crashes on launch |
| Checkout | ✅ wired, transactional, awaited | ❌ inline duplicate; `order_id = 0`; unawaited |
| Dead code | none | 191 lines (`checkout_dialog.dart`) never imported |
| Currency | ✅ `₱` (₱120/₱90/₱140/₱85) | ❌ **`$` USD** for a Philippine client |
| UUID | ✅ `uuid: ^4.2.1`, stored | ❌ no `uuid`; hashed-timestamp / literal `0` |
| Sync button | functional | `onPressed: () {}` — **no-op** |
| Package name | `venuevue_mobile` | `flutevue` (typo of "venuevue") |
| Sync payload | flat SQLite row; no `items` | flat map; no `items` |

B also ships a stale `issues.txt` proving it once failed to compile (`undefined_named_parameter 'validator'`, `undefined_method 'OrderModel'`). Both clients are superseded by the React app; **A is the only one worth keeping as a reference.**

### 1.4 Scope creep

| # | Creep | Source | Disposition |
|---|---|---|---|
| SC-1 | Entire React/Supabase cloud app | `venuevue - Copy` | **Cut the cloud layer** — excluded by D1 §1.4 |
| SC-2 | Venue/event-management domain model | `/events`, `/register` routes | **Out of scope** (though see CR-09 — a *minimal* event entity is needed) |
| SC-3 | PDF report export | D8 §1.2 | **Strike from the Agreement** |
| SC-4 | `payment_method ENUM('cash','card','mobile')` | DDL `:54` | **Narrow to cash** (but keep the column — Tab 1 needs payment distribution) |
| SC-5 | Order lifecycle `pending/preparing/ready/closed` | DDL `:53` | **Unneeded** — no kitchen workflow |
| SC-6 | CI, Wrangler deploy, service worker, Bun+npm dual lockfiles | `venuevue - Copy` | **Out of scope** |
| SC-7 | Two Flutter apps | 2 folders | **Archive both; keep A as reference** |
| SC-8 | Same 650 hrs / ₱11,600 / ₱183,500 / ₱8,000 tablet valuation reused across a vanilla-JS 6-table plan **and** a React-19 8-table plan with UUID idempotency and a 14-test matrix; tablet count grew 1→3 with no budget change | D6 vs D3/D4 | **Re-cost the plan** |

### 1.5 Timeline reality

- **3 Aug 2026 (Mon) → 18 Dec 2026 (Fri) = 137 days = 19.57 weeks ≈ 4.5 months.** D1's *"20 Weeks / 5 Months"* is **overstated**. A true 20 weeks ends 21 Dec 2026; 5 months ends 3 Jan 2027.
- Every D1 milestone lands on a Friday and coincides with a 2-week sprint boundary.
- **As of 23 Sep the team is 7.4 weeks in (38% elapsed) and self-reports 20% complete.** Phase 3 (target 18 Sep) is **5 days overdue** and on the critical path.
- **No sprint is ever named, numbered, or dated** in any document, despite all six claiming "two-week sprints." The Agile claim is currently unauditable.
- **No schedule buffer exists anywhere.** There is a ₱2,000 monetary contingency but zero schedule contingency. The last task (PhpSpreadsheet export) lands 20 Nov; the final four weeks carry **all** verification, **all** deployment, **all** bug-fixing, **all** manuals, and UAT **plus** thesis writing.

**Deadline contradiction resolved.** Your brief asks for a roadmap "to the last week of November"; D1 says 18 December. Both are satisfiable:
> **Feature freeze and full T01–T14 verification complete Friday 27 November 2026. 1–18 December is reserved for deployment, training, manuals, defect burn-down, and UAT sign-off only. No new features after 27 November.**

### 1.6 Requirements traceability went backwards **NEW**

| Revision | Functional reqs | Non-functional reqs | Roles | Deliverables | References | Client names |
|---|---|---|---|---|---|---|
| D6 (Rev 3.0, May) | 7 (FR-01…07) | 4 (NFR-01…04) | ✅ + RACI | 11 | ✅ | ✅ |
| D4 (Rev 2.0, 22 Sep) | 6 (FR-01…06) | 2 (NFR-01…02) | ✅ | 9 | ✅ | ✅ |
| D3 (Rev 2.1, 23 Sep) | **0** | **0** | ❌ | ❌ | ❌ | ❌ |

**The newest revision deleted the requirements, deliverables, roles, client names, and references while adding the most engineering complexity.** Dropped NFRs include touch latency **≤200 ms** and **daily automated `.sql` backups** — the latter replaced by "two USB drives" despite D8/NFR-04 promising automated backup. The plan an evaluator would grade has the *least* traceability.

---

## SECTION 2 — CROSS-DOCUMENT DISCREPANCY TABLE

Priority: **H** = blocks delivery or breaks the defence · **M** = fix before submission · **L** = consistency.

### 2.1 Architecture & technology

| Document A | Document B | Conflict / Gap Found | Recommended Alignment | P |
|---|---|---|---|---|
| Your brief | D1 §3.2; D2 §3.4 | Brief says **Flutter**; both current specs **pivot away from it** | Adopt React 19; archive Flutter (§3.1) | **H** |
| Your brief | D1 §1.2, D2 §2.3; D7 §6.4.3 | Brief says **SQLite**; docs specify **MySQL 8 on the host**; D7: *"No SQLite, no MySQL on tablet"* | Data tier = MySQL; tablet cache = IndexedDB (§3.4) | **H** |
| D4 §4.2 — *"Flutter APKs were evaluated during early planning"* | D6 (Rev 3.0, May 2026) — **never mentions Flutter**; chose HTML5/CSS3/JS | **The pivot rationale is retroactively narrated**; the earliest artefact contains no Flutter evaluation | Rewrite D4 §4.2/D1 §3.2 to state the real sequence, or expect panel challenge | **H** |
| D1 §4.1 (LAN POST) | `venuevue - Copy` (Supabase over internet) | Implemented client talks to a **hosted cloud**; no PHP, no MySQL, no LAN code | Strip Supabase; implement PHP endpoints (§3.3) | **H** |
| D1 §4.2 Mech. 1 — *real-time* during sales | D5 §5.3 — *"Devices do not communicate … during active sales hours"*; D7 §6.3 — *"No data transfer happens during the event"* | Direct contradiction on the core offline model | Ratify **real-time LAN POST** (a LAN POST is not a WAN dependency); correct D5/D7 (§3.4) | **H** |
| D1 §3.2 (Vite 8, Tailwind **4**) | D5 Table 4.1 (Tailwind **v3.x**, HTML5/CSS3/ES6) | Two different front-ends and CSS majors | D1 current; D5 superseded | M |
| D7 (May PTD) | D1 (Sep) | May PTD predates the pivot but is filed "REVISED" | Mark D7 **SUPERSEDED** in the register | M |
| D4 §4.2 rejects compiled APKs | D4 §4.2 bullet 3 adopts an **Android Kiosk WebView APK** | Rejects APKs then reintroduces one | Clarify: the container is optional, not the architecture | L |
| D1 §3.2 / D4 §4.2 — *"sub-second client-side rendering"* via Vite/Tailwind | NFR-02 (≤200 ms) **deleted** after Rev 2.0 | Performance claim with no quantified NFR to measure against | Restore a measurable NFR | M |

### 2.2 Database & data model

| Document A | Document B | Conflict / Gap Found | Recommended Alignment | P |
|---|---|---|---|---|
| D1 §4.5 / §2.2 — **8 tables** incl. `INVENTORY_TRANSACTIONS`, `AUDIT_LOGS` | `ddl_core_tables.sql` — **6 tables** | Claimed *"8-Table DDL — Completed Aug 28"* is not the artefact | Ship the 9-table DDL (§3.2) | **H** |
| D1 §4.3 — `ORDERS.client_transaction_id CHAR(36) UNIQUE NOT NULL` | DDL `:50-64` — no such column, **no unique key at all** | No idempotency surface; T06/T07 (`R_duplicate = 0%`) unachievable | Add column + `UNIQUE` (§3.2) | **H** |
| D1 §4.5 — `INGREDIENTS.current_stock`, `minimum_stock`, `updated_at` | DDL `:23-35` — `current_quantity`, `safety_stock`, `reorder_point`, `cost_per_unit` | **Every documented column name differs from the implementation** | Rename to D1 names (§3.2) | **H** |
| D1 §4.5 — `USERS.role ENUM('BARISTA','OWNER')` | DDL `:5` — `ENUM('admin','barista')` | Role vocabulary mismatch; no `OWNER` value | Standardise on `BARISTA`/`OWNER` | M |
| D1 §4.5 — `PRODUCTS.product_name, category, unit_price` | DDL `:13-21` — `name`, `description`, `base_price` | **No `category`**, yet FR-02 requires category tabs | Add `category`; rename | **H** |
| D1 §4.5 — `ORDERS.tablet_id`, `committed_at` | DDL `:50-64` | Absent; the `T1-0104` collision rule is unimplementable | Add both | M |
| **D2 §2.2 Tab 1 — *"Event Name, Date, Duration … Net Profit Estimates … Primary Payment Distribution"*** | **All revisions** — no `EVENTS` table, no `event_id`, no unit-cost column, no `payment_method` in D1's 8-table `ORDERS` | **The flagship report cannot be produced by the frozen schema.** Per-event, per-venue, and profit reporting are impossible | Add `EVENTS` + `ORDERS.event_id` + `INGREDIENTS.unit_cost` + `ORDERS.payment_method` — becomes a **9-table** schema (§3.2) | **H** |
| D1 §1.4 — *"actionable profit analytics"*; D1 Abstract — *"high-margin events"* | `INGREDIENTS` has no cost field in any revision | Margin/profit analytics impossible as specified | Add `unit_cost` (§3.2) | **H** |
| D4 §5.1 FR-02 — *"item options"* | No modifiers/variants table in **any** revision | Size/add-on recipe deduction is unmodelled | Either add a modifiers table or strike "item options" from FR-02 | M |
| D1 §4.4 — `SELECT … FOR UPDATE` row locks | `sync.php:164-201` — plain `SELECT` then `UPDATE` | No row locking; T02/T03 (concurrent tablets) can lose updates | Add `FOR UPDATE` (§3.3.2) | **H** |
| D1 §1.4 — *"tracking inventory deltas"* | `sync.php:193-201` mutates `current_quantity` in place, **no ledger write** | Inventory deltas are unrecoverable; no audit trail | Write `INVENTORY_TRANSACTIONS` inside the txn | **H** |
| DDL `orders.status` ENUM incl. `'cancelled'` | No code ever sets it | Void/refund state is dead schema | Remove, or implement voids | L |

### 2.3 Code-level defects (all verified by static reading; `file:line` cited)

| ID | Defect | Evidence | P |
|---|---|---|---|
| **T-01** | **Payload envelope mismatch → 100% sync failure** | `sync_service.dart:18` (A) / `:63` (B) post flat maps; `sync.php:71` requires `$input['order']` → **400** | **H** |
| **T-02** | **`items` array never transmitted** | Neither client reads its line-item table in the sync path; `sync.php:88/114` requires `items` | **H** |
| **T-03** | **Codebase A cannot populate `user_id`/`status`/`payment_method`** | A's `local_orders` (`database_helper.dart:29-37`) has no such columns; `sync.php:88` requires all three | **H** |
| **T-04** | **Negative quantity passes validation and inflates stock** | `sync.php:115-120` uses `empty()`; `:135-136`, `:181`, `:194-195` | **H** |
| **T-05** | **Dead concurrency guard** | `sync.php:198` assigns `PDOStatement::execute()` (**bool**) to `$rowsAffected`; `:203` `=== 0` can never fire. Needs `->rowCount()` | **H** |
| **T-06** | **Codebase B crashes on launch** | `flutevue/main.dart:5-7` no `MultiProvider`; `pos_screen.dart:13/104` calls `Provider.of<CartProvider>` | **H** |
| **T-07** | **B's checkout orphans every line item** | `pos_screen.dart:330` `orderId: 0`; `:344/:355` **unawaited** inserts | **H** |
| **T-08** | **No idempotency; duplicate submission possible on 5 independent paths** | No key transmitted (`sync.php` ignores `order_id`/`order_uuid`); no unique index; flag set only after response; unawaited double-tap; differing mid-batch semantics | **H** |
| **T-09** | **`isServerReachable()` always returns false** | `sync_service.dart:126-138` uses HTTP `HEAD`; `sync.php:49-56` answers non-POST with **405** | M |
| **T-10** | **Head-of-line blocking permanently stalls B's queue** | `sync_service.dart:106-113` `break`s on first failure; combined with T-01, nothing ever syncs | M |
| **T-11** | **A returns `true` from sync even when every order failed** | `sync_service.dart:28` unconditional `return true` | M |
| **T-12** | **No pull/down-sync path exists at all** | No `SELECT` from the server anywhere in either client; no conflict resolution, no LWW, no ETag | M |
| **T-13** | **SQLite foreign keys declared but never enforced** | Neither `database_helper.dart` sets `PRAGMA foreign_keys = ON`; SQLite defaults FKs **off** | M |
| **T-14** | **Weak, colliding client IDs** | A truncates a UUIDv4 to **6 hex chars** (`checkout_dialog.dart:66`); B uses a hashed millisecond timestamp or literal `0`; no unique index | M |
| **T-15** | **Every order attributed to user 1** | `pos_screen.dart:331`, `checkout_dialog.dart:47` hardcode `userId: 1` | **H** |
| **T-16** | **MySQL `root` with empty password in source** | `sync.php:10-14` | **H** |
| **T-17** | **Exception messages leak DB/SQL internals** | `sync.php:32`, `:230` return `$e->getMessage()` | M |
| **T-18** | **`sync.php:188` reads an unselected column** | Query `:165-169` omits `i.unit` but `{$recipe['unit']}` is interpolated twice → PHP 8 warning, malformed message | L |
| **T-19** | **Wrong HTTP status for business errors** | `sync.php:227` returns **500**; D1 T09 requires **409** | M |
| **T-20** | **B's `checkout_dialog.dart` (191 lines) is dead code** with divergent validation and ID generation | Never imported; `pos_screen.dart:277` reimplements checkout inline | M |
| **T-21** | **A's post-checkout success dialog may not display** | `flutter analyze`: `use_build_context_synchronously` at `checkout_dialog.dart:97:33`, `:101:30` — `Navigator.pop` precedes `showDialog` on the same context | L |
| **T-22** | **A's line-item schema is incompatible with MySQL** | A stores `order_uuid` + `subtotal`; MySQL needs `order_id` + `unit_price`/`total_price` | M |
| **T-23** | **PWA service-worker caching is not guaranteed over the LAN IP** | `http://192.168.137.x` is **not a secure context**, so `public/sw.js` may not register. IndexedDB does work (no secure-context requirement) | M |

### 2.4 Roles, responsibilities & governance

| Document A | Document B | Conflict / Gap Found | Recommended Alignment | P |
|---|---|---|---|---|
| D8 signature page: Roquid = **Developer / System Analyst**; Gregorio = **Developer / Documenter** | D1 §2.1: Gregorio = **SA / QA Lead**; Roquid = **QA / Testing** | **Two members' roles are swapped between the signed legal instrument and the frozen plan** | Ratify D1's roles; issue a signed addendum (§3.6) | **H** |
| D5 p.1: Roquid = System Analyst; Gregorio = Tester/Documenter | D5 Table 2.2: the reverse | **The same document contradicts itself, cover page vs p.12** | D5 superseded; fix if resubmitted | M |
| D4 §2.3: Roquid does *"PhpSpreadsheet export **verification**"* | D4 §6.2 WBS: Roquid is the **owner/builder** of the low-stock and PhpSpreadsheet modules | **Self-verification** — the same person builds and validates; likewise Gregorio builds and signs as reviewer | Assign an independent verifier per module (§3.5) | **H** |
| D1 §2.1 RACI | D1 §6.2 WBS | Zapico owns 6 of 10 phases and is *Accountable* on 4 matrix rows; Gregorio/Roquid are *"Informed"* on the two riskiest items (SPA, PHP API) | Rebalance; add a second reviewer on every critical-path task (§3.5) | M |
| D1 §5.1 *"20% Completed as of September 22"* | D1 §6.2 marks Phases 1–2 **all Completed** + Phase 3 in progress | 2 complete + 1 in-progress of 10 ≠ 20% (≈30–35%) | Restate as one dated % (§3.4) | L |
| D9 §V | D1 §6.2 Phase 1 *"SWOT — Completed Aug 14, 2026"* | SWOT is dated **3 May 2026** — three months **before** the 3 Aug start | Re-date as pre-project initiation input | M |
| D6 — all six signatories dated **9 May 2026**, including the `Academic Instructor / Evaluator` | D6 issued 9 May 2026 | **Blanket pre-dated approvals**, before any work ran | Do not resubmit D6 as a signed artefact | **H** |

### 2.5 Contractual & compliance

| Document A | Document B | Conflict / Gap Found | Recommended Alignment | P |
|---|---|---|---|---|
| D8 §1.2 — *"Excel (.xlsx) **or PDF** reports"* | D1 §1.4 / FR-07 — 4-tab `.xlsx` only | LoA promises a PDF capability no document scopes and no code implements | **Strike PDF** (§3.7) | M |
| D8 §1.2 — *"post-event data transfer"* | D1 §4.2 Mech. 1 — real-time during-event POST | The legal instrument describes the post-event model; the plan implements real-time | Amend D8 wording (§3.7) | M |
| D8 §1.1 — *"PHP/MySQL"*; NFR-04 daily `.sql` backup; D8 §1.3 backup utility | No backup code exists; Rev 2.1 deleted the automated-backup NFR | Contractual backup capability unimplemented **and** de-scoped | Restore the NFR and add a WBS task (§3.5) | **H** |
| D11 — barangay LoA (*"barangay residents' records"*, 5-month term) | D8 — the correct TravelBean agreement | An **unadapted barangay template** sits in the deliverable set | Delete D11 from the pack | **H** |
| D10 p.1 / D11 §1 — *"COSC 70: Software Engineering I"* | D1/D5 disclaimer — *"COSC 75: Software Engineering II"* | **Wrong course code on cover pages**; D6 lists both | Resolve to COSC 75 for SE II artefacts | M |
| D1 §4.6 — *"validate the user's session token … 401/403"* | `sync.php` — no auth of any kind | Documented control entirely unimplemented | Implement token + RBAC (§3.3.2) | **H** |
| D8 §3.1.3 — *"six (6) months"* bug fixing | D1 §6.2 ends 18 Dec 2026 | No post-turnover support plan, owner, or effort budgeted | Add support window to the WBS (§3.5) | L |
| D8 §5.1 — Data Privacy Act compliance | `.env` committed to a public repo; demo accounts seeded; unencrypted SQLite | Compliance promise breached in practice | Rotate keys, purge demo data (§3.8) | **H** |

### 2.6 Schedule, effort & documentation hygiene

| Document A | Document B | Conflict / Gap Found | Recommended Alignment | P |
|---|---|---|---|---|
| D1/D3/D4 — *"20 Weeks / 5 Months"* | 3 Aug → 18 Dec 2026 = **19.57 weeks ≈ 4.5 months** | **Duration overstated.** True 20 weeks = 21 Dec 2026; 5 months = 3 Jan 2027. Same 650 hrs and identical budget reused across the mis-stated window | Restate as **19.5 weeks**, or move the end date | M |
| All six plans — *"two-week sprints"* | No sprint named, numbered, dated, or goal-set anywhere | **The Agile claim is unauditable**; a likely rubric hit and a real tracking gap for a fixed deadline | Adopt the named/dated sprint table in §4.1 | **H** |
| D6 §6.1 — Month 5 = W17–W20 (4 weeks) | Contains Phase 4 (`XX`+3 tasks) **and** Phase 5 (`XX`+4 tasks) = **7 single-week tasks in 4 weeks** | Month 5 is over-subscribed; Month 4 first introduces 4 production modules at once | Re-phase per §4.1 | M |
| D6 — *"Gantt chart"* | Bars are literal `XXXX`/`XX`/`X` placeholders; **no date axis**; the strings `August`/`December`/`Aug 3`/`Dec 18` **never occur** | D6 has **zero calendar anchors** | Do not resubmit D6's Gantt | M |
| D6 budget (₱11,600 / ₱183,500 / 650 hrs / ₱8,000 tablets) | D3/D4 budget — **identical**, for materially larger scope (8 tables, UUID idempotency, 14 tests, 3rd tablet) | **Identical budget for materially different scope**; tablet count 1→3 with no cost change | Re-cost; the ₱33,900 composition exists only in D6 | M |
| D6 text | Trailing footnote residue (`...SWOT analysis3`, `[cite: 1]`, `Verified1a`) | **Extraction/editing artefacts inside tables**; will pollute any submission | Clean before resubmission | L |
| D1 §6 numbering | `6. Project Timeline & WBS` → unnumbered Gantt → `6.1 WBS` | Section numbering skips the Gantt | Fix numbering | L |
| D3 §5.3 ToC vs body | ToC: `5.3 System Overview & Data Sync Architecture`; body: `5.3 System Overview & Database Design` | Heading mismatch | Fix | L |
| D3/D4 — signature blocks | `Reviewed by: Tester / Documenter | Gregorio` where Gregorio is also `Prepared by: System Analyst` | **Self-review** | Add an independent reviewer | M |
| D1 §6.2 | No task for: **automated backup**, **training**, **manuals**, **SRS**, **test plan**, **client data load**, **IndexedDB quota handling**, **server-side auth**, **post-turnover support** | **9 missing workstreams** | See §3.5 (**NEW** rows) | **H** |

---

## SECTION 3 — ACTIONABLE CORRECTIONS & REWRITES

### 3.1 Architecture Decision Record (insert as D1 Rev 2.3 §0)

> **ADR-001 — Ratification of the React 19 SPA Client and MySQL/XAMPP Data Tier**
>
> **Status:** Accepted · **Date:** 23 September 2026 · **Supersedes:** Flutter/SQLite client architecture
>
> **Context.** Three client implementations exist: two Flutter applications using local SQLite (`CTRL Stay coding`, `VenueVue/flutevue`) and one React 19 SPA (`venuevue - Copy`). The baseline (Rev 2.2 §3.2; System Architecture §3.4) specifies a React 19 SPA served from the host laptop's XAMPP stack against MySQL 8.x, with IndexedDB as a client-side transaction queue. Both Flutter clients fail their own acceptance criteria — neither can transmit a payload the backend accepts, and the larger one does not launch.
>
> **Decision.** The React 19 / TanStack Router / Vite 8 / Tailwind CSS 4 client, served locally by Apache and persisting to MySQL 8.x through PHP 8.x PDO APIs, is ratified as the sole implementation path. Both Flutter codebases are frozen to `archive/flutter-prototype`. `venuevue - Copy`'s Supabase dependency is removed in Phase 3.
>
> **Rationale.** (1) A rebuilt `dist/` folder updates every tablet on browser refresh; Flutter requires per-device sideloading. (2) Chrome and Safari both reach the SPA, eliminating Android/iPadOS build divergence across a mixed client device pool. (3) MySQL on the host is the **single authoritative store**; SQLite-per-tablet creates N divergent databases requiring exactly the manual reconciliation VenueVue exists to eliminate. (4) The Letter of Agreement §1.1 specifies "a standalone local server environment (PHP/MySQL)".
>
> **Correction to the historical record.** Rev 2.0 §4.2 asserts Flutter APKs "were evaluated during early planning." The earliest artefact (Rev 3.0, May 2026) contains **no Flutter evaluation**; it selected browser-based HTML5/CSS3/JavaScript. The accurate statement is: *"The project's initial architecture was a browser-delivered HTML/CSS/JavaScript client. During Rev 2.0 planning the team evaluated native Flutter APK deployment and rejected it for the operational reasons below, selecting a React 19 SPA instead."* This correction must be applied so the panel is not asked to accept an unsupported claim.
>
> **Consequences.** The `sqflite` dependency and both `database_helper.dart` implementations are retired. Client durability becomes the IndexedDB queue's responsibility. "Offline" means **absence of WAN/Internet connectivity**, per §8.
>
> **Binding cloud exclusion.** No hosted database, managed authentication provider, CDN, or third-party cloud service may be introduced. Supabase (`@supabase/supabase-js`, `supabase/`) is removed in Phase 3. Rationale: §1.1 establishes that cloud-dependent POS systems are unusable at TravelBean MNL's venues; a cloud data tier falsifies the project's premise and breaches the Agreement. Verified at each gate by the absence of outbound WAN calls during a full sales cycle.
>
> **Scope correction (see CR-09).** The frozen 8-table schema cannot deliver the client's headline requirement. Rev 2.3 expands the core schema to **nine tables** by adding `EVENTS`, an `ORDERS.event_id` foreign key, `ORDERS.payment_method`, and `INGREDIENTS.unit_cost` — the minimum required to produce Tab 1 of the contractual workbook ("Event Name, Date, Duration … Net Profit Estimates … Primary Payment Distribution"). The §8 terminology entry "Six-table database → Eight-table core database" is amended to **"→ Nine-table core database."**

### 3.2 Corrected nine-table DDL (replaces `VenueVue/sql/ddl_core_tables.sql`)

Closes **CR-03** and **CR-09**; aligns every column to D1 §4.5; adds the two missing tables, the UUID key, and the event/cost dimensions the reporting spec requires.

```sql
-- =====================================================================
-- VenueVue — Core Schema (9 tables)  |  Rev 2.3  |  2026-09-23
-- Target: MySQL 8.x / InnoDB / utf8mb4
-- Replaces the 6-table ddl_core_tables.sql. Adds: EVENTS, ORDERS.event_id,
-- ORDERS.payment_method, INGREDIENTS.unit_cost, INVENTORY_TRANSACTIONS,
-- AUDIT_LOGS, ORDERS.client_transaction_id + UNIQUE index.
-- =====================================================================
SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS venuevue_db
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE venuevue_db;

-- 1. USERS -------------------------------------------------------------
CREATE TABLE users (
    user_id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('BARISTA','OWNER') NOT NULL DEFAULT 'BARISTA',
    is_active     TINYINT(1)   NOT NULL DEFAULT 1,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_users_role (role)
) ENGINE=InnoDB;

-- 2. EVENTS  (NEW — required by Tab 1: "Event Name, Date, Duration") ---
CREATE TABLE events (
    event_id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    event_name     VARCHAR(150) NOT NULL,
    venue          VARCHAR(150) NULL,          -- enables per-venue analysis
    event_date     DATE         NOT NULL,
    start_time     TIME         NULL,
    end_time       TIME         NULL,
    duration_hours DECIMAL(5,2) NULL,          -- Tab 1 "Duration"
    status         ENUM('PLANNED','ACTIVE','CLOSED') NOT NULL DEFAULT 'PLANNED',
    created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_events_date (event_date),
    INDEX idx_events_status (status)
) ENGINE=InnoDB;

-- 3. PRODUCTS ----------------------------------------------------------
CREATE TABLE products (
    product_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_name VARCHAR(100)  NOT NULL UNIQUE,
    category     VARCHAR(50)   NOT NULL DEFAULT 'Uncategorised',  -- FR-02 tabs
    unit_price   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    is_active    TINYINT(1)    NOT NULL DEFAULT 1,
    created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_products_category (category)
) ENGINE=InnoDB;

-- 4. INGREDIENTS  (unit_cost NEW — required for "Net Profit Estimates") -
CREATE TABLE ingredients (
    ingredient_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ingredient_name VARCHAR(100)  NOT NULL UNIQUE,
    unit            ENUM('g','mL','units') NOT NULL DEFAULT 'mL',
    current_stock   DECIMAL(12,3) NOT NULL DEFAULT 0.000,
    minimum_stock   DECIMAL(12,3) NOT NULL DEFAULT 0.000,
    unit_cost       DECIMAL(10,4) NOT NULL DEFAULT 0.0000,   -- cost per unit
    updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                  ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_stock_nonneg CHECK (current_stock >= 0)
) ENGINE=InnoDB;

-- 5. RECIPE_ITEMS ------------------------------------------------------
CREATE TABLE recipe_items (
    recipe_item_id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id        INT UNSIGNED NOT NULL,
    ingredient_id     INT UNSIGNED NOT NULL,
    quantity_required DECIMAL(12,3) NOT NULL DEFAULT 0.000,
    UNIQUE KEY uq_product_ingredient (product_id, ingredient_id),
    CONSTRAINT fk_recipe_product FOREIGN KEY (product_id)
        REFERENCES products(product_id) ON DELETE CASCADE,
    CONSTRAINT fk_recipe_ingredient FOREIGN KEY (ingredient_id)
        REFERENCES ingredients(ingredient_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 6. ORDERS ------------------------------------------------------------
CREATE TABLE orders (
    order_id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    client_transaction_id CHAR(36)      NOT NULL,   -- UUIDv4 idempotency key
    user_id               INT UNSIGNED  NOT NULL,
    tablet_id             VARCHAR(16)   NOT NULL,   -- 'T-01'
    event_id              INT UNSIGNED  NULL,       -- NEW: enables Tab 1
    payment_method        ENUM('cash')  NOT NULL DEFAULT 'cash',  -- Tab 1
    total_amount          DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    cash_tendered         DECIMAL(10,2) NULL,
    change_due            DECIMAL(10,2) NULL,
    created_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    committed_at          TIMESTAMP     NULL,
    UNIQUE KEY uq_orders_client_txn (client_transaction_id),  -- R_duplicate = 0
    CONSTRAINT fk_orders_user  FOREIGN KEY (user_id)
        REFERENCES users(user_id)   ON DELETE RESTRICT,
    CONSTRAINT fk_orders_event FOREIGN KEY (event_id)
        REFERENCES events(event_id) ON DELETE SET NULL,
    INDEX idx_orders_event   (event_id),
    INDEX idx_orders_created (created_at),
    INDEX idx_orders_tablet  (tablet_id)
) ENGINE=InnoDB;

-- 7. ORDER_ITEMS -------------------------------------------------------
CREATE TABLE order_items (
    order_item_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id      BIGINT UNSIGNED NOT NULL,
    product_id    INT UNSIGNED    NOT NULL,
    quantity      INT UNSIGNED    NOT NULL DEFAULT 1,
    unit_price    DECIMAL(10,2)   NOT NULL DEFAULT 0.00,  -- price snapshot
    CONSTRAINT fk_items_order FOREIGN KEY (order_id)
        REFERENCES orders(order_id)   ON DELETE CASCADE,
    CONSTRAINT fk_items_product FOREIGN KEY (product_id)
        REFERENCES products(product_id) ON DELETE RESTRICT,
    CONSTRAINT chk_qty_positive CHECK (quantity > 0)
) ENGINE=InnoDB;

-- 8. INVENTORY_TRANSACTIONS (movement ledger — was MISSING) ------------
CREATE TABLE inventory_transactions (
    inventory_transaction_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ingredient_id INT UNSIGNED NOT NULL,
    user_id       INT UNSIGNED NOT NULL,
    order_id      BIGINT UNSIGNED NULL,
    transaction_type ENUM('SALE','RESTOCK','ADJUSTMENT') NOT NULL,
    quantity_delta   DECIMAL(12,3) NOT NULL,     -- negative for SALE
    reason        VARCHAR(255) NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_invtx_ingredient FOREIGN KEY (ingredient_id)
        REFERENCES ingredients(ingredient_id) ON DELETE RESTRICT,
    CONSTRAINT fk_invtx_user FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_invtx_order FOREIGN KEY (order_id)
        REFERENCES orders(order_id) ON DELETE SET NULL,
    INDEX idx_invtx_ingredient_created (ingredient_id, created_at),
    INDEX idx_invtx_type (transaction_type)
) ENGINE=InnoDB;

-- 9. AUDIT_LOGS (security trail — was MISSING) -------------------------
CREATE TABLE audit_logs (
    audit_log_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id      INT UNSIGNED NULL,
    action       VARCHAR(64)  NOT NULL,   -- LOGIN_OK, RBAC_DENIED, STOCK_OVERRIDE
    entity_type  VARCHAR(32)  NULL,       -- ORDER | INGREDIENT | PRODUCT | USER
    entity_id    VARCHAR(64)  NULL,
    details      JSON         NULL,
    ip_address   VARCHAR(45)  NULL,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_audit_action_created (action, created_at)
) ENGINE=InnoDB;

-- API session store (required by §3.3.2 token auth) --------------------
CREATE TABLE api_sessions (
    session_id  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     INT UNSIGNED NOT NULL,
    token_hash  CHAR(64)     NOT NULL UNIQUE,   -- SHA-256 of the bearer token
    tablet_id   VARCHAR(16)  NULL,
    expires_at  DATETIME     NOT NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_sessions_expiry (expires_at)
) ENGINE=InnoDB;

-- Least-privilege application user (replaces root/empty-password) ------
-- CREATE USER 'venuevue_app'@'localhost' IDENTIFIED BY '<strong-password>';
-- GRANT SELECT, INSERT, UPDATE ON venuevue_db.* TO 'venuevue_app'@'localhost';
-- (no DELETE, no DROP — matches the May PTD §7.5.2 control)
```

**Verification:** `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='venuevue_db';` → **EXPECT 9** (plus `api_sessions` = 10 objects; the "9 core tables" count excludes the session store).

> **Note for the documents:** D1 §1.4, §2.2, §4.5 and the §8 terminology dictionary must all change "8-table" → "9-table". Leaving them stale recreates the CR-03 class of defect.

### 3.3 Corrected API contract (closes CR-01, CR-02, CR-10, and T-01…T-08, T-15, T-19)

**Defects being fixed.** `sync_service.dart` transmits a flat map; `sync.php:71` requires `{"order":{…}}` → **HTTP 400**. Neither client sends `items` (`sync.php:88/114` requires it). Codebase A cannot supply `user_id`/`status`/`payment_method`. There is no auth, no idempotency, no row locking, no ledger write, and negative quantities inflate stock.

#### 3.3.1 Wire contract (authoritative — freeze this)

```json
{
  "client_transaction_id": "550e8400-e29b-41d4-a716-446655440000",
  "tablet_id": "T-01",
  "event_id": 7,
  "order": { "cash_tendered": 500.00, "created_at": "2026-11-14 14:30:15" },
  "items": [ { "product_id": 12, "quantity": 2 } ]
}
```

Rules: `client_transaction_id` is a **UUIDv4 generated client-side before first transmission** — the sole idempotency key. `unit_price` is **never** sent; the server resolves it from `products.unit_price` (FR-03: *"prices locked to internal system menu tables"*). `user_id` is **never** sent; it comes from the authenticated session (fixes T-15).

#### 3.3.2 Replacement `sync.php`

```php
<?php
/**
 * VenueVue Order Ingestion API  |  Rev 2.3  |  2026-09-23
 * Fixes: {order:{}} envelope, missing items[], absent auth/RBAC, absent
 *        idempotency, absent FOR UPDATE locks, absent ledger/audit writes,
 *        negative-quantity acceptance, 500-instead-of-409, and the broken
 *        execute()-as-rowcount concurrency guard.
 */
declare(strict_types=1);

const DB_HOST = 'localhost';
const DB_NAME = 'venuevue_db';
const DB_USER = 'venuevue_app';     // least-privilege, NOT root
const DB_PASS = '';                 // from getenv()/git-ignored config in practice

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: http://192.168.137.1');   // never '*'
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

function fail(int $code, string $error, array $extra = []): never {
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $error] + $extra);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'Method not allowed');

$pdo = new PDO(
    'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
    DB_USER, DB_PASS,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
     PDO::ATTR_EMULATE_PREPARES => false,
     PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
);

// ---- 1. AUTHENTICATE (Rev 2.2 §4.6) ---------------------------------
$token = preg_replace('/^Bearer\s+/i', '', $_SERVER['HTTP_AUTHORIZATION'] ?? '');
if ($token === '') fail(401, 'Missing session token');

$auth = $pdo->prepare(
    'SELECT u.user_id, u.role FROM api_sessions s
       JOIN users u ON u.user_id = s.user_id
      WHERE s.token_hash = SHA2(?, 256)
        AND s.expires_at > NOW() AND u.is_active = 1'
);
$auth->execute([$token]);
$session = $auth->fetch();
if (!$session) fail(401, 'Invalid or expired session token');
$userId = (int)$session['user_id'];   // server-derived; never trusted from client

// ---- 2. PARSE & VALIDATE --------------------------------------------
$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) fail(422, 'Malformed JSON body');

$txnId    = (string)($input['client_transaction_id'] ?? '');
$tabletId = (string)($input['tablet_id'] ?? '');
$eventId  = isset($input['event_id']) ? (int)$input['event_id'] : null;
$order    = $input['order'] ?? null;
$items    = $input['items'] ?? null;

if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $txnId)) {
    fail(422, 'client_transaction_id must be a UUIDv4');
}
if ($tabletId === '')                    fail(422, 'tablet_id is required');
if (!is_array($order))                   fail(422, 'order object is required');
if (!is_array($items) || $items === [])  fail(422, 'items must contain at least one line');

try {
    $pdo->beginTransaction();

    // ---- 3. IDEMPOTENCY (§4.3; T06/T07 => R_duplicate = 0%) ---------
    $dup = $pdo->prepare('SELECT order_id, total_amount FROM orders WHERE client_transaction_id = ?');
    $dup->execute([$txnId]);
    if ($existing = $dup->fetch()) {
        $pdo->commit();
        http_response_code(200);
        echo json_encode(['success' => true, 'order_id' => (int)$existing['order_id'],
                          'duplicate' => true,
                          'message' => 'Already committed; no re-deduction performed.']);
        exit;
    }

    // ---- 4. RESOLVE PRICES SERVER-SIDE (FR-03) + strict qty ---------
    $total = 0.0; $resolved = [];
    $priceStmt = $pdo->prepare('SELECT unit_price FROM products WHERE product_id = ? AND is_active = 1');
    foreach ($items as $line) {
        $pid = filter_var($line['product_id'] ?? null, FILTER_VALIDATE_INT);
        $qty = filter_var($line['quantity']   ?? null, FILTER_VALIDATE_INT);
        // FIXES CR-10: rejects negatives, zero and non-numerics outright
        if ($pid === false || $pid <= 0) fail(422, 'product_id must be a positive integer');
        if ($qty === false || $qty <= 0) fail(422, 'quantity must be a positive integer');
        if ($qty > 100)                  fail(422, 'quantity exceeds sane per-line maximum');
        $priceStmt->execute([$pid]);
        $p = $priceStmt->fetch();
        if (!$p) fail(422, "Product {$pid} not found or inactive");
        $unit = (float)$p['unit_price'];
        $total += $unit * $qty;
        $resolved[] = ['product_id' => $pid, 'quantity' => $qty, 'unit_price' => $unit];
    }

    $cash = array_key_exists('cash_tendered', $order) ? (float)$order['cash_tendered'] : null;
    if ($cash !== null && $cash < $total) fail(422, 'cash_tendered is less than the order total');

    // ---- 5. AGGREGATE REQUIREMENTS + LOCK ROWS (§4.4; T02/T03) ------
    $need = [];
    $recipeStmt = $pdo->prepare('SELECT ingredient_id, quantity_required FROM recipe_items WHERE product_id = ?');
    foreach ($resolved as $l) {
        $recipeStmt->execute([$l['product_id']]);
        foreach ($recipeStmt->fetchAll() as $r) {
            $iid = (int)$r['ingredient_id'];
            $need[$iid] = ($need[$iid] ?? 0.0) + ((float)$r['quantity_required'] * $l['quantity']);
        }
    }
    if ($need !== []) {
        $ids = array_keys($need);
        $ph  = implode(',', array_fill(0, count($ids), '?'));
        $lock = $pdo->prepare("SELECT ingredient_id, current_stock FROM ingredients
                                WHERE ingredient_id IN ($ph) FOR UPDATE");
        $lock->execute($ids);
        $stock = [];
        foreach ($lock->fetchAll() as $row) { $stock[(int)$row['ingredient_id']] = (float)$row['current_stock']; }
        foreach ($need as $iid => $qtyNeeded) {
            if (($stock[$iid] ?? 0.0) < $qtyNeeded) {
                $pdo->rollBack();
                http_response_code(409);                 // T09 expects 409, not 500
                echo json_encode(['success' => false, 'error' => 'Insufficient stock',
                                  'ingredient_id' => $iid, 'required' => $qtyNeeded,
                                  'available' => $stock[$iid] ?? 0.0]);
                exit;
            }
        }
    }

    // ---- 6. PERSIST ORDER (user_id from session, not the client) ----
    $ins = $pdo->prepare(
        'INSERT INTO orders (client_transaction_id, user_id, tablet_id, event_id,
                             payment_method, total_amount, cash_tendered, change_due, committed_at)
         VALUES (?,?,?,?,"cash",?,?,?,NOW())'
    );
    $change = $cash !== null ? $cash - $total : null;
    $ins->execute([$txnId, $userId, $tabletId, $eventId, $total, $cash, $change]);
    $orderId = (int)$pdo->lastInsertId();

    $insItem = $pdo->prepare('INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?,?,?,?)');
    foreach ($resolved as $l) { $insItem->execute([$orderId, $l['product_id'], $l['quantity'], $l['unit_price']]); }

    // ---- 7. DEDUCT + WRITE LEDGER (real rowCount, not a bool) ------
    $upd = $pdo->prepare('UPDATE ingredients SET current_stock = current_stock - ?
                           WHERE ingredient_id = ? AND current_stock >= ?');
    $led = $pdo->prepare('INSERT INTO inventory_transactions
                            (ingredient_id, user_id, order_id, transaction_type, quantity_delta, reason)
                          VALUES (?,?,?,"SALE",?,?)');
    foreach ($need as $iid => $qtyNeeded) {
        $upd->execute([$qtyNeeded, $iid, $qtyNeeded]);
        if ($upd->rowCount() !== 1) {                    // FIXES T-05
            throw new RuntimeException("Concurrency conflict on ingredient {$iid}");
        }
        $led->execute([$iid, $userId, $orderId, -$qtyNeeded, "Order #{$orderId}"]);
    }

    // ---- 8. AUDIT TRAIL --------------------------------------------
    $pdo->prepare('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
                   VALUES (?,?,?,?,?,?)')
        ->execute([$userId, 'ORDER_COMMIT', 'ORDER', (string)$orderId,
                   json_encode(['tablet' => $tabletId, 'event_id' => $eventId, 'total' => $total]),
                   $_SERVER['REMOTE_ADDR'] ?? null]);

    $pdo->commit();

    // ---- 9. LOW-STOCK BADGE DATA -----------------------------------
    $low = $pdo->query('SELECT ingredient_id, ingredient_name, current_stock, minimum_stock
                          FROM ingredients WHERE current_stock <= minimum_stock')->fetchAll();

    http_response_code(201);                              // T01 / §4.3 expect 201
    echo json_encode(['success' => true, 'order_id' => $orderId, 'duplicate' => false,
                      'total_amount' => round($total, 2),
                      'change_due'   => $change !== null ? round($change, 2) : null,
                      'low_stock'    => $low,
                      'server_time'  => date('c')]);      // enables L_trans measurement
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('[VenueVue] ' . $e->getMessage());          // FIXES T-17: log, never echo
    fail(500, 'Transaction failed; database state unchanged');
}
```

#### 3.3.3 Replacement Flutter client (only if the Flutter path is retained)

```dart
// lib/services/sync_service.dart — contract-aligned replacement
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../database_helper.dart';
import '../models/order_model.dart';

class SyncService {
  static const String _base = 'http://192.168.137.1/venuevue_api';

  /// Frozen wire envelope. The server rejects anything else (fixes T-01/T-02).
  /// user_id is deliberately ABSENT — the server derives it from the session
  /// token (fixes T-15).
  static Map<String, dynamic> buildEnvelope(
    OrderModel order,
    List<Map<String, dynamic>> items, {
    required String tabletId,
    int? eventId,
  }) => {
    'client_transaction_id': order.clientTransactionId,
    'tablet_id': tabletId,
    if (eventId != null) 'event_id': eventId,
    'order': {
      'cash_tendered': order.cashTendered,
      'created_at': order.createdAt.toIso8601String(),
    },
    'items': items
        .map((i) => {'product_id': i['product_id'], 'quantity': i['quantity']})
        .toList(),
  };

  static Future<bool> syncOrder(
    OrderModel order,
    List<Map<String, dynamic>> items, {
    required String tabletId,
    required String sessionToken,
    int? eventId,
  }) async {
    try {
      final res = await http.post(
        Uri.parse('$_base/sync.php'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $sessionToken'},
        body: jsonEncode(buildEnvelope(order, items, tabletId: tabletId, eventId: eventId)),
      ).timeout(const Duration(seconds: 10));
      return res.statusCode == 200 || res.statusCode == 201;  // 200 = replay, 201 = created
    } catch (_) {
      return false;
    }
  }

  /// Drains the queue OLDEST-FIRST with bounded exponential backoff.
  /// Fixes: previous code used `break` on first failure (head-of-line blocking,
  /// T-10) and ordered `created_at DESC` (LIFO drain).
  static Future<({int synced, int failed})> drainQueue(
    DatabaseHelper db, {
    required String tabletId,
    required String sessionToken,
    int? eventId,
    int maxAttempts = 3,
  }) async {
    final pending = await db.getUnsyncedOrders(orderAscending: true);
    int synced = 0, failed = 0;

    for (final order in pending) {
      final items = await db.getOrderItems(order.orderId);   // FIXES T-02
      bool ok = false;
      for (var attempt = 1; attempt <= maxAttempts && !ok; attempt++) {
        ok = await syncOrder(order, items,
            tabletId: tabletId, sessionToken: sessionToken, eventId: eventId);
        if (!ok) {
          await Future<void>.delayed(Duration(milliseconds: 250 * (1 << (attempt - 1))));
        }
      }
      if (ok) { await db.markOrderSynced(order.orderId); synced++; }
      else    { failed++; }        // continue — one poison row must not block the queue
    }
    return (synced: synced, failed: failed);
  }

  /// Fixes T-09: the old HEAD probe always returned false because sync.php
  /// answers 405 to HEAD. Probe a GET health endpoint instead.
  static Future<bool> isServerReachable() async {
    try {
      final res = await http.get(Uri.parse('$_base/health.php'))
          .timeout(const Duration(seconds: 3));
      return res.statusCode == 200;
    } catch (_) { return false; }
  }
}
```

Also required in the Flutter client (all currently missing):
- `uuid: ^4.5.1` in `pubspec.yaml`; a **full** UUIDv4 stored as `client_transaction_id` (**never** a 6-char truncation — fixes T-14).
- `UNIQUE INDEX` on the local `client_transaction_id` column.
- `onConfigure: (db) => db.execute('PRAGMA foreign_keys = ON')` in `openDatabase` (fixes T-13).
- `await` every insert and use the returned rowid as `order_id` (fixes T-07); wrap order + items in one `db.transaction`.
- `MultiProvider`/`ChangeNotifierProvider` at the app root (fixes T-06).
- A session-token acquisition (login) flow; remove every hardcoded `userId: 1` (T-15).

### 3.4 Corrected specification sections (paste into D1 as Rev 2.3)

**Replace D1 §1.2 "Operational Availability Definition":**

> VenueVue provides operational availability independent of WAN/Internet access, provided the local host server and local wireless network remain active. "Offline" in this study refers specifically to the absence of WAN/Internet connectivity, not to autonomous operation of individual tablets. The host laptop running Apache/PHP 8.x and MySQL 8.x is the **single authoritative store**; client tablets are presentation and queueing devices. **The host laptop is therefore a documented single point of failure, and §7.2 defines recovery for its loss.** No hosted or cloud service participates in transaction processing.

**Replace D1 §4.2 heading and Mechanism 1** (resolves the D5/D7 contradiction):

> **4.2 Three Data-Ingestion Mechanisms** — all terminating at the authoritative host database.
>
> **Mechanism 1 — Real-Time Wi-Fi HTTP POST (Primary).** While the local hotspot is active, completed orders are transmitted immediately over the LAN (`192.168.137.x`) to the PHP API and committed to MySQL. This is a **local-area** exchange consuming no WAN bandwidth, and is therefore consistent with the offline-first requirement. Client-side durability does not depend on the service worker: **IndexedDB is the queue of record and requires no secure context**, whereas service-worker caching is explicitly treated as a progressive enhancement because `http://192.168.137.x` is not a secure origin (see T-23).
>
> **Mechanism 2 — IndexedDB Queue / USB Recovery Import (Fail-Safe).** On partition, the client queues the order in IndexedDB as `PENDING_LOCAL`. Queued records export as a JSON recovery package transferable by USB and importable on the host with full idempotency checking.
>
> **Mechanism 3 — Manual Excel/CSV Batch Ingestion (Administrative Fallback).** Parsed with PhpSpreadsheet, verified against `client_transaction_id`, and committed atomically or rolled back in full.
>
> **Superseded:** the post-event-only reconciliation model in the May 2026 PTD is withdrawn. Requiring devices to remain silent during active sales creates an unnecessary backlog with no technical justification on a LAN.

**Insert as D1 §4.7 "Cloud Exclusion"** — use the binding text in ADR-001 (§3.1).

**Insert as D1 §4.8 "Event Dimension" (NEW — closes CR-09):**

> **4.8 Event Dimension.** Every order is associated with an `EVENTS` record via `ORDERS.event_id`, and `INGREDIENTS` carries `unit_cost`. These two additions are the minimum required to satisfy the contractual reporting specification: Tab 1 of the workbook requires *"Event Name, Date, Duration, Total Gross Revenue, **Net Profit Estimates**, … Primary Payment Distribution."* Without an event entity, per-event and per-venue analysis is impossible; without ingredient cost, no margin or net-profit figure can be computed. The core schema is consequently **nine tables**.

**Replace D1 §5 status block** (fixes the 20% inconsistency):

> **Status as of 23 September 2026 (Day 52 of 137; 38% elapsed).** Phase 1 and Phase 2 documentation streams are complete. The database schema exists as **six** of the required nine tables and is therefore **incomplete**. Authentication routing is in progress and **five days past its 18 September target**. No reporting module exists. Overall assessed completion against the Rev 2.3 baseline: **≈12–15%**. This figure supersedes the earlier "20% milestone" statement.

### 3.5 Corrected WBS — every task, owner, reviewer, and date (replaces D1 §6.2)

Rebalanced so no member owns more than three concurrent critical-path tasks; adds the **nine missing workstreams**; gives every task an independent reviewer.

| Phase | Task | Component | Owner | **Reviewer** | Target (Fri) |
|---|---|---|---|---|---|
| 1 | Requirements + SWOT prioritisation | Docs | Z. Zapico | R. Gregorio | Aug 14 |
| 1 | System architecture + network spec | Docs | R. Gregorio | Z. Zapico | Aug 21 |
| 2 | DDL → **9 tables** + migration | MySQL | Z. Zapico | R. Gregorio | Aug 28 |
| 2 | UI design tokens + React 19 scaffold | Vite/Tailwind | R. Gregorio | J. Roquid | Sep 4 |
| 3 | Auth routing + **API session/RBAC + `api_sessions`** | TanStack **+ PHP** | Z. Zapico | R. Gregorio | Sep 25 |
| 3 | Figma wireframes (7 screens) | Figma | R. Gregorio | J. Roquid | Sep 25 |
| 3 | **Supabase removal + PHP API rebase** **NEW** | PHP | Z. Zapico | J. Roquid | Sep 25 |
| 3 | **PWA/service-worker behaviour verified on real tablets over LAN IP** **NEW** | QA | J. Roquid | R. Gregorio | Sep 25 |
| 4 | Product / Ingredient /**Event** / Recipe CRUD | React + PHP | R. Gregorio | Z. Zapico | Oct 9 |
| 4 | **Client menu, recipe, ingredient-cost + event data load** **NEW** | Data | J. Roquid | Client | Oct 9 |
| 4 | **SRS authoring** **NEW** | Docs | R. Gregorio | Z. Zapico | Oct 9 |
| 5 | Touch POS grid + cart engine | React | Z. Zapico | J. Roquid | Oct 16 |
| 5 | Atomic deduction (`FOR UPDATE`) + ledger + **negative-qty rejection** | PHP/PDO | Z. Zapico | R. Gregorio | Oct 23 |
| 5 | Low-stock alert badges | React + PHP | J. Roquid | **R. Gregorio** | Oct 30 |
| 5 | **Test plan authoring (T01–T14)** **NEW — moved forward** | Docs | R. Gregorio | Z. Zapico | Oct 30 |
| 6 | IndexedDB queue + UUIDv4 idempotency | React + PHP | Z. Zapico | J. Roquid | Nov 6 |
| 6 | **IndexedDB quota / storage-exhaustion handling** **NEW** | React | J. Roquid | Z. Zapico | Nov 6 |
| 7 | USB recovery package + CSV ingestion | PHP | Z. Zapico | J. Roquid | Nov 13 |
| 8 | PhpSpreadsheet: Tab 1 Summary **(event + profit)** + Tab 2 | PHP | J. Roquid | Z. Zapico | Nov 13 |
| 8 | PhpSpreadsheet: Tab 3 Ingredient Usage + Tab 4 Restock + styling | PHP | J. Roquid | **R. Gregorio** | Nov 20 |
| 8 | **Automated daily `.sql` backup + USB mirror** (restores NFR-04) **NEW** | Ops | Z. Zapico | R. Gregorio | Nov 20 |
| 9 | **T01–T14 execution + defect burn-down** | LAN/USB | J. Roquid | R. Gregorio | **Nov 27** |
| 9 | **FEATURE FREEZE** | — | Z. Zapico | — | **Nov 27** |
| 10 | Production hardware + hotspot config | Host | Z. Zapico | J. Roquid | Dec 4 |
| 10 | **User Operational Manual + Installation Guide** **NEW** | Docs | R. Gregorio | J. Roquid | Dec 4 |
| 10 | **Barista & owner training sessions** **NEW** | Ops | J. Roquid | Client | Dec 11 |
| 10 | UAT sign-off + final manuscript | Docs | CTRL+STAY | Client/Panel | Dec 18 |
| 10 | **Post-turnover support window (6 months, LoA §3.1.3)** **NEW** | Ops | Z. Zapico | — | Jun 18, 2027 |

### 3.6 Role reconciliation (closes the LoA vs. plan conflict)

> **ADDENDUM A — Clarification of Team Role Designations**
>
> The Parties acknowledge that the role labels on the signature page of the Letter of Agreement do not match the designations in Project Plan Rev 2.3 §2.1, and agree the following are authoritative for all purposes under the Agreement:
>
> | Member | Authoritative Role |
> |---|---|
> | Zapico, Zaki | Project Manager / Lead Developer |
> | Gregorio, Rhea Mae | System Analyst / QA Lead |
> | Roquid, Jenny Lyn | QA & Testing Specialist |
>
> To preserve independent verification, no member shall be the sole author and sole verifier of the same deliverable. All other terms remain in full force.

Also correct the Project Plan cover page (D5 p.1 currently contradicts D5 p.12) and delete the duplicate `Prepared by: Jean Lyn Roquid — System Analyst` / `Reviewed by: Rhea Mae Gregorio — Tester/Documenter` block.

### 3.7 Letter of Agreement corrections

| Location | Change |
|---|---|
| §1.2 | Strike *"or PDF performance reports"* — scope is the 4-tab `.xlsx` workbook. |
| §1.1 | Replace *"Multi-Device Data Sync: Provide post-event data transfer mechanisms"* with: *"Multi-Mechanism Data Ingestion: Provide real-time local-LAN order ingestion during events, with an offline client queue and post-event USB/Excel recovery mechanisms as fail-safes."* |
| New §1.4 | Add: *"Host Dependency Disclosure: The Industry Client acknowledges that VenueVue operates as a locally networked system in which the host laptop is the single authoritative server, and that loss of the host during an event suspends system operation. The Industry Client agrees to maintain a secondary paper fallback for host failure, as provided in Project Plan §7.2."* |
| §1.3 | Restore the **automated daily `.sql` backup** commitment to match Project Plan NFR-04; Rev 2.1 deleted it while the Agreement still promises it. |
| §3.1.3 | Add: *"Support is provided for six (6) months from turnover, during which the Student Developers will address defects at no charge. New feature requests fall outside this Agreement."* |

### 3.8 Immediate remediation checklist

1. **Restore `CTRL Stay coding\` and `VenueVue\` from the Recycle Bin**, then archive both to `archive/flutter-prototype`. Keep codebase **A** as the working reference — B does not launch. **(CR-00)**
2. **Rotate the Supabase anon key**, add `.env` to `.gitignore`, `git rm --cached .env`, and purge the three seeded demo accounts. **(CR-08)**
3. Present **ADR-001** (§3.1) — including the corrected pivot history — for panel sign-off. This unblocks everything. **(CR-01/05/07, Decision 1)**
4. Present the **event-dimension scope correction** (§3.4, CR-09) and get the 9-table schema approved. **Without this the contractual workbook cannot be produced.**
5. Freeze the **wire contract** (§3.3.1) as a D1 appendix; treat it as immutable.
6. Replace the DDL with §3.2; replace `sync.php` with §3.3.2; replace the MySQL `root`/empty-password credentials with the least-privilege `venuevue_app` user. **(CR-03, CR-10, T-05, T-16)**
7. Delete `4. PROJECT PLAN.docx.pdf` (blank) and `7. SAMPLE LETTER OF AGREEMENT.docx` (barangay) from the pack; archive the three duplicate pairs and Rev 1.0–2.1.
8. Create the **Trello board** from §3.5 and export it as the required tracking artefact.
9. Author the **SRS** — the largest missing deliverable and a prerequisite for the Phase 3 gate.

---

## SECTION 4 — INTEGRATED MASTER PROJECT PLAN & TIMELINE

**Window:** 3 August 2026 (Mon) → 18 December 2026 (Fri) · **19.5 weeks** · 10 two-week sprints
**Feature freeze:** Friday **27 November 2026** · **1–18 December reserved for verification, training, and sign-off only**

### 4.1 Sprint calendar (named and dated — closes the "no sprints defined" gap)

| Sprint | Dates | Phase | Deliverable | Gate |
|---|---|---|---|---|
| **S1** | Aug 3 – Aug 16 | P1 Requirements | On-site study, SWOT, prioritisation, requirements | ✅ **G1 Aug 14** |
| **S2** | Aug 17 – Aug 30 | P1–P2 Design | Network topology, DDL, architecture review | ✅ **G2 Aug 28** |
| **S3** | Aug 31 – Sep 13 | P2 Design | React 19 + Vite 8 + Tailwind 4 scaffold, design tokens | ✅ **G3 Sep 4** |
| **S4** | Sep 14 – Sep 27 | P3 Foundation | Auth routing, **API session + RBAC**, Supabase removal, 7 Figma screens, **service-worker/tablet verification** | ⚠️ **G4 Sep 25 — overdue** |
| **S5** | Sep 28 – Oct 11 | P4 Master data | Product / Ingredient / **Event** / Recipe CRUD; client data load; **SRS + test plan** | 🔴 **G5 Oct 9** |
| **S6** | Oct 12 – Oct 25 | P5 Core POS | Touch POS grid, cart, **atomic deduction + ledger** | 🔴 **G6 Oct 23** |
| **S7** | Oct 26 – Nov 8 | P5–P6 Alerts & queue | Low-stock badges, IndexedDB queue, **UUIDv4 idempotency**, quota handling | 🔴 **G7 Nov 6** |
| **S8** | Nov 9 – Nov 22 | P7–P8 Recovery & reporting | USB/CSV ingestion, **PhpSpreadsheet 4-tab export**, daily `.sql` backup | 🔴 **G8 Nov 20** |
| **S9** | Nov 23 – Nov 27 *(1 wk)* | P9 Verification | **T01–T14 execution**, defect burn-down, **FEATURE FREEZE** | 🔴 **G9 Nov 27** |
| **S10** | Nov 30 – Dec 11 | P10 Handover | Production deploy, hotspot config, **manuals**, **training**, bug fixes | **G10 Dec 11** |
| **S11** | Dec 14 – Dec 18 | P10 Acceptance | UAT execution, client + panel sign-off, manuscript | 🏁 **G11 Dec 18** |

### 4.2 Critical path and float

```
9-table DDL ──► API auth/RBAC ──► Recipe deduction ──► Idempotency ──► Export engine ──► T01-T14 ──► FREEZE
  (Aug 28)        (Sep 25)           (Oct 23)             (Nov 6)         (Nov 20)       (Nov 27)
                      │                                    │
                      └──► CRUD (Oct 9) ──► POS grid (Oct 16) ┘
```

| Segment | Duration | Float |
|---|---|---|
| Aug 28 → Sep 25 | 4 weeks | 0 |
| Sep 25 → Oct 23 | 4 weeks | 0 |
| Oct 23 → Nov 6 | 2 weeks | 0 |
| Nov 6 → Nov 20 | 2 weeks | 0 |
| **Nov 20 → Nov 27 (all 14 tests)** | **1 week** | **0** |
| Nov 27 → Dec 18 | 3 weeks | **3 weeks — the only buffer** |

**Every task from Aug 28 to Nov 27 sits on a zero-float chain.** The entire reserve sits *after* the freeze, so it protects sign-off but **cannot absorb development slippage**. Mitigations, in priority order:

1. **Move test-plan authoring to S5 (Oct 30)** — the single highest-leverage change. Tests written alongside the engine are executable the day it lands.
2. **Split Phase 8 across two sprints** (Tabs 1–2 by Nov 13, Tabs 3–4 by Nov 20) so export failure cannot consume the whole verification week.
3. **Start T01–T03 as soon as the recipe engine commits (Oct 23)**, not at the freeze — removes ~2 weeks of end-loaded risk.
4. **Timebox G4.** Auth/RBAC is already 5 days overdue. If it misses **Oct 2**, cut Mechanism 3 (Excel/CSV batch ingestion) to a stretch goal — it is the least-used of the three and the only one droppable without touching Objectives 1, 2, 3, 4, or 7.
5. **Pre-agree the cut list, in order:** PDF export (already proposed for removal), Mechanism 3, multi-tablet testing beyond 2 devices, polish.
6. **Protect the event/`unit_cost` work in §3.2.** Tab 1 is the client's headline deliverable; it must not be traded away under schedule pressure.

### 4.3 Milestone acceptance criteria

| Gate | Date | Passes only when |
|---|---|---|
| **G4** | Sep 25 | Login returns a session token; an unauthenticated POST to `sync.php` returns **401**; a BARISTA calling a stock-edit endpoint returns **403** and writes an `AUDIT_LOGS` row; **zero Supabase calls** in the bundle; IndexedDB queue verified on a real tablet over the LAN IP |
| **G5** | Oct 9 | `SELECT COUNT(*)` on `information_schema.tables` returns the agreed table count; CRUD round-trips for products, ingredients, **events**, and recipes; client menu/recipe/cost data loaded |
| **G6** | Oct 23 | One order commits with correct total and change; `INVENTORY_TRANSACTIONS` gains one `SALE` row per ingredient; **a negative quantity is rejected with 422**; two concurrent tablets produce zero lost updates |
| **G7** | Nov 6 | Killing the server mid-checkout leaves the order `PENDING_LOCAL`; on restore it reconciles; replaying the same UUID creates **no** second order |
| **G8** | Nov 20 | A 4-tab `.xlsx` is produced in **≤ 10 s** with Tab 1 showing **event name, date, duration, gross revenue and net profit**; daily `.sql` dump exists on host **and** USB |
| **G9** | Nov 27 | **All 14 scenarios pass**; $A_{deduction}=100\%$, $R_{sync}=100\%$, $R_{duplicate}=0\%$, $p95\ L_{trans}\le 500$ms; zero P1/P2 defects open; **no new features after this date** |
| **G11** | Dec 18 | Signed UAT certificate; manuals delivered; training completed; final manuscript submitted |

### 4.4 Effort distribution

D1 §7.1 allocates **650 hours** (Zapico 250, Gregorio 220, Roquid 180) ≈ 33 h/week for Zapico over 19.5 weeks — sustainable only if the three-way implementation split truly ends. **Ratifying ADR-001 and archiving Flutter is what makes this budget achievable.** With three implementations in flight, 650 hours is insufficient; with one, it is. Note also that the identical 650-hour and ₱11,600/₱183,500 figures were reused across materially larger scope without re-costing (§1.4 SC-8) — **re-baseline the budget when the 9-table scope is approved.**

### 4.5 Status summary as of 23 September 2026

| Item | Claimed | Actual (audited) |
|---|---|---|
| Overall completion | 20% | **≈12–15%** |
| Phase 2: 8-table DDL | Completed Aug 28 | **6 of 9 required tables** |
| Phase 3: Auth routing | In Progress (due Sep 18) | **Overdue 5 days**; no server-side auth exists |
| Working end-to-end order sync | — | **0% — payload contract never matches (CR-01)** |
| PhpSpreadsheet export | Phase 8, Nov 20 | **0% — does not exist (CR-04)** |
| Per-event / profit reporting | Promised (Tab 1, "profit analytics") | **Unbuildable under the frozen schema (CR-09)** |
| Deliverable artefacts | 10 listed | **3 of 10 present** |
| Runnable clients | — | **1 of 3** (Flutter A); B crashes; React is Supabase-bound |

**Bottom line.** The project is not 20% complete against its own baseline; it is approximately **12–15%**, with its two highest-value features (working idempotent sync and Excel reporting) at **0%**, a data model that **cannot produce the client's headline report**, and a schedule that has already consumed its only slack. The pathway back is narrow but real:

> **Ratify the architecture decision this week · approve the event-dimension scope correction · archive the Flutter forks · freeze the wire contract · rebuild the schema to nine tables · front-load the test plan · hold the 27 November freeze.**

Do that, and 18 December becomes a comfortable sign-off rather than a scramble.

---

*Prepared as a Senior Technical Project Manager audit. Every technical claim is sourced to a file and line; every date is computed from the 3 August 2026 Monday start. Flutter findings were verified by static analysis (`flutter analyze`); `sync.php` was audited statically and was not executed against a live MySQL instance. Source code was read from Recycle Bin recovery paths because both project folders were deleted mid-audit.*
