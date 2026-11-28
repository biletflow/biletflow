import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@biletflow/db";
import { hashPassword } from "@biletflow/shared/password.server";

import { POST as createCampaign } from "@/app/api/organizer/events/[id]/campaigns/route";
import { POST as mobileLogin } from "@/app/api/mobile/auth/login/route";
import { POST as cancelOrder } from "@/app/api/orders/[id]/cancel/route";
import { POST as payOrder } from "@/app/api/orders/[id]/pay/route";
import { POST as simulatePay } from "@/app/api/orders/[id]/pay/simulate/route";
import { POST as refundOrder } from "@/app/api/orders/[id]/refund/route";
import { POST as webhook } from "@/app/api/payments/webhook/route";
import { POST as createOrder } from "@/app/api/orders/route";
import { signWebhookBody } from "@/lib/payments-signature";

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
    await prisma.checkInRecord.deleteMany({ where: { eventId } });
    await prisma.ticket.deleteMany({ where: { eventId } });
    await prisma.attendee.deleteMany({ where: { email: { contains: suffix } } });
    await prisma.promoRedemption.deleteMany({ where: { campaign: { eventId } } });
    await prisma.refund.deleteMany({ where: { order: { eventId } } });
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

    const raced = await campaign(`Race ${suffix}`, { maxRedemptions: 5, perUserLimit: 1 });
    const [left, right] = await Promise.all([
      createOrder(request("/api/orders", orderBody(raced.campaign.promoCode, emails.buyer), tokens.buyer)),
      createOrder(request("/api/orders", orderBody(raced.campaign.promoCode, emails.buyer), tokens.buyer)),
    ]);
    expect([left.status, right.status].sort()).toEqual([201, 400]);
    expect(
      (await prisma.promotionalCampaign.findUniqueOrThrow({ where: { id: raced.campaign.id } })).redeemed,
    ).toBe(1);
  });

  it("returns an unpaid promo and does not move counters twice", async () => {
    const limited = await campaign(`Release ${suffix}`, { maxRedemptions: 4, perUserLimit: 1 });
    const code = limited.campaign.promoCode;

    async function stock() {
      const row = await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketTypeId } });
      return { sold: row.sold, reserved: row.reserved, refunded: row.refunded };
    }
    const baseline = await stock();
    async function used() {
      const row = await prisma.promotionalCampaign.findUniqueOrThrow({ where: { id: limited.campaign.id } });
      return row.redeemed;
    }
    async function place() {
      const response = await createOrder(request("/api/orders", orderBody(code, emails.buyer), tokens.buyer));
      expect(response.status).toBe(201);
      const body = (await response.json()) as { order: { id: string } };
      expect(await used()).toBe(1);
      expect((await stock()).reserved).toBe(baseline.reserved + 1);
      return body.order.id;
    }
    async function expectReleased() {
      expect(await used()).toBe(0);
      expect(await prisma.promoRedemption.count({ where: { campaignId: limited.campaign.id } })).toBe(0);
      expect((await stock()).reserved).toBe(baseline.reserved);
      const again = await createOrder(request("/api/orders", orderBody(code, emails.buyer), tokens.buyer));
      expect(again.status).toBe(201);
      return ((await again.json()) as { order: { id: string } }).order.id;
    }

    const cancelledId = await place();
    const cancelled = await cancelOrder(
      request(`/api/orders/${cancelledId}/cancel`, {}, tokens.buyer),
      { params: Promise.resolve({ id: cancelledId }) },
    );
    expect(cancelled.status).toBe(200);
    const cancelledAgain = await cancelOrder(
      request(`/api/orders/${cancelledId}/cancel`, {}, tokens.buyer),
      { params: Promise.resolve({ id: cancelledId }) },
    );
    expect(cancelledAgain.status).toBe(409);
    const reopened = await expectReleased();
    await cancelOrder(request(`/api/orders/${reopened}/cancel`, {}, tokens.buyer), {
      params: Promise.resolve({ id: reopened }),
    });

    const declinedId = await place();
    const declined = await simulatePay(
      request(`/api/orders/${declinedId}/pay/simulate`, { outcome: "DECLINED" }, tokens.buyer),
      { params: Promise.resolve({ id: declinedId }) },
    );
    expect(declined.status).toBe(200);
    expect(((await declined.json()) as { order: { status: string } }).order.status).toBe("CANCELLED");
    const afterDecline = await expectReleased();
    await cancelOrder(request(`/api/orders/${afterDecline}/cancel`, {}, tokens.buyer), {
      params: Promise.resolve({ id: afterDecline }),
    });

    const abandonedId = await place();
    const abandoned = await simulatePay(
      request(`/api/orders/${abandonedId}/pay/simulate`, { outcome: "ABANDONED" }, tokens.buyer),
      { params: Promise.resolve({ id: abandonedId }) },
    );
    expect(abandoned.status).toBe(200);
    const afterAbandon = await expectReleased();
    await cancelOrder(request(`/api/orders/${afterAbandon}/cancel`, {}, tokens.buyer), {
      params: Promise.resolve({ id: afterAbandon }),
    });

    const expiredId = await place();
    await prisma.order.update({
      where: { id: expiredId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const expired = await payOrder(request(`/api/orders/${expiredId}/pay`, {}, tokens.buyer), {
      params: Promise.resolve({ id: expiredId }),
    });
    expect(expired.status).toBe(409);
    expect(((await expired.json()) as { error: { code: string } }).error.code).toBe("HOLD_EXPIRED");
    const afterExpire = await expectReleased();
    await cancelOrder(request(`/api/orders/${afterExpire}/cancel`, {}, tokens.buyer), {
      params: Promise.resolve({ id: afterExpire }),
    });

    const webhookId = await place();
    const started = await payOrder(request(`/api/orders/${webhookId}/pay`, {}, tokens.buyer), {
      params: Promise.resolve({ id: webhookId }),
    });
    expect(started.status).toBe(200);
    const intentId = ((await started.json()) as { payment: { intentId: string } }).payment.intentId;
    async function deliver(eventKey: string) {
      const payload = JSON.stringify({ intentId, outcome: "DECLINED", eventKey });
      return webhook(
        new Request(new URL("/api/payments/webhook", "http://localhost:3000"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-biletflow-signature": signWebhookBody(payload),
          },
          body: payload,
        }),
      );
    }
    const firstHook = await deliver(`${intentId}:DECLINED`);
    expect(firstHook.status).toBe(200);
    expect(await firstHook.json()).toMatchObject({ duplicate: false, tickets: 0 });
    const replay = await deliver(`${intentId}:DECLINED`);
    expect(await replay.json()).toMatchObject({ duplicate: true, tickets: 0 });
    const otherKey = await deliver(`${intentId}:DECLINED:again`);
    expect(await otherKey.json()).toMatchObject({ ignored: true, tickets: 0 });
    expect(await used()).toBe(0);
    expect((await stock()).reserved).toBe(baseline.reserved);
    const afterWebhook = await createOrder(request("/api/orders", orderBody(code, emails.buyer), tokens.buyer));
    expect(afterWebhook.status).toBe(201);
    const payableId = ((await afterWebhook.json()) as { order: { id: string } }).order.id;

    await prisma.event.update({
      where: { id: eventId },
      data: { refundPolicy: "UNTIL_48H_BEFORE" },
    });
    const paid = await simulatePay(
      request(`/api/orders/${payableId}/pay/simulate`, { outcome: "APPROVED" }, tokens.buyer),
      { params: Promise.resolve({ id: payableId }) },
    );
    expect(paid.status).toBe(200);
    const paidId = ((await paid.json()) as { order: { id: string; status: string } }).order.id;
    expect((await prisma.order.findUniqueOrThrow({ where: { id: paidId } })).status).toBe("PAID");
    expect(await used()).toBe(1);
    const beforeRefund = await stock();
    const refundPath = { params: Promise.resolve({ id: paidId }) };
    const [refunded, repeated] = await Promise.all([
      refundOrder(request(`/api/orders/${paidId}/refund`, { reason: "plans changed" }, tokens.buyer), refundPath),
      refundOrder(request(`/api/orders/${paidId}/refund`, { reason: "plans changed" }, tokens.buyer), refundPath),
    ]);
    expect([refunded.status, repeated.status].sort()).toEqual([200, 201]);
    const afterRefund = await stock();
    expect(afterRefund.sold).toBe(beforeRefund.sold - 1);
    expect(afterRefund.refunded).toBe(beforeRefund.refunded + 1);
    expect(await used()).toBe(1);
    expect(await prisma.ticket.count({ where: { orderId: paidId, status: "REFUNDED" } })).toBe(1);
    const third = await refundOrder(
      request(`/api/orders/${paidId}/refund`, { reason: "plans changed" }, tokens.buyer),
      refundPath,
    );
    expect(third.status).toBe(200);
    expect(await stock()).toEqual(afterRefund);
  });
});
