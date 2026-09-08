# Delivery plan

4 people. Planning started week 4 of 12 with no code. Weeks 4–12 remain.

The SRS sizes this for 5 people with 12 weeks. Two consequences drive everything below:
one TypeScript codebase so D and A can write server code, and scope cuts made now rather
than in week 10.

## Scope

**Build, in priority order:** auth + roles → organizer profile → event CRUD/publish →
ticket types + inventory → free registration → QR ticket + email → scanner check-in →
paid activation → simulated checkout + webhook → PDF ticket → refunds → promo + campaign
QR → admin moderation → support chat → analytics → audit timeline → Docker.

**Thin on purpose:**

| Feature | Version we build |
| --- | --- |
| Support chat | 2 tables, REST + 10s polling, 4 statuses, no attachments |
| Admin portal | shadcn data tables + suspend + activation queue |
| Analytics | 3 aggregation endpoints, nothing precomputed |
| Audit trail | 1 append-only table + `audit()` helper |
| Notifications | Email only, 1 layout, 11 templates |
| Refunds | Whole order, one click |
| i18n | `ru` + `en` complete, `kk` filled week 11 |

**Cut. Restore only if week 10 is green:** assigned seating and seat map, calendar export
(cheapest to restore, ~2h), GA4, offline sync, message attachments.

## Owners

One primary owner per area, review from one other.

| | Role | Owns |
| --- | --- | --- |
| A | Sole PM + design | Board, acceptance criteria, Figma. Then organizer + admin UI |
| D | Tech lead | Attendee web, PDF, i18n, integration, release |
| Z | Backend | Schema, auth, orders, inventory, payments, refunds, promos, analytics |
| K | Mobile + check-in | Expo app *and* its endpoints: signing, `/api/checkin`, undo, search |

D is not a second PM. Z is the critical path — keep Z out of meetings.

**Cadence:** standup 3x/week (20 min), Monday scope review, Friday demo of merged work.

## Schedule

| Week | Focus | Gate |
| --- | --- | --- |
| 4 | Decisions, schema, monorepo, CI, Docker, auth, wireframes, Expo camera | Everyone can `infra:up`, register, log in, see a role-gated page |
| 5 | Event CRUD + publish, ticket types, event page, scanner sign-in | — |
| 6 | **Free flow end to end:** order → ticket → QR → email → scan → check-in | Second scan rejected. If red Friday, cut promo + support to stubs |
| 7 | Simulated gateway + webhook, atomic reservation, activation, refunds, PDF | — |
| 8 | Campaigns, campaign QR, admin portal, audit timeline UI | — |
| 9 | Analytics dashboard, support chat, notifications, event history + duplication | — |
| 10 | **Feature freeze.** Seed data, E2E, concurrency tests, bug bash | Full demo runs clean |
| 11 | Accessibility, `kk` strings, docs, 2 demo rehearsals | — |
| 12 | Buffer, final rehearsal, submission | — |

**10-week term:** merge weeks 8–9 by cutting support chat to one thread with no assignment
and analytics to 4 cards + 1 chart. Week 10 stays reserved.

## Demo flow to rehearse

1. Organizer creates event, activates paid sales, creates a campaign.
2. Attendee scans the campaign QR, sees the discount pre-applied, completes checkout.
3. Email arrives, attendee downloads and prints the PDF.
4. Event admin scans the paper ticket. Check-in succeeds.
5. Second scan rejected.
6. Campaign QR scanned at the door — rejected as not a ticket.
7. Organizer opens analytics and the activity timeline.
8. Admin suspends the event; sales stop.

## Risk

Z is a single point of failure on schema, money, and inventory. Mitigated by full-stack
TypeScript (D and A write their own read and CRUD handlers) and by K owning the check-in
vertical. If Z slips two weeks, demo the free flow flawlessly and show the paid path as
partial — which is why the free flow ships in week 6.
