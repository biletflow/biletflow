Bodies are validated by [`packages/shared/src/schemas`](../packages/shared/src/schemas/index.ts)

| Convention | |
| Location | `apps/web/src/app/api/**/route.ts` |
| Auth | Web: better-auth session cookie. Mobile: `Authorization: Bearer <token>` |
| Errors | `{ error: { code, message, details? } }` — `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_FAILED`, `SOLD_OUT` `HOLD_EXPIRED`, `PROMO_INVALID`, `ALREADY_CHECKED_IN`, `NOT_A_TICKET`, `CONFLICT` |
| Money | Integer KZT, fields suffixed `Kzt` |
| Idempotency | Anything creating money or tickets requires `clientIdempotencyKey` |

## Auth
| `POST` | `/api/auth/[...all]` | better-auth handler: sign-up, sign-in, sign-out, verify email, reset password |
| `GET` | `/api/me` | Current user, role, organizer profile summary |
| `POST` | `/api/mobile/auth/login` | Returns a bearer token for the scanner app |

## Organizer profile and payouts

| `GET` `PUT` | `/api/organizer/profile` | `organizerProfileSchema` |
| `POST` | `/api/organizer/verification` | Uploads the simulated identity document |
| `GET` `POST` | `/api/organizer/payout-accounts` | `payoutAccountSchema` |
| `GET` | `/api/organizer/payouts` | Simulated payout list with status |

## Events

| `GET` | `/api/events` | Public listing. Only `PUBLISHED` + `PUBLIC`. Filters: category, date, query |
| `GET` | `/api/events/:slug` | Public event page payload including visible ticket types |
| `POST` | `/api/organizer/events` | `eventInputSchema` |
| `GET` `PUT` | `/api/organizer/events/:id` | `eventInputSchema` |
| `POST` | `/api/organizer/events/:id/publish` | Rejects if no visible ticket type exists |
| `POST` | `/api/organizer/events/:id/unpublish` | |
| `POST` | `/api/organizer/events/:id/cancel` | Cancels, auto-refunds paid orders, notifies attendees, bumps `calendarSequence` |
| `POST` | `/api/organizer/events/:id/duplicate` | New `DRAFT`; copies config only, never orders, tickets, payments, check-ins, or cases |
| `GET` | `/api/organizer/events/:id/history` | Audit timeline. Filters: `from`, `to`, `action` |

## Ticket types

| `GET` `POST` | `/api/organizer/events/:id/ticket-types` | `ticketTypeInputSchema` |
| `PUT` `DELETE` | `/api/organizer/ticket-types/:id` | Delete is refused once tickets are sold; hide instead |

Every response includes the counters `quantity`, `sold`, `reserved`, `refunded`,
`checkedIn`, `available` (SRS 4.3).

## Paid sales activation

| `GET` | `/api/organizer/events/:id/activation` | The checklist state: five booleans plus the fee amount |
| `POST` | `/api/organizer/events/:id/activation/pay-fee` | Creates an `ACTIVATION_FEE` payment intent |
| `POST` | `/api/organizer/events/:id/activation/accept-terms` | |
| `POST` | `/api/admin/activations/:id/review` | Platform Admin approves or rejects the simulated KYC |

## Checkout

| `POST` | `/api/promo/preview` | `applyPromoSchema`. Server-calculated discount and new total. Never trusts a client-supplied amount |
| `POST` | `/api/orders` | `createOrderSchema`. Reserves inventory atomically, returns the order with `expiresAt`. Free orders return `PAID` immediately with tickets issued |
| `GET` | `/api/orders/:id` | |
| `POST` | `/api/orders/:id/cancel` | Releases reservation |
| `POST` | `/api/orders/:id/pay` | Creates a payment intent, returns the simulated gateway URL |
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

## Analytics

| `GET` | `/api/organizer/analytics/summary` | Capacity, sold, remaining, percent sold, gross, discounts, refunds, net |
| `GET` | `/api/organizer/analytics/sales-over-time` | Buckets by day from `Order.paidAt` |
| `GET` | `/api/organizer/analytics/by-ticket-type` | |
| `GET` | `/api/organizer/analytics/campaigns` | Per-campaign redemptions, tickets, revenue |
| `GET` | `/api/organizer/analytics/attendance` | Checked in, absent, percentage |

All accept `analyticsQuerySchema`. All are scoped to events the caller manages, and all run as read-only aggregations outside any checkout transaction (SRS 7).

## Administration 

| `GET` | `/api/admin/search` | Users, events, orders, payments |
| `POST` | `/api/admin/users/:id/suspend` | `suspendSchema` |
| `POST` | `/api/admin/events/:id/suspend` | Sets `paidSalesSuspended`, stopping further sales immediately |
| `GET` | `/api/admin/reports` | Reported events queue |
| `GET` `PUT` | `/api/admin/settings` | Activation fee and fee configuration |
| `GET` | `/api/admin/exports/:report.csv` | Basic operational reports |