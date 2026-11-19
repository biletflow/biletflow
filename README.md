# BiletFlow

BiletFlow is a self-service event management and ticketing platform for Kazakhstan. The goal is to make it easier for organizers to manage events and for attendees to find events, obtain tickets and enter venues using QR codes.

## Project scope

- **Attendees:** event discovery, registration, free and paid tickets, checkout, QR tickets, refunds and support.
- **Organizers:** event creation and publication, ticket management, paid sales activation, attendee management, promotional campaigns and analytics.
- **Event admins:** QR ticket verification, attendee search and check-in statistics.
- **Platform admins:** user and event moderation, paid sales approval and platform management.

The project includes web and mobile applications connected to a shared backend and database. The system supports Kazakh, Russian and English. Payments and identity verification are simulated.

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
