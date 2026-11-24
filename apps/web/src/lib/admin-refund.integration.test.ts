import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@biletflow/db";
import { hashPassword } from "@biletflow/shared/password.server";

import { GET as listActivations } from "@/app/api/admin/activations/route";
import { POST as suspendEvent } from "@/app/api/admin/events/[id]/suspend/route";
import { GET as exportOrders } from "@/app/api/admin/exports/[report]/route";
import { GET as listReports } from "@/app/api/admin/reports/route";
import { GET as search } from "@/app/api/admin/search/route";
import { GET as getSettings, PUT as putSettings } from "@/app/api/admin/settings/route";
import { POST as suspendUser } from "@/app/api/admin/users/[id]/suspend/route";
import { POST as reportEvent } from "@/app/api/events/[slug]/report/route";
import { GET as me } from "@/app/api/me/route";
import { POST as refundOrder } from "@/app/api/orders/[id]/refund/route";
import { POST as verifyIdentity } from "@/app/api/organizer/verification/route";
import { POST as mobileLogin } from "@/app/api/mobile/auth/login/route";
import { refundWindowOpen } from "@/lib/refunds";

describe("refund window", () => {
  const startsAt = new Date("2026-12-01T18:00:00.000Z");

  it("opens only inside the policy cutoff", () => {
    const dayBefore = new Date("2026-11-30T17:00:00.000Z");
    const twoDaysBefore = new Date("2026-11-29T17:00:00.000Z");
    expect(refundWindowOpen("NO_REFUNDS", startsAt, twoDaysBefore)).toBe(false);
    expect(refundWindowOpen("UNTIL_48H_BEFORE", startsAt, twoDaysBefore)).toBe(true);
    expect(refundWindowOpen("UNTIL_48H_BEFORE", startsAt, dayBefore)).toBe(false);
    expect(refundWindowOpen("UNTIL_24H_BEFORE", startsAt, dayBefore)).toBe(true);
  });
});

