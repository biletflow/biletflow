import type { Prisma } from "@biletflow/db";

import { ApiError } from "./api-error";

/**
 * Inventory moves are single conditional UPDATEs. A read-then-write loses the race
 * when two checkouts sell the last ticket together. See docs/backend-commerce.md.
 */

async function expectUpdate(updated: number, code: "SOLD_OUT" | "CONFLICT") {
  if (updated !== 1) throw new ApiError(409, code);
}

export async function reserveInventory(
  tx: Prisma.TransactionClient,
  ticketTypeId: string,
  quantity: number,
) {
  const updated = await tx.$executeRaw`
    UPDATE "TicketType"
    SET "reserved" = "reserved" + ${quantity}
    WHERE "id" = ${ticketTypeId}
      AND "sold" + "reserved" + ${quantity} <= "quantity"
  `;
  await expectUpdate(updated, "SOLD_OUT");
}

export async function sellInventory(
  tx: Prisma.TransactionClient,
  ticketTypeId: string,
  quantity: number,
) {
  const updated = await tx.$executeRaw`
    UPDATE "TicketType"
    SET "sold" = "sold" + ${quantity}
    WHERE "id" = ${ticketTypeId}
      AND "sold" + "reserved" + ${quantity} <= "quantity"
  `;
  await expectUpdate(updated, "SOLD_OUT");
}

export async function releaseInventory(
  tx: Prisma.TransactionClient,
  ticketTypeId: string,
  quantity: number,
) {
  const updated = await tx.$executeRaw`
    UPDATE "TicketType"
    SET "reserved" = "reserved" - ${quantity}
    WHERE "id" = ${ticketTypeId}
      AND "reserved" >= ${quantity}
  `;
  await expectUpdate(updated, "CONFLICT");
}

export async function convertReservation(
  tx: Prisma.TransactionClient,
  ticketTypeId: string,
  quantity: number,
) {
  const updated = await tx.$executeRaw`
    UPDATE "TicketType"
    SET "reserved" = "reserved" - ${quantity},
        "sold" = "sold" + ${quantity}
    WHERE "id" = ${ticketTypeId}
      AND "reserved" >= ${quantity}
  `;
  await expectUpdate(updated, "CONFLICT");
}

export async function refundInventory(
  tx: Prisma.TransactionClient,
  ticketTypeId: string,
  quantity: number,
) {
  const updated = await tx.$executeRaw`
    UPDATE "TicketType"
    SET "sold" = "sold" - ${quantity},
        "refunded" = "refunded" + ${quantity}
    WHERE "id" = ${ticketTypeId}
      AND "sold" >= ${quantity}
  `;
  await expectUpdate(updated, "CONFLICT");
}

export async function redeemCampaign(
  tx: Prisma.TransactionClient,
  campaignId: string,
) {
  const updated = await tx.$executeRaw`
    UPDATE "PromotionalCampaign"
    SET "redeemed" = "redeemed" + 1
    WHERE "id" = ${campaignId}
      AND "status" = 'ACTIVE'
      AND ("maxRedemptions" IS NULL OR "redeemed" < "maxRedemptions")
  `;
  if (updated !== 1) throw new ApiError(400, "PROMO_INVALID");
}
