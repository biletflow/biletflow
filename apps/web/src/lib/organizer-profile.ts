import { prisma } from "@biletflow/db";
import {
  organizerProfileSchema,
  payoutAccountSchema,
} from "@biletflow/shared";
import type { z } from "zod";

import { ApiError } from "./api-error";
import { audit } from "./audit";
import { clientIp } from "./http";

type SessionUser = {
  id: string;
  role: "ATTENDEE" | "ORGANIZER" | "PLATFORM_ADMIN";
  email: string;
  name: string;
};

type ProfileInput = z.infer<typeof organizerProfileSchema>;
type PayoutInput = z.infer<typeof payoutAccountSchema>;

export function presentProfile(
  profile: {
    id: string;
    displayName: string;
    description: string | null;
    logoUrl: string | null;
    contactEmail: string;
    contactPhone: string | null;
    websiteUrl: string | null;
    verificationStatus: string;
    verifiedAt: Date | null;
    reviewNote: string | null;
  },
) {
  return {
    id: profile.id,
    displayName: profile.displayName,
    description: profile.description,
    logoUrl: profile.logoUrl,
    contactEmail: profile.contactEmail,
    contactPhone: profile.contactPhone,
    websiteUrl: profile.websiteUrl,
    verificationStatus: profile.verificationStatus,
    verifiedAt: profile.verifiedAt?.toISOString() ?? null,
    reviewNote: profile.reviewNote,
  };
}

async function requireOrganizer(user: SessionUser) {
  if (user.role !== "ORGANIZER" && user.role !== "PLATFORM_ADMIN") {
    throw new ApiError(403, "FORBIDDEN");
  }
}

export async function getOrganizerProfile(user: SessionUser) {
  await requireOrganizer(user);
  const profile = await prisma.organizerProfile.findUnique({
    where: { userId: user.id },
  });
  if (!profile) {
    return {
      id: null,
      displayName: user.name,
      description: null,
      logoUrl: null,
      contactEmail: user.email,
      contactPhone: null,
      websiteUrl: null,
      verificationStatus: "NOT_STARTED",
      verifiedAt: null,
      reviewNote: null,
    };
  }
  return presentProfile(profile);
}

export async function upsertOrganizerProfile(
  user: SessionUser,
  input: ProfileInput,
  headers: Headers,
) {
  await requireOrganizer(user);
  const profile = await prisma.$transaction(async (tx) => {
    const saved = await tx.organizerProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        displayName: input.displayName,
        description: input.description,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        websiteUrl: input.websiteUrl,
        logoUrl: input.logoUrl,
      },
      update: {
        displayName: input.displayName,
        description: input.description,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        websiteUrl: input.websiteUrl,
        logoUrl: input.logoUrl,
      },
    });
    await audit(tx, {
      actorUserId: user.id,
      action: "organizer_profile.updated",
      entityType: "OrganizerProfile",
      entityId: saved.id,
      description: "Organizer profile updated",
      ipAddress: clientIp(headers),
    });
    return saved;
  });
  return presentProfile(profile);
}

export async function listPayoutAccounts(user: SessionUser) {
  await requireOrganizer(user);
  const profile = await prisma.organizerProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!profile) return [];
  const accounts = await prisma.payoutAccount.findMany({
    where: { organizerProfileId: profile.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  return accounts.map((account) => ({
    id: account.id,
    holderName: account.holderName,
    bankName: account.bankName,
    ibanLast4: account.ibanLast4,
    currency: account.currency,
    isDefault: account.isDefault,
    simulated: account.simulated,
    createdAt: account.createdAt.toISOString(),
  }));
}

export async function createPayoutAccount(
  user: SessionUser,
  input: PayoutInput,
  headers: Headers,
) {
  await requireOrganizer(user);
  let profile = await prisma.organizerProfile.findUnique({
    where: { userId: user.id },
  });
  if (!profile) {
    profile = await prisma.organizerProfile.create({
      data: {
        userId: user.id,
        displayName: user.name,
        contactEmail: user.email,
      },
    });
  }

  const account = await prisma.$transaction(async (tx) => {
    const count = await tx.payoutAccount.count({
      where: { organizerProfileId: profile!.id },
    });
    const created = await tx.payoutAccount.create({
      data: {
        organizerProfileId: profile!.id,
        holderName: input.holderName,
        bankName: input.bankName,
        ibanLast4: input.ibanLast4,
        isDefault: count === 0,
        simulated: true,
      },
    });
    await audit(tx, {
      actorUserId: user.id,
      action: "payout_account.created",
      entityType: "PayoutAccount",
      entityId: created.id,
      description: "Simulated payout account connected",
      metadata: { bankName: created.bankName, ibanLast4: created.ibanLast4 },
      ipAddress: clientIp(headers),
    });
    return created;
  });

  return {
    id: account.id,
    holderName: account.holderName,
    bankName: account.bankName,
    ibanLast4: account.ibanLast4,
    currency: account.currency,
    isDefault: account.isDefault,
    simulated: account.simulated,
    createdAt: account.createdAt.toISOString(),
  };
}

export async function listPayouts(user: SessionUser) {
  await requireOrganizer(user);
  const profile = await prisma.organizerProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!profile) return [];

  const payouts = await prisma.payout.findMany({
    where: { payoutAccount: { organizerProfileId: profile.id } },
    orderBy: { createdAt: "desc" },
    include: {
      event: { select: { id: true, title: true, slug: true } },
      payoutAccount: {
        select: { id: true, bankName: true, ibanLast4: true },
      },
    },
  });

  return payouts.map((payout) => ({
    id: payout.id,
    status: payout.status,
    grossKzt: payout.grossKzt,
    feeKzt: payout.feeKzt,
    refundedKzt: payout.refundedKzt,
    netKzt: payout.netKzt,
    simulated: payout.simulated,
    scheduledFor: payout.scheduledFor?.toISOString() ?? null,
    paidAt: payout.paidAt?.toISOString() ?? null,
    createdAt: payout.createdAt.toISOString(),
    event: payout.event,
    payoutAccount: payout.payoutAccount,
  }));
}
