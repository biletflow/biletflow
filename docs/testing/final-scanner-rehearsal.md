# Final rehearsal: scanner and admission (issue #117)

Owner of this workstream: utegenkamila. Issue #117 is shared by four contributors and does not assign individual deliverables explicitly; this scope follows the scanner and purchase-to-admission responsibilities in #98, #99 and #116. PDF, notifications, promo discount pricing, refund processing, support and admin UI sign-off remain shared team work.

## Automated regression

On an isolated migrated PostgreSQL database with the seed configuration and simulated payments, follow the root README and run:

```sh
pnpm --filter scanner typecheck
pnpm --filter scanner test
RUN_AUTH_INTEGRATION=1 pnpm --filter web exec vitest run src/lib/commerce.integration.test.ts src/lib/scanner.integration.test.ts
pnpm --filter web exec playwright test team-workflow.spec.ts
```

The Playwright workflow now connects fresh browser free and paid purchases to the actual scanner session controller and live Next.js API, using a storage adapter (not native camera). It checks assigned events, wrong-event rejection, non-ticket rejection, valid admission, duplicate rejection and the persisted check-in record. The existing commerce suite covers organizer publishing and simulated payment outcomes. See also PR #119 for cancelled/refunded scan coverage and physical-device checks.

## Demo accounts and preparation

Use only a disposable demo environment. Never reseed a shared or production database. Use passwords from the local seed configuration; do not put credentials or ticket codes in slides or screenshots.

- Organizer: organizer@biletflow.kz
- Attendee: register a fresh demo attendee in the web UI.
- Scanner: scanner@biletflow.kz (backup: scanner2@biletflow.kz).
- Platform admin: admin@biletflow.kz (for the team admin segment).
- Free event: KBTU Freshers Welcome; paid event: Almaty Jazz Night. Verify event availability and staff assignments before rehearsal.
- Phone and API must be on a reachable trusted network. Configure EXPO_PUBLIC_API_URL with the computer LAN address and start Expo following the scanner README.
- Keep a second screen displaying fresh ticket QR codes. Prepare separate unused cancelled/refunded fixtures and a real campaign QR in the isolated database.

## Scanner presentation segment (about 3 minutes)

| Time | Presenter action | Expected result |
| --- | --- | --- |
| 0:00 | Explain handoff from organizer to attendee; open My Tickets after purchase | Signed ticket QR is visible |
| 0:30 | Sign in on phone, choose the assigned event | Camera opens after permission |
| 1:00 | Scan fresh QR | Green VALID, attendee and ticket type |
| 1:30 | Scan the same QR again | Red ALREADY_CHECKED_IN |
| 1:50 | Scan campaign QR or ticket under wrong event | Red NOT_A_TICKET or WRONG_EVENT |
| 2:20 | Explain cancellation/refund rejection and network failure behavior | Only server VALID grants entry |
| 2:45 | Hand off to next presenter | Team can continue with support/admin segment |

If a network or camera problem occurs, stop admission, show the recorded test evidence if available and reconnect. Never present an untested recording or automated API result as a live phone pass.

### Slide-ready content

**Slide: Secure ticket admission**

- Assigned staff sign in and select an event.
- The scanner sends the raw QR and event ID to the check-in API.
- The server checks signature, event, ticket status and uniqueness.
- Only VALID confirms entry; duplicate, wrong-event, cancelled, refunded and promotional codes do not admit.

**Slide: Final testing and demo**

- Free and simulated paid checkout to scanner check-in.
- Decline/Abandon must not issue a ticket.
- RU / KK / EN interface review; physical camera and network recovery.
- Evidence: CI report, phone test matrix and team rehearsal log.

Speaker note: distinguish the automated browser/API path from the separate native-camera verification. Do not claim a completed rehearsal until the team actually rehearses.

## Sign-off record

| Check | Actual result / evidence |
| --- | --- |
| Browser free and paid purchase to scanner | Pending CI result |
| Decline and Abandon | Pending CI result |
| RU / KK / EN scanner sign-in and result headings | Pending manual device run |
| Cancelled/refunded/campaign/wrong-event/duplicate scans | Pending manual device run |
| Camera permission, reconnect, resume, logout | Pending manual device run |
| Presentation handoff and timing | Pending live rehearsal |

Record date, commit, CI URL, device model/OS, API environment, observed outcomes and defect links. No physical device or live team rehearsal has been performed as part of preparing this file. Keep #117 open until the team completes its remaining checks and rehearsal.
