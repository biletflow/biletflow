import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@biletflow/db";
import { hashPassword } from "@biletflow/shared/password.server";

import { POST as createCampaign } from "@/app/api/organizer/events/[id]/campaigns/route";
import { POST as mobileLogin } from "@/app/api/mobile/auth/login/route";
import { POST as createOrder } from "@/app/api/orders/route";

describe.skipIf(process.env.RUN_AUTH_INTEGRATION !== "1")("campaign redemption limits", () => {
  const suffix = randomUUID();
  const password = "Password123!";
  const emails = {
    owner: `owner-${suffix}@campaign-limits.test`,
    buyer: `buyer-${suffix}@campaign-limits.test`,
    guest: `guest-${suffix}@campaign-limits.test`,
  };
  const ids: Record<keyof typeof emails, string> = { owner: "", buyer: "", guest: "" };
  const tokens: Record<keyof typeof emails, string> = { ...ids };
  let eventId = "";
  let ticketTypeId = "";

  function request(path: string, body?: unknown, token = "") {
    const headers = new Headers({ "Content-Type": "application/json" });
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return new Request(new URL(path, "http://localhost:3000"), {
      method: body === undefined ? "GET" : "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  function orderBody(code: string, email: string) {
    return {
      eventId,
      items: [{ ticketTypeId, quantity: 1 }],
      attendees: [{ fullName: "Aida Nurlanova", email }],
      promoCode: code,
      clientIdempotencyKey: randomUUID(),
    };
  }

  beforeAll(async () => {
    for (const [role, email] of [
      ["ORGANIZER", emails.owner],
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
    const event = await prisma.event.create({
      data: {
        organizerId: ids.owner,
        slug: `limits-${suffix}`,
        title: `Limits ${suffix}`,
        status: "PUBLISHED",
        paidSalesActive: true,
        startsAt: new Date(Date.now() + 5 * 86_400_000),
        endsAt: new Date(Date.now() + 6 * 86_400_000),
        ticketTypes: { create: { name: "General", priceKzt: 1000, quantity: 20 } },
      },
      include: { ticketTypes: true },
    });
    eventId = event.id;
    ticketTypeId = event.ticketTypes[0]!.id;
  });

  afterAll(async () => {
    const userIds = Object.values(ids).filter(Boolean);
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.promoRedemption.deleteMany({ where: { campaign: { eventId } } });
    await prisma.payment.deleteMany({ where: { order: { eventId } } });
    await prisma.orderItem.deleteMany({ where: { order: { eventId } } });
    await prisma.order.deleteMany({ where: { eventId } });
    await prisma.auditLog.deleteMany({
      where: { OR: [{ eventId }, { actorUserId: { in: userIds } }] },
    });
    await prisma.event.deleteMany({ where: { id: eventId } });
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.account.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  async function campaign(name: string, limits: { maxRedemptions: number; perUserLimit: number }) {
    const response = await createCampaign(
      request(
        `/api/organizer/events/${eventId}/campaigns`,
        {
          name,
          discountType: "FIXED_KZT",
          discountValue: 200,
          ticketTypeIds: [],
          ...limits,
        },
        tokens.owner,
      ),
      { params: Promise.resolve({ id: eventId }) },
    );
    expect(response.status).toBe(201);
    return (await response.json()) as {
      campaign: { id: string; promoCode: string; perUserLimit: number; maxRedemptions: number };
    };
  }

  it("stops at maxRedemptions and still lets each buyer use perUserLimit", async () => {
    const capped = await campaign(`Cap ${suffix}`, { maxRedemptions: 1, perUserLimit: 1 });
    expect(capped.campaign.promoCode).toEqual(expect.any(String));

    const [first, second] = await Promise.all([
      createOrder(request("/api/orders", orderBody(capped.campaign.promoCode, emails.buyer), tokens.buyer)),
      createOrder(request("/api/orders", orderBody(capped.campaign.promoCode, emails.guest), tokens.guest)),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 400]);
    const rejected = first.status === 400 ? first : second;
    expect((await rejected.json()).error.code).toBe("PROMO_INVALID");
    const accepted = first.status === 201 ? first : second;
    expect((await accepted.json()).order).toMatchObject({
      status: "AWAITING_PAYMENT",
      subtotalKzt: 1000,
      discountKzt: 200,
      totalKzt: 800,
    });
    const storedCap = await prisma.promotionalCampaign.findUniqueOrThrow({
      where: { id: capped.campaign.id },
    });
    expect(storedCap.redeemed).toBe(1);
    expect(await prisma.promoRedemption.count({ where: { campaignId: capped.campaign.id } })).toBe(1);

    const personal = await campaign(`Personal ${suffix}`, { maxRedemptions: 10, perUserLimit: 2 });
    const again = await createOrder(
      request("/api/orders", orderBody(personal.campaign.promoCode, emails.buyer), tokens.buyer),
    );
    expect(again.status).toBe(201);
    const third = await createOrder(
      request("/api/orders", orderBody(personal.campaign.promoCode, emails.buyer), tokens.buyer),
    );
    expect(third.status).toBe(201);
    const fourth = await createOrder(
      request("/api/orders", orderBody(personal.campaign.promoCode, emails.buyer), tokens.buyer),
    );
    expect(fourth.status).toBe(400);
    expect((await fourth.json()).error.code).toBe("PROMO_INVALID");
    const other = await createOrder(
      request("/api/orders", orderBody(personal.campaign.promoCode, emails.guest), tokens.guest),
    );
    expect(other.status).toBe(201);
    const storedPersonal = await prisma.promotionalCampaign.findUniqueOrThrow({
      where: { id: personal.campaign.id },
    });
    expect(storedPersonal.redeemed).toBe(3);
    expect(
      await prisma.promoRedemption.count({
        where: { campaignId: personal.campaign.id, userId: ids.buyer },
      }),
    ).toBe(2);
  });
});
