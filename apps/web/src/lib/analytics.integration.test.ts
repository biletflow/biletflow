import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@biletflow/db";
import { hashPassword } from "@biletflow/shared/password.server";

import { GET as analytics } from "@/app/api/organizer/analytics/[report]/route";
import { POST as acceptTerms } from "@/app/api/organizer/events/[id]/activation/accept-terms/route";
import { POST as payFee } from "@/app/api/organizer/events/[id]/activation/pay-fee/route";
import { POST as simulateFee } from "@/app/api/organizer/events/[id]/activation/simulate/route";
import { GET as history } from "@/app/api/organizer/events/[id]/history/route";
import { POST as mobileLogin } from "@/app/api/mobile/auth/login/route";

describe.skipIf(process.env.RUN_AUTH_INTEGRATION !== "1")(
  "organizer analytics and activation settlement",
  () => {
    const suffix = randomUUID();
    const password = "Password123!";
    const emails = {
      owner: `owner-${suffix}@analytics.test`,
      other: `other-${suffix}@analytics.test`,
      admin: `admin-${suffix}@analytics.test`,
    };
    const ids: Record<keyof typeof emails, string> = { owner: "", other: "", admin: "" };
    const tokens: Record<keyof typeof emails, string> = { owner: "", other: "", admin: "" };
    let eventId = "";
    let ticketTypeId = "";

    function request(path: string, body?: unknown, token = "", method?: string) {
      const headers = new Headers({ "Content-Type": "application/json" });
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return new Request(new URL(path, "http://localhost:3000"), {
        method: method ?? (body === undefined ? "GET" : "POST"),
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    }

    beforeAll(async () => {
      for (const [role, email] of [
        ["ORGANIZER", emails.owner],
        ["ORGANIZER", emails.other],
        ["PLATFORM_ADMIN", emails.admin],
      ] as const) {
        const key = (Object.keys(emails) as (keyof typeof emails)[]).find((name) => emails[name] === email)!;
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
          userId: ids.owner,
          displayName: "Analytics Org",
          contactEmail: emails.owner,
          payoutAccounts: {
            create: { holderName: "Analytics Org", bankName: "Test Bank", ibanLast4: "1234", isDefault: true },
          },
        },
      });
      for (const key of Object.keys(emails) as (keyof typeof emails)[]) {
        const response = await mobileLogin(request("/api/mobile/auth/login", { email: emails[key], password }));
        expect(response.status).toBe(200);
        tokens[key] = ((await response.json()) as { token: string }).token;
      }
      const event = await prisma.event.create({
        data: {
          organizerId: ids.owner,
          slug: `analytics-${suffix}`,
          title: `Analytics ${suffix}`,
          status: "PUBLISHED",
          startsAt: new Date(Date.now() + 86_400_000),
          endsAt: new Date(Date.now() + 2 * 86_400_000),
        },
      });
      eventId = event.id;
      const ticketType = await prisma.ticketType.create({
        data: { eventId, name: "General", priceKzt: 5000, quantity: 10, sold: 1 },
      });
      ticketTypeId = ticketType.id;
      const campaign = await prisma.promotionalCampaign.create({
        data: { eventId, name: "Launch", discountType: "FIXED_KZT", discountValue: 500, redeemed: 1 },
      });
      const order = await prisma.order.create({
        data: {
          reference: `AN-${suffix.slice(0, 8)}`,
          eventId,
          userId: ids.other,
          status: "PAID",
          subtotalKzt: 5000,
          discountKzt: 500,
          totalKzt: 4500,
          paidAt: new Date("2026-11-18T20:00:00Z"),
          campaignId: campaign.id,
        },
      });
      const item = await prisma.orderItem.create({
        data: { orderId: order.id, ticketTypeId, quantity: 1, unitPriceKzt: 5000, totalKzt: 4500 },
      });
      const attendee = await prisma.attendee.create({
        data: { fullName: "Dana Sultanova", email: `dana-${suffix}@analytics.test` },
      });
      await prisma.ticket.create({
        data: {
          code: `BFT1.${order.id}.analytics`,
          eventId,
          orderId: order.id,
          orderItemId: item.id,
          ticketTypeId,
          attendeeId: attendee.id,
          status: "CHECKED_IN",
        },
      });
      const payment = await prisma.payment.create({
        data: {
          purpose: "TICKET_ORDER",
          orderId: order.id,
          providerIntentId: `sim_${order.id}`,
          status: "SUCCEEDED",
          amountKzt: 4500,
          simulated: true,
          succeededAt: new Date(),
        },
      });
      await prisma.refund.create({
        data: {
          orderId: order.id,
          paymentId: payment.id,
          initiatedById: ids.owner,
          amountKzt: 1000,
          status: "SUCCEEDED",
          simulated: true,
          processedAt: new Date(),
        },
      });
    });

    afterAll(async () => {
      const userIds = Object.values(ids).filter(Boolean);
      await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.refund.deleteMany({ where: { order: { eventId } } });
      await prisma.ticket.deleteMany({ where: { eventId } });
      await prisma.attendee.deleteMany({ where: { email: { contains: suffix } } });
      await prisma.payment.deleteMany({
        where: { OR: [{ order: { eventId } }, { activation: { eventId } }] },
      });
      await prisma.orderItem.deleteMany({ where: { order: { eventId } } });
      await prisma.order.deleteMany({ where: { eventId } });
      await prisma.promotionalCampaign.deleteMany({ where: { eventId } });
      await prisma.paidSalesActivation.deleteMany({ where: { eventId } });
      await prisma.ticketType.deleteMany({ where: { eventId } });
      await prisma.auditLog.deleteMany({
        where: { OR: [{ eventId }, { actorUserId: { in: userIds } }] },
      });
      await prisma.event.deleteMany({ where: { id: eventId } });
      await prisma.payoutAccount.deleteMany({ where: { organizerProfile: { userId: { in: userIds } } } });
      await prisma.organizerProfile.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.account.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.$disconnect();
    });

    it("returns owner analytics and hides another organizer's event", async () => {
      const summary = await analytics(
        request(`/api/organizer/analytics/summary?eventId=${eventId}`, undefined, tokens.owner),
        { params: Promise.resolve({ report: "summary" }) },
      );
      expect(summary.status).toBe(200);
      expect((await summary.json()).summary).toMatchObject({
        capacity: 10,
        sold: 1,
        grossKzt: 5000,
        discountsKzt: 500,
        refundsKzt: 1000,
        orders: 1,
      });

      const days = await analytics(
        request(`/api/organizer/analytics/sales-over-time?eventId=${eventId}`, undefined, tokens.owner),
        { params: Promise.resolve({ report: "sales-over-time" }) },
      );
      expect((await days.json()).buckets[0]).toMatchObject({ day: "2026-11-19", collectedKzt: 4500, tickets: 1 });

      const types = await analytics(
        request(`/api/organizer/analytics/by-ticket-type?eventId=${eventId}`, undefined, tokens.owner),
        { params: Promise.resolve({ report: "by-ticket-type" }) },
      );
      expect((await types.json()).ticketTypes[0]).toMatchObject({ id: ticketTypeId, tickets: 1, grossKzt: 4500 });

      const campaigns = await analytics(
        request(`/api/organizer/analytics/campaigns?eventId=${eventId}`, undefined, tokens.owner),
        { params: Promise.resolve({ report: "campaigns" }) },
      );
      expect((await campaigns.json()).campaigns[0]).toMatchObject({ redemptions: 1, discountKzt: 500 });

      const attendance = await analytics(
        request(`/api/organizer/analytics/attendance?eventId=${eventId}`, undefined, tokens.owner),
        { params: Promise.resolve({ report: "attendance" }) },
      );
      expect((await attendance.json()).attendance).toEqual({
        registered: 1,
        checkedIn: 1,
        absent: 0,
        percentCheckedIn: 100,
      });

      const hidden = await analytics(
        request(`/api/organizer/analytics/summary?eventId=${eventId}`, undefined, tokens.other),
        { params: Promise.resolve({ report: "summary" }) },
      );
      expect(hidden.status).toBe(404);
      const timeline = await history(
        request(`/api/organizer/events/${eventId}/history`, undefined, tokens.other),
        { params: Promise.resolve({ id: eventId }) },
      );
      expect(timeline.status).toBe(403);
    });

    it("settles the simulated activation fee for the owning organizer only", async () => {
      const accepted = await acceptTerms(
        request(`/api/organizer/events/${eventId}/activation/accept-terms`, {}, tokens.owner),
        { params: Promise.resolve({ id: eventId }) },
      );
      expect(accepted.status).toBe(200);
      const started = await payFee(
        request(`/api/organizer/events/${eventId}/activation/pay-fee`, {}, tokens.owner),
        { params: Promise.resolve({ id: eventId }) },
      );
      expect(started.status).toBe(200);
      const intentId = (await started.json()).payment.intentId as string;

      const stranger = await simulateFee(
        request(`/api/organizer/events/${eventId}/activation/simulate`, { intentId, outcome: "APPROVED" }, tokens.other),
        { params: Promise.resolve({ id: eventId }) },
      );
      expect(stranger.status).toBe(404);

      const settled = await simulateFee(
        request(`/api/organizer/events/${eventId}/activation/simulate`, { intentId, outcome: "APPROVED" }, tokens.owner),
        { params: Promise.resolve({ id: eventId }) },
      );
      expect(settled.status).toBe(200);
      const body = await settled.json();
      expect(body.activation.feePaid).toBe(true);
      expect(body.activation.activated).toBe(false);
      const replay = await simulateFee(
        request(`/api/organizer/events/${eventId}/activation/simulate`, { intentId, outcome: "APPROVED" }, tokens.owner),
        { params: Promise.resolve({ id: eventId }) },
      );
      expect(replay.status).toBe(200);
      expect((await replay.json()).simulation.duplicate).toBe(true);
    });
  },
);
