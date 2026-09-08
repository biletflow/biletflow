#!/usr/bin/env bash
#
# Creates labels, milestones, and the week 4-12 issue backlog in biletflow/biletflow.
# Idempotent: re-running skips things that already exist.
#
# Prerequisites: gh installed and authenticated, run from the repo root.
# Usage: ./scripts/bootstrap-github.sh

set -euo pipefail

REPO="biletflow/biletflow"

# --- Handles. Fill these in before running, or leave blank to skip assignment. ---
D_HANDLE=""
A_HANDLE=""
Z_HANDLE=""
K_HANDLE=""

label() { gh label create "$1" --repo "$REPO" --color "$2" --description "$3" --force >/dev/null; }

echo "Creating labels..."
label "P0-demo"        "b60205" "Blocks the core demo flow"
label "P1"             "d93f0b" "Required MVP feature"
label "P2-stretch"     "fbca04" "Bonus scope, only if green"
label "area:web-attendee"  "0e8a16" "Attendee-facing web"
label "area:web-organizer" "1d76db" "Organizer dashboard"
label "area:admin"         "5319e7" "Platform admin portal"
label "area:api"           "006b75" "Backend services and route handlers"
label "area:mobile"        "c2e0c6" "Expo scanner app"
label "area:infra"         "bfd4f2" "CI, Docker, tooling"
label "area:docs"          "d4c5f9" "Documentation"
label "blocked"        "000000" "Waiting on something else"
label "needs-design"   "f9d0c4" "Waiting on Figma"
label "needs-api"      "fef2c0" "Waiting on an endpoint"

echo "Creating milestones..."
for w in 4 5 6 7 8 9 10 11 12; do
  gh api "repos/$REPO/milestones" -f title="Week $w" >/dev/null 2>&1 || true
done
gh api "repos/$REPO/milestones" -f title="Stretch" >/dev/null 2>&1 || true

# issue <week> <owner-handle> <labels> <title> <body>
issue() {
  local week="$1" owner="$2" labels="$3" title="$4" body="$5"
  local args=(--repo "$REPO" --title "$title" --body "$body" --milestone "$week" --label "$labels")
  if [[ -n "$owner" ]]; then args+=(--assignee "$owner"); fi
  gh issue create "${args[@]}" >/dev/null
  echo "  + $title"
}

echo "Creating week 4 issues..."
issue "Week 4" "$D_HANDLE" "area:infra,P0-demo" \
  "Scaffold apps/web (Next.js + Tailwind + shadcn)" \
  "Run create-next-app into apps/web per docs/REPO-SETUP.md, wire @biletflow/db and @biletflow/shared as workspace deps, add lint/typecheck/test scripts so CI picks them up."
issue "Week 4" "$D_HANDLE" "area:infra,P1" \
  "Wire next-intl with kk/ru/en" \
  "Locale routing, message catalogues, and a locale switcher. Must land before feature screens so no hardcoded strings accumulate."
issue "Week 4" "$Z_HANDLE" "area:api,P0-demo" \
  "Run first Prisma migration and add the partial unique indexes" \
  "Migrate packages/db/prisma/schema.prisma, then hand-add the CheckInRecord and SeatHold partial unique indexes documented in docs/data-model.md."
issue "Week 4" "$Z_HANDLE" "area:api,P0-demo" \
  "better-auth: sign-up, sign-in, email verification, roles" \
  "Cookie sessions for web plus a bearer token endpoint for the scanner. Seed one user per role."
issue "Week 4" "$Z_HANDLE" "area:api,P1" \
  "Seed script with demo data" \
  "3 organizers, 6 events across all four statuses, ~200 orders, 2 campaigns, check-ins. Every demo and test depends on this."
issue "Week 4" "$Z_HANDLE" "area:api,P0-demo" \
  "audit() helper" \
  "Transaction-aware append-only writer. Every mutation calls it from the moment it is written; see docs/data-model.md."
issue "Week 4" "$K_HANDLE" "area:mobile,P0-demo" \
  "Scaffold apps/scanner (Expo) and scan any QR on device" \
  "Expo dev build running on a physical device, expo-camera reading a QR into a text field, metro.config.js configured for the monorepo."
issue "Week 4" "$A_HANDLE" "area:docs,P0-demo" \
  "Figma wireframes for the six core screens" \
  "Event page, checkout, organizer event editor, attendee list, scanner result, analytics dashboard. Aligned to shadcn primitives."
issue "Week 4" "$A_HANDLE" "area:docs,P1" \
  "Fill in CODEOWNERS handles and enable the branch ruleset" \
  "Replace placeholders in .github/CODEOWNERS, then enable the main ruleset per docs/REPO-SETUP.md."

echo "Creating week 5 issues..."
issue "Week 5" "$Z_HANDLE" "area:api,P0-demo" "Event CRUD, publish, unpublish, cancel" "Per docs/api.md. Audit entries on every transition."
issue "Week 5" "$Z_HANDLE" "area:api,P0-demo" "Ticket type CRUD with counters" "Includes available/sold/reserved/refunded/checkedIn in every response."
issue "Week 5" "$A_HANDLE" "area:web-organizer,P0-demo" "Organizer event editor and preview" ""
issue "Week 5" "$D_HANDLE" "area:web-attendee,P0-demo" "Event listing and public event page" "Respects PUBLIC/UNLISTED/PRIVATE visibility."
issue "Week 5" "$K_HANDLE" "area:mobile,P0-demo" "Scanner sign-in and assigned-events list" "Bearer auth against /api/mobile/*; shows only StaffAssignment events."

