import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@biletflow/db";

// Run against a local server and a disposable, migrated, seeded database.
describe.skipIf(process.env.RUN_HTTP_INTEGRATION !== "1")(
  "auth over HTTP",
  () => {
    const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
    const email = `http-${randomUUID()}@example.test`;
    const password = "Password123!";
    let cookie = "";
    let userId = "";
    let ip = 1;

    async function request(path: string, body?: unknown, session = "") {
      return fetch(new URL(path, base), {
        method: body === undefined ? "GET" : "POST",
        redirect: "manual",
        headers: {
          "Content-Type": "application/json",
          Origin: base,
          Cookie: session,
          "User-Agent": "Twitterbot", // Wait for server-rendered redirects.
          "x-forwarded-for": `198.51.100.${ip++}`,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    }

    function cookies(response: Response) {
      return response.headers
        .getSetCookie()
        .map((v) => v.split(";")[0])
        .join("; ");
    }

    async function redirected(path: string, destination: string, session = "") {
      const response = await request(path, undefined, session);
      await response.text();
      expect(response.status).toBe(307);
      expect(new URL(response.headers.get("location")!, base).pathname).toBe(
        destination,
      );
    }

    afterAll(async () => {
      await prisma.user.deleteMany({ where: { email } });
      await prisma.$disconnect();
    });

    it("redirects anonymous dashboard requests in all three locales", async () => {
      for (const locale of ["ru", "kk", "en"]) {
        for (const page of ["admin", "organizer"]) {
          await redirected(`/${locale}/${page}`, `/${locale}/sign-in`);
        }
      }
    }, 120000);

    it("registers with the web form payload and exposes the cookie session to /api/me", async () => {
      const response = await request("/api/auth/sign-up/email", {
        email,
        password,
        name: "HTTP integration attendee",
        locale: "kk",
      });
      expect(response.status).toBe(200);
      cookie = cookies(response);
      expect(cookie).toContain("session_token=");
      await response.json();
      const current = await request("/api/me", undefined, cookie);
      expect(current.status).toBe(200);
      expect(current.headers.get("cache-control")).toBe("no-store");
      const { user } = await current.json();
      userId = user.id;
      expect(user).toMatchObject({ email, locale: "kk", role: "ATTENDEE" });
      expect(user).not.toHaveProperty("password");
      await redirected("/kk/admin", "/kk", cookie);
      await redirected("/kk/organizer", "/kk", cookie);
    });

    it.each([
      ["organizer@biletflow.kz", "ORGANIZER", "organizer", "admin"],
      ["admin@biletflow.kz", "PLATFORM_ADMIN", "admin", "organizer"],
    ])(
      "connects seeded %s to its dashboard",
      async (email, role, allowed, denied) => {
        const login = await request("/api/auth/sign-in/email", {
          email,
          password,
        });
        expect(login.status).toBe(200);
        const session = cookies(login);
        const { user } = await login.json();
        expect(user.role).toBe(role);
        const page = await request(`/en/${allowed}`, undefined, session);
        const html = await page.text();
        expect(page.status).toBe(200);
        expect(html).toContain(user.name);
        await redirected(`/en/${denied}`, `/en/${allowed}`, session);
        const logout = await request("/api/auth/sign-out", {}, session);
        expect(logout.status).toBe(200);
        await logout.text();
      },
    );

    it.each(["scanner@biletflow.kz", "scanner2@biletflow.kz"])(
      "returns the token and event assignments consumed by %s",
      async (email) => {
        const login = await request("/api/mobile/auth/login", {
          email,
          password,
        });
        expect(login.status).toBe(200);
        expect(login.headers.get("set-cookie")).toBeNull();
        const result = await login.json();
        expect(result.user.staffAssignments.length).toBeGreaterThan(0);
        expect(result.user.staffAssignments[0].role).toBe("EVENT_ADMIN");
        const headers = { Authorization: `Bearer ${result.token}` };
        const current = await fetch(new URL("/api/me", base), { headers });
        expect(current.status).toBe(200);
        expect((await current.json()).user).toEqual(result.user);
        const logout = await fetch(new URL("/api/auth/sign-out", base), {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: "{}",
        });
        expect(logout.status).toBe(200);
        await logout.text();
        const expired = await fetch(new URL("/api/me", base), { headers });
        expect(expired.status).toBe(401);
        await expired.text();
      },
    );

    it("blocks an existing organizer session after suspension", async () => {
      await prisma.user.update({
        where: { id: userId },
        data: { role: "ORGANIZER" },
      });
      const page = await request("/en/organizer", undefined, cookie);
      expect(page.status).toBe(200);
      await page.text();
      await prisma.user.update({
        where: { id: userId },
        data: { status: "SUSPENDED" },
      });
      try {
        const current = await request("/api/me", undefined, cookie);
        expect(current.status).toBe(403);
        await current.text();
        await redirected("/en/organizer", "/en/sign-in", cookie);
      } finally {
        await prisma.user.update({
          where: { id: userId },
          data: { status: "ACTIVE", role: "ATTENDEE" },
        });
      }
    });

    it("rejects incorrect passwords and invalid mobile JSON over HTTP", async () => {
      const login = await request("/api/auth/sign-in/email", {
        email,
        password: "incorrect",
      });
      expect(login.status).toBe(401);
      await login.text();
      const malformed = await fetch(new URL("/api/mobile/auth/login", base), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      });
      expect(malformed.status).toBe(400);
      expect((await malformed.json()).error.code).toBe("VALIDATION_FAILED");
    });

    it("invalidates the web cookie on logout", async () => {
      const logout = await request("/api/auth/sign-out", {}, cookie);
      expect(logout.status).toBe(200);
      await logout.text();
      const current = await request("/api/me", undefined, cookie);
      expect(current.status).toBe(401);
      await current.text();
      await redirected("/en/organizer", "/en/sign-in", cookie);
    });
  },
);
