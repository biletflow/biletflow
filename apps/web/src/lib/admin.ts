import { prisma, type Prisma, type UserRole } from "@biletflow/db";
import type { PlatformSettingsInput } from "@biletflow/shared";

import { ApiError } from "./api-error";
import { audit } from "./audit";
import { clientIp } from "./http";

type Actor = { id: string; role: UserRole };

const SETTING_KEYS = {
  activationFeeKzt: "PLATFORM_ACTIVATION_FEE_KZT",
  feePercent: "PLATFORM_FEE_PERCENT",
  feeFixedKzt: "PLATFORM_FEE_FIXED_KZT",
  checkoutHoldMinutes: "CHECKOUT_HOLD_MINUTES",
} as const;

function csvCell(value: string | number | null) {
  const text = value === null ? "" : String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export async function searchAdmin(query: string) {
  const q = query.trim();
  if (q.length < 2) throw new ApiError(400, "VALIDATION_FAILED");
  const [users, events, orders, payments] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 20,
      select: { id: true, name: true, email: true, role: true, status: true },
    }),
    prisma.event.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 20,
      select: { id: true, title: true, slug: true, status: true, paidSalesSuspended: true },
    }),
    prisma.order.findMany({
      where: { reference: { contains: q, mode: "insensitive" } },
      take: 20,
      select: { id: true, reference: true, status: true, totalKzt: true, eventId: true },
    }),
    prisma.payment.findMany({
      where: { providerIntentId: { contains: q, mode: "insensitive" } },
      take: 20,
      select: {
        id: true,
        providerIntentId: true,
        status: true,
        amountKzt: true,
        purpose: true,
        orderId: true,
      },
    }),
  ]);
  return { users, events, orders, payments };
}

export async function setUserSuspension(actor: Actor, userId: string, suspended: boolean, reason: string, headers: Headers) {
  const status = suspended ? "SUSPENDED" : "ACTIVE";
  const updated = await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id: userId } });
    if (!target) throw new ApiError(404, "NOT_FOUND");
    if (target.id === actor.id) throw new ApiError(409, "CONFLICT");
    if (target.status === status) {
      return { id: target.id, status: target.status, duplicate: true };
    }
    if (suspended && target.role === "PLATFORM_ADMIN") {
      const others = await tx.user.count({
        where: { role: "PLATFORM_ADMIN", status: "ACTIVE", NOT: { id: target.id } },
      });
      if (others < 1) throw new ApiError(409, "CONFLICT");
    }
    const { count } = await tx.user.updateMany({
      where: { id: target.id, status: target.status },
      data: { status },
    });
    const user = { id: target.id, status };
    if (count === 0) return { ...user, duplicate: true };
    await audit(tx, {
      actorUserId: actor.id,
      action: suspended ? "user.suspended" : "user.restored",
      entityType: "User",
      entityId: user.id,
      description: suspended ? "Platform admin suspended the account" : "Platform admin restored the account",
      metadata: { reason },
      ipAddress: clientIp(headers),
    });
    return { ...user, duplicate: false };
  });
  return { user: { id: updated.id, status: updated.status }, duplicate: updated.duplicate };
}

export async function setEventSuspension(
  actor: Actor,
  eventId: string,
  suspended: boolean,
  reason: string,
  headers: Headers,
) {
  const updated = await prisma.$transaction(async (tx) => {
    const event = await tx.event.findUnique({ where: { id: eventId } });
    if (!event) throw new ApiError(404, "NOT_FOUND");
    const { count } = await tx.event.updateMany({
      where: { id: eventId, paidSalesSuspended: !suspended },
      data: { paidSalesSuspended: suspended },
    });
    const saved = { id: eventId, paidSalesSuspended: suspended };
    if (count === 0) return { ...saved, duplicate: true };
    await audit(tx, {
      actorUserId: actor.id,
      eventId: event.id,
      action: suspended ? "event.sales_suspended" : "event.sales_restored",
      entityType: "Event",
      entityId: event.id,
      description: suspended ? "Event suspended by a platform admin" : "Event restored by a platform admin",
      metadata: { reason },
      ipAddress: clientIp(headers),
    });
    return { ...saved, duplicate: false };
  });
  return {
    event: { id: updated.id, paidSalesSuspended: updated.paidSalesSuspended },
    duplicate: updated.duplicate,
  };
}

