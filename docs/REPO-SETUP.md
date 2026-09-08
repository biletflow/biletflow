# Setup

Owner: D. Checked items are already committed.

## Already done

- [x] Org `biletflow`, public repo, MIT.
- [x] pnpm workspace + root scripts + `.npmrc` (`node-linker=hoisted`, required by Expo's Metro).
- [x] `packages/db` — full Prisma schema, all 24 SRS entities.
- [x] `packages/shared` — Zod schemas, KZT money, QR parse/sign, tests.
- [x] `infra/` — Compose (Postgres, Mailpit, MinIO) + Dockerfile.
- [x] `.github/` — CI, PR template, issue forms, CODEOWNERS.
- [x] `docs/`, `.env.example`, `scripts/bootstrap-github.sh`.

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

## 2. Scaffold apps/web — D

`apps/web` is empty on purpose so `create-next-app` hits no conflicts.

```bash
pnpm create next-app@latest apps/web --ts --tailwind --app --eslint --src-dir --use-pnpm
cd apps/web
pnpm add @biletflow/db@workspace:* @biletflow/shared@workspace:*
pnpm add better-auth next-intl @react-pdf/renderer qrcode recharts \
         react-hook-form @hookform/resolvers zod nodemailer @aws-sdk/client-s3
pnpm add -D vitest @vitejs/plugin-react
pnpm dlx shadcn@latest init
```

Then: add `"typecheck": "tsc --noEmit"` and `"test": "vitest run --passWithNoTests"` to
`apps/web/package.json`, and set `output: "standalone"` in `next.config.ts` so the
Dockerfile works.

## 3. Scaffold apps/scanner — K

```bash
pnpm create expo-app apps/scanner --template blank-typescript
cd apps/scanner
pnpm add expo-camera expo-router expo-secure-store nativewind
pnpm add @biletflow/shared@workspace:*
```

Then configure `metro.config.js` per Expo's monorepo guide: `watchFolders` at the repo
root, extended `nodeModulesPaths`. Import `@biletflow/shared` only — never
`qr.server.ts`, which needs `node:crypto` and will not bundle.

If Metro costs more than a day, move the scanner to its own repo and copy the types. Do
not block week 5 on it.

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

Fields: `Owner`, `Area`, `Priority`, `Week`. Columns: Backlog / This Week / In Progress /
In Review / Done. Bulk-add the issues from step 4.
