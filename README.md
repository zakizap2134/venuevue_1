> Current implementation: [PHASE3.md](PHASE3.md) documents TravelBean MNL branding and role navigation polish. Start with [PHASE2.md](PHASE2.md) for management, reports, backup/restore and the required migration. [PHASE1.md](PHASE1.md) covers the underlying checkout, variant/batch schema, installation and recovery. The older setup below describes the original checkpoint; its demo credentials are not production setup instructions.

Hello
The latest codebase for VenueVue is now live on our GitHub repository. This release includes our completed Sprint 4 self-hosted authentication engine, database schema migrations, auto-injected device tracking, and the modernized Coffee & Latte UI layout.

Getting Started Locally
Clone the repository: git clone <YOUR_GITHUB_REPO_URL_THIS_REPO_>

Initialize Database: Start XAMPP MySQL and import database/schema.sql followed by database/migrations/002_auth_rev23_align.sql into venuevue_db.

Copy Backend: Copy the /backend directory to C:\xampp\htdocs\backend.

Install Dependencies: Run npm install in the project root.

Launch Application: Double-click RUN-VENUEVUE.bat to automatically launch MySQL, the local PHP API, and the React frontend.

Default Accounts
Owner Access (/admin): owner@venuevue.local | Owner#2026

Barista Access (/pos): barista@venuevue.local | Barista#2026

Please refer to README.md in the repository for detailed environment variables and troubleshooting notes. Please use STOP-VENUEVUE.bat when shutting down to preserve database state.

Best regards,

Project Manager, CTRL + STAY
