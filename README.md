# BiletFlow

BiletFlow is a self-service event ticketing platform for Kazakhstan. Attendees can discover events and obtain QR-code tickets, organizers can create and manage events, and event staff can verify tickets at admission.

The web application supports attendee, organizer and platform administrator workflows. A full Flutter mobile application is in development, using the same backend and database. The existing Expo scanner remains available for ticket check-in.

All payments are simulated. No real money moves.

## Stack

| Component | Technology |
| --- | --- |
| Web and API | Next.js (App Router), TypeScript |
| Database | PostgreSQL, Prisma |
| Authentication | Better Auth (web cookies, mobile bearer tokens) |
| Web UI | Tailwind CSS, shadcn/ui |
| Mobile | Flutter, Dart (in development); Expo React Native (existing scanner) |
| Local services | Docker Compose, PostgreSQL, Mailpit, MinIO |

## Quick start

```bash
corepack enable && corepack use pnpm@latest
cp .env.example .env
pnpm install
pnpm infra:up
pnpm db:migrate && pnpm db:seed
pnpm dev
```

Configure the authentication secret and signing keys in `.env` before starting. Use the seed command only with a fresh development database.

### Mobile

The Flutter application is being developed for Android and iOS. Its initial code is available in the [mobile/flutter-starter branch](https://github.com/biletflow/biletflow/tree/mobile/flutter-starter/apps/mobile_flutter). See the [Flutter setup instructions](https://github.com/biletflow/biletflow/blob/mobile/flutter-starter/apps/mobile_flutter/README.md). The Flutter application is not yet part of the main branch.

To run the existing Expo scanner, set `EXPO_PUBLIC_API_URL` to the reachable backend URL and run `pnpm --filter scanner start`. Use the scanner account from the local seed configuration.

## Repository layout

```text
apps/web             Web interfaces and API
apps/scanner         Existing Expo scanner
packages/db          Prisma schema, client and seed
packages/shared      Shared validation, money and QR utilities
infra                Docker configuration
docs                 Project documentation
```

The Flutter development branch adds `apps/mobile_flutter`.

## Documentation

| Document | Description |
| --- | --- |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development workflow |
| [api.md](docs/api.md) | API contracts |
| [backend-commerce.md](docs/backend-commerce.md) | Orders, simulated payments and check-in |

## Team ADZK

| Member | Responsibilities |
| --- | --- |
| Adina | Project management, UI/UX design, organizer and admin interfaces |
| Dariya | Tech lead, web and mobile attendee interfaces, frontend integration |
| Zhansaya | Database, backend, authentication, payments and API integration |
| Kamila | Flutter mobile application, QR scanner, check-in backend, mobile integration and testing |
