import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@biletflow/db";
import { hashPassword } from "@biletflow/shared/password.server";

import { GET as freeSeats } from "@/app/api/events/[slug]/seats/route";
import { POST as mobileLogin } from "@/app/api/mobile/auth/login/route";
import { POST as markRead } from "@/app/api/notifications/[id]/read/route";
import { POST as createOrder } from "@/app/api/orders/route";
import { POST as simulatePay } from "@/app/api/orders/[id]/pay/simulate/route";
import { POST as createSection } from "@/app/api/organizer/events/[id]/sections/route";
import { POST as createRow } from "@/app/api/organizer/events/[id]/sections/[sectionId]/rows/route";

describe.skipIf(process.env.RUN_AUTH_INTEGRATION !== "1")(
  "notification read state and assigned seats",
  () => {
    const suffix = randomUUID();
    const password = "Password123!";
    const emails = {
      organizer: `org-${suffix}@seats.test`,
      buyer: `buyer-${suffix}@seats.test`,
      other: `other-${suffix}@seats.test`,
    };
    const ids: Record<keyof typeof emails, string> = { organizer: "", buyer: "", other: "" };
    const tokens: Record<keyof typeof emails, string> = { organizer: "", buyer: "", other: "" };
    let eventId = "";
    let venueId = "";
    let slug = "";
    let notificationId = "";

    function request(path: string, body?: unknown, token = "") {
      const headers = new Headers({ "Content-Type": "application/json" });
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return new Request(new URL(path, "http://localhost:3000"), {
        method: body === undefined ? "GET" : "POST",
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    }

    beforeAll(async () => {
      for (const [role, email] of [
        ["ORGANIZER", emails.organizer],
        ["ATTENDEE", emails.buyer],
        ["ATTENDEE", emails.other],
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
        const response = await mobileLogin(
          request("/api/mobile/auth/login", { email, password }),
        );
        expect(response.status).toBe(200);
        tokens[key] = ((await response.json()) as { token: string }).token;
      }
      const note = await prisma.notification.create({
        data: {
          userId: ids.buyer,
          type: "ORDER_CONFIRMATION",
          channel: "IN_APP",
          subject: "Order ready",
          body: "Your order is ready.",
        },
      });
      notificationId = note.id;
      const venue = await prisma.venue.create({
        data: { name: `Hall ${suffix}`, address: "1 Test Street", city: "Almaty" },
      });
      venueId = venue.id;
      slug = `seats-${suffix}`;
      const event = await prisma.event.create({
        data: {
          organizerId: ids.organizer,
          venueId,
          slug,
          title: `Seats ${suffix}`,
          status: "PUBLISHED",
          seatingMode: "ASSIGNED",
          paidSalesActive: true,
          startsAt: new Date(Date.now() + 86_400_000),
          endsAt: new Date(Date.now() + 2 * 86_400_000),
        },
      });
      eventId = event.id;
      await prisma.ticketType.create({
        data: { eventId, name: "Seat", priceKzt: 2000, quantity: 10 },
      });
    });

    afterAll(async () => {
      const userIds = Object.values(ids).filter(Boolean);
      await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.refund.deleteMany({ where: { order: { eventId } } });
      await prisma.ticket.deleteMany({ where: { eventId } });
      await prisma.attendee.deleteMany({ where: { email: { contains: suffix } } });
      await prisma.payment.deleteMany({ where: { order: { eventId } } });
      await prisma.seatHold.deleteMany({ where: { eventId } });
      await prisma.orderItem.deleteMany({ where: { order: { eventId } } });
      await prisma.order.deleteMany({ where: { eventId } });
      await prisma.ticketType.deleteMany({ where: { eventId } });
      await prisma.auditLog.deleteMany({
        where: { OR: [{ eventId }, { actorUserId: { in: userIds } }] },
      });
      await prisma.event.deleteMany({ where: { id: eventId } });
      await prisma.seat.deleteMany({ where: { row: { section: { venueId } } } });
      await prisma.seatRow.deleteMany({ where: { section: { venueId } } });
      await prisma.venueSection.deleteMany({ where: { venueId } });
      await prisma.venue.deleteMany({ where: { id: venueId } });
      await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.account.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.$disconnect();
    });

    it("marks only the owner's notification and keeps the first timestamp", async () => {
      const first = await markRead(
        request(`/api/notifications/${notificationId}/read`, {}, tokens.buyer),
        { params: Promise.resolve({ id: notificationId }) },
      );
      expect(first.status).toBe(200);
      const body = (await first.json()) as { readAt: string };
      const second = await markRead(
        request(`/api/notifications/${notificationId}/read`, {}, tokens.buyer),
        { params: Promise.resolve({ id: notificationId }) },
      );
      expect(second.status).toBe(200);
      expect(((await second.json()) as { readAt: string }).readAt).toBe(body.readAt);
      const hidden = await markRead(
        request(`/api/notifications/${notificationId}/read`, {}, tokens.other),
        { params: Promise.resolve({ id: notificationId }) },
      );
      expect(hidden.status).toBe(404);
    });

    it("holds one seat, frees it when payment is declined, and copies it onto the ticket", async () => {
      const sectionResponse = await createSection(
        request(`/api/organizer/events/${eventId}/sections`, { name: "Stalls" }, tokens.organizer),
        { params: Promise.resolve({ id: eventId }) },
      );
      expect(sectionResponse.status).toBe(201);
      const sectionId = ((await sectionResponse.json()) as { id: string }).id;
      const rowResponse = await createRow(
        request(
          `/api/organizer/events/${eventId}/sections/${sectionId}/rows`,
          { label: "A", seats: [{ number: "1" }, { number: "2" }] },
          tokens.organizer,
        ),
        { params: Promise.resolve({ id: eventId, sectionId }) },
      );
      expect(rowResponse.status).toBe(201);
      const seats = ((await rowResponse.json()) as { seats: { id: string; number: string }[] }).seats;
      const seatA = seats.find((seat) => seat.number === "1")!;
      const ticketType = await prisma.ticketType.findFirstOrThrow({ where: { eventId } });

      const listed = await freeSeats(request(`/api/events/${slug}/seats`), {
        params: Promise.resolve({ slug }),
      });
      expect(listed.status).toBe(200);
      const listedBody = (await listed.json()) as {
        sections: { rows: { seats: { id: string }[] }[] }[];
      };
      expect(listedBody.sections[0]?.rows[0]?.seats.map((seat) => seat.id).sort()).toEqual(
        seats.map((seat) => seat.id).sort(),
      );

      const orderBody = (seatId: string, email: string) => ({
        eventId,
        items: [{ ticketTypeId: ticketType.id, quantity: 1, seatIds: [seatId] }],
        attendees: [{ fullName: "Dana Sultanova", email }],
        clientIdempotencyKey: randomUUID(),
      });
      const [firstOrder, secondOrder] = await Promise.all([
        createOrder(request("/api/orders", orderBody(seatA.id, `dana-${suffix}@seats.test`), tokens.buyer)),
        createOrder(request("/api/orders", orderBody(seatA.id, `dana2-${suffix}@seats.test`), tokens.other)),
      ]);
      const statuses = [firstOrder.status, secondOrder.status].sort();
      expect(statuses).toEqual([201, 409]);
      const winner = firstOrder.status === 201 ? firstOrder : secondOrder;
      const winnerToken = firstOrder.status === 201 ? tokens.buyer : tokens.other;
      const loserToken = winnerToken === tokens.buyer ? tokens.other : tokens.buyer;
      const winnerBody = (await winner.json()) as { order: { id: string } };
      expect((await (firstOrder.status === 409 ? firstOrder : secondOrder).json()).error.code).toBe(
        "SOLD_OUT",
      );

      const declined = await simulatePay(
        request(
          `/api/orders/${winnerBody.order.id}/pay/simulate`,
          { outcome: "DECLINED" },
          winnerToken,
        ),
        { params: Promise.resolve({ id: winnerBody.order.id }) },
      );
      expect(declined.status).toBe(200);

      const recovered = await createOrder(
        request("/api/orders", orderBody(seatA.id, `dana3-${suffix}@seats.test`), loserToken),
      );
      expect(recovered.status).toBe(201);
      const recoveredBody = (await recovered.json()) as { order: { id: string } };
      const approved = await simulatePay(
        request(
          `/api/orders/${recoveredBody.order.id}/pay/simulate`,
          { outcome: "APPROVED" },
          loserToken,
        ),
        { params: Promise.resolve({ id: recoveredBody.order.id }) },
      );
      expect(approved.status).toBe(200);
      const ticket = await prisma.ticket.findFirstOrThrow({
        where: { orderId: recoveredBody.order.id },
      });
      expect(ticket.seatId).toBe(seatA.id);
      expect(ticket.seatNumber).toBe("1");
      expect(ticket.rowLabel).toBe("A");
      expect(ticket.sectionName).toBe("Stalls");
    });
  },
);
