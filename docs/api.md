Bodies are validated by [`packages/shared/src/schemas`](../packages/shared/src/schemas/index.ts)

| Convention | |
| Location | `apps/web/src/app/api/**/route.ts` |
| Auth | Web: better-auth session cookie. Mobile: `Authorization: Bearer <token>` |
| Errors | `{ error: { code, message, details? } }` — `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_FAILED`, `SOLD_OUT` `HOLD_EXPIRED`, `PROMO_INVALID`, `ALREADY_CHECKED_IN`, `NOT_A_TICKET`, `CONFLICT` |
| Money | Integer KZT, fields suffixed `Kzt` |
| Idempotency | Anything creating money or tickets requires `clientIdempotencyKey` |

## Auth

Implemented auth response shapes, role checks, migration notes and audit usage:
[backend-auth.md](backend-auth.md). Better Auth routes retain their native error format.

| `POST` | `/api/auth/[...all]` | better-auth handler: sign-up, sign-in, sign-out, verify email, reset password |
| `GET` | `/api/me` | Current user, role, organizer profile summary |
| `POST` | `/api/mobile/auth/login` | Returns a bearer token for the scanner app |
| `POST` | `/api/auth/sign-up/email` | `{ name, email, password, locale }`. Role and status from the client are ignored. A verification email is sent when mail is available; login is not blocked on it |
| `POST` | `/api/auth/request-password-reset` | `{ email }` |
| `POST` | `/api/auth/reset-password` | `{ newPassword, token }` |

## Organizer profile and payouts

| `GET` `PUT` | `/api/organizer/profile` | `organizerProfileSchema` |
| `POST` | `/api/organizer/verification` | `identityVerificationSchema`. Marks the profile `PENDING_REVIEW` with a simulated document reference. No file bytes are stored |
| `GET` `POST` | `/api/organizer/payout-accounts` | `payoutAccountSchema` |
| `GET` | `/api/organizer/payouts` | Stored simulated payout rows. Not recomputed from orders, and not the analytics net |

## Events

| `GET` | `/api/events` | Public listing. Only `PUBLISHED` + `PUBLIC`. Filters: category, date, query |
| `GET` | `/api/events/:slug` | Public event page payload including visible ticket types |
| `GET` | `/api/events/:slug/seats` | Free seats for a published assigned-seating event |
| `POST` | `/api/events/:slug/report` | `eventReportSchema`. Signed-in user reports a published event |
| `POST` | `/api/organizer/events` | `eventInputSchema` |
| `GET` `PUT` | `/api/organizer/events/:id` | `eventInputSchema` |
| `POST` | `/api/organizer/events/:id/publish` | Rejects if no visible ticket type exists |
| `POST` | `/api/organizer/events/:id/unpublish` | |
| `POST` | `/api/organizer/events/:id/cancel` | Cancels, auto-refunds paid orders, notifies attendees, bumps `calendarSequence` |
| `POST` | `/api/organizer/events/:id/duplicate` | New `DRAFT`; copies config only, never orders, tickets, payments, check-ins, or cases |
| `GET` | `/api/organizer/events/:id/history` | Audit timeline. Filters: `from`, `to`, `action` |

## Ticket types

| `GET` `POST` | `/api/organizer/events/:id/ticket-types` | `ticketTypeInputSchema` |
| `POST` | `/api/organizer/events/:id/sections` | `venueSectionSchema`. Requires a venue on the event |
| `POST` | `/api/organizer/events/:id/sections/:sectionId/rows` | `seatRowSchema`. Creates the row and its seats |
| `POST` | `/api/organizer/events/:id/rows/:rowId/seats` | `addSeatsSchema`. Adds seats to a row that already exists |
| `GET` | `/api/organizer/events/:id/seats` | Full map for that event |
| `DELETE` | `/api/organizer/events/:id/seats/:seatId` | Deletes one free seat |

### Seat map

Sections, rows and seats belong to the venue. A live hold belongs to one event, so two events in the same venue can reserve the same physical seat.

Who may change the map: the platform admin, or an organizer when every event at that venue is theirs. If another organizer also uses the venue, map changes return `403`. Reading `GET /api/organizer/events/:id/seats` still requires only ownership of that event.

`GET /api/organizer/events/:id/seats` response:

```json
{
  "sections": [
    {
      "id": "section-id",
      "name": "Stalls",
      "displayOrder": 0,
      "rows": [
        {
          "id": "row-id",
          "label": "A",
          "seats": [
            { "id": "seat-id", "number": "1", "isAccessible": false, "status": "AVAILABLE" }
          ]
        }
      ]
    }
  ]
}
```

