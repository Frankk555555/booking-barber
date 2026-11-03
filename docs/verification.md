# Verification — 2026-11-03 (Asia/Bangkok)

Verified on Windows with Bun 1.4.4, Node.js 26.13.0, Next.js 15.5.28 and native PostgreSQL 18.

| Check | Result |
| --- | --- |
| Frozen dependency installation | Passed; lockfile matches exact manifest versions |
| TypeScript strict check | Passed |
| ESLint including Next.js rules | Passed |
| Prettier format check | Passed |
| Unit tests | 6 passed |
| Integration tests against real PostgreSQL | 17 passed |
| Playwright | 6 passed across desktop and mobile |
| Production build | Passed for all routes |
| Production runtime smoke | HTTP 200; healthy database; unauthenticated admin API returns 401; no browser errors |
| Responsive checks | No document overflow at desktop, 390px and 320px |
| Backup and restore | Custom-format dump restored into a new database; core row counts match |
| PostgreSQL stop/start | Counts and row fingerprints of all 10 tables in both app and test databases remained identical |

The integration suite verifies overlapping concurrent requests, duplicate request replay, direct database exclusion constraints, atomic rescheduling, cancellation release, exact two-hour cutoff, token isolation, disabled sign-up, snapshot preservation, calendar edits conflicting with existing appointments, status transitions, origin checks, stale quote confirmation, and holidays racing with bookings.

Playwright verifies the complete customer booking/receipt/reschedule/cancellation path and admin login, offline booking, day/week/list views, service creation, staff creation and shop settings persistence. Test databases are separate from application data.

Production screenshots: `.local/previews/production-desktop.png`, `production-mobile.png`, and `production-small-mobile.png`.

## Local setup notes

- The existing PostgreSQL Windows service on port 5432 was not modified.
- The app uses its own native cluster on 127.0.0.1:5433 with persistent files under `.local/postgres-data`.
- Registering that cluster as a Windows service was not permitted by the current Windows account. Use `bun run db:start` after boot, or stop this cluster first and run the setup script from an Administrator PowerShell to register it.
- Next.js build emits non-fatal monorepo ESLint detection warnings; standalone lint passes. Better Auth uses a shared per-path rate-limit bucket when a client IP is unavailable behind the local rewrite.
- 21st catalog search returned HTTP 401; the UI uses local shared primitives. 21st review completed with informational CSS color-token suggestions.
- No website was deployed and no customer messaging or payments were added.