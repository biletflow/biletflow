import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@biletflow/db";
import { createScannerAuth } from "../../scanner/src/auth";

// Use only the disposable, seeded integration database. The seed's demo password
// is read locally instead of duplicating it in the tests or publishing credentials.
const password =
  process.env.E2E_PASSWORD ??
  readFileSync(
    resolve(__dirname, "../../../packages/db/prisma/seed.ts"),
    "utf8",
  ).match(/const PASSWORD = "([^"]+)"/)?.[1];
if (!password)
  throw new Error(
    "Set E2E_PASSWORD or provide the local demo seed configuration.",
  );
const createdEmails: string[] = [];
const messages = Object.fromEntries(
  ["en", "ru", "kk"].map((locale) => [
    locale,
    JSON.parse(
      readFileSync(resolve(__dirname, `../messages/${locale}.json`), "utf8"),
    ),
  ]),
);

async function login(page: Page, email: string, value = password!) {
  await page.goto("/en/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(value);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
async function signup(page: Page) {
  const email = `team-e2e-${randomUUID()}@example.test`;
  createdEmails.push(email);
  await page.goto("/en/sign-up");
  await page
    .getByLabel("Name", { exact: true })
    .fill("Team integration attendee");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.locator('input[name="password"]').fill(password!);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL("http://localhost:3000/en");
  return email;
}

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

for (const locale of ["en", "ru", "kk"]) {
  test(`public events and authentication forms render in ${locale}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`/${locale}/events`);
    await expect(
      page.getByRole("heading", { name: "Almaty Jazz Night" }),
    ).toBeVisible();
    await page.goto(`/${locale}/events/almaty-jazz-night`);
    await expect(
      page.getByRole("heading", { name: "Almaty Jazz Night", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: messages[locale].event.increaseQuantity,
        exact: true,
      })
      .click();
    const total = locale === "en" ? "₸16,000" : "₸16\u00a0000";
    await expect(page.getByText(total, { exact: true }).first()).toBeVisible();
    expect(errors).toEqual([]);
    await page.goto(`/${locale}/sign-in`);
    await expect(
      page.getByRole("heading", {
        name: messages[locale].auth.signInTitle,
        exact: true,
      }),
    ).toBeVisible();
    await page.goto(`/${locale}/sign-up`);
    await expect(
      page.getByRole("heading", {
        name: messages[locale].auth.signUpTitle,
        exact: true,
      }),
    ).toBeVisible();
  });
}

test("incorrect web password shows an error without a session", async ({
  page,
}) => {
  await login(page, "organizer@biletflow.kz", "incorrect-test-input");
  await expect(page.locator("form").getByRole("alert")).toContainText(
    messages.en.auth.errorInvalid,
  );
  expect((await page.request.get("/api/me")).status()).toBe(401);
});

test("browser signup, cookie persistence, attendee access and logout work together", async ({
  page,
}) => {
  const email = await signup(page);
  const response = await page.request.get("/api/me");
  expect(response.status()).toBe(200);
  expect((await response.json()).user).toMatchObject({
    email,
    role: "ATTENDEE",
    locale: "en",
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  for (const target of ["admin", "organizer"]) {
    await page.goto(`/en/${target}`);
    await expect(page).toHaveURL("http://localhost:3000/en");
  }
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("link", { name: messages.en.nav.signIn, exact: true }),
  ).toBeVisible();
  expect((await page.request.get("/api/me")).status()).toBe(401);
});

test("organizer sees only their seeded events and cannot open admin users", async ({
  page,
}) => {
  await login(page, "organizer@biletflow.kz");
  await expect(page).toHaveURL(/\/en\/organizer$/);
  await expect(
    page.getByRole("heading", { name: "Almaty Jazz Night", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Summer Open Air (draft)", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "KBTU Freshers Welcome", exact: true }),
  ).toHaveCount(0);
  await page.goto("/en/admin");
  await expect(page).toHaveURL(/\/en\/organizer$/);
});

test("platform admin sees seeded users without credentials", async ({
  page,
}) => {
  await login(page, "admin@biletflow.kz");
  await expect(page).toHaveURL(/\/en\/admin$/);
  const table = page.getByRole("table");
  await expect(table).toContainText("scanner@biletflow.kz");
  await expect(table).toContainText("organizer@biletflow.kz");
  await expect(table).toContainText("PLATFORM_ADMIN");
  await expect(table).not.toContainText(password!);
});

test("anonymous dashboards redirect to sign-in in every locale", async ({
  page,
}) => {
  for (const locale of ["en", "ru", "kk"])
    for (const target of ["organizer", "admin"]) {
      await page.goto(`/${locale}/${target}`);
      await expect(page).toHaveURL(`http://localhost:3000/${locale}/sign-in`);
    }
});

test("suspending an account blocks its existing browser cookie", async ({
  page,
}) => {
  const email = await signup(page);
  await prisma.user.update({ where: { email }, data: { status: "SUSPENDED" } });
  expect((await page.request.get("/api/me")).status()).toBe(403);
  await page.goto("/en/organizer");
  await expect(page).toHaveURL(/\/en\/sign-in$/);
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toHaveCount(0);
});

test("expiring a session returns the browser to anonymous access", async ({
  page,
}) => {
  const email = await signup(page);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  await prisma.session.updateMany({
    where: { userId: user.id },
    data: { expiresAt: new Date(0) },
  });
  expect((await page.request.get("/api/me")).status()).toBe(401);
  await page.goto("/en/admin");
  await expect(page).toHaveURL(/\/en\/sign-in$/);
});

test("both seeded scanner accounts work through the running Next.js API", async ({
  request,
}) => {
  // Node fetch adds browser metadata without an Origin. Expo's native transport
  // does not. Use the API transport to preserve native requests and CSRF checks.
  const nativeFetch: typeof fetch = async (input, init) => {
    const response = await request.fetch(
      input instanceof Request ? input.url : String(input),
      {
        method: init?.method,
        headers: Object.fromEntries(new Headers(init?.headers).entries()),
        data: init?.body ? String(init.body) : undefined,
      },
    );
    return new Response(await response.text(), {
      status: response.status(),
      headers: response.headers(),
    });
  };
  for (const email of ["scanner@biletflow.kz", "scanner2@biletflow.kz"]) {
    const device = {
      token: null as string | null,
      async getItemAsync() {
        return this.token;
      },
      async setItemAsync(_key: string, token: string) {
        this.token = token;
      },
      async deleteItemAsync() {
        this.token = null;
      },
    };
    const scanner = createScannerAuth(
      device,
      "http://localhost:3000",
      nativeFetch,
    );
    await scanner.login(email, password!);
    expect(scanner.getSnapshot()).toMatchObject({
      phase: "ready",
      user: { email },
    });
    await scanner.restore();
    expect(scanner.getSnapshot().phase).toBe("ready");
    await scanner.logout();
    expect(device.token).toBeNull();
  }
});
