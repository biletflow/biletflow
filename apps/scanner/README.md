# Expo scanner reference

Flutter is the final mobile client. The following Expo notes and test matrices are historical; see [Flutter setup](../mobile_flutter/README.md) and #198 for final device checks.

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

## Issue #98 admission acceptance checklist

Run the automated checks before merging:

```sh
pnpm --filter scanner typecheck
pnpm --filter scanner test
```

On a **physical iOS or Android phone** with the API reachable via LAN:

1. Sign in as assigned staff. Confirm that only assigned events appear. An
   account with no scanner assignment must not gain camera access.
2. Select an assigned event; allow camera access. Deny permission on a clean
   installation and confirm the Settings recovery route after permanent denial.
3. Scan a real My Tickets QR. Only a server `VALID` result grants admission.
   The resulting screen displays attendee name, ticket type, and seat (if any).
4. Scan the same ticket again: expect `ALREADY_CHECKED_IN`. Scan a campaign QR,
   an unknown QR, and a ticket for another event. Each must be rejected.
5. Turn off the API/network during a scan. Confirm that admission is **not**
   reported and Scan again recovers after network access returns.
6. Revoke the staff assignment while the app is open. A denied check-in or
   events reload must clear the session. Background/foreground must revalidate.
7. Switch events and verify no prior result survives; sign out and restart.

**Physical-device verification is pending** until a tester records the device,
OS version, API environment, and results of steps 1 through 7. Automated tests
do not constitute device verification.


## Issue #116 physical-phone test matrix

Use an isolated development database only; do not modify real tickets.
Start the web server with `pnpm --filter web exec next dev --hostname 0.0.0.0`
after following the root README infrastructure and database setup.
Connect the phone and computer to the same trusted network, set
`EXPO_PUBLIC_API_URL=http://<computer-LAN-IP>:3000` in the scanner environment,
and start Expo. Open that server URL in the phone browser first to confirm
reachability. Use a compatible Expo Go version or a development build.

Prepare two assigned events, a fresh valid ticket, two separate unused tickets
with CANCELLED and REFUNDED status in the isolated database, and a campaign QR.
Use actual signed ticket codes from My Tickets or test database fixtures; do not
construct fake signatures. Display the codes on a second screen for scanning.
For the wrong-event case, select the other assigned event and scan the fresh
ticket before using it for valid admission.

| Case | Expected API result | Expected device behavior | Actual |
| --- | --- | --- | --- |
| Wrong event | WRONG_EVENT | Red; no admission | Not run |
| Fresh valid ticket (correct event) | VALID | Green; attendee and ticket details | Not run |
| Same ticket again | ALREADY_CHECKED_IN | Red; no second admission | Not run |
| Cancelled ticket | CANCELLED | Red; no admission | Not run |
| Refunded ticket | REFUNDED | Red; no admission | Not run |
| Campaign QR | NOT_A_TICKET | Red; no admission | Not run |
| Forged ticket signature | INVALID | Red; no admission | Not run |
| Network unavailable during scan | Request fails | No green result; retry after reconnect | Not run |

Press Scan again between scans. Confirm one check-in record exists for the valid
ticket and none for rejected tickets. Repeat the permission, background/resume
and logout checks above. Record device model, OS, Expo version/build, commit SHA,
API environment, date, tester, actual results and any defects. Avoid recording
session tokens or real attendee data.

Status: **physical device verification pending**. The automated scanner and
commerce tests cover response handling and server decisions, not camera or
native OS behavior. Do not close #116 until the phone run is recorded and any
device defects are resolved.
