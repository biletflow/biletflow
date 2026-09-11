## What

<!-- One or two sentences. What does this change do for a user? -->

## Checklist

- [ ] CI is green
- [ ] Works against `pnpm infra:up` + `pnpm db:seed` demo data
- [ ] Zod validation on any new input, in `packages/shared/src/schemas`
- [ ] `audit()` called for any new mutation
- [ ] No hardcoded user-facing strings; i18n keys added for all three locales
- [ ] Money handled as integer KZT, never a float
- [ ] Screenshot or a short clip for UI changes
