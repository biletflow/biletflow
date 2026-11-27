import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { hashPassword } from "@biletflow/shared/password.server";
import { buildTicketCode, generateCampaignToken } from "@biletflow/shared/qr.server";

const tables = [
  "User", "OrganizerProfile", "PayoutAccount", "Venue", "VenueSection",
  "SeatRow", "Seat", "Event", "TicketType", "PaidSalesActivation",
  "PromotionalCampaign", "CampaignTicketType", "PromoCode", "Order",
  "OrderItem", "Attendee", "Ticket", "SeatHold", "Payment", "Refund",
  "ProcessedWebhookEvent", "PromoRedemption", "CheckInRecord",
  "StaffAssignment", "SupportCase", "SupportMessage", "Notification",
  "AuditLog", "Payout", "PlatformSetting", "EventReport",
] as const;
type Row = Record<string, unknown>;
type Table = (typeof tables)[number];
const prisma = new PrismaClient();

async function main() {
  if (process.env.BILETFLOW_FINAL_DEMO !== "1") {
    throw new Error("Set BILETFLOW_FINAL_DEMO=1 explicitly for a local demo database.");
  }
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      !/(?:_demo|_verify)$/.test(url.pathname)) {
    throw new Error("Use a local empty database named with suffix _demo or _verify.");
  }
  const signingKey = process.env.TICKET_SIGNING_KEY;
  if (!signingKey) throw new Error("Set TICKET_SIGNING_KEY to the local server's signing key.");
  const data = JSON.parse(readFileSync(resolve(process.cwd(), "prisma/final-demo-data.json"), "utf8")) as Record<Table, Row[]>;
  for (const table of tables) {
    if (!Array.isArray(data[table])) throw new Error(`Missing fixture table: ${table}`);
  }
  for (const table of ["Payment", "Refund", "Payout", "PayoutAccount", "PaidSalesActivation"] as const) {
    if (data[table].some(row => row.simulated !== true)) throw new Error(`Non-simulated ${table} fixture`);
  }
  const allowed = /^(?:admin|organizer[23]?|scanner2?)@biletflow\.kz$|^(?:attendee(?:[1-9]|10)|registered)@example\.kz$/;
  if (data.User.some(row => typeof row.email !== "string" || !allowed.test(row.email))) {
    throw new Error("Unexpected demo account");
  }
  for (const row of data.Ticket) row.code = buildTicketCode(String(row.id), signingKey);
  for (const row of data.PromoCode) row.qrToken = generateCampaignToken();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";
  for (const row of data.Notification) {
    if (typeof row.body === "string") row.body = row.body.replaceAll("http://localhost:3100", appUrl.replace(/\/$/, ""));
  }
  const password = await hashPassword("Password123!");
  await prisma.$transaction(async tx => {
    for (const table of [...tables, "Account", "Session", "Verification"]) {
      const identifier = Prisma.raw(`"${table}"`);
      const [result] = await tx.$queryRaw<{ count: bigint }[]>(Prisma.sql`SELECT count(*) AS count FROM ${identifier}`);
      if (!result || result.count !== BigInt(0)) throw new Error(`Database is not empty: ${table}. Nothing imported.`);
    }
    for (const table of tables) {
      const identifier = Prisma.raw(`"${table}"`);
      if (data[table].length) {
        const inserted = await tx.$executeRaw(Prisma.sql`INSERT INTO ${identifier} SELECT * FROM json_populate_recordset(NULL::${identifier}, ${JSON.stringify(data[table])}::json)`);
        if (inserted !== data[table].length) throw new Error(`Row count mismatch: ${table}`);
      }
      console.log(`${table}: ${data[table].length}`);
    }
    await tx.account.createMany({data: data.User.map(row => ({
      userId: String(row.id), accountId: String(row.id), providerId: "credential", password,
    }))});
  }, {timeout: 120000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable});
  console.log("FINAL DEMO IMPORT COMPLETED");
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
