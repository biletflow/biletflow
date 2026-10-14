# Team-wide integration testing (issue #68)

One shared suite covers the currently implemented attendee web, organizer/admin
shells, authentication API, audit helper and mobile scanner session flow.

| Area | Automated coverage |
| --- | --- |
| Public attendee web | Seeded event list/detail and sign-in/sign-up pages in EN, RU and KK |
| Web authentication | Browser form submission, invalid password, signup, cookie persistence, logout, expired and suspended sessions |
| Organizer shell | Seeded own events, including drafts; exclusion of another organizer's events; admin access denied |
| Admin shell | Seeded user rows and role; no password displayed; anonymous and attendee access denied |
| API and database | Existing auth/audit integration and HTTP tests: validation, role/status injection, origins, rate limits, bearer/cookie sessions and audit rollback |
| Scanner | Both seeded scanner accounts against the running Next.js API; existing controller and HTTP/PostgreSQL integration suites cover restore, revoked assignments, expiry, suspension, network/storage failures and logout races |

## Reproduce

Use a disposable development/test database. Never run the seed against a database
containing user data: it replaces the dataset.

1. Configure the root environment as described in README. Start PostgreSQL, install
   the pinned workspace dependencies, generate the Prisma client and deploy migrations.
2. Run the existing integration tests with `RUN_AUTH_INTEGRATION=1`.
3. Seed the disposable database with `pnpm --filter @biletflow/db run seed`.
4. Install Chromium: `pnpm --filter web exec playwright install --with-deps chromium`.
5. Export the environment variables to the web process, including `DATABASE_URL`,
   `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=http://localhost:3000` and
   `NEXT_PUBLIC_APP_URL=http://localhost:3000`.
6. Run `pnpm --filter web exec playwright test`. Playwright starts the Next.js dev
   server. Set `E2E_REUSE_SERVER=1` to use an already running local server.

The browser tests read the local seed configuration's demo password; use
`E2E_PASSWORD` only if the seeded credentials were intentionally changed.
New signup fixtures use unique addresses and are removed after the suite. Tests
that alter account/session status only touch their own generated fixtures.

## CI evidence

CI runs workspace lint/typechecks, unit/controller and PostgreSQL integration
suites, the existing live HTTP suite, then eleven Chromium browser scenarios.
The `team-integration-report` artifact contains the browser HTML report and
screenshots/traces for failed scenarios. The PR records the completed CI run.

## Boundaries

Camera hardware, native OS permission dialogs and actual Expo SecureStore on a
physical phone remain device checks described in `apps/scanner/README.md`.
The automated scanner storage adapter substitutes device storage while using
the real API. QR recognition does not yet perform admission/check-in verification.
Checkout/payment/check-in endpoints outside the currently implemented milestone
are not certified by this suite.
