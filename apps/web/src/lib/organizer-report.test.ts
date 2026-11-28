import { describe, expect, it } from "vitest";
import { dateKey, eventPhase, summarizeSales } from "./organizer-report";

describe("organizer reporting", () => {
  it("classifies past, current, future and cancelled events", () => {
    const now = new Date("2026-11-18T10:00:00Z");
    const event = { status: "PUBLISHED", startsAt: new Date("2026-11-18T09:00:00Z"), endsAt: new Date("2026-11-18T11:00:00Z") };
    expect(eventPhase(event, now)).toBe("ACTIVE");
    expect(eventPhase(event, new Date("2026-11-17"))).toBe("UPCOMING");
    expect(eventPhase(event, new Date("2026-11-19"))).toBe("COMPLETED");
    expect(eventPhase({ ...event, status: "CANCELLED" }, now)).toBe("CANCELLED");
    expect(eventPhase({ ...event, status: "DRAFT" }, now)).toBe("DRAFT");
  });

  it("counts paid orders, successful refunds and campaign sales without counting pending orders", () => {
    const order = {
      paidAt: new Date("2026-11-18T20:00:00Z"),
      subtotalKzt: 10000, discountKzt: 1000, feeKzt: 400, totalKzt: 9000,
      campaignId: "promo", items: [{ ticketTypeId: "vip", quantity: 2, totalKzt: 9000 }],
      refunds: [{ amountKzt: 2000, status: "SUCCEEDED" }, { amountKzt: 100, status: "FAILED" }],
    };
    const report = summarizeSales([order, { ...order, paidAt: null }], "Asia/Almaty");
    expect(report.totals).toEqual({ gross: 10000, discounts: 1000, fees: 400, refunds: 2000, collected: 9000, net: 6600, count: 1, tickets: 2 });
    expect(report.byType.get("vip")).toEqual({ quantity: 2, total: 9000 });
    expect(report.byCampaign.get("promo")).toEqual({ orders: 1, tickets: 2, gross: 10000, discount: 1000, net: 7000 });
    expect(report.byDay.get("2026-11-19")).toBe(9000);
    expect(dateKey(order.paidAt)).toBe("2026-11-19");
  });

  it("keeps processing fees on refunded orders, which is the demo payout gap", () => {
    const paid = new Date("2026-11-20T08:00:00Z");
    const sale = (
      subtotalKzt: number,
      discountKzt: number,
      feeKzt: number,
      totalKzt: number,
      refundKzt = 0,
    ) => ({
      paidAt: paid,
      subtotalKzt,
      discountKzt,
      feeKzt,
      totalKzt,
      campaignId: null,
      items: [{ ticketTypeId: "door", quantity: 1, totalKzt }],
      refunds: refundKzt === 0 ? [] : [{ amountKzt: refundKzt, status: "SUCCEEDED" }],
    });
    const report = summarizeSales(
      [
        sale(20000, 0, 800, 20000),
        sale(30000, 0, 1150, 30000),
        sale(5000, 1000, 240, 4000),
        sale(10000, 0, 450, 10000, 10000),
        sale(2500, 500, 170, 2000, 2000),
        sale(0, 0, 0, 0),
        { ...sale(20000, 0, 800, 20000), paidAt: null },
      ],
      "Asia/Almaty",
    );
    expect(report.totals).toMatchObject({
      gross: 67500,
      discounts: 1500,
      fees: 2810,
      refunds: 12000,
      collected: 66000,
      net: 51190,
      count: 6,
    });
    const storedPayoutNet = 48050 + 3760;
    expect(storedPayoutNet - report.totals.net).toBe(450 + 170);
  });
});