`status` is `AVAILABLE`, `HELD`, `SOLD`, or `UNAVAILABLE`. `UNAVAILABLE` means `Seat.status` is not `AVAILABLE` and the seat is not currently held or sold for this event. Held and sold win over the physical status. A sold or held seat, including one held or sold by another event in the same venue, cannot be deleted (`409`). Deletion locks the seat row. A checkout that starts at the same time either keeps the seat, or receives `404` or `409` if the seat is already gone.

`POST /api/organizer/events/:id/rows/:rowId/seats` body:

```json
{ "seats": [{ "number": "14", "isAccessible": false }] }
```

`201` returns `{ "seats": [{ "id", "number", "isAccessible", "status": "AVAILABLE" }] }`. A repeated number in that row is `409`.

`PUT /api/organizer/events/:id` keeps the current `seatingMode`, `venueId`, `visibility`, `timezone`, and `refundPolicy` when those fields are omitted. Sending a different `seatingMode` or `venueId` after any order, hold, or ticket is `409`.

Public `GET /api/events/:slug/seats` returns only `AVAILABLE` seats for a published assigned-seating event (`PUBLIC` or `UNLISTED`). A general-admission event returns `404`. Its checkout must omit `seatIds`; sending any is `400`.

Assigned checkout item: `{ "ticketTypeId", "quantity", "seatIds" }`. `seatIds.length` must equal `quantity`, ids must be unique, and each seat must belong to the event venue and have physical status `AVAILABLE`. A mismatch is `400`. A missing, foreign, or physically unavailable seat is `404`. A seat already held or sold for this event is `409` with code `SOLD_OUT`. The insert locks the seat row. The order item, the order response, and `GET /api/tickets` include `seatId`, `sectionName`, `rowLabel`, and `seatNumber`. General admission leaves those fields `null`.

Declined, abandoned, expired, and cancelled checkouts release the hold and the reserved inventory together. Payment approval, expiry, and cancellation lock the order row, so two approvals of the same order issue one ticket. A successful refund or event cancellation marks the ticket `REFUNDED` (`invalidatedAt` is set). Check-in then returns `REFUNDED`, and the seat can be sold again. A checked-in ticket cannot be refunded by the organizer (`409`).

Check-in success and `ALREADY_CHECKED_IN` both include `ticket.seatLabel` (`"Stalls A 1"`, or `null` for general admission).

| `PUT` `DELETE` | `/api/organizer/ticket-types/:id` | Delete is refused once tickets are sold; hide instead |

Every response includes the counters `quantity`, `sold`, `reserved`, `refunded`,
`checkedIn`, `available` (SRS 4.3).

## Paid sales activation

| `GET` | `/api/organizer/events/:id/activation` | The checklist state: five booleans plus the fee amount |
| `POST` | `/api/organizer/events/:id/activation/pay-fee` | Creates an `ACTIVATION_FEE` payment intent |
| `POST` | `/api/organizer/events/:id/activation/simulate` | `{ intentId, outcome }`. Settles that simulated fee without a client webhook secret. `outcome` is `APPROVED`, `DECLINED`, or `ABANDONED` |
| `POST` | `/api/organizer/events/:id/activation/accept-terms` | |
| `POST` | `/api/admin/activations/:id/review` | Platform Admin approves or rejects the simulated KYC |

## Checkout

| `POST` | `/api/promo/preview` | `applyPromoSchema`. Server-calculated discount and new total. Never trusts a client-supplied amount |
| `POST` | `/api/orders` | `createOrderSchema`. Reserves inventory atomically, returns the order with `expiresAt`. Free orders return `PAID` immediately with tickets issued. Assigned seating sends `seatIds` whose length matches `quantity`; each seat is held by one conditional insert and copied onto the ticket |
| `GET` | `/api/orders/:id` | |
| `POST` | `/api/orders/:id/cancel` | Releases reservation |
| `POST` | `/api/orders/:id/refund` | `refundOrderSchema`. Simulated refund when the event refund policy window is still open. Checked-in tickets are refused. Repeating the request does not create a second refund |
| `POST` | `/api/orders/:id/pay` | Creates a payment intent, returns the simulated gateway URL |
| `POST` | `/api/orders/:id/pay/simulate` | Authenticated mobile/demo settlement (`APPROVED`/`DECLINED`/`ABANDONED`). Signs the webhook server-side; no client secret |
| `GET` | `/api/orders` | Attendee's own orders |

### Simulated payment gateway

| `GET` | `/sandbox/pay/:intentId` | Page with Approve, Decline, and Abandon buttons. Labelled as simulated |
| `POST` | `/api/payments/webhook` | The only place tickets are issued for paid orders. Verifies the signature, dedupes on `ProcessedWebhookEvent`, then issues tickets in one transaction |

