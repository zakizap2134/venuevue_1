# Phase 3 — TravelBean MNL presentation polish

Completed October 18, 2026 on `feature/phase3-branding`, based on Phase 2 commit `f4374f8`. Includes Phases 1 and 2; nothing is pushed or merged automatically.

## Changes

- TravelBean MNL wordmark on sign-in, shared header, browser title and sale confirmation. VenueVue remains the software name. The existing decorative cup icon and warm coffee/cream palette are retained; no official client logo artwork or brand manual was supplied for this phase.
- Owner badge reads “Owner / Admin.” Existing role guards are preserved: Barista has Register only; Owner/Admin has Register and Management.
- Owner Management includes catalogue, inventory, batches, recipes, sales reports, staff/recovery, audit, backup/restore and Settings. Settings exposes the existing browser-local theme preference and points to existing account/data controls; it adds no business-rule editor or backend API.
- Calmer selected-navigation styling, consistent spacing/focus treatment, dark-mode foreground contrast, small-screen card layout and backup-preview count alignment.
- Sign-in wording clarifies that internet independence still requires the host and local Wi-Fi to operate.

## Scope and verification

No backend, API, database migration, transaction, inventory, VAT, queue, authentication-context or route-guard implementation changed. Receipt numeric fields and formatting functions are unchanged.

Passed production build, eight pending-order unit tests, full Phase 1/2 database integration suite and both browser workflows. Additional browser assertions check branding/title, direct Barista `/admin` redirect to Register, absence of Barista Settings, both owner navigation links, owner Settings and light/dark switching. Screenshots reviewed for dark owner Settings and tablet Register. Existing browser checks verify no tablet document overflow or JavaScript errors.

Deploy the matching frontend build with the already-installed Phase 2 backend. This phase requires **no additional database migration**. Installations still on original main need the Phase 1 and Phase 2 setup/migrations first: see [PHASE2.md](PHASE2.md). Physical-tablet and Windows/XAMPP client acceptance testing remain required; this is not a claim of production or fiscal certification.
