import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@biletflow/db";
import { hashPassword } from "@biletflow/shared/password.server";

import { POST as checkIn } from "@/app/api/checkin/route";
import { POST as cancelEvent } from "@/app/api/organizer/events/[id]/cancel/route";
import { GET as publicSeats } from "@/app/api/events/[slug]/seats/route";
import { POST as mobileLogin } from "@/app/api/mobile/auth/login/route";
import { POST as cancelOrder } from "@/app/api/orders/[id]/cancel/route";
import { POST as simulatePay } from "@/app/api/orders/[id]/pay/simulate/route";
import { POST as refundOrder } from "@/app/api/orders/[id]/refund/route";
import { POST as createOrder } from "@/app/api/orders/route";
import { GET as listTickets } from "@/app/api/tickets/route";
import { GET as getEvent, PUT as updateEvent } from "@/app/api/organizer/events/[id]/route";
import { POST as addSeats } from "@/app/api/organizer/events/[id]/rows/[rowId]/seats/route";
import { DELETE as deleteSeat } from "@/app/api/organizer/events/[id]/seats/[seatId]/route";
import { GET as organizerSeats } from "@/app/api/organizer/events/[id]/seats/route";
import { POST as createRow } from "@/app/api/organizer/events/[id]/sections/[sectionId]/rows/route";
import { POST as createSection } from "@/app/api/organizer/events/[id]/sections/route";