export async function listEventReports() {
  const reports = await prisma.eventReport.findMany({
    where: { resolvedAt: null },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const events = await prisma.event.findMany({
    where: { id: { in: reports.map((report) => report.eventId) } },
    select: { id: true, title: true, slug: true, paidSalesSuspended: true },
  });
  const titles = new Map(events.map((event) => [event.id, event]));
  return reports.map((report) => ({
    id: report.id,
    reason: report.reason,
    details: report.details,
    createdAt: report.createdAt.toISOString(),
    event: titles.get(report.eventId) ?? null,
  }));
}

export async function reportEvent(
  reporterId: string,
  slug: string,
  reason: string,
  details: string | undefined,
  headers: Headers,
) {
  const event = await prisma.event.findUnique({ where: { slug } });
  if (!event || event.status !== "PUBLISHED") throw new ApiError(404, "NOT_FOUND");
  const report = await prisma.$transaction(async (tx) => {
    const created = await tx.eventReport.create({
      data: { eventId: event.id, reporterId, reason, details },
    });
    await audit(tx, {
      actorUserId: reporterId,
      eventId: event.id,
      action: "event.reported",
      entityType: "EventReport",
      entityId: created.id,
      description: "Event reported for moderation",
      metadata: { reason },
      ipAddress: clientIp(headers),
    });
    return created;
  });
  return {
    id: report.id,
    reason: report.reason,
    createdAt: report.createdAt.toISOString(),
  };
}

function readSetting(rows: { key: string; value: string }[], key: string, fallback: string) {
  return rows.find((row) => row.key === key)?.value ?? fallback;
}

export async function getPlatformSettings() {
  const rows = await prisma.platformSetting.findMany({
    where: { key: { in: Object.values(SETTING_KEYS) } },
  });
  return {
    activationFeeKzt: Number(readSetting(rows, SETTING_KEYS.activationFeeKzt, "15000")),
    feePercent: Number(readSetting(rows, SETTING_KEYS.feePercent, "3.5")),
    feeFixedKzt: Number(readSetting(rows, SETTING_KEYS.feeFixedKzt, "100")),
    checkoutHoldMinutes: Number(readSetting(rows, SETTING_KEYS.checkoutHoldMinutes, "15")),
  };
}

export async function updatePlatformSettings(
  actor: Actor,
  input: PlatformSettingsInput,
  headers: Headers,
) {
  const writes: Prisma.PlatformSettingUpsertArgs[] = [];
  const entries: [keyof PlatformSettingsInput, string][] = [
    ["activationFeeKzt", SETTING_KEYS.activationFeeKzt],
    ["feePercent", SETTING_KEYS.feePercent],
    ["feeFixedKzt", SETTING_KEYS.feeFixedKzt],
    ["checkoutHoldMinutes", SETTING_KEYS.checkoutHoldMinutes],
  ];
  for (const [field, key] of entries) {
    const value = input[field];
    if (value === undefined) continue;
    writes.push({
      where: { key },
      create: { key, value: String(value) },
      update: { value: String(value) },
    });
  }
  await prisma.$transaction(async (tx) => {
    for (const write of writes) {
      await tx.platformSetting.upsert(write);
    }
    await audit(tx, {
      actorUserId: actor.id,
      action: "settings.updated",
      entityType: "PlatformSetting",
      entityId: "platform",
      description: "Platform fee settings updated",
      metadata: input,
      ipAddress: clientIp(headers),
    });
  });
  return getPlatformSettings();
}

export async function listActivationQueue() {
  return prisma.paidSalesActivation.findMany({
    where: { reviewedById: null, termsAcceptedAt: { not: null } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 50,
    select: {
      id: true,
      feePaid: true,
      identityVerified: true,
      payoutAccountConnected: true,
      event: { select: { title: true } },
      organizer: { select: { name: true } },
    },
  });
}

export async function exportOrdersCsv() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 1000,
    select: {
      reference: true,
      status: true,
      totalKzt: true,
      paidAt: true,
      event: { select: { title: true } },
    },
  });
  const header = ["reference", "status", "totalKzt", "paidAt", "event"].join(",");
  const lines = orders.map((order) =>
    [
      csvCell(order.reference),
      csvCell(order.status),
      csvCell(order.totalKzt),
      csvCell(order.paidAt?.toISOString() ?? null),
      csvCell(order.event.title),
    ].join(","),
  );
  return [header, ...lines].join("\n");
}
