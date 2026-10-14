import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@biletflow/db";
import { hashPassword } from "@biletflow/shared/password.server";
import { createScannerAuth, TOKEN_KEY } from "../../../scanner/src/auth";
import { GET as me } from "@/app/api/me/route";
import { POST as mobileLogin } from "@/app/api/mobile/auth/login/route";

// Real HTTP, route handlers, Better Auth and PostgreSQL. Only device storage is
// substituted; native camera/OS permissions still require physical-device tests.
describe.skipIf(process.env.RUN_AUTH_INTEGRATION !== "1")(
  "scanner/API integration",
  () => {
    const suffix = randomUUID();
    const email = `scanner-integration-${suffix}@example.test`;
    const password = randomUUID();
    let userId: string;
    let eventId: string;
    let server: Server;
    let base: string;
    let requestNumber = 1;
    const statuses: number[] = [];

    function storage(initial: string | null = null) {
      return {
        value: initial,
        async getItemAsync(key: string) {
          expect(key).toBe(TOKEN_KEY);
          return this.value;
        },
        async setItemAsync(key: string, value: string) {
          expect(key).toBe(TOKEN_KEY);
          this.value = value;
        },
        async deleteItemAsync(key: string) {
          expect(key).toBe(TOKEN_KEY);
          this.value = null;
        },
      };
    }

    beforeAll(async () => {
      const user = await prisma.user.create({
        data: { email, name: "Scanner integration", emailVerified: true },
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
      const event = await prisma.event.create({
        data: {
          organizerId: userId,
          slug: `scanner-integration-${suffix}`,
          title: "Scanner integration fixture",
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 3600000),
          staff: { create: { userId, role: "EVENT_ADMIN" } },
        },
      });
      eventId = event.id;
      server = createServer(async (incoming, outgoing) => {
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
          const headers = new Headers();
          for (const [key, value] of Object.entries(incoming.headers))
            if (value)
              headers.set(key, Array.isArray(value) ? value.join(",") : value);
          // Avoid sharing Better Auth's rate-limit bucket with other test requests.
          headers.set("x-forwarded-for", `198.51.100.${requestNumber++}`);
          const request = new Request(new URL(incoming.url ?? "/", base), {
            method: incoming.method,
            headers,
            ...(incoming.method === "POST"
              ? { body: Buffer.concat(chunks).toString() }
              : {}),
          });
          const response =
            incoming.url === "/api/mobile/auth/login"
              ? await mobileLogin(request)
              : incoming.url === "/api/me"
                ? await me(request)
                : new Response(null, { status: 404 });
          statuses.push(response.status);
          outgoing.writeHead(
            response.status,
            Object.fromEntries(response.headers.entries()),
          );
          outgoing.end(await response.text());
        } catch {
          outgoing.writeHead(500);
          outgoing.end();
        }
      });
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
      );
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Missing HTTP test port");
      base = `http://127.0.0.1:${address.port}`;
    });

    afterAll(async () => {
      if (server)
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      if (eventId) await prisma.event.delete({ where: { id: eventId } });
      if (userId) await prisma.user.delete({ where: { id: userId } });
      await prisma.$disconnect();
    });

    it("rejects incorrect credentials without saving a token", async () => {
      const device = storage();
      const scanner = createScannerAuth(device, base);
      await scanner.login(email, "incorrect-test-input");
      expect(scanner.getSnapshot()).toMatchObject({
        phase: "signedOut",
        error: "credentials",
      });
      expect(device.value).toBeNull();
      expect(statuses.at(-1)).toBe(401);
    });

    it("logs in, restores via bearer /api/me, and stays signed out after logout", async () => {
      const device = storage();
      const scanner = createScannerAuth(device, base);
      await scanner.login(email, password);
      expect(scanner.getSnapshot()).toMatchObject({
        phase: "ready",
        user: { email },
      });
      expect(device.value).toBeTruthy();
      const reopened = createScannerAuth(device, base);
      await reopened.restore();
      expect(reopened.getSnapshot().phase).toBe("ready");
      expect(statuses.at(-1)).toBe(200);
      await reopened.logout();
      expect(device.value).toBeNull();
      const afterLogout = createScannerAuth(device, base);
      await afterLogout.restore();
      expect(afterLogout.getSnapshot().phase).toBe("signedOut");
    });

    it("blocks revoked event access when resuming", async () => {
      const device = storage();
      const scanner = createScannerAuth(device, base);
      await scanner.login(email, password);
      expect(scanner.getSnapshot().phase).toBe("ready");
      scanner.suspend();
      await prisma.staffAssignment.deleteMany({ where: { userId, eventId } });
      try {
        await scanner.resume();
        expect(scanner.getSnapshot()).toMatchObject({
          phase: "signedOut",
          error: "access",
        });
        expect(device.value).toBeNull();
      } finally {
        await prisma.staffAssignment.create({
          data: { userId, eventId, role: "EVENT_ADMIN" },
        });
      }
    });

    it("clears a genuinely expired PostgreSQL session", async () => {
      const device = storage();
      const scanner = createScannerAuth(device, base);
      await scanner.login(email, password);
      expect(scanner.getSnapshot().phase).toBe("ready");
      await prisma.session.updateMany({
        where: { userId },
        data: { expiresAt: new Date(Date.now() - 60000) },
      });
      await scanner.restore();
      expect(statuses.at(-1)).toBe(401);
      expect(scanner.getSnapshot().phase).toBe("signedOut");
      expect(device.value).toBeNull();
    });

    it("blocks an existing bearer token after account suspension", async () => {
      const device = storage();
      const scanner = createScannerAuth(device, base);
      await scanner.login(email, password);
      expect(scanner.getSnapshot().phase).toBe("ready");
      await prisma.user.update({
        where: { id: userId },
        data: { status: "SUSPENDED" },
      });
      try {
        await scanner.restore();
        expect(statuses.at(-1)).toBe(403);
        expect(scanner.getSnapshot().phase).toBe("signedOut");
        expect(device.value).toBeNull();
      } finally {
        await prisma.user.update({
          where: { id: userId },
          data: { status: "ACTIVE" },
        });
      }
    });
  },
);
