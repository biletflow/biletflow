# Authentication and audit

Implements the backend scope in issues #54–#57. Existing UI components are unchanged.

## Web integration

Better Auth is mounted at `/api/auth/[...all]`. Use its client for
`signUp.email`, `signIn.email`, `signOut`, and session access, or call the
corresponding `/api/auth/sign-up/email`, `/sign-in/email`, and `/sign-out` routes.
Web requests use the session cookie. Sign-up uses the shared `signUpSchema`:
name, email, password (10–200 characters), and optional `locale` (`ru`, `kk`, `en`).
Public sign-up always creates an `ATTENDEE`; clients cannot set role or status.
The existing seed password hash format is reused.

`GET /api/me` returns `{ user: { id, name, email, emailVerified, image, role,
status, locale, organizerProfile, staffAssignments } }`.
The optional organizer summary contains `id`, `displayName`, `verificationStatus`.
Each staff assignment contains `eventId` and `role`.
No account credentials or session tokens are included in this response.

## Scanner integration

Send JSON `{ "email": "scanner@biletflow.kz", "password": "Password123!" }`
to `POST /api/mobile/auth/login`. Success is `{ token, user }`; store the token
in native secure storage and send `Authorization: Bearer <token>` thereafter.
No cookies are returned by this mobile wrapper. This is a session token, not a JWT.
For logout, POST `{}` to `/api/auth/sign-out` with the bearer header, then remove
the locally stored token. `/api/me` accepts both web cookies and bearer tokens.

Login authenticates any active account. It does not grant permission to scan an
arbitrary event. The scanner demo user has global role `ATTENDEE` and per-event
`EVENT_ADMIN` assignments. Future check-in routes must check the assignment for
the requested event; do not use the global role alone. `requireRole(headers, roles)`
checks an explicit list of global roles; it does not infer a hierarchy.

Missing, invalid, revoked or expired sessions receive 401. Suspended accounts
receive 403 from our protected routes, including for existing sessions.
Mobile malformed input receives 400; too many login attempts receive 429.
Our routes use `{ error: { code, message } }`, with stable codes for clients to
translate. The standard Better Auth routes keep the library's own error format
for compatibility with its client. New codes: `RATE_LIMITED`, `INTERNAL_ERROR`.
Rate limiting uses Better Auth's in-process storage; a multi-instance deployment
must configure shared rate-limit storage and trusted proxy/IP handling.

## Audit helper

Call `audit()` with the **same transaction** as a business mutation:

```ts
await prisma.$transaction(async (tx) => {
  await tx.event.update({ where: { id: eventId }, data: { title } });
  await audit(tx, {
    actorUserId: user.id,
    eventId,
    action: "event.updated",
    entityType: "Event",
    entityId: eventId,
    description: "Event title updated",
    metadata: { title },
  });
});
```

Do not pass request bodies, passwords, cookies, tokens, or unnecessary personal
data into metadata. The helper deliberately does not swallow database errors.
Business changes and their audit entry then commit or roll back together.
This helper is ready for future business routes; it does not automatically audit
every internal Better Auth session/account operation.

## Database and checks

Apply `pnpm db:deploy`, then `pnpm db:generate`. The new data migration changes
legacy credential `accountId = email` to `accountId = userId`, as required by
Better Auth 1.7.3. It preserves users, password hashes, and other data. The seed
now creates compatible credentials too. Do not reset an existing shared database.

Run `pnpm typecheck`, `pnpm lint`, and `pnpm test`. Integration tests require a
migrated development/test database, `DATABASE_URL`, `BETTER_AUTH_URL`,
`BETTER_AUTH_SECRET`, and `RUN_AUTH_INTEGRATION=1`. They skip without this opt-in;
CI enables it against its dedicated PostgreSQL test service. They create unique
test users and remove them afterward. Do not run them against production.

Covered: missing/forged credentials, input validation, seed-format passwords,
bearer and cookie sessions, role checks, organizer/staff data, suspension,
sign-up privilege injection, logout, session expiry, login origin checks,
rate limiting, audit commit and rollback.

Email verification delivery and password-reset delivery are not configured in
this milestone. Sign-in/sign-up UI wiring remains the frontend task.

References: [Better Auth Next.js](https://better-auth.com/docs/integrations/next),
[Prisma adapter](https://better-auth.com/docs/adapters/prisma),
[bearer plugin](https://better-auth.com/docs/plugins/bearer).
