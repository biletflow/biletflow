import { prisma } from "@biletflow/db";
import { errorResponse } from "@/lib/api-error";
import { json } from "@/lib/http";
import { requireOwnedEvent } from "@/lib/organizer";
import { requireRole } from "@/lib/session";
import { dateKey, summarizeSales } from "@/lib/organizer-report";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(request.headers, ["ORGANIZER", "PLATFORM_ADMIN"]);
    const { id } = await context.params;
    await requireOwnedEvent(user, id);
    const event = await prisma.event.findUniqueOrThrow({
      where: { id },
      select: {
        timezone: true,
        ticketTypes: { select: { id: true, name: true, quantity: true, sold: true, reserved: true, refunded: true } },
        orders: { select: { paidAt: true, subtotalKzt: true, discountKzt: true, feeKzt: true, totalKzt: true, campaignId: true, items: { select: { ticketTypeId: true, quantity: true, totalKzt: true } }, refunds: { select: { status: true, amountKzt: true } } } },
        tickets: { select: { status: true } },
        campaigns: { select: { id: true, name: true, redeemed: true } },
      },
    });
    const params = new URL(request.url).searchParams;
    const date = (key: string) => { const value = params.get(key) ?? ""; return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ""; };
    const from = date("from"), to = date("to");
    const sales = summarizeSales(event.orders.filter((order) => {
      if (!order.paidAt) return false;
      const day = dateKey(order.paidAt, event.timezone);
      return (!from || day >= from) && (!to || day <= to);
    }), event.timezone);
    const sum = (key: "quantity" | "sold" | "reserved" | "refunded") => event.ticketTypes.reduce((total, row) => total + row[key], 0);
    const capacity = sum("quantity"), sold = sum("sold"), reserved = sum("reserved");
    const registered = event.tickets.filter((ticket) => ticket.status === "VALID" || ticket.status === "CHECKED_IN").length;
    const checkedIn = event.tickets.filter((ticket) => ticket.status === "CHECKED_IN").length;
    return json({
      inventory: { capacity, sold, reserved, available: Math.max(0, capacity - sold - reserved), refunded: sum("refunded") },
      attendance: { registered, checkedIn, absent: registered - checkedIn },
      totals: sales.totals,
      days: [...sales.byDay].sort(([a], [b]) => a.localeCompare(b)).map(([day, amountKzt]) => ({ day, amountKzt })),
      ticketTypes: event.ticketTypes.map((row) => ({ ...row, issued: sales.byType.get(row.id)?.quantity ?? 0, totalKzt: sales.byType.get(row.id)?.total ?? 0 })),
      campaigns: event.campaigns.map((row) => ({ ...row, ...sales.byCampaign.get(row.id) })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
