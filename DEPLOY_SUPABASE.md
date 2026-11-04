# Hostinger + Supabase (Prisma 5)

## Required settings

- Framework: Express; root: ./; build: npm run build.
- Hostinger entry file: scripts/start.mjs (replace dist/server/index.js).
- NODE_ENV=production; PORT=3000; NPM_CONFIG_INCLUDE=dev.
- DATABASE_URL: the Supabase PostgreSQL Session pooler URI (port 5432), stored only in Hostinger secrets. Use the exact dashboard URI with the database password correctly URL-encoded. Require TLS using sslmode=require if not already configured; preserve existing URI query parameters.
- Keep the existing JWT, cookie and CORS settings. SUPABASE_URL and SUPABASE_API_KEY are not used by Prisma.

## First deployment

Use a dedicated Supabase database/schema with no existing application tables or valuable data. Back up any existing data before migrations. The connection role needs permission to create tables, indexes, constraints and the Prisma migration history. The current Supabase postgres role can bypass RLS; keep its password server-side only.

The new launcher executes the local Prisma CLI with migrate deploy before importing the compiled Express server. It does not use npx downloads, db push, reset, forced data loss or demo seeding. If a migration fails or exceeds 180 seconds, the server does not start. A failed initial migration requires investigation, not an automatic reset.

The initial migration creates users, devis, interventions and enables RLS without public API policies. The application continues to use its own Express JWT authorization and Prisma database connection, not Supabase Auth. Do not add public access policies for these tables, especially users containing password hashes.

Changing npm start alone is insufficient when Hostinger launches the configured entry directly. Always set Entry file to scripts/start.mjs. Builds alone do not apply this migration. If running outside Hostinger, use node scripts/start.mjs from the project root.

## Verify

Runtime logs should show migrations applied, then Migrations complete. Starting Express..., then Server running on port 3000. Check /api/health and register a real account using the application; no demo account is created automatically. Inspect the assigned user role before granting administrative privileges.

Subsequent restarts apply only pending committed migrations. Never edit an already applied migration. Prepare and review new migrations separately; keep database backups. Existing SQLite data is not transferred by this change. This patch was prepared by source inspection and must still be validated by build/runtime logs and functional tests.