echo "Creating week 6 issues (end-to-end milestone)..."
issue "Week 6" "$Z_HANDLE" "area:api,P0-demo" "Free registration: order, ticket, signed QR" "Zero-total order, ticket issuance, buildTicketCode."
issue "Week 6" "$Z_HANDLE" "area:api,P0-demo" "Confirmation email via Mailpit" "react-email template, ticket attached or linked."
issue "Week 6" "$D_HANDLE" "area:web-attendee,P0-demo" "Free registration flow and My Tickets" ""
issue "Week 6" "$K_HANDLE" "area:api,P0-demo" "POST /api/checkin with campaign-QR rejection" "Implements the five ordered steps in docs/api.md."
issue "Week 6" "$K_HANDLE" "area:mobile,P0-demo" "Scan, validate, check in, prevent double entry" "Clear valid/invalid/cancelled/refunded/already-used result screens."
issue "Week 6" "$D_HANDLE" "area:infra,P0-demo" "MILESTONE GATE: free flow works end to end" "Register, receive email, scan paper-free ticket, second scan rejected. If red on Friday, cut promo and support to stubs."

echo "Creating week 7 issues..."
issue "Week 7" "$Z_HANDLE" "area:api,P0-demo" "Simulated payment gateway and webhook" "Hosted approve/decline/abandon page, signed webhook, ProcessedWebhookEvent dedupe. Tickets issued only in the webhook."
issue "Week 7" "$Z_HANDLE" "area:api,P0-demo" "Atomic inventory reservation and expiry sweeper" "The conditional UPDATE in docs/data-model.md plus lazy expiry and the 60s sweeper."
issue "Week 7" "$Z_HANDLE" "area:api,P1" "Paid sales activation checklist" "Five-item checklist, fee payment, admin review."
issue "Week 7" "$Z_HANDLE" "area:api,P1" "Full-order refunds" "Invalidates tickets, notifies attendee, audits."
issue "Week 7" "$D_HANDLE" "area:web-attendee,P0-demo" "Paid checkout UI with hold countdown" ""
issue "Week 7" "$D_HANDLE" "area:web-attendee,P0-demo" "Print-optimised PDF ticket" "@react-pdf/renderer, A4, grayscale-legible QR, no sensitive data."

echo "Creating week 8 issues..."
issue "Week 8" "$Z_HANDLE" "area:api,P0-demo" "Campaigns, promo validation, atomic redemption limits" ""
issue "Week 8" "$Z_HANDLE" "area:api,P0-demo" "Campaign QR generation with opaque tokens" "Visually distinct from ticket QR codes."
issue "Week 8" "$A_HANDLE" "area:web-organizer,P1" "Campaign management UI" ""
issue "Week 8" "$D_HANDLE" "area:web-attendee,P0-demo" "Campaign link auto-applies the promo code" "Server-validated; shows code, discount, and updated total before checkout."
issue "Week 8" "$A_HANDLE" "area:admin,P1" "Admin portal: search, suspend, activation queue, reports" ""
issue "Week 8" "$A_HANDLE" "area:web-organizer,P1" "Event activity timeline UI" "Date-range and action-type filters."

echo "Creating week 9 issues..."
issue "Week 9" "$Z_HANDLE" "area:api,P1" "Analytics aggregation endpoints" "Five endpoints from docs/api.md, event-scoped."
issue "Week 9" "$A_HANDLE" "area:web-organizer,P1" "Analytics dashboard" "Four KPI cards, sales-over-time line, by-ticket-type bar, campaign and attendance tables."
issue "Week 9" "$K_HANDLE" "area:api,P1" "Support cases and messages API" "Authorization by role and relationship; 404 for unauthorized."
issue "Week 9" "$A_HANDLE" "area:web-organizer,P1" "Support chat UI with 10s polling" ""
issue "Week 9" "$Z_HANDLE" "area:api,P1" "Remaining notification templates" "All 11 NotificationType values."
issue "Week 9" "$A_HANDLE" "area:web-organizer,P1" "Event history views and duplication" "Upcoming/Active/Completed/Cancelled; duplicate excludes transactions."

echo "Creating week 10-12 issues..."
issue "Week 10" "$D_HANDLE" "area:infra,P0-demo" "FEATURE FREEZE: integration and bug bash" "Each member tests someone else's area."
issue "Week 10" "$K_HANDLE" "area:infra,P0-demo" "Playwright E2E of the core demo flow" ""
issue "Week 10" "$Z_HANDLE" "area:api,P0-demo" "Concurrency test: 10 parallel buyers, 1 remaining ticket" "Exactly one order succeeds. Same for promo redemption limits and double check-in."
issue "Week 11" "$D_HANDLE" "area:web-attendee,P1" "Accessibility pass on event page and checkout" "WCAG 2.1 AA: keyboard, contrast, labels."
issue "Week 11" "$A_HANDLE" "area:docs,P1" "Fill kk translations" ""
issue "Week 11" "$A_HANDLE" "area:docs,P0-demo" "Architecture doc, README, and demo script rehearsal" "Twice, end to end."
issue "Week 12" "$D_HANDLE" "area:docs,P0-demo" "Final rehearsal and submission" ""
issue "Stretch" "$D_HANDLE" "area:web-attendee,P2-stretch" "Calendar export (.ics + calendar links)" "Cheapest bonus, roughly two hours. First to restore if week 10 is green."
issue "Stretch" "$K_HANDLE" "area:web-attendee,P2-stretch" "Assigned seating with interactive seat map" "Schema already exists. Only with a green week 10."

echo
echo "Done. Next: create the org Project board and add all issues to it:"
echo "  gh project create --owner biletflow --title 'BiletFlow Delivery'"
