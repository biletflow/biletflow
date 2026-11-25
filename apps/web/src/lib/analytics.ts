import { prisma, type UserRole } from "@biletflow/db";
import type { analyticsQuerySchema } from "@biletflow/shared";
import type { z } from "zod";

import { ApiError } from "./api-error";
import { dateKey, summarizeSales } from "./organizer-report";

type Query = z.infer<typeof analyticsQuerySchema>;
type Actor = { id: string; role: UserRole };

const orderSelect = {
  paidAt: true,
  subtotalKzt: true,
  discountKzt: true,
  feeKzt: true,
  totalKzt: true,
  campaignId: true,
  items: { select: { ticketTypeId: true, quantity: true, totalKzt: true } },
  refunds: { select: { status: true, amountKzt: true } },
} as const;

export async function loadAnalytics(user: Actor, query: Query) {
  const events = await prisma.event.findMany({
    where: {
      ...(user.role === "PLATFORM_ADMIN" ? {} : { organizerId: user.id }),
      ...(query.eventId ? { id: query.eventId } : {}),
    },
    select: {
      id: true,
      timezone: true,
      ticketTypes: {
        where: query.ticketTypeId ? { id: query.ticketTypeId } : undefined,
        select: { id: true, name: true, quantity: true, sold: true, reserved: true, refunded: true },
      },
      campaigns: { select: { id: true, name: true, redeemed: true } },
      orders: {
        where: {
          paidAt: {
            not: null,
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: query.to } : {}),
          },
          ...(query.ticketTypeId
            ? { items: { some: { ticketTypeId: query.ticketTypeId } } }
            : {}),
        },
        select: orderSelect,
      },
      tickets: { select: { status: true } },
    },
  });
  if (query.eventId && events.length === 0) throw new ApiError(404, "NOT_FOUND");

  const sales = events.map((event) => ({
    event,
    report: summarizeSales(event.orders, event.timezone),
  }));
  const totals = sales.reduce(
    (sum, row) => {
      sum.grossKzt += row.report.totals.gross;
      sum.discountsKzt += row.report.totals.discounts;
      sum.feesKzt += row.report.totals.fees;
      sum.refundsKzt += row.report.totals.refunds;
      sum.netKzt += row.report.totals.net;
      sum.orders += row.report.totals.count;
      sum.tickets += row.report.totals.tickets;
      return sum;
    },
    { grossKzt: 0, discountsKzt: 0, feesKzt: 0, refundsKzt: 0, netKzt: 0, orders: 0, tickets: 0 },
  );
  const inventory = sales.reduce(
    (sum, row) => {
      for (const type of row.event.ticketTypes) {
        sum.capacity += type.quantity;
        sum.sold += type.sold;
        sum.reserved += type.reserved;
        sum.refunded += type.refunded;
      }
      return sum;
    },
    { capacity: 0, sold: 0, reserved: 0, refunded: 0 },
  );
  const remaining = Math.max(0, inventory.capacity - inventory.sold - inventory.reserved);
  const registered = sales.reduce(
    (sum, row) =>
      sum + row.event.tickets.filter((ticket) => ticket.status === "VALID" || ticket.status === "CHECKED_IN").length,
    0,
  );
  const checkedIn = sales.reduce(
    (sum, row) => sum + row.event.tickets.filter((ticket) => ticket.status === "CHECKED_IN").length,
    0,
  );

  return { events: sales, totals, inventory, remaining, registered, checkedIn };
}

export async function analyticsSummary(user: Actor, query: Query) {
  const report = await loadAnalytics(user, query);
  return {
    summary: {
      capacity: report.inventory.capacity,
      sold: report.inventory.sold,
      reserved: report.inventory.reserved,
      refunded: report.inventory.refunded,
      remaining: report.remaining,
      percentSold:
        report.inventory.capacity === 0
          ? 0
          : Math.round((report.inventory.sold / report.inventory.capacity) * 100),
      ...report.totals,
    },
  };
}

export async function analyticsSalesOverTime(user: Actor, query: Query) {
  const report = await loadAnalytics(user, query);
  const days = new Map<string, { collectedKzt: number; orders: number; tickets: number }>();
  for (const row of report.events) {
    for (const order of row.event.orders) {
      if (!order.paidAt) continue;
      const day = dateKey(order.paidAt, row.event.timezone);
      const bucket = days.get(day) ?? { collectedKzt: 0, orders: 0, tickets: 0 };
      bucket.collectedKzt += order.totalKzt;
      bucket.orders += 1;
      bucket.tickets += order.items.reduce((sum, item) => sum + item.quantity, 0);
      days.set(day, bucket);
    }
  }
  return {
    buckets: [...days.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([day, bucket]) => ({ day, ...bucket })),
  };
}

export async function analyticsByTicketType(user: Actor, query: Query) {
  const report = await loadAnalytics(user, query);
  return {
    ticketTypes: report.events.flatMap((row) =>
      row.event.ticketTypes.map((type) => {
        const sold = row.report.byType.get(type.id);
        return {
          id: type.id,
          eventId: row.event.id,
          name: type.name,
          quantity: type.quantity,
          sold: type.sold,
          reserved: type.reserved,
          refunded: type.refunded,
          available: Math.max(0, type.quantity - type.sold - type.reserved),
          tickets: sold?.quantity ?? 0,
          grossKzt: sold?.total ?? 0,
        };
      }),
    ),
  };
}

export async function analyticsCampaigns(user: Actor, query: Query) {
  const report = await loadAnalytics(user, query);
  return {
    campaigns: report.events.flatMap((row) =>
      row.event.campaigns.map((campaign) => {
        const sales = row.report.byCampaign.get(campaign.id);
        return {
          id: campaign.id,
          eventId: row.event.id,
          name: campaign.name,
          redemptions: campaign.redeemed,
          tickets: sales?.tickets ?? 0,
          grossKzt: sales?.gross ?? 0,
          discountKzt: sales?.discount ?? 0,
          netKzt: sales?.net ?? 0,
        };
      }),
    ),
  };
}

export async function analyticsAttendance(user: Actor, query: Query) {
  const report = await loadAnalytics(user, query);
  return {
    attendance: {
      registered: report.registered,
      checkedIn: report.checkedIn,
      absent: report.registered - report.checkedIn,
      percentCheckedIn:
        report.registered === 0 ? 0 : Math.round((report.checkedIn / report.registered) * 100),
    },
  };
}
