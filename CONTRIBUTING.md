# Contributing

## Branching

`main` plus short-lived feature branches. No `develop`, no `staging`.

- Keep `main` demoable with passing CI.
- Branch names: `feat/organizer-event-editor`, `fix/checkout-inventory-race`, `chore/ci-cache`.
- Prefer small, short-lived branches.
- Squash merge, delete the branch.
- To freeze a state for a graded demo, tag it: `git tag demo-week6 && git push --tags`.
  Never branch for this.

Use a separate demo environment when needed.

## Commits

Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.

## Pull requests

- Keep changes focused; larger integration PRs need extra review.
- 1 approval, CI green, conversations resolved.
- Reviewed within one working day. A stale PR queue is how small teams stall.
- Code owner is auto-requested; see [.github/CODEOWNERS](.github/CODEOWNERS).

## Definition of done

Merged to `main`, CI green, works against `pnpm db:seed` data, one line of docs.

## Non-negotiable rules

| Rule | Why |
| --- | --- |
| Money is integer KZT | A float subtotal will eventually disagree with the sum of its items |
| Input validated by a Zod schema in `packages/shared` | One definition, enforced on web, API, and mobile |
| Every mutation calls `audit()` in its transaction | Retrofitting leaves permanent holes in the SRS 4.16 timeline |
| No hardcoded user-facing strings | Three locales; retrofitting i18n costs days |
| Inventory, promo limits, and check-in uniqueness use atomic database operations | Read-then-write loses the race |
| Paid tickets are issued only after verified payment settlement | Makes "abandoned checkout issues no ticket" structural |
| Never import `qr.server.ts` from client or mobile code | Depends on `node:crypto`; leaks signing keys |
