# BiletFlow team demo validation (#88)

This checklist is not evidence of a completed end-to-end run.

## Preconditions
- Use an isolated migrated and seeded test database.
- Configure simulated payments and server-side ticket signing.
- Prepare organizer, attendee, admin and assigned scanner accounts.

## Scenarios
1. Organizer creates and publishes an event with free and paid ticket types.
2. Attendee books a free ticket; server issues one signed QR.
3. Assigned scanner admits it once; repeat scan returns ALREADY_CHECKED_IN.
4. Organizer accepts paid-sales terms and pays a simulated activation fee; platform admin approves and required payout/identity checks are satisfied.
5. Attendee pays through simulated Approve; verified webhook issues one paid ticket; scanner admits it once.
6. Repeat checkout with Decline and Abandon; neither produces a valid ticket.
7. Retry payment webhook and ensure idempotency (no duplicates).
8. Scan campaign QR, invalid QR and a ticket for a different event: expect NOT_A_TICKET, INVALID and WRONG_EVENT.
9. Check inventory counters, rejected unauthorized access, and RU/KK/EN flows.

## Evidence required
Record CI URL, browser/screenshots, manual device testing, expected vs actual outcomes, dates and testers before closing issue #88.