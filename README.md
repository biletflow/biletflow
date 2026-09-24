# BiletFlow

Self-service event ticketing for Kazakhstan. Organizers create events and issue QR-code
tickets; free events cost nothing, paid sales are activated per event. Event admins verify
tickets with a mobile app.

All payments in this build are **simulated**. No real money moves.

## Stack

| | |
| --- | --- |
| Web + API | Next.js (App Router), TypeScript |
| Database | PostgreSQL + Prisma |
| Auth | better-auth (cookies for web, bearer for mobile) |
| UI | Tailwind CSS + shadcn/ui |
| Mobile | Expo React Native (Event Admin scanner) |
| Local services | Docker Compose: Postgres, Mailpit, MinIO |

## Quick start

```bash
corepack enable && corepack use pnpm@latest
cp .env.example .env      # fill BETTER_AUTH_SECRET + 2 signing keys
pnpm install
pnpm infra:up             # Postgres :5433, Mailpit :8025, MinIO :9001
pnpm db:migrate && pnpm db:seed
pnpm dev
```

For the scanner app, set `EXPO_PUBLIC_API_URL` to the web server's reachable URL
(for example `http://192.168.1.10:3000` on a phone on the same Wi-Fi), then run
`pnpm --filter scanner start`. Sign in as `scanner@biletflow.kz` using the
development password from the local seed configuration. The app stores its bearer token in secure
device storage and validates it when reopened.

## Layout

```
apps/web         Next.js: attendee + organizer + admin + API
apps/scanner     Expo app for event admins
packages/db      Prisma schema, client, seed
packages/shared  Zod schemas, KZT money, QR parsing/signing
infra            docker-compose, Dockerfile
```

## Docs

| | |
| --- | --- |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Branching, PRs, definition of done |
| [api.md](docs/api.md) | Endpoint contract |

## Team

| | |
| --- | --- |
| A | Product owner, design, organizer + admin UI |
| D | Tech lead, attendee web, integration |
| Z | Backend: schema, auth, orders, payments, promos, analytics |
| K | Scanner app + check-in backend |
