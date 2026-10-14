# Integration testing — #68

Backend/auth checks, 14 October 2026. Base: `5cee301`.

The HTTP suite starts from the same payloads used by the web forms and scanner.
It calls a running Next.js server, so routing, cookies, redirects and database
reads are tested together. It does not click through the UI or run Expo.

## Coverage

- Anonymous requests to organizer/admin pages redirect to sign-in in ru, kk and en.
- Web registration creates an attendee; its cookie works with `/api/me`.
- An attendee cannot open either dashboard.
- Seeded organizer/admin accounts can open their own dashboard and are redirected
  away from the other one.
- Scanner login returns a bearer token and event staff assignments. `/api/me`
  accepts that token; server-side logout invalidates it.
- Suspending an organizer blocks both `/api/me` and the organizer page, including
  a session issued before suspension.
- Incorrect passwords and malformed mobile JSON are rejected.
- Web logout invalidates the old cookie and protects the dashboard again.

The existing suite also checks role injection, session expiry, origin checks,
rate limiting, and audit commit/rollback.

## Bug found

With an existing organizer cookie, setting the account to `SUSPENDED` made
`/api/me` return 403, but `/en/organizer` still returned 200. The page guard only
checked the session's role. It now uses `requireUser`, the same current-account
check as the API. Authentication failures return the user to sign-in; unexpected
server errors still propagate.

## Running the checks

Use a disposable local database. The seed deletes and recreates data.
Migrate and seed it, then start the web server with `DATABASE_URL`,
`BETTER_AUTH_URL` and `BETTER_AUTH_SECRET` set. The test process must use the same
database and auth URL as the server.

- Existing database tests: set `RUN_AUTH_INTEGRATION=1`, then run `pnpm test`.
- HTTP tests: set `RUN_HTTP_INTEGRATION=1`, then run
  `pnpm --filter web exec vitest run src/lib/auth.http.test.ts`.

CI creates a PostgreSQL service, applies migrations, runs the existing tests,
seeds the database, starts Next.js and runs the HTTP suite separately.
Local validation uses a temporary PGlite database; CI checks PostgreSQL 16.
Local result: 7 QR tests, 11 auth/audit tests and 9 HTTP tests passed after the
guard fix. The updated scanner's 18 controller tests (mocked network/storage)
also passed. Workspace lint and typecheck passed as well.

## Still needed for team sign-off

- Check form interactions, visible error text and redirects in a real browser.
- On a phone, check scanner login, secure token restoration, camera permissions
  and sign-out. The scanner currently clears its saved token locally on sign-out;
  it does not call the server logout endpoint tested above.
- End-to-end purchase/payment/check-in is outside this auth suite. The current
  scanner still displays “Awaiting server verification.”

Keep #68 open until the team has completed the browser and device checks.
