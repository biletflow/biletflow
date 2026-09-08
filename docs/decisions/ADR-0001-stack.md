# ADR-0001: Stack and closed decisions

**Status:** Accepted, week 4 · **Deciders:** D, A, Z, K

Satisfies SRS 9 (documented stack rationale) and closes SRS 12 (open decisions).

## Decision

One TypeScript monorepo: **Next.js (App Router) + PostgreSQL + Prisma**, with **Expo React
Native** for the Event Admin scanner. One repo, one backend serving both web and mobile.

**Why TypeScript both sides:** one dedicated backend dev (Z), two frontend/design (D, A),
one mobile (K). A split-language stack funnels all 16 required features through Z. Shared
language lets D and A own their own route handlers and lets K own the check-in endpoints
behind his app.

**Why PostgreSQL over MongoDB:** the SRS requires atomic inventory reservation, promo
redemption limits, and seat holds. Those need transactions and row locking.

**Why one repo:** the scanner imports `@biletflow/shared`, so a payload change updates API
and app in one PR with one CI run. Three repos would make every cross-cutting feature a
version-bump across repos.

**Rejected:** FastAPI or Spring Boot with Next.js as a client. Legitimate, but costs ~1
week on the API boundary, duplicated validation, token plumbing, and CORS, and removes D
and A from server work. Revisit only if Z would be materially slower in TypeScript.

## Stack

| Layer | Choice |
| --- | --- |
| Web + API | Next.js 15 App Router, Route Handlers + Server Actions |
| Database | PostgreSQL 16 + Prisma |
| Auth | better-auth — cookies for web, bearer + Expo plugin for mobile |
| UI | React 19, Tailwind CSS, shadcn/ui |
| Validation | Zod in `packages/shared`, shared by web, API, and mobile |
| Charts | Recharts |
| i18n | next-intl — `kk`, `ru`, `en` |
| Email | Resend + react-email in prod; Mailpit container in dev |
| Storage | MinIO in dev, Cloudflare R2 if deployed |
| PDF | `@react-pdf/renderer` + `qrcode` — no headless Chromium |
| Payments | Internal simulated gateway: hosted page + webhook |
| Mobile | Expo dev build, expo-router, expo-camera, NativeWind |
| Expiry | `expires_at` + lazy read + one sweeper interval. No Redis or queue |
| Testing | Vitest; Playwright for one E2E path |
| Deploy | Docker Compose |
| Repo | pnpm workspaces, `node-linker=hoisted` for Metro |

Payments are simulated, not sandboxed, because Stripe and comparable providers do not
settle KZT — and SRS 3.2 permits a labelled simulation. The simulator is still modelled as
a real PSP (provider interface, hosted `/sandbox/pay/:intentId` page, signed webhook), so
async confirmation and idempotency are exercised for real.

## Closed SRS 12 decisions

| Decision | Adopted |
| --- | --- |
| Name | BiletFlow |
| Backend + DB | Next.js + PostgreSQL + Prisma |
| Activation fee | 15 000 KZT, one-time per event, non-refundable, admin-editable |
| Payment method | Internal simulation, "SIMULATED PAYMENT" badge on every screen and record |
| Attendee accounts | Required. Guest checkout means a second identity path for tickets, orders, cases |
| Processing fees | Organizer pays, deducted from payout. 3.5% + 100 KZT |
| Payouts | Simulated, T+5 business days after event end, no reserve. `pending`/`scheduled`/`paid` |
| Organizer verification | One ID upload + payout fields, manual Platform Admin approval. Simulated KYC |
| Refund rules | Three presets: none / until 48h / until 24h. Full-order only. Cancellation auto-refunds |
| Seating | Cut. If green after week 10: one 200-seat, 3-section theater |
| Support attachments | No |
| Promo codes | Percent or fixed KZT, `max_redemptions`, 1 per user, selected ticket types |
| Dashboard | Default last 30 days + all-time toggle. 4 KPI cards, sales line, ticket-type bar |
| Retention | Keep everything for the term, no purge |

## QR format

| | |
| --- | --- |
| Admission ticket | `BFT1.<ticketId>.<sig>`, `sig` = first 16 bytes of `HMAC-SHA256(ticketId, TICKET_SIGNING_KEY)`, base64url. Deliberately not a URL |
| Campaign QR | `https://biletflow.kz/e/<slug>?c=<opaqueToken>`. Never encodes a discount value |

The scanner rejects anything not matching `^BFT1\.` with "This is a promotional code, not a
ticket." `/api/checkin` enforces the same rule server-side, so the guard exists in both
layers. This satisfies the SRS success criterion that admission scanners reject campaign
QR codes.

Database-level invariants are in [data-model.md](../data-model.md). Engineering rules are in
[CONTRIBUTING.md](../../CONTRIBUTING.md).
