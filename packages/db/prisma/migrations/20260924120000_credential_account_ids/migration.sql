-- Better Auth 1.7 matches credential accountId to User.id, not User.email.
-- Repair existing demo accounts without resetting data or changing passwords.
UPDATE "Account" AS account
SET "accountId" = account."userId"
FROM "User" AS owner
WHERE account."userId" = owner."id"
  AND account."providerId" = 'credential'
  AND account."accountId" = owner."email";
