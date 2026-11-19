# BiletFlow

Self-service event ticketing platform for Kazakhstan. Organizers can create events and distribute free tickets without charge. Paid ticket sales require activation for each event.

## Project scope

- Event creation, publication and ticket management
- Free registration, simulated payments and QR/PDF tickets
- Mobile ticket verification and attendee check-in
- Promo codes, refunds and support cases
- Organizer analytics, event history and admin moderation

The project covers web and mobile applications with a shared backend and database. The mobile application is designed for iOS and Android with role-based functionality. Payments and identity verification are simulated.

## Stack

| Component | Technology |
| --- | --- |
| Web and API | Next.js, TypeScript, Tailwind CSS |
| Mobile | Flutter, Dart |
| Database | PostgreSQL, Prisma |
| Authentication | Better Auth |
| Infrastructure | Docker Compose |

## Setup

```bash
corepack enable && corepack use pnpm@latest
cp .env.example .env
pnpm install
pnpm infra:up
pnpm db:migrate && pnpm db:seed
pnpm dev
```

Configure the required secrets in `.env`. Seed only a fresh development database.

[API documentation](docs/api.md) · [Flutter setup](https://github.com/biletflow/biletflow/blob/mobile/flutter-starter/apps/mobile_flutter/README.md)

## Team ADZK

| Member | Responsibilities |
| --- | --- |
| Adina | Product owner, project management, design, organizer and admin UI |
| Dariya | Tech lead, attendee web and mobile UI, frontend integration |
| Zhansaya | Database, authentication, orders, payments, promotions, analytics and API |
| Kamila | Flutter mobile application, QR scanner, check-in backend and mobile testing |
