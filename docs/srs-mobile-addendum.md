# BiletFlow SRS v0.3 — mobile scope addendum

Updated 28 November 2026. The team reports that the instructor requested full mobile functionality matching the website. This records the verbal scope change; written approval is not attached.

## Scope
Replace the scanner-only mobile scope in sections 1.2, 2.1, 4.8, 7, 8, 9 and 13 with a native Flutter/Dart client for Android and iOS. Attendee, Organizer and Platform Admin workflows are included alongside authorized Event Admin check-in. Remove the original exclusion of native attendee and organizer apps. Retain the web application, one Next.js HTTP backend and PostgreSQL/Prisma database. No WebView or second backend. The Expo scanner remains a reference.

## Functional acceptance
- Attendee: account registration, verification, sign-in/out, recovery, event discovery, free and paid checkout, promo codes, order history, QR/PDF tickets, support and eligible cancellations/refunds.
- Organizer: create/edit/publish/unpublish/cancel/duplicate events, ticket inventory and ticket types, profile, simulated identity/payout setup, event-scoped activation with all four conditions, attendees, analytics, campaigns, support and audit history.
- Platform Admin: activation review, search, user suspension, event paid-sales suspension, reported events, settings, operational reports and escalated support.
- Event Admin: authorized event selection, camera QR validation, duplicate rejection, attendee search, reverse check-in and current attendance.
- All roles: appropriate authorization, EN/RU/KK, loading/error/empty states. Server remains authoritative for payment, inventory and check-in. Never expose signing secrets. All money movement and verification remain simulated.

Original bonus/excluded boundaries remain in force except the explicit mobile expansion. Assigned seating, calendar export, advanced GA4, offline check-in and store publication remain outside required base delivery.

## Integration and verification
Demonstrate organizer publishing, attendee checkout in Flutter, issued QR, physical-device scanner admission and duplicate rejection, then refreshed web analytics. Verify activation conditions, admin moderation, support/refunds and language switching. Record current commit, CI results, Android and iOS evidence and remaining defects. The prior device results in #134 do not establish that a later commit was tested.

## Organizer/admin implementation
The Adina mobile-parity branch adds native screens for event overview and audit history, activation, organizer profile and simulated payouts, admin search/moderation and settings, campaign creation and configuration, and order CSV export. The event overview JSON route uses existing server reporting calculations. Activation settlement is server-side and owner-scoped. These changes are integrated in #195, with final parity verification tracked in #199. Campaign date and ticket-type configuration and CSV export are implemented but still need testing, along with localization and cross-platform regression.

## API additions
- GET /api/organizer/events/{id}/overview?from=YYYY-MM-DD&to=YYYY-MM-DD: owner-authorized inventory, attendance, simulated sales totals, daily sales, ticket types and campaign aggregates. Date filtering affects sales, not current inventory.
- POST /api/organizer/events/{id}/activation/simulate: owner-authorized simulated settlement for an existing activation payment, with intentId and outcome (APPROVED, DECLINED, ABANDONED). No client signing key.

## Final handoff
Continue from #195. Final regression, parity and release tasks are tracked in #198, #199 and #201. Earlier device results do not establish verification of the final revision.