describe.skipIf(process.env.RUN_AUTH_INTEGRATION !== "1")(
  "admin moderation, verification, and refunds",
  () => {
    const suffix = randomUUID();
    const password = "Password123!";
    const emails = {
      organizer: `organizer-${suffix}@moderation.test`,
      attendee: `attendee-${suffix}@moderation.test`,
      admin: `admin-${suffix}@moderation.test`,
    };
    const ids: Record<keyof typeof emails, string> = {
      organizer: "",
      attendee: "",
      admin: "",
    };
    const tokens: Record<keyof typeof emails, string> = {
      organizer: "",
      attendee: "",
      admin: "",
    };
    let openEventId = "";
    let closedEventId = "";
    let openOrderId = "";
    let closedOrderId = "";
    let openSlug = "";

    function request(path: string, body?: unknown, token = "") {
      const headers = new Headers({ "Content-Type": "application/json" });
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return new Request(new URL(path, "http://localhost:3000"), {
        method: body === undefined ? "GET" : "POST",
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    }

    async function login(email: string) {
      const response = await mobileLogin(
        request("/api/mobile/auth/login", { email, password }),
      );
      expect(response.status).toBe(200);
      return ((await response.json()) as { token: string }).token;
    }

    beforeAll(async () => {
      for (const [role, email] of [
        ["ORGANIZER", emails.organizer],
        ["ATTENDEE", emails.attendee],
        ["PLATFORM_ADMIN", emails.admin],
      ] as const) {
        const key = (Object.keys(emails) as (keyof typeof emails)[]).find(
          (name) => emails[name] === email,
        )!;
        const user = await prisma.user.create({
          data: { email, name: email, role, emailVerified: true },
        });
        ids[key] = user.id;
        await prisma.account.create({
          data: {
            userId: user.id,
            providerId: "credential",
            accountId: user.id,
            password: await hashPassword(password),
          },
        });
      }
      await prisma.organizerProfile.create({
        data: {
          userId: ids.organizer,
          displayName: "Moderation Org",
          contactEmail: emails.organizer,
        },
      });
      tokens.organizer = await login(emails.organizer);
      tokens.attendee = await login(emails.attendee);
      tokens.admin = await login(emails.admin);

      const startsAt = new Date(Date.now() + 7 * 86_400_000);
      const endsAt = new Date(Date.now() + 8 * 86_400_000);
      const open = await prisma.event.create({
        data: {
          organizerId: ids.organizer,
          slug: `open-${suffix}`,
          title: `Open night ${suffix}`,
          status: "PUBLISHED",
          refundPolicy: "UNTIL_24H_BEFORE",
          startsAt,
          endsAt,
          publishedAt: new Date(),
        },
      });
      const closed = await prisma.event.create({
        data: {
          organizerId: ids.organizer,
          slug: `closed-${suffix}`,
          title: `Closed night ${suffix}`,
          status: "PUBLISHED",
          refundPolicy: "NO_REFUNDS",
          startsAt,
          endsAt,
          publishedAt: new Date(),
        },
      });
      openEventId = open.id;
      closedEventId = closed.id;
      openSlug = open.slug;

      async function paidOrder(eventId: string, ticketName: string) {
        const ticketType = await prisma.ticketType.create({
          data: { eventId, name: ticketName, priceKzt: 4000, quantity: 5, sold: 1 },
        });
        const order = await prisma.order.create({
          data: {
            reference: `BF-${randomUUID().slice(0, 8).toUpperCase()}`,
            eventId,
            userId: ids.attendee,
            status: "PAID",
            subtotalKzt: 4000,
            totalKzt: 4000,
            paidAt: new Date(),
          },
        });
        const item = await prisma.orderItem.create({
          data: {
            orderId: order.id,
            ticketTypeId: ticketType.id,
            quantity: 1,
            unitPriceKzt: 4000,
            totalKzt: 4000,
          },
        });
        const attendee = await prisma.attendee.create({
          data: { fullName: "Dana Sultanova", email: `dana-${order.id}-${suffix}@moderation.test` },
        });
        await prisma.ticket.create({
          data: {
            code: `BFT1.${order.id}.test`,
            eventId,
            orderId: order.id,
            orderItemId: item.id,
            ticketTypeId: ticketType.id,
            attendeeId: attendee.id,
            status: "VALID",
          },
        });
        await prisma.payment.create({
          data: {
            purpose: "TICKET_ORDER",
            orderId: order.id,
            providerIntentId: `sim_${order.id}`,
            status: "SUCCEEDED",
            amountKzt: 4000,
            simulated: true,
            succeededAt: new Date(),
          },
        });
        return order.id;
      }

      openOrderId = await paidOrder(open.id, "General");
      closedOrderId = await paidOrder(closed.id, "Door");
      await prisma.paidSalesActivation.create({
        data: {
          eventId: open.id,
          organizerId: ids.organizer,
          feeKzt: 15000,
          termsAcceptedAt: new Date(),
        },
      });
    });

    afterAll(async () => {
      const userIds = Object.values(ids).filter(Boolean);
      const eventIds = [openEventId, closedEventId].filter(Boolean);
      await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.eventReport.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.refund.deleteMany({ where: { order: { eventId: { in: eventIds } } } });
      await prisma.checkInRecord.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.ticket.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.attendee.deleteMany({ where: { email: { contains: suffix } } });
      await prisma.payment.deleteMany({ where: { order: { eventId: { in: eventIds } } } });
      await prisma.orderItem.deleteMany({ where: { order: { eventId: { in: eventIds } } } });
      await prisma.order.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.paidSalesActivation.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.ticketType.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.auditLog.deleteMany({
        where: { OR: [{ eventId: { in: eventIds } }, { actorUserId: { in: userIds } }] },
      });
      await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
      await prisma.payoutAccount.deleteMany({ where: { organizerProfile: { userId: { in: userIds } } } });
      await prisma.organizerProfile.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.account.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.$disconnect();
    });

    it("refunds inside the policy window once and refuses a no-refund event", async () => {
      const denied = await refundOrder(
        request(`/api/orders/${closedOrderId}/refund`, { reason: "Changed plans" }, tokens.attendee),
        { params: Promise.resolve({ id: closedOrderId }) },
      );
      expect(denied.status).toBe(409);
      expect(await prisma.ticket.count({ where: { orderId: closedOrderId, status: "VALID" } })).toBe(1);

      const accepted = await refundOrder(
        request(`/api/orders/${openOrderId}/refund`, { reason: "Cannot attend" }, tokens.attendee),
        { params: Promise.resolve({ id: openOrderId }) },
      );
      expect(accepted.status).toBe(201);
      const body = await accepted.json();
      expect(body.order.status).toBe("REFUNDED");
      expect(body.refund.simulated).toBe(true);
      expect(body.refund.amountKzt).toBe(4000);
      expect(await prisma.ticket.count({ where: { orderId: openOrderId, status: "REFUNDED" } })).toBe(1);
      expect(await prisma.refund.count({ where: { orderId: openOrderId } })).toBe(1);
      const type = await prisma.ticketType.findFirstOrThrow({ where: { eventId: openEventId } });
      expect(type.sold).toBe(0);
      expect(type.refunded).toBe(1);

      const again = await refundOrder(
        request(`/api/orders/${openOrderId}/refund`, { reason: "Cannot attend" }, tokens.attendee),
        { params: Promise.resolve({ id: openOrderId }) },
      );
      expect(again.status).toBe(200);
      expect((await again.json()).duplicate).toBe(true);
      expect(await prisma.refund.count({ where: { orderId: openOrderId } })).toBe(1);
      expect(
        await prisma.notification.count({
          where: { userId: ids.attendee, type: "REFUND_COMPLETED" },
        }),
      ).toBeGreaterThan(0);

      const stranger = await refundOrder(
        request(`/api/orders/${closedOrderId}/refund`, { reason: "Not mine" }, tokens.organizer),
        { params: Promise.resolve({ id: closedOrderId }) },
      );
      expect(stranger.status).toBe(409);
    });

    it("lets an admin moderate accounts, events, reports, and settings", async () => {
      const forbidden = await search(request("/api/admin/search?q=moderation", undefined, tokens.attendee));
      expect(forbidden.status).toBe(403);

      const found = await search(
        request(`/api/admin/search?q=${encodeURIComponent(emails.attendee)}`, undefined, tokens.admin),
      );
      expect(found.status).toBe(200);
      const foundBody = await found.json();
      expect(foundBody.users.map((user: { id: string }) => user.id)).toContain(ids.attendee);

      const suspended = await suspendUser(
        request(`/api/admin/users/${ids.attendee}/suspend`, { reason: "Abuse report" }, tokens.admin),
        { params: Promise.resolve({ id: ids.attendee }) },
      );
      expect(suspended.status).toBe(200);
      const blocked = await me(request("/api/me", undefined, tokens.attendee));
      expect(blocked.status).toBe(403);
      const self = await suspendUser(
        request(`/api/admin/users/${ids.admin}/suspend`, { reason: "Mistake" }, tokens.admin),
        { params: Promise.resolve({ id: ids.admin }) },
      );
      expect(self.status).toBe(409);

      const sales = await suspendEvent(
        request(`/api/admin/events/${closedEventId}/suspend`, { reason: "Policy review" }, tokens.admin),
        { params: Promise.resolve({ id: closedEventId }) },
      );
      expect(sales.status).toBe(200);
      expect((await prisma.event.findUniqueOrThrow({ where: { id: closedEventId } })).paidSalesSuspended).toBe(true);

      const reported = await reportEvent(
        request(`/api/events/${openSlug}/report`, { reason: "Misleading title" }, tokens.organizer),
        { params: Promise.resolve({ slug: openSlug }) },
      );
      expect(reported.status).toBe(201);
      const queue = await listReports(request("/api/admin/reports", undefined, tokens.admin));
      const reports = (await queue.json()).reports as { event: { id: string } | null }[];
      expect(reports.some((report) => report.event?.id === openEventId)).toBe(true);

      const settings = await putSettings(
        new Request(new URL("/api/admin/settings", "http://localhost:3000"), {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokens.admin}`,
          },
          body: JSON.stringify({ activationFeeKzt: 12000 }),
        }),
      );
      expect(settings.status).toBe(200);
      expect((await settings.json()).settings.activationFeeKzt).toBe(12000);
      const readBack = await getSettings(request("/api/admin/settings", undefined, tokens.admin));
      expect((await readBack.json()).settings.activationFeeKzt).toBe(12000);
      await prisma.platformSetting.upsert({
        where: { key: "PLATFORM_ACTIVATION_FEE_KZT" },
        create: { key: "PLATFORM_ACTIVATION_FEE_KZT", value: "15000" },
        update: { value: "15000" },
      });

      const csv = await exportOrders(
        request("/api/admin/exports/orders.csv", undefined, tokens.admin),
        { params: Promise.resolve({ report: "orders.csv" }) },
      );
      expect(csv.status).toBe(200);
      expect(csv.headers.get("content-type")).toContain("text/csv");
      const text = await csv.text();
      const reference = (await prisma.order.findUniqueOrThrow({ where: { id: openOrderId } })).reference;
      expect(text).toContain(reference);

      const activations = await listActivations(
        request("/api/admin/activations", undefined, tokens.admin),
      );
      expect(activations.status).toBe(200);
      const rows = (await activations.json()).activations as { event: { title: string } }[];
      expect(rows.some((row) => row.event.title.includes(suffix))).toBe(true);

      const verification = await verifyIdentity(
        request("/api/organizer/verification", { documentName: "id-card.pdf" }, tokens.organizer),
      );
      expect(verification.status).toBe(200);
      expect((await verification.json()).profile.verificationStatus).toBe("PENDING_REVIEW");
    });
  },
);
