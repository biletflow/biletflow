import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@biletflow/db";
import { hashPassword } from "@biletflow/shared/password.server";

import { POST as reviewActivation } from "@/app/api/admin/activations/[id]/review/route";
import { POST as checkIn } from "@/app/api/checkin/route";
import { GET as readActivation } from "@/app/api/organizer/events/[id]/activation/route";
import { POST as acceptTerms } from "@/app/api/organizer/events/[id]/activation/accept-terms/route";
import { POST as payFee } from "@/app/api/organizer/events/[id]/activation/pay-fee/route";
import { POST as publish } from "@/app/api/organizer/events/[id]/publish/route";
import { POST as createTicketType } from "@/app/api/organizer/events/[id]/ticket-types/route";
import { POST as createEvent } from "@/app/api/organizer/events/route";
import { POST as createOrder } from "@/app/api/orders/route";
import { POST as payOrder } from "@/app/api/orders/[id]/pay/route";
import { POST as webhook } from "@/app/api/payments/webhook/route";
import { POST as mobileLogin } from "@/app/api/mobile/auth/login/route";
import { signWebhookBody } from "@/lib/payments-signature";

// Issue #97. Failed payments must not create tickets, and a repeated checkout,
// payment, activation, webhook, or check-in must not create a second row.
describe.skipIf(process.env.RUN_AUTH_INTEGRATION !== "1")(
  "order, activation, and webhook invariants",
  () => {
    const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
    const suffix = randomUUID();
    const password = "Password123!";
    const emails = {
      organizer: `organizer-${suffix}@invariants.test`,
      attendee: `attendee-${suffix}@invariants.test`,
      admin: `admin-${suffix}@invariants.test`,
      scanner: `scanner-${suffix}@invariants.test`,
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
    const startsAt = new Date(Date.now() + 86_400_000).toISOString();
    const endsAt = new Date(Date.now() + 2 * 86_400_000).toISOString();

    function request(path: string, body?: unknown, token = "", method?: string) {
      const headers = new Headers({
        "Content-Type": "application/json",
        "x-forwarded-for": `198.51.100.${(ip++ % 200) + 1}`,
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
          data: {
            email,
            name: email,
            role,
            emailVerified: true,
          },
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
      await prisma.order.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.paidSalesActivation.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.ticketType.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.staffAssignment.deleteMany({
        where: { OR: [{ eventId: { in: eventIds } }, { userId: { in: userIds } }] },
      });
      await prisma.auditLog.deleteMany({
        where: { OR: [{ eventId: { in: eventIds } }, { actorUserId: { in: userIds } }] },
      });
      await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
      await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.account.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.$disconnect();
    });

    async function publishPaidEvent(name: string) {
      const created = await createEvent(
        request(
          "/api/organizer/events",
          { title: `${name} ${suffix.slice(0, 8)}`, startsAt, endsAt, timezone: "Asia/Almaty" },
          tokens.organizer,
        ),
      );
      expect(created.status).toBe(201);
      const { event } = await created.json();
      const typeResponse = await createTicketType(
        request(
          `/api/organizer/events/${event.id}/ticket-types`,
          { name: "General", priceKzt: 5000, quantity: 4 },
          tokens.organizer,
        ),
        { params: Promise.resolve({ id: event.id }) },
      );
      expect(typeResponse.status).toBe(201);
      const ticketType = (await typeResponse.json()).ticketType as { id: string };
      const published = await publish(
        request(`/api/organizer/events/${event.id}/publish`, {}, tokens.organizer),
        { params: Promise.resolve({ id: event.id }) },
      );
      expect(published.status).toBe(200);
      return { event: event as { id: string; slug: string }, ticketType };
    }

    async function inventory(ticketTypeId: string) {
      const ticketType = await prisma.ticketType.findUniqueOrThrow({
        where: { id: ticketTypeId },
        select: { sold: true, reserved: true },
      });
      const tickets = await prisma.ticket.count({ where: { ticketTypeId } });
      return { sold: ticketType.sold, reserved: ticketType.reserved, tickets };
    }

    async function placeOrder(eventId: string, ticketTypeId: string, key = randomUUID()) {
      const response = await createOrder(
        request(
          "/api/orders",
          {
            eventId,
            items: [{ ticketTypeId, quantity: 1 }],
            attendees: [{ fullName: "Dana Sultanova", email: `dana-${key}@invariants.test` }],
            clientIdempotencyKey: key,
          },
          tokens.attendee,
        ),
      );
      const body = await response.json();
      return { status: response.status, order: body.order as { id: string; status: string; tickets: unknown[] }, key };
    }

    async function startPay(orderId: string) {
      const response = await payOrder(
        request(`/api/orders/${orderId}/pay`, {}, tokens.attendee),
        { params: Promise.resolve({ id: orderId }) },
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      return body.payment as { id: string; intentId: string; status: string };
    }

    async function deliver(
      intentId: string,
      outcome: "APPROVED" | "DECLINED" | "ABANDONED",
      eventKey: string,
      signature?: string | null,
    ) {
      const payload = JSON.stringify({ intentId, outcome, eventKey });
      const signed = signature === undefined ? signWebhookBody(payload) : signature;
      const headers = new Headers({ "Content-Type": "application/json" });
      if (signed !== null) headers.set("x-biletflow-signature", signed);
      const response = await webhook(
        new Request(new URL("/api/payments/webhook", base), {
          method: "POST",
          headers,
          body: payload,
        }),
      );
      return { status: response.status, body: await response.json() };
    }

    async function activationFor(eventId: string) {
      const response = await readActivation(
        request(`/api/organizer/events/${eventId}/activation`, undefined, tokens.organizer),
        { params: Promise.resolve({ id: eventId }) },
      );
      expect(response.status).toBe(200);
      return (await response.json()).activation as {
        id: string;
        feePaid: boolean;
        activated: boolean;
      };
    }

    it("rejects a bad webhook without issuing a ticket or moving inventory", async () => {
      const { event, ticketType } = await publishPaidEvent("Unsigned");
      await unlockPaidSales(event.id);

      const placed = await placeOrder(event.id, ticketType.id);
      expect(placed.status).toBe(201);
      expect(placed.order.tickets).toHaveLength(0);
      expect(placed.order.status).toBe("AWAITING_PAYMENT");
      const payment = await startPay(placed.order.id);
      expect(await inventory(ticketType.id)).toEqual({ sold: 0, reserved: 1, tickets: 0 });

      const unsigned = await deliver(payment.intentId, "APPROVED", `${payment.intentId}:bad-1`, null);
      expect(unsigned.status).toBe(401);
      const forged = await deliver(payment.intentId, "APPROVED", `${payment.intentId}:bad-2`, "0".repeat(64));
      expect(forged.status).toBe(401);
      const malformed = await webhook(
        new Request(new URL("/api/payments/webhook", base), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-biletflow-signature": signWebhookBody("{"),
          },
          body: "{",
        }),
      );
      expect(malformed.status).toBe(400);
      const unknown = await deliver("sim_missing", "APPROVED", `sim_missing:${randomUUID()}`);
      expect(unknown.status).toBe(404);

      expect(await inventory(ticketType.id)).toEqual({ sold: 0, reserved: 1, tickets: 0 });
      const order = await prisma.order.findUniqueOrThrow({ where: { id: placed.order.id } });
      expect(order.status).toBe("AWAITING_PAYMENT");
      expect(await prisma.ticket.count({ where: { orderId: placed.order.id } })).toBe(0);
    });

    async function unlockPaidSales(eventId: string) {
      await acceptTerms(
        request(`/api/organizer/events/${eventId}/activation/accept-terms`, {}, tokens.organizer),
        { params: Promise.resolve({ id: eventId }) },
      );
      const pending = await activationFor(eventId);
      await reviewActivation(
        request(`/api/admin/activations/${pending.id}/review`, { decision: "APPROVE" }, tokens.admin),
        { params: Promise.resolve({ id: pending.id }) },
      );
      const fee = await payFee(
        request(`/api/organizer/events/${eventId}/activation/pay-fee`, {}, tokens.organizer),
        { params: Promise.resolve({ id: eventId }) },
      );
      const feeBody = await fee.json();
      const settled = await deliver(
        feeBody.payment.intentId,
        "APPROVED",
        `${feeBody.payment.intentId}:APPROVED`,
      );
      expect(settled.status).toBe(200);
      expect((await activationFor(eventId)).activated).toBe(true);
      return pending.id;
    }

    it("releases a declined or abandoned hold once and never issues a ticket", async () => {
      const { event, ticketType } = await publishPaidEvent("Declined");
      await unlockPaidSales(event.id);

      async function fail(outcome: "DECLINED" | "ABANDONED") {
        const placed = await placeOrder(event.id, ticketType.id);
        expect(placed.status).toBe(201);
        expect(placed.order.tickets).toHaveLength(0);
        const payment = await startPay(placed.order.id);
        const eventKey = `${payment.intentId}:${outcome}`;
        const first = await deliver(payment.intentId, outcome, eventKey);
        expect(first.status).toBe(200);
        expect(first.body).toMatchObject({ duplicate: false, tickets: 0 });
        expect(await inventory(ticketType.id)).toMatchObject({ sold: 0, tickets: 0, reserved: 0 });
        const replay = await deliver(payment.intentId, outcome, eventKey);
        expect(replay.body).toMatchObject({ duplicate: true, tickets: 0 });
        const anotherKey = await deliver(payment.intentId, outcome, `${eventKey}:again`);
        expect(anotherKey.body).toMatchObject({ ignored: true, tickets: 0 });
        expect(await prisma.ticket.count({ where: { orderId: placed.order.id } })).toBe(0);
        const stored = await prisma.order.findUniqueOrThrow({
          where: { id: placed.order.id },
          include: { payments: true },
        });
        expect(stored.status).toBe("CANCELLED");
        expect(stored.payments).toHaveLength(1);
        expect(stored.payments[0]?.status).toBe(outcome === "ABANDONED" ? "ABANDONED" : "FAILED");
        expect(await inventory(ticketType.id)).toEqual({ sold: 0, reserved: 0, tickets: 0 });
      }

      await fail("DECLINED");
      await fail("ABANDONED");
    });

    it("returns the same order and payment, and one replayed approval issues one ticket", async () => {
      const { event, ticketType } = await publishPaidEvent("Replay");
      await acceptTerms(
        request(`/api/organizer/events/${event.id}/activation/accept-terms`, {}, tokens.organizer),
        { params: Promise.resolve({ id: event.id }) },
      );
      const pending = await activationFor(event.id);
      await reviewActivation(
        request(`/api/admin/activations/${pending.id}/review`, { decision: "APPROVE" }, tokens.admin),
        { params: Promise.resolve({ id: pending.id }) },
      );
      const fee = await payFee(
        request(`/api/organizer/events/${event.id}/activation/pay-fee`, {}, tokens.organizer),
        { params: Promise.resolve({ id: event.id }) },
      );
      const feeBody = await fee.json();
      const feeAgain = await payFee(
        request(`/api/organizer/events/${event.id}/activation/pay-fee`, {}, tokens.organizer),
        { params: Promise.resolve({ id: event.id }) },
      );
      const feeAgainBody = await feeAgain.json();
      expect(feeAgainBody.payment.intentId).toBe(feeBody.payment.intentId);
      expect(
        await prisma.payment.count({
          where: { activationId: pending.id, purpose: "ACTIVATION_FEE" },
        }),
      ).toBe(1);
      await deliver(feeBody.payment.intentId, "APPROVED", `${feeBody.payment.intentId}:APPROVED`);
      expect((await activationFor(event.id)).activated).toBe(true);

      const key = randomUUID();
      const first = await placeOrder(event.id, ticketType.id, key);
      const second = await placeOrder(event.id, ticketType.id, key);
      expect(second.order.id).toBe(first.order.id);
      expect(await prisma.order.count({ where: { clientIdempotencyKey: key } })).toBe(1);
      expect(await inventory(ticketType.id)).toEqual({ sold: 0, reserved: 1, tickets: 0 });

      const payment = await startPay(first.order.id);
      const paymentAgain = await startPay(first.order.id);
      expect(paymentAgain.intentId).toBe(payment.intentId);
      expect(await prisma.payment.count({ where: { orderId: first.order.id } })).toBe(1);

      const eventKey = `${payment.intentId}:APPROVED`;
      const [left, right] = await Promise.all([
        deliver(payment.intentId, "APPROVED", eventKey),
        deliver(payment.intentId, "APPROVED", eventKey),
      ]);
      const bodies = [left.body, right.body];
      expect(bodies.filter((body) => body.duplicate === true)).toHaveLength(1);
      expect(bodies.reduce((sum, body) => sum + body.tickets, 0)).toBe(1);
      const later = await deliver(payment.intentId, "APPROVED", `${eventKey}:later`);
      expect(later.body).toMatchObject({ ignored: true, tickets: 0 });

      expect(await inventory(ticketType.id)).toEqual({ sold: 1, reserved: 0, tickets: 1 });
      const stored = await prisma.order.findUniqueOrThrow({
        where: { id: first.order.id },
        include: { tickets: true, payments: true },
      });
      expect(stored.status).toBe("PAID");
      expect(stored.tickets).toHaveLength(1);
      expect(stored.payments.filter((row) => row.status === "SUCCEEDED")).toHaveLength(1);
    });

    it("keeps one activation row and locks paid checkout again after rejection", async () => {
      const { event, ticketType } = await publishPaidEvent("Activation");
      const blocked = await placeOrder(event.id, ticketType.id);
      expect(blocked.status).toBe(409);

      await acceptTerms(
        request(`/api/organizer/events/${event.id}/activation/accept-terms`, {}, tokens.organizer),
        { params: Promise.resolve({ id: event.id }) },
      );
      await acceptTerms(
        request(`/api/organizer/events/${event.id}/activation/accept-terms`, {}, tokens.organizer),
        { params: Promise.resolve({ id: event.id }) },
      );
      expect(await prisma.paidSalesActivation.count({ where: { eventId: event.id } })).toBe(1);
      const pending = await activationFor(event.id);
      expect(pending.activated).toBe(false);

      const early = await reviewActivation(
        request(`/api/admin/activations/${pending.id}/review`, { decision: "APPROVE" }, tokens.admin),
        { params: Promise.resolve({ id: pending.id }) },
      );
      expect((await early.json()).activation.activated).toBe(false);
      expect((await placeOrder(event.id, ticketType.id)).status).toBe(409);

      const declinedFee = await payFee(
        request(`/api/organizer/events/${event.id}/activation/pay-fee`, {}, tokens.organizer),
        { params: Promise.resolve({ id: event.id }) },
      );
      const declinedBody = await declinedFee.json();
      const declinedAgain = await payFee(
        request(`/api/organizer/events/${event.id}/activation/pay-fee`, {}, tokens.organizer),
        { params: Promise.resolve({ id: event.id }) },
      );
      expect((await declinedAgain.json()).payment.intentId).toBe(declinedBody.payment.intentId);
      const declined = await deliver(
        declinedBody.payment.intentId,
        "DECLINED",
        `${declinedBody.payment.intentId}:DECLINED`,
      );
      expect(declined.body).toMatchObject({ tickets: 0 });
      const declinedReplay = await deliver(
        declinedBody.payment.intentId,
        "DECLINED",
        `${declinedBody.payment.intentId}:DECLINED`,
      );
      expect(declinedReplay.body).toMatchObject({ duplicate: true, tickets: 0 });
      expect(await activationFor(event.id)).toMatchObject({ feePaid: false, activated: false });
      expect((await placeOrder(event.id, ticketType.id)).status).toBe(409);

      const paidFee = await payFee(
        request(`/api/organizer/events/${event.id}/activation/pay-fee`, {}, tokens.organizer),
        { params: Promise.resolve({ id: event.id }) },
      );
      const paidBody = await paidFee.json();
      expect(paidBody.payment.intentId).not.toBe(declinedBody.payment.intentId);
      await deliver(paidBody.payment.intentId, "APPROVED", `${paidBody.payment.intentId}:APPROVED`);
      await deliver(paidBody.payment.intentId, "APPROVED", `${paidBody.payment.intentId}:APPROVED`);
      expect(await activationFor(event.id)).toMatchObject({ feePaid: true, activated: true });
      expect(await prisma.paidSalesActivation.count({ where: { eventId: event.id } })).toBe(1);
      expect(
        await prisma.payment.count({
          where: { activationId: pending.id, status: "SUCCEEDED", purpose: "ACTIVATION_FEE" },
        }),
      ).toBe(1);

      const held = await placeOrder(event.id, ticketType.id);
      expect(held.status).toBe(201);
      expect(held.order.tickets).toHaveLength(0);

      const rejected = await reviewActivation(
        request(
          `/api/admin/activations/${pending.id}/review`,
          { decision: "REJECT", note: "Payout details do not match" },
          tokens.admin,
        ),
        { params: Promise.resolve({ id: pending.id }) },
      );
      expect((await rejected.json()).activation.activated).toBe(false);
      expect((await placeOrder(event.id, ticketType.id)).status).toBe(409);
      expect(await prisma.paidSalesActivation.count({ where: { eventId: event.id } })).toBe(1);
      expect(await prisma.ticket.count({ where: { eventId: event.id } })).toBe(0);
    });

    it("admits one scan when the same ticket is checked in twice", async () => {
      const { event, ticketType } = await publishPaidEvent("Admission");
      await unlockPaidSales(event.id);

      const placed = await placeOrder(event.id, ticketType.id);
      const payment = await startPay(placed.order.id);
      await deliver(payment.intentId, "APPROVED", `${payment.intentId}:APPROVED`);
      const ticket = await prisma.ticket.findFirstOrThrow({ where: { orderId: placed.order.id } });
      await prisma.staffAssignment.create({
        data: { eventId: event.id, userId: ids.scanner, role: "EVENT_ADMIN" },
      });

      const scan = () =>
        checkIn(
          request(
            "/api/checkin",
            { eventId: event.id, payload: ticket.code, deviceLabel: "Door A" },
            tokens.scanner,
          ),
        );
      const [first, second] = await Promise.all([scan(), scan()]);
      const results = [await first.json(), await second.json()]
        .map((body) => body.result as string)
        .sort();
      expect(results).toEqual(["ALREADY_CHECKED_IN", "VALID"]);
      const third = await scan();
      expect((await third.json()).result).toBe("ALREADY_CHECKED_IN");

      expect(await prisma.ticket.count({ where: { orderId: placed.order.id } })).toBe(1);
      expect(
        await prisma.checkInRecord.count({ where: { ticketId: ticket.id, activeKey: "active" } }),
      ).toBe(1);
      expect(
        await prisma.auditLog.count({ where: { eventId: event.id, action: "ticket.checked_in" } }),
      ).toBe(1);
      const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      expect(stored.status).toBe("CHECKED_IN");
    });
  },
);
