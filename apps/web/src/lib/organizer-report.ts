export type EventPhase = "DRAFT" | "UPCOMING" | "ACTIVE" | "COMPLETED" | "CANCELLED";

export function eventPhase(event: { status: string; startsAt: Date; endsAt: Date }, now = new Date()): EventPhase {
  if (event.status === "CANCELLED") return "CANCELLED";
  if (event.status === "DRAFT") return "DRAFT";
  if (event.status === "COMPLETED" || event.endsAt <= now) return "COMPLETED";
  return event.startsAt > now ? "UPCOMING" : "ACTIVE";
}

export function dateKey(date: Date, timeZone = "Asia/Almaty") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return [part("year"), part("month"), part("day")].join("-");
}

type Sale = {
  paidAt: Date | null;
  subtotalKzt: number;
  discountKzt: number;
  feeKzt: number;
  totalKzt: number;
  campaignId: string | null;
  items: { ticketTypeId: string; quantity: number; totalKzt: number }[];
  refunds: { amountKzt: number; status: string }[];
};

export function summarizeSales(orders: Sale[], timeZone: string) {
  const totals = { gross: 0, discounts: 0, fees: 0, refunds: 0, collected: 0, net: 0, count: 0, tickets: 0 };
  const byDay = new Map<string, number>();
  const byType = new Map<string, { quantity: number; total: number }>();
  const byCampaign = new Map<string, { orders: number; tickets: number; gross: number; discount: number; net: number }>();

  for (const order of orders) {
    if (!order.paidAt) continue;
    const refunds = order.refunds.filter((row) => row.status === "SUCCEEDED").reduce((sum, row) => sum + row.amountKzt, 0);
    const tickets = order.items.reduce((sum, row) => sum + row.quantity, 0);
    totals.count++;
    totals.tickets += tickets;
    totals.gross += order.subtotalKzt;
    totals.discounts += order.discountKzt;
    totals.fees += order.feeKzt;
    totals.refunds += refunds;
    totals.collected += order.totalKzt;
    const day = dateKey(order.paidAt, timeZone);
    byDay.set(day, (byDay.get(day) ?? 0) + order.totalKzt);
    for (const item of order.items) {
      const row = byType.get(item.ticketTypeId) ?? { quantity: 0, total: 0 };
      row.quantity += item.quantity;
      row.total += item.totalKzt;
      byType.set(item.ticketTypeId, row);
    }
    if (order.campaignId) {
      const row = byCampaign.get(order.campaignId) ?? { orders: 0, tickets: 0, gross: 0, discount: 0, net: 0 };
      row.orders++;
      row.tickets += tickets;
      row.gross += order.subtotalKzt;
      row.discount += order.discountKzt;
      row.net += order.totalKzt - refunds;
      byCampaign.set(order.campaignId, row);
    }
  }
  totals.net = totals.collected - totals.refunds - totals.fees;
  return { totals, byDay, byType, byCampaign };
}
