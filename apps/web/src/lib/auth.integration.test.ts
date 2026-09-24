import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@biletflow/db";
import { hashPassword } from "@biletflow/shared/password.server";
import { auth } from "./auth";
import { audit } from "./audit";
import { requireRole } from "./session";
import { GET as me } from "@/app/api/me/route";
import { POST as mobileLogin } from "@/app/api/mobile/auth/login/route";

// Explicit opt-in: use a migrated development/test database, never production.
describe.skipIf(process.env.RUN_AUTH_INTEGRATION !== "1")(
  "auth and audit integration",
  () => {
    const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
    const suffix = randomUUID();
    const email = `scanner-${suffix}@example.test`;
    const signupEmail = `signup-${suffix}@example.test`;
    const password = "Password123!";
    let userId: string;
    let token: string;
    let ip = 1;

    function request(
      path: string,
      body?: unknown,
      headers: Record<string, string> = {},
    ) {
      return new Request(new URL(path, base), {
        method: body === undefined ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": `192.0.2.${ip++}`,
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    }

    beforeAll(async () => {
      const user = await prisma.user.create({
        data: {
          email,
          name: "Auth test scanner",
          emailVerified: true,
        },
      });
      userId = user.id;
      await prisma.account.create({
        data: {
          userId,
          providerId: "credential",
          accountId: userId,
          password: await hashPassword(password),
        },
      });
    });

    afterAll(async () => {
      const users = await prisma.user.findMany({
        where: { email: { in: [email, signupEmail] } },
        select: { id: true },
      });
      await prisma.auditLog.deleteMany({
        where: { actorUserId: { in: users.map((u) => u.id) } },
      });
      await prisma.user.deleteMany({
        where: { email: { in: [email, signupEmail] } },
      });
      await prisma.$disconnect();
    });

    it("rejects missing and forged credentials", async () => {
      const cases: Record<string, string>[] = [
        {},
        { Authorization: "Bearer invented-token" },
        { Cookie: "better-auth.session_token=forged" },
      ];
      for (const headers of cases) {
        const response = await me(request("/api/me", undefined, headers));
        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({
          error: { code: "UNAUTHENTICATED", message: "UNAUTHENTICATED" },
        });
      }
    });

    it("validates mobile JSON and credentials", async () => {
      expect(
        (
          await mobileLogin(
            new Request(new URL("/api/mobile/auth/login", base), {
              method: "POST",
              body: "{",
            }),
          )
        ).status,
      ).toBe(400);
      expect(
        (
          await mobileLogin(
            request("/api/mobile/auth/login", { email: "invalid", password }),
          )
        ).status,
      ).toBe(400);
      expect(
        (
          await mobileLogin(
            request("/api/mobile/auth/login", { email, password: "incorrect" }),
          )
        ).status,
      ).toBe(401);
    });

    it("authenticates a seed-format password and returns a usable bearer token", async () => {
      const response = await mobileLogin(
        request("/api/mobile/auth/login", {
          email: ` ${email.toUpperCase()} `,
          password,
        }),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(response.headers.get("cache-control")).toBe("no-store");
      const result = await response.json();
      token = result.token;
      expect(token).toBeTruthy();
      expect(result.user.id).toBe(userId);
      expect(result.user).not.toHaveProperty("accounts");
      expect(result.user).not.toHaveProperty("password");
      const current = await me(
        request("/api/me", undefined, { Authorization: `Bearer ${token}` }),
      );
      expect(current.status).toBe(200);
      expect((await current.json()).user.role).toBe("ATTENDEE");
    });

    it("enforces roles on the server", async () => {
      const headers = new Headers({ Authorization: `Bearer ${token}` });
      await expect(
        requireRole(headers, ["PLATFORM_ADMIN"]),
      ).rejects.toMatchObject({ status: 403 });
      await expect(requireRole(headers, ["ATTENDEE"])).resolves.toMatchObject({
        id: userId,
      });
    });

    it("returns organizer summaries and per-event staff roles", async () => {
      await prisma.organizerProfile.create({
        data: { userId, displayName: "Test organizer", contactEmail: email },
      });
      const event = await prisma.event.create({
        data: {
          organizerId: userId,
          slug: `auth-${suffix}`,
          title: "Auth fixture",
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 3600000),
          staff: { create: { userId, role: "EVENT_ADMIN" } },
        },
      });
      try {
        const response = await me(
          request("/api/me", undefined, { Authorization: `Bearer ${token}` }),
        );
        const { user } = await response.json();
        expect(user.organizerProfile.displayName).toBe("Test organizer");
        expect(user.staffAssignments).toContainEqual({
          eventId: event.id,
          role: "EVENT_ADMIN",
        });
      } finally {
        await prisma.event.delete({ where: { id: event.id } });
      }
    });

    it("blocks a suspended account's existing token and new login", async () => {
      await prisma.user.update({
        where: { id: userId },
        data: { status: "SUSPENDED" },
      });
      try {
        expect(
          (
            await me(
              request("/api/me", undefined, {
                Authorization: `Bearer ${token}`,
              }),
            )
          ).status,
        ).toBe(403);
        expect(
          (
            await mobileLogin(
              request("/api/mobile/auth/login", { email, password }),
            )
          ).status,
        ).toBe(403);
      } finally {
        await prisma.user.update({
          where: { id: userId },
          data: { status: "ACTIVE" },
        });
      }
    });

    it("sets a web cookie and prevents role/status injection at sign-up", async () => {
      const response = await auth.handler(
        request(
          "/api/auth/sign-up/email",
          {
            email: signupEmail,
            password,
            name: "Test attendee",
            locale: "kk",
            role: "PLATFORM_ADMIN",
            status: "SUSPENDED",
          },
          { Origin: base },
        ),
      );
      expect(response.status).toBe(200);
      const cookies = response.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      expect(cookies).toContain("session_token=");
      const current = await me(
        request("/api/me", undefined, { Cookie: cookies }),
      );
      expect(current.status).toBe(200);
      expect((await current.json()).user).toMatchObject({
        role: "ATTENDEE",
        status: "ACTIVE",
        locale: "kk",
      });
      expect(
        (
          await auth.handler(
            request(
              "/api/auth/sign-out",
              {},
              { Cookie: cookies, Origin: base },
            ),
          )
        ).status,
      ).toBe(200);
      expect(
        (await me(request("/api/me", undefined, { Cookie: cookies }))).status,
      ).toBe(401);
    });

    it("preserves origin protection on the mobile wrapper", async () => {
      expect(
        (
          await mobileLogin(
            request(
              "/api/mobile/auth/login",
              { email, password },
              { Origin: "https://untrusted.example" },
            ),
          )
        ).status,
      ).toBe(403);
    });

    it("expires sessions", async () => {
      await prisma.session.updateMany({
        where: { userId },
        data: { expiresAt: new Date(0) },
      });
      expect(
        (
          await me(
            request("/api/me", undefined, { Authorization: `Bearer ${token}` }),
          )
        ).status,
      ).toBe(401);
    });

    it("commits audit entries with a mutation and rolls both back on failure", async () => {
      const entry = {
        actorUserId: userId,
        action: "user.updated",
        entityType: "User",
        entityId: userId,
        description: "Locale updated",
      };
      await prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: userId }, data: { locale: "en" } });
        await audit(tx, entry);
      });
      expect(
        await prisma.auditLog.count({ where: { actorUserId: userId } }),
      ).toBe(1);
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: userId },
            data: { locale: "kk" },
          });
          await audit(tx, entry);
          throw new Error("rollback");
        }),
      ).rejects.toThrow("rollback");
      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).locale,
      ).toBe("en");
      expect(
        await prisma.auditLog.count({ where: { actorUserId: userId } }),
      ).toBe(1);
    });

    it("rate limits repeated mobile login attempts", async () => {
      const statuses = [];
      for (let i = 0; i < 12; i++) {
        const response = await mobileLogin(
          request(
            "/api/mobile/auth/login",
            { email, password: "wrong" },
            { "x-forwarded-for": "192.0.2.250" },
          ),
        );
        statuses.push(response.status);
      }
      expect(statuses).toContain(429);
    });
  },
);
