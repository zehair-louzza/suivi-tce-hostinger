# Hostinger + Supabase (Prisma 5)

## Runtime settings

- Express; root ./; build npm run build; entry scripts/start.mjs.
- NODE_ENV=production; PORT=3000; NPM_CONFIG_INCLUDE=dev.
- DATABASE_URL: Supabase PostgreSQL Session pooler URI, port 5432, stored only in Hostinger. URL-encode special characters in the password. Use TLS (sslmode=require), preserving existing URI query parameters.
- Keep JWT, cookie and CORS settings. Supabase API keys are not used by Prisma.

## Startup

The launcher starts Express immediately without migration subprocesses or database network waits. This avoids the observed Hostinger three-second listen deadline. The initial migration has already been applied according to the supplied runtime logs; this patch does not change it or transfer SQLite data.

The server trusts only loopback reverse proxies, matching the observed peer 127.0.0.1. Confirm the actual proxy topology and that the local proxy sanitizes forwarded headers before production use. Do not blindly trust all proxies.

GET /api/auth/me now runs authMiddleware before loading the user. Async auth route failures are forwarded to the Express 4 error handler. Existing cookie security and USER registration role are preserved. No demo account is seeded.

## Future database migrations (separate deployment step)

Back up the database and review pending SQL before execution. With the appropriate PostgreSQL credentials in the execution environment, run from the project root:

```sh
node scripts/migrate.mjs
```

This command runs the local Prisma migrate deploy and exits nonzero on failure. It is not invoked automatically by startup or build. Apply future migrations in a controlled deployment/release step before deploying code that depends on them. Do not run reset, force-reset, accept-data-loss or edit applied migrations. Keep database credentials out of Git and logs.

## Validation after redeploy

1. Confirm entry scripts/start.mjs and deployment of this commit.
2. Verify the startup no longer prints Applying pending PostgreSQL migrations.
3. Check server startup logs for errors and /api/health.
4. Login with the real account already registered: expect login 200 followed by me 200.
5. Without a valid session, me should return JSON 401, not terminate the process.
6. Wrong credentials should return JSON 401; invalid registration input should be handled without process exit.
7. Check registration, logout and refresh. Do not share cookies or tokens in diagnostics.

This patch was prepared by source inspection, not compiled or functionally tested here. Other routers and UI styling have not been audited or modified by this patch. Further errors require runtime logs and tests.
