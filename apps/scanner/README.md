# Authenticated scanner workflow

Start the web/API server and seed the development database following the root
README. In `apps/scanner/.env.local`, set `EXPO_PUBLIC_API_URL` to the web server's
URL reachable from the phone (use the computer's LAN address, not `localhost`).
Run `pnpm --filter scanner start` and open the app in Expo Go or a development build.
Use the seeded scanner account and its password from your local seed configuration.
Both seeded scanner accounts are supported: access requires an `EVENT_ADMIN`
assignment returned by the server. A global `ATTENDEE` role alone does not grant
scanner access. Check-in authorization must still be enforced server-side.

## Automated checks

`pnpm --filter scanner typecheck` and `pnpm --filter scanner test` check the
session controller with mocked network and secure storage. CI runs these tests.
They cover login, current assignments, session expiry/suspension, network retry,
malformed responses, storage failures, duplicate submits, app resume, and logout
racing with a pending token write.

## Device verification

These camera/OS checks require a physical device and are not covered by controller tests:

1. On a fresh install, select RU, KK or EN. Verify empty/incorrect credentials show
   errors and the camera stays closed. Sign in with a seeded scanner account.
2. Deny camera permission, then grant it. If the OS blocks further prompts, use
   **Open settings**, enable the camera and return to the app.
3. Scan a ticket, promotional QR and unknown QR. Only the first scan is displayed
   until **Scan again** is pressed. Recognition alone does not admit the attendee;
   the app still awaits server verification.
4. Restart the app: the saved token must be verified before the camera opens.
   Stop the API or disconnect Wi-Fi: the retry screen must keep scanning blocked.
   Restore connectivity and press **Retry**; no new login should be necessary.
5. Background the app, revoke its event assignment or expire/suspend its session
   in the development database, then resume: it must return to sign-in.
6. Sign out from the camera, permission or result screen. Restart: the login screen
   must remain visible. Sign-out clears the local token; it does not revoke the
   server session on other devices.
