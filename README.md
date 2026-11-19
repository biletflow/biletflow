# BiletFlow

Self-service event ticketing platform for Kazakhstan.

BiletFlow is designed for individuals, student organizations, businesses and community groups that organize physical events. Creating events and distributing free tickets is free of charge. Organizers who wish to sell paid tickets must activate paid sales for each event by paying a one-time activation fee, completing identity and payout verification, and accepting the paid-event terms.

## Project scope

The academic MVP covers a web application and an iOS and Android mobile application connected to a shared backend and database. The mobile application is intended to provide the same role-based functionality as the web application, including ticket verification for Event Admins.

| User | Requirements |
| --- | --- |
| Attendee | Discover events, register, purchase tickets, view orders, download and print QR tickets, apply promo codes and contact support |
| Organizer | Create and publish events, manage ticket types and inventory, activate paid sales, manage attendees and orders, process refunds, create campaigns and review analytics and event history |
| Event Admin | Select assigned events, scan and verify tickets, search attendees, record or reverse check-ins and view attendance statistics |
| Platform Admin | Manage users and events, review paid-sales activation, moderate the platform and handle escalated support cases |

The MVP also includes account management, organizer profiles, email confirmations and audit records. The system uses KZT and supports Kazakh, Russian and English.

Payments, activation fees, identity verification and payouts use a sandbox or simulation. No real financial transactions are required.

### Optional features

- Assigned seating with a predefined venue layout
- Calendar export
- Advanced GA4 analytics
- Offline check-in synchronization
- Support attachments and enhanced real-time messaging

Production financial processing, production identity verification and app store publication are outside the academic MVP.

## Technology stack

| Component | Technology |
| --- | --- |
| Web | Next.js, TypeScript, Tailwind CSS, shadcn/ui |
| Mobile | Flutter, Dart |
| API | Next.js |
| Database | PostgreSQL, Prisma |
| Authentication | Better Auth |
| Infrastructure | Docker Compose, Mailpit, MinIO |

## Repository structure

```text
apps/web          Web application and API
apps/scanner      Expo QR scanner
packages/db       Database schema and seed data
packages/shared   Shared validation and QR utilities
infra             Docker configuration
docs              Project documentation
```

Flutter source: [apps/mobile_flutter](https://github.com/biletflow/biletflow/tree/mobile/flutter-starter/apps/mobile_flutter)

## Local setup

```bash
corepack enable && corepack use pnpm@latest
cp .env.example .env
pnpm install
pnpm infra:up
pnpm db:migrate && pnpm db:seed
pnpm dev
```

Configure the required secrets in `.env` before starting. Seed only a fresh development database.

For the Expo scanner, set `EXPO_PUBLIC_API_URL` to the backend URL and run `pnpm --filter scanner start`.

## Documentation

- [Development workflow](CONTRIBUTING.md)
- [API specification](docs/api.md)
- [Authentication](docs/backend-auth.md)
- [Orders, payments and check-in](docs/backend-commerce.md)
- [Flutter setup](https://github.com/biletflow/biletflow/blob/mobile/flutter-starter/apps/mobile_flutter/README.md)

## Team ADZK

| Member | Responsibilities |
| --- | --- |
| Adina | Product owner, project management, design, organizer and admin UI |
| Dariya | Tech lead, attendee web and mobile UI, frontend integration |
| Zhansaya | Database, authentication, orders, payments, promotions, analytics and API |
| Kamila | Flutter mobile application, QR scanner, check-in backend and mobile testing |
