import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@biletflow/db";
import { hashPassword } from "@biletflow/shared/password.server";

import { POST as reviewActivation } from "@/app/api/admin/activations/[id]/review/route";
import { POST as checkIn } from "@/app/api/checkin/route";
import { GET as mobileEvents } from "@/app/api/mobile/events/route";
import { GET as eventStats } from "@/app/api/mobile/events/[id]/stats/route";
import { GET as activation } from "@/app/api/organizer/events/[id]/activation/route";
import { POST as acceptTerms } from "@/app/api/organizer/events/[id]/activation/accept-terms/route";
import { POST as payFee } from "@/app/api/organizer/events/[id]/activation/pay-fee/route";
import { POST as cancelEvent } from "@/app/api/organizer/events/[id]/cancel/route";
import { GET as history } from "@/app/api/organizer/events/[id]/history/route";
import { POST as publish } from "@/app/api/organizer/events/[id]/publish/route";
import { GET as ticketTypes, POST as createTicketType } from "@/app/api/organizer/events/[id]/ticket-types/route";
import { POST as createEvent } from "@/app/api/organizer/events/route";
import { DELETE as deleteTicketType } from "@/app/api/organizer/ticket-types/[id]/route";
import { GET as listOrders, POST as createOrder } from "@/app/api/orders/route";
import { POST as payOrder } from "@/app/api/orders/[id]/pay/route";
import { GET as ticketQr } from "@/app/api/tickets/[id]/qr.png/route";
import { POST as webhook } from "@/app/api/payments/webhook/route";
import { POST as mobileLogin } from "@/app/api/mobile/auth/login/route";
import { GET as sandboxGet, POST as sandboxPost } from "@/app/sandbox/pay/[intentId]/route";
import { signWebhookBody } from "@/lib/payments-signature";