Tickets are issued **only** by the webhook handler, never by the checkout response. That is
what makes "failed or abandoned transactions shall not create valid tickets" (SRS 4.6) true
by construction.

## Tickets 

| `GET` | `/api/tickets` | Attendee's tickets |
| `GET` | `/api/tickets/:id` | |
| `GET` | `/api/tickets/:id/pdf` | Print-optimised A4 PDF. No card data, no unnecessary personal data |
| `GET` | `/api/tickets/:id/qr.png` | QR image for the web view |
| `GET` | `/api/events/:slug/calendar.ics` | Bonus scope. Uses a stable UID plus `calendarSequence` |

## Check-in

| `GET` | `/api/mobile/events` | Only events the caller is assigned to via `StaffAssignment` |
| `GET` | `/api/mobile/events/:id/stats` | Registered and checked-in totals |
| `POST` | `/api/checkin` | `checkInSchema`. Takes the **raw scanned string** and classifies it server-side |
| `POST` | `/api/checkin/reverse` | `reverseCheckInSchema`. Requires `EVENT_ADMIN` or above |
| `GET` | `/api/mobile/events/:id/attendees` | Manual search by name, email, or order reference |

`/api/checkin` returns `checkInResultSchema`. Its ordered logic:

1. `parseScannedPayload(payload)`. Anything other than `ADMISSION_TICKET` returns `NOT_A_TICKET`. A `CAMPAIGN_QR` gets the explicit message "This is a promotional code, not a ticket" and is never admitted.
2. `verifyTicketCode` against `TICKET_SIGNING_KEY`. Failure returns `INVALID` with no database read.
3. Load the ticket. Wrong event returns `WRONG_EVENT`; status `CANCELLED` or `REFUNDED` returns the matching result.
4. Insert the `CheckInRecord`. A unique violation on the partial index returns `ALREADY_CHECKED_IN` with the original `checkedInAt`.
5. Set `Ticket.status = CHECKED_IN` and write the audit entry in the same transaction.

## Promotions

| `GET` `POST` | `/api/organizer/events/:id/campaigns` | `campaignInputSchema`. Generates the promo code and the opaque QR token |
| `PUT` | `/api/organizer/campaigns/:id` | Disable, edit dates and limits |
| `GET` | `/api/organizer/campaigns/:id/qr.png` | Visually distinct from a ticket QR: different frame, campaign label, no ticket styling |
| `GET` | `/api/organizer/campaigns/:id/report` | Redemptions, orders, tickets, gross, discount, net |

## Support

| `GET` `POST` | `/api/support/cases` | `createSupportCaseSchema` |
| `GET` | `/api/support/cases/:id` | 404, not 403, for cases the caller cannot access |
| `POST` | `/api/support/cases/:id/messages` | `postSupportMessageSchema` |
| `PUT` | `/api/support/cases/:id/status` | `supportStatusSchema`. Staff only |
| `PUT` | `/api/support/cases/:id/assignee` | Staff only |

Clients poll `GET /api/support/cases/:id` every 10 seconds while the thread is open. No WebSockets.

## Notifications

| `GET` | `/api/notifications` | The signed-in user's latest in-app notifications, including `readAt` |
| `POST` | `/api/notifications/:id/read` | Sets `readAt` on the caller's own row. A later call keeps the first timestamp. Another user's id is `404` |

## Analytics

| `GET` | `/api/organizer/analytics/summary` | Capacity, sold, remaining, percent sold, gross, discounts, refunds, net |
| `GET` | `/api/organizer/analytics/sales-over-time` | Daily buckets from `Order.paidAt`. `collectedKzt` is the paid order total |
| `GET` | `/api/organizer/analytics/by-ticket-type` | |
| `GET` | `/api/organizer/analytics/campaigns` | Per-campaign redemptions, tickets, revenue |
| `GET` | `/api/organizer/analytics/attendance` | Checked in, absent, percentage |

All accept `analyticsQuerySchema`. All are scoped to events the caller manages, and all run as read-only aggregations outside any checkout transaction (SRS 7).

## Administration 

| `GET` | `/api/admin/activations` | Paid-sales reviews waiting for a platform admin |
| `GET` | `/api/admin/search` | Users, events, orders, payments. Query `q` must be at least two characters |
| `POST` | `/api/admin/users/:id/suspend` | `suspendSchema`. Existing sessions are rejected on the next request |
| `POST` | `/api/admin/events/:id/suspend` | Sets `paidSalesSuspended`, stopping further paid sales immediately |
| `GET` | `/api/admin/reports` | Unresolved reported events |
| `GET` `PUT` | `/api/admin/settings` | `platformSettingsSchema` for the activation fee, platform fee, and checkout hold |
| `GET` | `/api/admin/exports/orders.csv` | Operational order export. Cells that could be formulas are quoted |
