import type { Prisma } from "@biletflow/db";

export async function lockEventSales(tx: Prisma.TransactionClient, eventId: string) {
  // Serialize checkout and settlement with the admin update for this event.
  const [event] = await tx.$queryRaw<{ paidSalesSuspended: boolean; status: string }[]>`
    SELECT "paidSalesSuspended", "status" FROM "Event" WHERE "id" = ${eventId} FOR SHARE
  `;
  return event;
}
