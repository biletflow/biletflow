import { randomBytes } from "node:crypto";

import { prisma, type Prisma } from "@biletflow/db";

import { ApiError } from "./api-error";
import { audit } from "./audit";
import { clientIp } from "./http";
import { sandboxPayUrl } from "./payments-signature";

const checklistSelect = {
  id: true,
  eventId: true,
  organizerId: true,
  feeKzt: true,
  feePaid: true,
  identityVerified: true,
  payoutAccountConnected: true,
  termsAcceptedAt: true,
  activatedAt: true,
  reviewNote: true,
} satisfies Prisma.PaidSalesActivationSelect;

export async function activationFeeKzt() {
  const setting = await prisma.platformSetting.findUnique({
    where: { key: "PLATFORM_ACTIVATION_FEE_KZT" },
  });
  const parsed = Number(setting?.value ?? 15000);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 15000;
}

async function payoutConnected(organizerId: string) {
  const count = await prisma.payoutAccount.count({
    where: { organizerProfile: { userId: organizerId } },
  });
  return count > 0;
}

export async function ensureActivation(eventId: string, organizerId: string) {
  const existing = await prisma.paidSalesActivation.findUnique({
    where: { eventId },
  });
  if (existing) return existing;
  return prisma.paidSalesActivation.create({
    data: {
      eventId,
      organizerId,
      feeKzt: await activationFeeKzt(),
      simulated: true,
    },
  });
}

export async function presentActivation(eventId: string, organizerId: string) {
  const activation = await ensureActivation(eventId, organizerId);
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { paidSalesActive: true },
  });
  const connected = await payoutConnected(organizerId);
  if (activation.payoutAccountConnected !== connected) {
    await prisma.paidSalesActivation.update({
      where: { id: activation.id },
      data: { payoutAccountConnected: connected },
    });
  }
  return {
    id: activation.id,
    eventId: activation.eventId,
    feeKzt: activation.feeKzt,
    feePaid: activation.feePaid,
    identityVerified: activation.identityVerified,
    payoutAccountConnected: connected,
    termsAccepted: activation.termsAcceptedAt !== null,
    activated: Boolean(activation.activatedAt) && Boolean(event?.paidSalesActive),
  };
}

export async function acceptActivationTerms(
  userId: string,
  eventId: string,
  headers: Headers,
) {
  const activation = await ensureActivation(eventId, userId);
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.paidSalesActivation.update({
      where: { id: activation.id },
      data: { termsAcceptedAt: activation.termsAcceptedAt ?? new Date() },
      select: checklistSelect,
    });
    await audit(tx, {
      actorUserId: userId,
      eventId,
      action: "activation.terms_accepted",
      entityType: "PaidSalesActivation",
      entityId: row.id,
      description: "Organizer accepted paid-sales terms",
      ipAddress: clientIp(headers),
    });
    return row;
  });
  return presentActivation(updated.eventId, updated.organizerId);
}

export async function startActivationPayment(userId: string, eventId: string, headers: Headers) {
  const activation = await ensureActivation(eventId, userId);
  if (activation.feePaid) throw new ApiError(409, "CONFLICT");
  const open = await prisma.payment.findFirst({
    where: { activationId: activation.id, status: "CREATED", purpose: "ACTIVATION_FEE" },
  });
  if (open) {
    return {
      payment: {
        id: open.id,
        intentId: open.providerIntentId,
        amountKzt: open.amountKzt,
        status: open.status,
      },
      url: sandboxPayUrl(open.providerIntentId),
    };
  }
  const payment = await prisma.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        purpose: "ACTIVATION_FEE",
        activationId: activation.id,
        provider: "simulated",
        providerIntentId: `sim_${randomBytes(12).toString("hex")}`,
        status: "CREATED",
        amountKzt: activation.feeKzt,
        simulated: true,
      },
    });
    await audit(tx, {
      actorUserId: userId,
      eventId,
      action: "activation.payment_started",
      entityType: "Payment",
      entityId: created.id,
      description: "Simulated activation fee started",
      metadata: { amountKzt: created.amountKzt },
      ipAddress: clientIp(headers),
    });
    return created;
  });
  return {
    payment: {
      id: payment.id,
      intentId: payment.providerIntentId,
      amountKzt: payment.amountKzt,
      status: payment.status,
    },
    url: sandboxPayUrl(payment.providerIntentId),
  };
}

export async function reviewActivation(
  reviewerId: string,
  activationId: string,
  decision: "APPROVE" | "REJECT",
  note: string | undefined,
  headers: Headers,
) {
  const activation = await prisma.paidSalesActivation.findUnique({
    where: { id: activationId },
  });
  if (!activation) throw new ApiError(404, "NOT_FOUND");
  await prisma.$transaction(async (tx) => {
    const updated = await tx.paidSalesActivation.update({
      where: { id: activationId },
      data: {
        identityVerified: decision === "APPROVE",
        reviewedById: reviewerId,
        reviewNote: note,
        activatedAt: decision === "APPROVE" ? activation.activatedAt : null,
      },
    });
    if (decision === "REJECT") {
      await tx.event.update({
        where: { id: activation.eventId },
        data: { paidSalesActive: false },
      });
    } else {
      await maybeActivate(tx, updated);
    }
    await audit(tx, {
      actorUserId: reviewerId,
      eventId: activation.eventId,
      action: decision === "APPROVE" ? "activation.approved" : "activation.rejected",
      entityType: "PaidSalesActivation",
      entityId: activationId,
      description:
        decision === "APPROVE"
          ? "Platform admin approved paid sales"
          : "Platform admin rejected paid sales",
      metadata: note ? { note } : undefined,
      ipAddress: clientIp(headers),
    });
  });
  return presentActivation(activation.eventId, activation.organizerId);
}

export async function maybeActivate(
  tx: Prisma.TransactionClient,
  activation: {
    id: string;
    eventId: string;
    organizerId: string;
    feePaid: boolean;
    identityVerified: boolean;
    activatedAt: Date | null;
  },
) {
  if (!activation.feePaid || !activation.identityVerified) return;
  if (!activation.activatedAt) {
    await tx.paidSalesActivation.update({
      where: { id: activation.id },
      data: { activatedAt: new Date() },
    });
  }
  await tx.event.update({
    where: { id: activation.eventId },
    data: { paidSalesActive: true },
  });
  await audit(tx, {
    actorUserId: activation.organizerId,
    eventId: activation.eventId,
    action: "activation.completed",
    entityType: "PaidSalesActivation",
    entityId: activation.id,
    description: "Paid sales unlocked",
  });
}
