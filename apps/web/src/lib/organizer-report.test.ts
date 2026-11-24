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
});