describe.skipIf(process.env.RUN_AUTH_INTEGRATION !== "1")("assigned seating contract", () => {
  const suffix = randomUUID();
  const password = "Password123!";
  const emails = {
    owner: `owner-${suffix}@seat-contract.test`,
    other: `other-${suffix}@seat-contract.test`,
    admin: `admin-${suffix}@seat-contract.test`,
    buyer: `buyer-${suffix}@seat-contract.test`,
    guest: `guest-${suffix}@seat-contract.test`,
  };
  const ids: Record<keyof typeof emails, string> = {
    owner: "",
    other: "",
    admin: "",
    buyer: "",
    guest: "",
  };
  const tokens: Record<keyof typeof emails, string> = { ...ids };
  let venueId = "";
  let eventId = "";
  let slug = "";
  let ticketTypeId = "";
  let rowId = "";
  let sectionId = "";
  const seatIds: Record<string, string> = {};

  function request(path: string, body?: unknown, token = "", method?: string) {
    const headers = new Headers({ "Content-Type": "application/json" });
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return new Request(new URL(path, "http://localhost:3000"), {
      method: method ?? (body === undefined ? "GET" : "POST"),
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  function orderBody(seatList: string[], quantity = seatList.length, email = `dana-${suffix}@seat-contract.test`) {
    return {
      eventId,
      items: [{ ticketTypeId, quantity, seatIds: seatList }],
      attendees: Array.from({ length: quantity }, (_, index) => ({
        fullName: "Dana Sultanova",
        email: index === 0 ? email : `dana-${index}-${suffix}@seat-contract.test`,
      })),
      clientIdempotencyKey: randomUUID(),
    };
  }

  async function seatStatus(targetEventId: string, seatId: string) {
    const response = await organizerSeats(
      request(`/api/organizer/events/${targetEventId}/seats`, undefined, tokens.owner),
      { params: Promise.resolve({ id: targetEventId }) },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      sections: { rows: { seats: { id: string; status: string }[] }[] }[];
    };
    return body.sections
      .flatMap((section) => section.rows.flatMap((row) => row.seats))
      .find((seat) => seat.id === seatId)?.status;
  }

  beforeAll(async () => {
    for (const [role, email] of [
      ["ORGANIZER", emails.owner],
      ["ORGANIZER", emails.other],
      ["PLATFORM_ADMIN", emails.admin],
      ["ATTENDEE", emails.buyer],
      ["ATTENDEE", emails.guest],
    ] as const) {
      const key = (Object.keys(emails) as (keyof typeof emails)[]).find((name) => emails[name] === email)!;
      const user = await prisma.user.create({ data: { email, name: email, role, emailVerified: true } });
      ids[key] = user.id;
      await prisma.account.create({
        data: {
          userId: user.id,
          providerId: "credential",
          accountId: user.id,
          password: await hashPassword(password),
        },
      });
      let token = "";
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const response = await mobileLogin(request("/api/mobile/auth/login", { email, password }));
        if (response.status === 200) {
          token = ((await response.json()) as { token: string }).token;
          break;
        }
        if (response.status !== 429 || attempt === 7) expect(response.status).toBe(200);
        await new Promise((resolve) => setTimeout(resolve, 3500));
      }
      tokens[key] = token;
    }
    const venue = await prisma.venue.create({
      data: { name: `Hall ${suffix}`, address: "1 Test Street", city: "Almaty" },
    });
    venueId = venue.id;
    slug = `contract-${suffix}`;
    const event = await prisma.event.create({
      data: {
        organizerId: ids.owner,
        venueId,
        slug,
        title: `Contract ${suffix}`,
        status: "PUBLISHED",
        seatingMode: "ASSIGNED",
        paidSalesActive: true,
        refundPolicy: "UNTIL_48H_BEFORE",
        startsAt: new Date(Date.now() + 5 * 86_400_000),
        endsAt: new Date(Date.now() + 6 * 86_400_000),
        ticketTypes: { create: { name: "Seat", priceKzt: 2000, quantity: 30 } },
      },
      include: { ticketTypes: true },
    });
    eventId = event.id;
    ticketTypeId = event.ticketTypes[0]!.id;
    const section = await createSection(
      request(`/api/organizer/events/${eventId}/sections`, { name: "Stalls" }, tokens.owner),
      { params: Promise.resolve({ id: eventId }) },
    );
    expect(section.status).toBe(201);
    sectionId = ((await section.json()) as { id: string }).id;
    const row = await createRow(
      request(
        `/api/organizer/events/${eventId}/sections/${sectionId}/rows`,
        { label: "A", seats: [{ number: "1" }, { number: "2" }, { number: "3" }] },
        tokens.owner,
      ),
      { params: Promise.resolve({ id: eventId, sectionId }) },
    );
    expect(row.status).toBe(201);
    const created = (await row.json()) as { id: string; seats: { id: string; number: string }[] };
    rowId = created.id;
    for (const seat of created.seats) seatIds[seat.number] = seat.id;
  });

  afterAll(async () => {
    const userIds = Object.values(ids).filter(Boolean);
    const events = await prisma.event.findMany({ where: { venueId }, select: { id: true } });
    const eventIds = events.map((event) => event.id);
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.refund.deleteMany({ where: { order: { eventId: { in: eventIds } } } });
    await prisma.checkInRecord.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.ticket.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.attendee.deleteMany({ where: { email: { contains: suffix } } });
    await prisma.payment.deleteMany({ where: { order: { eventId: { in: eventIds } } } });
    await prisma.seatHold.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.orderItem.deleteMany({ where: { order: { eventId: { in: eventIds } } } });
    await prisma.order.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.ticketType.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.auditLog.deleteMany({
      where: { OR: [{ eventId: { in: eventIds } }, { actorUserId: { in: userIds } }] },
    });
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
    await prisma.seat.deleteMany({ where: { row: { section: { venueId } } } });
    await prisma.seatRow.deleteMany({ where: { section: { venueId } } });
    await prisma.venueSection.deleteMany({ where: { venueId } });
    await prisma.venue.deleteMany({ where: { id: venueId } });
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.account.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("rejects bad seat input and keeps general admission off the map", async () => {
    const published = await publicSeats(request(`/api/events/${slug}/seats`), {
      params: Promise.resolve({ slug }),
    });
    expect(published.status).toBe(200);
    const publishedBody = (await published.json()) as {
      sections: { rows: { seats: { id: string }[] }[] }[];
    };
    const publishedIds = publishedBody.sections.flatMap((section) =>
      section.rows.flatMap((row) => row.seats.map((seat) => seat.id)),
    );
    expect(publishedIds).toEqual(expect.arrayContaining([seatIds["1"], seatIds["2"], seatIds["3"]]));

    const duplicate = await createOrder(request("/api/orders", orderBody([seatIds["1"]!, seatIds["1"]!], 2), tokens.buyer));
    expect(duplicate.status).toBe(400);
    const mismatch = await createOrder(request("/api/orders", orderBody([seatIds["1"]!], 2), tokens.buyer));
    expect(mismatch.status).toBe(400);
    const foreignVenue = await prisma.venue.create({
      data: { name: `Other ${suffix}`, address: "2 Test Street", city: "Almaty" },
    });
    const foreignSection = await prisma.venueSection.create({
      data: { venueId: foreignVenue.id, name: "Away" },
    });
    const foreignRow = await prisma.seatRow.create({
      data: { venueSectionId: foreignSection.id, label: "Z" },
    });
    const foreignSeat = await prisma.seat.create({ data: { seatRowId: foreignRow.id, number: "1" } });
    const foreign = await createOrder(request("/api/orders", orderBody([foreignSeat.id]), tokens.buyer));
    expect(foreign.status).toBe(404);
    await prisma.seat.delete({ where: { id: foreignSeat.id } });
    await prisma.seatRow.delete({ where: { id: foreignRow.id } });
    await prisma.venueSection.delete({ where: { id: foreignSection.id } });
    await prisma.venue.delete({ where: { id: foreignVenue.id } });

    await prisma.seat.update({ where: { id: seatIds["3"]! }, data: { status: "UNAVAILABLE" } });
    expect(await seatStatus(eventId, seatIds["3"]!)).toBe("UNAVAILABLE");
    const closed = await createOrder(request("/api/orders", orderBody([seatIds["3"]!]), tokens.buyer));
    expect(closed.status).toBe(404);
    await prisma.seat.update({ where: { id: seatIds["3"]! }, data: { status: "AVAILABLE" } });

    const ga = await prisma.event.create({
      data: {
        organizerId: ids.owner,
        venueId,
        slug: `ga-${suffix}`,
        title: `GA ${suffix}`,
        status: "PUBLISHED",
        seatingMode: "GENERAL_ADMISSION",
        startsAt: new Date(Date.now() + 86_400_000),
        endsAt: new Date(Date.now() + 2 * 86_400_000),
        ticketTypes: { create: { name: "Free", priceKzt: 0, quantity: 10 } },
      },
      include: { ticketTypes: true },
    });
    const gaWithSeat = await createOrder(
      request("/api/orders", {
        eventId: ga.id,
        items: [{ ticketTypeId: ga.ticketTypes[0]!.id, quantity: 1, seatIds: [seatIds["1"]!] }],
        attendees: [{ fullName: "Dana Sultanova", email: `ga-seat-${suffix}@seat-contract.test` }],
        clientIdempotencyKey: randomUUID(),
      }, tokens.buyer),
    );
    expect(gaWithSeat.status).toBe(400);
    const gaOrder = await createOrder(
      request("/api/orders", {
        eventId: ga.id,
        items: [{ ticketTypeId: ga.ticketTypes[0]!.id, quantity: 1 }],
        attendees: [{ fullName: "Dana Sultanova", email: `ga-${suffix}@seat-contract.test` }],
        clientIdempotencyKey: randomUUID(),
      }, tokens.buyer),
    );
    expect(gaOrder.status).toBe(201);
    const gaBody = (await gaOrder.json()) as { order: { tickets: { seatId: string | null }[] } };
    expect(gaBody.order.tickets[0]?.seatId).toBeNull();
    const gaTicket = await prisma.ticket.findFirstOrThrow({ where: { eventId: ga.id } });
    const gaScan = await checkIn(
      request("/api/checkin", { eventId: ga.id, payload: gaTicket.code }, tokens.owner),
    );
    expect(await gaScan.json()).toMatchObject({ result: "VALID", ticket: { seatLabel: null } });
    const hidden = await publicSeats(request(`/api/events/${ga.slug}/seats`), {
      params: Promise.resolve({ slug: ga.slug }),
    });
    expect(hidden.status).toBe(404);
  });

  it("lets the owner extend a row and blocks a second organizer from editing the shared map", async () => {
    const added = await addSeats(
      request(`/api/organizer/events/${eventId}/rows/${rowId}/seats`, { seats: [{ number: "4" }] }, tokens.owner),
      { params: Promise.resolve({ id: eventId, rowId }) },
    );
    expect(added.status).toBe(201);
    const addedBody = (await added.json()) as { seats: { id: string; number: string; status: string }[] };
    expect(addedBody.seats[0]).toMatchObject({ number: "4", status: "AVAILABLE" });
    seatIds["4"] = addedBody.seats[0]!.id;
    const repeated = await addSeats(
      request(`/api/organizer/events/${eventId}/rows/${rowId}/seats`, { seats: [{ number: "4" }] }, tokens.owner),
      { params: Promise.resolve({ id: eventId, rowId }) },
    );
    expect(repeated.status).toBe(409);

    const shared = await prisma.event.create({
      data: {
        organizerId: ids.other,
        venueId,
        slug: `shared-${suffix}`,
        title: `Shared ${suffix}`,
        status: "PUBLISHED",
        seatingMode: "ASSIGNED",
        startsAt: new Date(Date.now() + 7 * 86_400_000),
        endsAt: new Date(Date.now() + 8 * 86_400_000),
      },
    });
    const ownerDenied = await createSection(
      request(`/api/organizer/events/${eventId}/sections`, { name: "Circle" }, tokens.owner),
      { params: Promise.resolve({ id: eventId }) },
    );
    const otherDenied = await createSection(
      request(`/api/organizer/events/${shared.id}/sections`, { name: "Circle" }, tokens.other),
      { params: Promise.resolve({ id: shared.id }) },
    );
    expect(ownerDenied.status).toBe(403);
    expect(otherDenied.status).toBe(403);
    const adminAdded = await createSection(
      request(`/api/organizer/events/${eventId}/sections`, { name: "Circle" }, tokens.admin),
      { params: Promise.resolve({ id: eventId }) },
    );
    expect(adminAdded.status).toBe(201);
    await prisma.event.delete({ where: { id: shared.id } });
  });

  it("serializes a booking against deletion and keeps one seat per event", async () => {
    const [removal, booking] = await Promise.all([
      deleteSeat(
        request(`/api/organizer/events/${eventId}/seats/${seatIds["4"]}`, undefined, tokens.owner, "DELETE"),
        { params: Promise.resolve({ id: eventId, seatId: seatIds["4"]! }) },
      ),
      createOrder(request("/api/orders", orderBody([seatIds["4"]!]), tokens.buyer)),
    ]);
    const booked = booking.status === 201;
    const removed = removal.status === 200;
    expect(booked !== removed).toBe(true);
    if (booked) {
      expect(removal.status).toBe(409);
      expect(await prisma.seat.findUnique({ where: { id: seatIds["4"]! } })).toBeTruthy();
      expect(await prisma.seatHold.count({ where: { seatId: seatIds["4"]!, eventId, activeKey: "active" } })).toBe(1);
      const orderId = ((await booking.json()) as { order: { id: string } }).order.id;
      await cancelOrder(request(`/api/orders/${orderId}/cancel`, {}, tokens.buyer), {
        params: Promise.resolve({ id: orderId }),
      });
    } else {
      expect([404, 409]).toContain(booking.status);
      expect(await prisma.seat.findUnique({ where: { id: seatIds["4"]! } })).toBeNull();
      const replacement = await addSeats(
        request(`/api/organizer/events/${eventId}/rows/${rowId}/seats`, { seats: [{ number: "4" }] }, tokens.owner),
        { params: Promise.resolve({ id: eventId, rowId }) },
      );
      seatIds["4"] = ((await replacement.json()) as { seats: { id: string }[] }).seats[0]!.id;
    }

    const second = await prisma.event.create({
      data: {
        organizerId: ids.owner,
        venueId,
        slug: `second-${suffix}`,
        title: `Second ${suffix}`,
        status: "PUBLISHED",
        seatingMode: "ASSIGNED",
        paidSalesActive: true,
        startsAt: new Date(Date.now() + 9 * 86_400_000),
        endsAt: new Date(Date.now() + 10 * 86_400_000),
        ticketTypes: { create: { name: "Seat", priceKzt: 2000, quantity: 10 } },
      },
      include: { ticketTypes: true },
    });
    const [firstHold, secondHold] = await Promise.all([
      createOrder(request("/api/orders", orderBody([seatIds["2"]!]), tokens.buyer)),
      createOrder(
        request("/api/orders", {
          eventId: second.id,
          items: [{ ticketTypeId: second.ticketTypes[0]!.id, quantity: 1, seatIds: [seatIds["2"]!] }],
          attendees: [{ fullName: "Dana Sultanova", email: `second-${suffix}@seat-contract.test` }],
          clientIdempotencyKey: randomUUID(),
        }, tokens.guest),
      ),
    ]);
    expect(firstHold.status).toBe(201);
    expect(secondHold.status).toBe(201);
    const blocked = await deleteSeat(
      request(`/api/organizer/events/${second.id}/seats/${seatIds["2"]}`, undefined, tokens.owner, "DELETE"),
      { params: Promise.resolve({ id: second.id, seatId: seatIds["2"]! }) },
    );
    expect(blocked.status).toBe(409);
    expect(await seatStatus(eventId, seatIds["2"]!)).toBe("HELD");
    expect(await seatStatus(second.id, seatIds["2"]!)).toBe("HELD");
    const firstId = ((await firstHold.json()) as { order: { id: string } }).order.id;
    const secondId = ((await secondHold.json()) as { order: { id: string } }).order.id;
    await cancelOrder(request(`/api/orders/${firstId}/cancel`, {}, tokens.buyer), {
      params: Promise.resolve({ id: firstId }),
    });
    await cancelOrder(request(`/api/orders/${secondId}/cancel`, {}, tokens.guest), {
      params: Promise.resolve({ id: secondId }),
    });
  });

  it("lets only one buyer hold a seat and deletes that seat once it is free", async () => {
    const [first, second] = await Promise.all([
      createOrder(request("/api/orders", orderBody([seatIds["3"]!]), tokens.buyer)),
      createOrder(request("/api/orders", orderBody([seatIds["3"]!], 1, `guest-race-${suffix}@seat-contract.test`), tokens.guest)),
    ]);
    const buyerWon = first.status === 201;
    const winnerResponse = buyerWon ? first : second;
    const loser = buyerWon ? second : first;
    expect(winnerResponse.status).toBe(201);
    expect(loser.status).toBe(409);
    expect(((await loser.json()) as { error: { code: string } }).error.code).toBe("SOLD_OUT");
    const winner = ((await winnerResponse.json()) as { order: { id: string } }).order.id;
    const released = await cancelOrder(
      request(`/api/orders/${winner}/cancel`, {}, buyerWon ? tokens.buyer : tokens.guest),
      { params: Promise.resolve({ id: winner }) },
    );
    expect(released.status).toBe(200);
    expect(await seatStatus(eventId, seatIds["3"]!)).toBe("AVAILABLE");
    const removed = await deleteSeat(
      request(`/api/organizer/events/${eventId}/seats/${seatIds["3"]}`, undefined, tokens.owner, "DELETE"),
      { params: Promise.resolve({ id: eventId, seatId: seatIds["3"]! }) },
    );
    expect(removed.status).toBe(200);
    expect(await prisma.seat.findUnique({ where: { id: seatIds["3"]! } })).toBeNull();
    expect((await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketTypeId } })).reserved).toBe(0);
  });

  it("releases a seat and its inventory on decline, abandon, expiry, cancel, and refund", async () => {
    const counters = () => prisma.ticketType.findUniqueOrThrow({ where: { id: ticketTypeId } });
    const hold = async (number: string, token = tokens.buyer) => {
      const response = await createOrder(request("/api/orders", orderBody([seatIds[number]!]), token));
      expect(response.status).toBe(201);
      const body = (await response.json()) as {
        order: { id: string; items: { seatId: string | null; sectionName: string | null; rowLabel: string | null; seatNumber: string | null }[] };
      };
      expect(body.order.items[0]).toMatchObject({
        seatId: seatIds[number],
        sectionName: "Stalls",
        rowLabel: "A",
        seatNumber: number,
      });
      return body.order.id;
    };

    const declinedId = await hold("1");
    expect((await counters()).reserved).toBe(1);
    const declined = await simulatePay(
      request(`/api/orders/${declinedId}/pay/simulate`, { outcome: "DECLINED" }, tokens.buyer),
      { params: Promise.resolve({ id: declinedId }) },
    );
    expect(declined.status).toBe(200);
    expect(await seatStatus(eventId, seatIds["1"]!)).toBe("AVAILABLE");
    expect((await counters()).reserved).toBe(0);

    const abandonedId = await hold("1");
    const abandoned = await simulatePay(
      request(`/api/orders/${abandonedId}/pay/simulate`, { outcome: "ABANDONED" }, tokens.buyer),
      { params: Promise.resolve({ id: abandonedId }) },
    );
    expect(abandoned.status).toBe(200);
    expect((await counters()).reserved).toBe(0);
    expect(await seatStatus(eventId, seatIds["1"]!)).toBe("AVAILABLE");

    const expiredId = await hold("1");
    await prisma.order.update({ where: { id: expiredId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const expired = await simulatePay(
      request(`/api/orders/${expiredId}/pay/simulate`, { outcome: "APPROVED" }, tokens.buyer),
      { params: Promise.resolve({ id: expiredId }) },
    );
    expect(expired.status).toBe(409);
    expect((await counters()).reserved).toBe(0);
    expect(await seatStatus(eventId, seatIds["1"]!)).toBe("AVAILABLE");

    const cancelledId = await hold("1");
    const cancelled = await cancelOrder(request(`/api/orders/${cancelledId}/cancel`, {}, tokens.buyer), {
      params: Promise.resolve({ id: cancelledId }),
    });
    expect(cancelled.status).toBe(200);
    expect((await counters()).reserved).toBe(0);

    const paidId = await hold("1");
    const [paid, raced] = await Promise.all([
      simulatePay(
        request(`/api/orders/${paidId}/pay/simulate`, { outcome: "APPROVED" }, tokens.buyer),
        { params: Promise.resolve({ id: paidId }) },
      ),
      simulatePay(
        request(`/api/orders/${paidId}/pay/simulate`, { outcome: "APPROVED" }, tokens.buyer),
        { params: Promise.resolve({ id: paidId }) },
      ),
    ]);
    expect([paid.status, raced.status].every((status) => status === 200 || status === 409)).toBe(true);
    expect([paid.status, raced.status]).toContain(200);
    expect(await prisma.ticket.count({ where: { orderId: paidId } })).toBe(1);
    const again = await simulatePay(
      request(`/api/orders/${paidId}/pay/simulate`, { outcome: "APPROVED" }, tokens.buyer),
      { params: Promise.resolve({ id: paidId }) },
    );
    expect(again.status).toBe(409);
    const ticket = await prisma.ticket.findFirstOrThrow({ where: { orderId: paidId } });
    expect(ticket).toMatchObject({ seatId: seatIds["1"], sectionName: "Stalls", rowLabel: "A", seatNumber: "1" });
    const mine = await listTickets(request("/api/tickets", undefined, tokens.buyer));
    expect(mine.status).toBe(200);
    const listed = ((await mine.json()) as { tickets: { orderId: string; seatNumber: string | null }[] }).tickets;
    expect(listed.find((row) => row.orderId === paidId)).toMatchObject({
      seatId: seatIds["1"],
      sectionName: "Stalls",
      rowLabel: "A",
      seatNumber: "1",
    });
    expect((await counters()).sold).toBe(1);
    expect(await seatStatus(eventId, seatIds["1"]!)).toBe("SOLD");
    const soldDelete = await deleteSeat(
      request(`/api/organizer/events/${eventId}/seats/${seatIds["1"]}`, undefined, tokens.owner, "DELETE"),
      { params: Promise.resolve({ id: eventId, seatId: seatIds["1"]! }) },
    );
    expect(soldDelete.status).toBe(409);

    const scanned = await checkIn(
      request("/api/checkin", { eventId, payload: ticket.code, deviceLabel: "door" }, tokens.owner),
    );
    expect(scanned.status).toBe(200);
    expect(await scanned.json()).toMatchObject({ result: "VALID", ticket: { seatLabel: "Stalls A 1" } });
    const duplicateScan = await checkIn(
      request("/api/checkin", { eventId, payload: ticket.code }, tokens.owner),
    );
    expect(await duplicateScan.json()).toMatchObject({
      result: "ALREADY_CHECKED_IN",
      ticket: { seatLabel: "Stalls A 1" },
    });

    const refunded = await refundOrder(
      request(`/api/orders/${paidId}/refund`, { reason: "Buyer changed plans" }, tokens.owner),
      { params: Promise.resolve({ id: paidId }) },
    );
    expect(refunded.status).toBe(409);

    await prisma.ticket.update({ where: { id: ticket.id }, data: { status: "VALID" } });
    await prisma.checkInRecord.deleteMany({ where: { ticketId: ticket.id } });
    const openRefund = await refundOrder(
      request(`/api/orders/${paidId}/refund`, { reason: "Buyer changed plans" }, tokens.owner),
      { params: Promise.resolve({ id: paidId }) },
    );
    expect(openRefund.status).toBe(201);
    const returned = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(returned.status).toBe("REFUNDED");
    expect((await counters()).sold).toBe(0);
    expect((await counters()).refunded).toBe(1);
    expect(await seatStatus(eventId, seatIds["1"]!)).toBe("AVAILABLE");
    const refused = await checkIn(request("/api/checkin", { eventId, payload: ticket.code }, tokens.owner));
    expect(await refused.json()).toMatchObject({ result: "REFUNDED" });

    const freeType = await prisma.ticketType.create({
      data: { eventId, name: "Comp", priceKzt: 0, quantity: 5 },
    });
    const freeKey = randomUUID();
    const freeBody = {
      eventId,
      items: [{ ticketTypeId: freeType.id, quantity: 1, seatIds: [seatIds["1"]!] }],
      attendees: [{ fullName: "Dana Sultanova", email: `comp-${suffix}@seat-contract.test` }],
      clientIdempotencyKey: freeKey,
    };
    const free = await createOrder(request("/api/orders", freeBody, tokens.guest));
    expect(free.status).toBe(201);
    const freeOrder = (await free.json()) as { order: { id: string; status: string; tickets: { seatNumber: string | null }[] } };
    expect(freeOrder.order.status).toBe("PAID");
    expect(freeOrder.order.tickets[0]?.seatNumber).toBe("1");
    const replay = await createOrder(request("/api/orders", freeBody, tokens.guest));
    expect(((await replay.json()) as { order: { id: string } }).order.id).toBe(freeOrder.order.id);
    expect(await prisma.ticket.count({ where: { orderId: freeOrder.order.id } })).toBe(1);
  });

  it("serializes a seating-mode change against the first checkout", async () => {
    const fresh = await prisma.event.create({
      data: {
        organizerId: ids.owner,
        venueId,
        slug: `layout-race-${suffix}`,
        title: `Layout race ${suffix}`,
        status: "PUBLISHED",
        seatingMode: "ASSIGNED",
        startsAt: new Date(Date.now() + 12 * 86_400_000),
        endsAt: new Date(Date.now() + 13 * 86_400_000),
        ticketTypes: { create: { name: "Free seat", priceKzt: 0, quantity: 10 } },
      },
      include: { ticketTypes: true },
    });
    const [changed, booked] = await Promise.all([
      updateEvent(
        request(`/api/organizer/events/${fresh.id}`, {
          title: fresh.title,
          startsAt: fresh.startsAt.toISOString(),
          endsAt: fresh.endsAt.toISOString(),
          seatingMode: "GENERAL_ADMISSION",
        }, tokens.owner, "PUT"),
        { params: Promise.resolve({ id: fresh.id }) },
      ),
      createOrder(request("/api/orders", {
        eventId: fresh.id,
        items: [{ ticketTypeId: fresh.ticketTypes[0]!.id, quantity: 1, seatIds: [seatIds["2"]!] }],
        attendees: [{ fullName: "Dana Sultanova", email: `layout-race-${suffix}@seat-contract.test` }],
        clientIdempotencyKey: randomUUID(),
      }, tokens.buyer)),
    ]);
    const saved = await prisma.event.findUniqueOrThrow({ where: { id: fresh.id } });
    if (booked.status === 201) {
      expect(changed.status).toBe(409);
      expect(saved.seatingMode).toBe("ASSIGNED");
      expect(await prisma.ticket.count({ where: { eventId: fresh.id, seatId: seatIds["2"]! } })).toBe(1);
    } else {
      expect(changed.status).toBe(200);
      expect(booked.status).toBe(400);
      expect(saved.seatingMode).toBe("GENERAL_ADMISSION");
      expect(await prisma.order.count({ where: { eventId: fresh.id } })).toBe(0);
    }
  });

  it("refuses a seating-mode change after an order exists", async () => {
    const current = await getEvent(request(`/api/organizer/events/${eventId}`, undefined, tokens.owner), {
      params: Promise.resolve({ id: eventId }),
    });
    const event = ((await current.json()) as { event: { title: string; startsAt: string; endsAt: string } }).event;
    const kept = await updateEvent(
      request(`/api/organizer/events/${eventId}`, {
        title: event.title,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
      }, tokens.owner, "PUT"),
      { params: Promise.resolve({ id: eventId }) },
    );
    expect(kept.status).toBe(200);
    expect(((await kept.json()) as { event: { seatingMode: string; refundPolicy: string } }).event).toMatchObject({
      seatingMode: "ASSIGNED",
      refundPolicy: "UNTIL_48H_BEFORE",
    });
    const blocked = await updateEvent(
      request(`/api/organizer/events/${eventId}`, {
        title: event.title,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        seatingMode: "GENERAL_ADMISSION",
      }, tokens.owner, "PUT"),
      { params: Promise.resolve({ id: eventId }) },
    );
    expect(blocked.status).toBe(409);
  });

  it("invalidates the ticket and frees the seat when the event is cancelled", async () => {
    const added = await addSeats(
      request(`/api/organizer/events/${eventId}/rows/${rowId}/seats`, { seats: [{ number: "9" }] }, tokens.owner),
      { params: Promise.resolve({ id: eventId, rowId }) },
    );
    expect(added.status).toBe(201);
    const seatId = ((await added.json()) as { seats: { id: string }[] }).seats[0]!.id;
    const placed = await createOrder(request("/api/orders", orderBody([seatId]), tokens.buyer));
    expect(placed.status).toBe(201);
    const orderId = ((await placed.json()) as { order: { id: string } }).order.id;
    const paid = await simulatePay(
      request(`/api/orders/${orderId}/pay/simulate`, { outcome: "APPROVED" }, tokens.buyer),
      { params: Promise.resolve({ id: orderId }) },
    );
    expect(paid.status).toBe(200);
    const cancelled = await cancelEvent(
      request(`/api/organizer/events/${eventId}/cancel`, { reason: "Venue closed" }, tokens.owner),
      { params: Promise.resolve({ id: eventId }) },
    );
    expect(cancelled.status).toBe(200);
    const ticket = await prisma.ticket.findFirstOrThrow({ where: { orderId } });
    expect(ticket.status).toBe("REFUNDED");
    expect(ticket.invalidatedAt).not.toBeNull();
    expect(await seatStatus(eventId, seatId)).toBe("AVAILABLE");
    const inventory = await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketTypeId } });
    expect(inventory.sold).toBe(0);
    expect(inventory.reserved).toBe(0);
    const scan = await checkIn(request("/api/checkin", { eventId, payload: ticket.code }, tokens.owner));
    expect(await scan.json()).toMatchObject({ result: "REFUNDED" });
  });
});