// Team demo (#88) and the commerce routes behind it. Opt in with a migrated
// database: RUN_AUTH_INTEGRATION=1. Never point this at production.
describe.skipIf(process.env.RUN_AUTH_INTEGRATION !== "1")(
  "organizer checkout, payment, and check-in",
  () => {
    const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
    const suffix = randomUUID();
    const password = "Password123!";
    const emails = {
      organizer: `organizer-${suffix}@commerce.test`,
      attendee: `attendee-${suffix}@commerce.test`,
      admin: `admin-${suffix}@commerce.test`,
      scanner: `scanner-${suffix}@commerce.test`,
    };
    const ids: Record<keyof typeof emails, string> = {
      organizer: "",
      attendee: "",
      admin: "",
      scanner: "",
    };
    const tokens: Record<keyof typeof emails, string> = {
      organizer: "",
      attendee: "",
      admin: "",
      scanner: "",
    };
    let ip = 1;

    function request(path: string, body?: unknown, token = "", method?: string) {
      const headers = new Headers({
        "Content-Type": "application/json",
        "x-forwarded-for": `203.0.113.${(ip++ % 200) + 1}`,
      });
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return new Request(new URL(path, base), {
        method: method ?? (body === undefined ? "GET" : "POST"),
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    }

    async function login(email: string) {
      const response = await mobileLogin(
        request("/api/mobile/auth/login", { email, password }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      return body.token as string;
    }

    const startsAt = new Date(Date.now() + 86_400_000).toISOString();
    const endsAt = new Date(Date.now() + 2 * 86_400_000).toISOString();

    beforeAll(async () => {
      for (const [role, email] of [
        ["ORGANIZER", emails.organizer],
        ["ATTENDEE", emails.attendee],
        ["PLATFORM_ADMIN", emails.admin],
        ["ATTENDEE", emails.scanner],
      ] as const) {
        const key = (Object.keys(emails) as (keyof typeof emails)[]).find(
          (name) => emails[name] === email,
        )!;
        const user = await prisma.user.create({
          data: { email, name: role === "ATTENDEE" ? "Demo attendee" : email, role, emailVerified: true },
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
      tokens.organizer = await login(emails.organizer);
      tokens.attendee = await login(emails.attendee);
      tokens.admin = await login(emails.admin);
      tokens.scanner = await login(emails.scanner);
    });

    afterAll(async () => {
      const userIds = Object.values(ids).filter(Boolean);
      const events = await prisma.event.findMany({
        where: { organizerId: { in: userIds } },
        select: { id: true },
      });
      const eventIds = events.map((event) => event.id);
      await prisma.checkInRecord.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.ticket.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.attendee.deleteMany({ where: { email: { contains: suffix } } });
      await prisma.refund.deleteMany({ where: { order: { eventId: { in: eventIds } } } });
      await prisma.payment.deleteMany({
        where: {
          OR: [
            { order: { eventId: { in: eventIds } } },
            { activation: { eventId: { in: eventIds } } },
          ],
        },
      });
      await prisma.orderItem.deleteMany({ where: { order: { eventId: { in: eventIds } } } });
      await prisma.promoRedemption.deleteMany({ where: { order: { eventId: { in: eventIds } } } });
      await prisma.order.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.paidSalesActivation.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.ticketType.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.staffAssignment.deleteMany({ where: { OR: [{ eventId: { in: eventIds } }, { userId: { in: userIds } }] } });
      await prisma.auditLog.deleteMany({
        where: { OR: [{ eventId: { in: eventIds } }, { actorUserId: { in: userIds } }] },
      });
      await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
      await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.account.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.$disconnect();
    });

    async function settle(
      intent: string,
      outcome: "APPROVED" | "DECLINED" | "ABANDONED",
      eventKey = `${intent}:${outcome}`,
    ) {
      const payload = JSON.stringify({ intentId: intent, outcome, eventKey });
      const response = await webhook(
        new Request(new URL("/api/payments/webhook", base), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-biletflow-signature": signWebhookBody(payload),
          },
          body: payload,
        }),
      );
      expect(response.status).toBe(200);
      return response.json();
    }

    it("publishes only with a visible ticket type, then checks in free and paid orders", async () => {
      const created = await createEvent(
        request(
          "/api/organizer/events",
          { title: `Campus night ${suffix}`, startsAt, endsAt, timezone: "Asia/Almaty" },
          tokens.organizer,
        ),
      );
      expect(created.status).toBe(201);
      const { event } = await created.json();
      expect(event.status).toBe("DRAFT");

      const hidden = await createTicketType(
        request(
          `/api/organizer/events/${event.id}/ticket-types`,
          { name: "Hidden", priceKzt: 0, quantity: 5, isHidden: true },
          tokens.organizer,
        ),
        { params: Promise.resolve({ id: event.id }) },
      );
      expect(hidden.status).toBe(201);
      const refused = await publish(request(`/api/organizer/events/${event.id}/publish`, {}, tokens.organizer), {
        params: Promise.resolve({ id: event.id }),
      });
      expect(refused.status).toBe(409);

      const freeTypeResponse = await createTicketType(
        request(
          `/api/organizer/events/${event.id}/ticket-types`,
          { name: "Free entry", priceKzt: 0, quantity: 10 },
          tokens.organizer,
        ),
        { params: Promise.resolve({ id: event.id }) },
      );
      expect(freeTypeResponse.status).toBe(201);
      const freeType = (await freeTypeResponse.json()).ticketType;
      expect(freeType).toMatchObject({ priceKzt: 0, sold: 0, reserved: 0, available: 10, checkedIn: 0 });

      const paidTypeResponse = await createTicketType(
        request(
          `/api/organizer/events/${event.id}/ticket-types`,
          { name: "General", priceKzt: 5000, quantity: 4 },
          tokens.organizer,
        ),
        { params: Promise.resolve({ id: event.id }) },
      );
      const paidType = (await paidTypeResponse.json()).ticketType;

      const published = await publish(request(`/api/organizer/events/${event.id}/publish`, {}, tokens.organizer), {
        params: Promise.resolve({ id: event.id }),
      });
      expect(published.status).toBe(200);
      expect((await published.json()).event.status).toBe("PUBLISHED");

      const timeline = await history(request(`/api/organizer/events/${event.id}/history`, undefined, tokens.organizer), {
        params: Promise.resolve({ id: event.id }),
      });
      const entries = (await timeline.json()).entries as { action: string }[];
      expect(entries.some((entry) => entry.action === "event.published")).toBe(true);

      const freeKey = randomUUID();
      const freeOrderResponse = await createOrder(
        request(
          "/api/orders",
          {
            eventId: event.id,
            items: [{ ticketTypeId: freeType.id, quantity: 1 }],
            attendees: [{ fullName: "Aliya Bekova", email: `aliya-${suffix}@commerce.test` }],
            clientIdempotencyKey: freeKey,
          },
          tokens.attendee,
        ),
      );
      expect(freeOrderResponse.status).toBe(201);
      const freeOrder = (await freeOrderResponse.json()).order;
      expect(freeOrder.status).toBe("PAID");
      expect(freeOrder.tickets).toHaveLength(1);
      expect(freeOrder.totalKzt).toBe(0);
      expect(freeOrder.tickets[0].code).toMatch(/^BFT1\./);

      const ticketId = freeOrder.tickets[0].id as string;
      const png = await ticketQr(
        request(`/api/tickets/${ticketId}/qr.png`, undefined, tokens.attendee),
        { params: Promise.resolve({ id: ticketId }) },
      );
      expect(png.status).toBe(200);
      expect(png.headers.get("content-type")).toBe("image/png");
      const bytes = Buffer.from(await png.arrayBuffer());
      expect(
        bytes.subarray(0, 8).equals(
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        ),
      ).toBe(true);
      const denied = await ticketQr(
        request(`/api/tickets/${ticketId}/qr.png`, undefined, tokens.organizer),
        { params: Promise.resolve({ id: ticketId }) },
      );
      expect(denied.status).toBe(404);
      const anonymousQr = await ticketQr(
        request(`/api/tickets/${ticketId}/qr.png`),
        { params: Promise.resolve({ id: ticketId }) },
      );
      expect(anonymousQr.status).toBe(401);

      const replay = await createOrder(
        request(
          "/api/orders",
          {
            eventId: event.id,
            items: [{ ticketTypeId: freeType.id, quantity: 1 }],
            attendees: [{ fullName: "Aliya Bekova", email: `aliya-${suffix}@commerce.test` }],
            clientIdempotencyKey: freeKey,
          },
          tokens.attendee,
        ),
      );
      expect((await replay.json()).order.id).toBe(freeOrder.id);
      const listedTypes = await ticketTypes(
        request(`/api/organizer/events/${event.id}/ticket-types`, undefined, tokens.organizer),
        { params: Promise.resolve({ id: event.id }) },
      );
      const afterReplay = (await listedTypes.json()).ticketTypes as { id: string; sold: number }[];
      expect(afterReplay.find((type) => type.id === freeType.id)?.sold).toBe(1);

      const blocked = await createOrder(
        request(
          "/api/orders",
          {
            eventId: event.id,
            items: [{ ticketTypeId: paidType.id, quantity: 1 }],
            attendees: [{ fullName: "Timur Omarov", email: `timur-${suffix}@commerce.test` }],
            clientIdempotencyKey: randomUUID(),
          },
          tokens.attendee,
        ),
      );
      expect(blocked.status).toBe(409);

      const checklist = await activation(
        request(`/api/organizer/events/${event.id}/activation`, undefined, tokens.organizer),
        { params: Promise.resolve({ id: event.id }) },
      );
      const pending = (await checklist.json()).activation;
      expect(pending.feeKzt).toBeGreaterThan(0);
      expect(pending.activated).toBe(false);
      await acceptTerms(request(`/api/organizer/events/${event.id}/activation/accept-terms`, {}, tokens.organizer), {
        params: Promise.resolve({ id: event.id }),
      });
      const earlyReview = await reviewActivation(
        request(`/api/admin/activations/${pending.id}/review`, { decision: "APPROVE" }, tokens.admin),
        { params: Promise.resolve({ id: pending.id }) },
      );
      expect(earlyReview.status).toBe(200);
      expect((await earlyReview.json()).activation.activated).toBe(false);

      const fee = await payFee(request(`/api/organizer/events/${event.id}/activation/pay-fee`, {}, tokens.organizer), {
        params: Promise.resolve({ id: event.id }),
      });
      const feeBody = await fee.json();
      const sandbox = await sandboxGet(request(feeBody.url, undefined, ""), {
        params: Promise.resolve({ intentId: feeBody.payment.intentId }),
      });
      const sandboxHtml = await sandbox.text();
      expect(sandboxHtml).toContain("Simulated payment");
      expect(sandboxHtml).toContain("Approve");
      expect(sandboxHtml).toContain("Decline");
      expect(sandboxHtml).toContain("Abandon");
      expect(sandboxHtml).toContain("No real money moves");

      const unlocked = await sandboxPost(
        new Request(feeBody.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outcome: "APPROVED" }),
        }),
        { params: Promise.resolve({ intentId: feeBody.payment.intentId }) },
      );
      expect(unlocked.status).toBe(200);
      const afterFee = await activation(
        request(`/api/organizer/events/${event.id}/activation`, undefined, tokens.organizer),
        { params: Promise.resolve({ id: event.id }) },
      );
      expect((await afterFee.json()).activation.activated).toBe(true);

      async function paidAttempt(outcome?: "APPROVED" | "DECLINED" | "ABANDONED") {
        const response = await createOrder(
          request(
            "/api/orders",
            {
              eventId: event.id,
              items: [{ ticketTypeId: paidType.id, quantity: 1 }],
              attendees: [{ fullName: "Dana Sultanova", email: `dana-${suffix}@commerce.test` }],
              clientIdempotencyKey: randomUUID(),
            },
            tokens.attendee,
          ),
        );
        expect(response.status).toBe(201);
        const order = (await response.json()).order;
        expect(order.status).toBe("AWAITING_PAYMENT");
        expect(order.tickets).toHaveLength(0);
        const payment = await payOrder(request(`/api/orders/${order.id}/pay`, {}, tokens.attendee), {
          params: Promise.resolve({ id: order.id }),
        });
        expect(payment.status).toBe(200);
        const paymentBody = await payment.json();
        if (outcome) await settle(paymentBody.payment.intentId, outcome);
        return { order, intentId: paymentBody.payment.intentId as string };
      }

      const declined = await paidAttempt("DECLINED");
      const abandoned = await paidAttempt("ABANDONED");
      const approved = await paidAttempt("APPROVED");
      await settle(approved.intentId, "APPROVED");

      const orders = await listOrders(request("/api/orders", undefined, tokens.attendee));
      const mine = (await orders.json()).orders as { id: string; status: string; tickets: unknown[] }[];
      expect(mine.find((order) => order.id === declined.order.id)?.tickets).toHaveLength(0);
      expect(mine.find((order) => order.id === abandoned.order.id)?.tickets).toHaveLength(0);
      expect(mine.find((order) => order.id === declined.order.id)?.status).toBe("CANCELLED");
      expect(mine.find((order) => order.id === abandoned.order.id)?.status).toBe("CANCELLED");
      const paidTickets = mine.find((order) => order.id === approved.order.id)?.tickets as { code: string }[];
      expect(paidTickets).toHaveLength(1);

      const counters = await ticketTypes(
        request(`/api/organizer/events/${event.id}/ticket-types`, undefined, tokens.organizer),
        { params: Promise.resolve({ id: event.id }) },
      );
      const general = ((await counters.json()).ticketTypes as { id: string; sold: number; reserved: number }[]).find(
        (type) => type.id === paidType.id,
      );
      expect(general).toMatchObject({ sold: 1, reserved: 0 });

      await prisma.staffAssignment.create({
        data: { eventId: event.id, userId: ids.scanner, role: "EVENT_ADMIN" },
      });
      const assigned = await mobileEvents(request("/api/mobile/events", undefined, tokens.scanner));
      expect(assigned.status).toBe(200);
      expect((await assigned.json()).events.map((row: { id: string }) => row.id)).toContain(event.id);

      const campaign = await checkIn(
        request(
          "/api/checkin",
          { eventId: event.id, payload: `https://biletflow.local/e/${event.slug}?c=promo-token` },
          tokens.scanner,
        ),
      );
      expect(await campaign.json()).toMatchObject({
        result: "NOT_A_TICKET",
        message: "This is a promotional code, not a ticket",
      });

      const forged = await checkIn(
        request("/api/checkin", { eventId: event.id, payload: "BFT1.not-a-ticket.bad-signature" }, tokens.scanner),
      );
      expect((await forged.json()).result).toBe("INVALID");

      const other = await createEvent(
        request(
          "/api/organizer/events",
          { title: `Other night ${suffix}`, startsAt, endsAt, timezone: "Asia/Almaty" },
          tokens.organizer,
        ),
      );
      const otherEvent = (await other.json()).event;
      await createTicketType(
        request(`/api/organizer/events/${otherEvent.id}/ticket-types`, { name: "Door", priceKzt: 0, quantity: 2 }, tokens.organizer),
        { params: Promise.resolve({ id: otherEvent.id }) },
      );
      await publish(request(`/api/organizer/events/${otherEvent.id}/publish`, {}, tokens.organizer), {
        params: Promise.resolve({ id: otherEvent.id }),
      });
      await prisma.staffAssignment.create({
        data: { eventId: otherEvent.id, userId: ids.scanner, role: "EVENT_ADMIN" },
      });
      const wrong = await checkIn(
        request("/api/checkin", { eventId: otherEvent.id, payload: paidTickets[0]!.code }, tokens.scanner),
      );
      expect((await wrong.json()).result).toBe("WRONG_EVENT");

      const admitted = await checkIn(
        request("/api/checkin", { eventId: event.id, payload: paidTickets[0]!.code, deviceLabel: "Door A" }, tokens.scanner),
      );
      expect((await admitted.json()).result).toBe("VALID");
      const again = await checkIn(
        request("/api/checkin", { eventId: event.id, payload: paidTickets[0]!.code }, tokens.scanner),
      );
      expect((await again.json()).result).toBe("ALREADY_CHECKED_IN");
      const stats = await eventStats(request(`/api/mobile/events/${event.id}/stats`, undefined, tokens.scanner), {
        params: Promise.resolve({ id: event.id }),
      });
      expect(await stats.json()).toEqual({ registered: 2, checkedIn: 1 });

      const auditCount = await prisma.auditLog.count({
        where: { eventId: event.id, action: "ticket.checked_in" },
      });
      expect(auditCount).toBe(1);

      const removed = await deleteTicketType(
        request(`/api/organizer/ticket-types/${paidType.id}`, undefined, tokens.organizer, "DELETE"),
        { params: Promise.resolve({ id: paidType.id }) },
      );
      expect(removed.status).toBe(409);

      const cancelled = await cancelEvent(
        request(`/api/organizer/events/${event.id}/cancel`, { reason: "Venue closed" }, tokens.organizer),
        { params: Promise.resolve({ id: event.id }) },
      );
      expect(cancelled.status).toBe(200);
      expect((await cancelled.json()).event.status).toBe("CANCELLED");
    }, 30000);
  },
);
