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

## Run locally

You need Node.js 22 or newer, pnpm 12.3.4 (the version pinned in `package.json`), and either Docker Compose or a local PostgreSQL instance. Run the commands from the repository root. If you use Compose, start Docker Desktop or your Docker engine first.

### 1. Install dependencies

```sh
npm install --global pnpm@12.3.4
pnpm install --frozen-lockfile
```

If PowerShell blocks the npm or pnpm script shims, use `npm.cmd` and `pnpm.cmd` in the commands below.

### 2. Configure the environment

If you do not already have a root `.env` file, copy the example.

```sh
cp .env.example .env
```

On Windows PowerShell, use `Copy-Item .env.example .env`.

Run the following command four times and paste a different value into each of these fields in `.env`: `BETTER_AUTH_SECRET`, `TICKET_SIGNING_KEY`, `CAMPAIGN_SIGNING_KEY`, and `PAYMENT_WEBHOOK_SECRET`.

```sh
node -p "require('node:crypto').randomBytes(32).toString('hex')"
```

Keep the other defaults for Docker Compose. Keep `.env` out of version control and reuse the same ticket signing key for an existing database so issued QR codes remain valid.

### 3. Start services and prepare the database

```sh
pnpm infra:up
pnpm db:deploy
pnpm db:generate
```

Compose starts PostgreSQL on host port `5433`, Mailpit on SMTP port `1025`, and MinIO on port `9000`. If Prisma cannot connect immediately, wait for PostgreSQL to finish starting and rerun `pnpm db:deploy`. Use `pnpm infra:logs` to check startup.

For a setup without Docker, create an empty development database on your local PostgreSQL instance, set `DATABASE_URL` in `.env` to its connection string, and run `pnpm db:deploy` and `pnpm db:generate`. Email delivery requires a separate SMTP server with matching settings in `.env`.

Populate a fresh development database with demo data if you want to use the sample accounts. The seed command clears existing application data, so skip it when reusing a populated database.

```sh
pnpm db:seed
```

### 4. Start the web app and API

```sh
pnpm exec dotenv -e .env -- pnpm dev --webpack
```

This loads the root `.env` before starting Next.js. Open [BiletFlow in English](http://localhost:3000/en) or [check the events API](http://localhost:3000/api/events). If you started Compose, you can view outgoing development emails in [Mailpit](http://localhost:8025).

The seeded accounts all use the local demo password `Password123!`.

| Role | Demo email |
| --- | --- |
| Attendee | `attendee1@example.kz` |
| Organizer | `organizer@biletflow.kz` |
| Platform admin | `admin@biletflow.kz` |
| Scanner (mobile) | `scanner@biletflow.kz` |

For subsequent sessions, start the backing services if needed and rerun the web command. Stop the web server with Ctrl+C and stop the Compose services with `pnpm infra:down`.

[API documentation](docs/api.md) · [Flutter setup](apps/mobile_flutter/README.md) · [Expo scanner setup](apps/scanner/README.md)

## Team ADZK

| Member | Responsibilities |
| --- | --- |
| Adina | Product owner, project management, design, organizer and admin UI |
| Dariya | Tech lead, attendee web and mobile UI, frontend integration |
| Zhansaya | Database, authentication, orders, payments, promotions, analytics and API |
| Kamila | Flutter mobile application, QR scanner, check-in backend and mobile testing |
