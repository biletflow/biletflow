# Setup

## Already done

- [x] Org `biletflow`, public repo, MIT.
- [x] pnpm workspace + root scripts + `.npmrc` (`node-linker=hoisted`, required by Expo's Metro).
- [x] `packages/db` — full Prisma schema, all 24 SRS entities.
- [x] `packages/shared` — Zod schemas, KZT money, QR parse/sign, tests.
- [x] `infra/` — Compose (Postgres, Mailpit, MinIO) + Dockerfile.
- [x] `.github/` — CI, PR template, issue forms, CODEOWNERS.
- [x] `docs/`, `.env.example`, `scripts/bootstrap-github.sh`.
- [x] `apps/web` — Next.js 16, React 19, Tailwind 4, shadcn/ui, standalone output.
- [x] `apps/scanner` — Expo SDK 57, expo-camera, monorepo Metro config, working scan screen.
- [x] Initial migration applied, seed script written and run.

## 1. Local (everyone, once)

```bash
corepack enable && corepack use pnpm@latest
cp .env.example .env
openssl rand -base64 32   # BETTER_AUTH_SECRET
openssl rand -hex 32      # TICKET_SIGNING_KEY
openssl rand -hex 32      # CAMPAIGN_SIGNING_KEY
pnpm install
pnpm infra:up
pnpm db:migrate && pnpm db:seed
```

Mailpit inbox: <http://localhost:8025>. MinIO console: <http://localhost:9001> (`biletflow`/`biletflow`).

## 2. apps/web — D

Scaffolded and building: Next.js 16, React 19, Tailwind 4, shadcn/ui, standalone output.
Installed: better-auth, next-intl, `@react-pdf/renderer`, qrcode, recharts,
react-hook-form, zod, nodemailer, `@aws-sdk/client-s3`, vitest.

Remaining for D:

- [ ] Wire next-intl (`kk`/`ru`/`en`) before any feature screens land.
- [ ] Configure better-auth to use `hashPassword`/`verifyPassword` from
      `@biletflow/shared/password.server`, so seeded logins work.

## 3. apps/scanner — K

Scaffolded on Expo SDK 57 with expo-camera and expo-secure-store. `metro.config.js` is
configured for the monorepo, and `App.tsx` scans a QR and classifies it with the shared
parser — including rejecting a campaign QR as "not a ticket".

Import `@biletflow/shared` only — never `qr.server.ts` or `password.server.ts`, which
need `node:crypto` and will not bundle.

Remaining for K:

- [ ] Run on a physical device: `pnpm --filter scanner start`, then scan with Expo Go.
- [ ] expo-router and NativeWind, deliberately not installed — both need entry-point and
      Babel changes better made once the screen structure exists.

If Metro resolution costs more than a day, move the scanner to its own repo and copy the
types. Do not block week 5 on it.

## 4. GitHub

```bash
gh api -X PUT orgs/biletflow/memberships/HANDLE -f role=member   # x4

# edit the 4 *_HANDLE vars at the top first
chmod +x scripts/bootstrap-github.sh && ./scripts/bootstrap-github.sh
```

Creates 13 labels, 10 milestones, and the ~45-issue week 4–12 backlog.

Keep the repo **public** — branch rulesets and unlimited Actions minutes are public-only
on the free plan. Otherwise claim the [Student Developer Pack](https://education.github.com/pack).

Enable in Settings: secret scanning + push protection, Dependabot (npm, weekly, grouped),
auto-delete head branches.

## 5. Ruleset on `main`

Do this **after** the scaffolding PRs land and after real handles are in CODEOWNERS — an
unresolvable code owner blocks every PR.

Settings → Rules → Rulesets → new branch ruleset targeting `main`:

- [ ] Block force pushes, restrict deletions
- [ ] Require PR: 1 approval, dismiss stale approvals, require conversation resolution, require Code Owner review
- [ ] Require status check `ci`, require branch up to date
- [ ] Empty bypass list

## 6. Board

```bash
gh project create --owner biletflow --title "BiletFlow Delivery"
```

