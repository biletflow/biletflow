/**
 * Demo data for local development, tests, and the graded demonstration.
 *
 * Idempotent: truncates every table, then rebuilds. Safe to re-run.
 * Every login below uses the password `Password123!`.
 */

import { hashPassword } from "@biletflow/shared/password.server";
import {
  buildTicketCode,
  generateCampaignToken,
  generatePromoCode,
} from "@biletflow/shared/qr.server";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TICKET_SIGNING_KEY = process.env.TICKET_SIGNING_KEY ?? "dev-ticket-signing-key";
const PASSWORD = "Password123!";

// Deterministic RNG so re-seeding produces the same numbers and demos stay predictable.
let rngState = 42;
function rand(): number {
  rngState = (rngState * 1103515245 + 12345) % 2147483648;
  return rngState / 2147483648;
}
function pick<T>(items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)]!;
}
function randInt(min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}
function daysFromNow(days: number, hour = 19): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function truncate() {
  // Order matters: children before parents.
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.supportMessage.deleteMany(),
    prisma.supportCase.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.checkInRecord.deleteMany(),
    prisma.promoRedemption.deleteMany(),
    prisma.refund.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.processedWebhookEvent.deleteMany(),
    prisma.ticket.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.attendee.deleteMany(),
    prisma.seatHold.deleteMany(),
    prisma.promoCode.deleteMany(),
    prisma.campaignTicketType.deleteMany(),
    prisma.promotionalCampaign.deleteMany(),
    prisma.payout.deleteMany(),
    prisma.paidSalesActivation.deleteMany(),
    prisma.ticketType.deleteMany(),
    prisma.staffAssignment.deleteMany(),
    prisma.eventReport.deleteMany(),
    prisma.event.deleteMany(),
    prisma.seat.deleteMany(),
    prisma.seatRow.deleteMany(),
    prisma.venueSection.deleteMany(),
    prisma.venue.deleteMany(),
    prisma.payoutAccount.deleteMany(),
    prisma.organizerProfile.deleteMany(),
    prisma.session.deleteMany(),
    prisma.account.deleteMany(),
    prisma.verification.deleteMany(),
    prisma.user.deleteMany(),
    prisma.platformSetting.deleteMany(),
  ]);
}

async function createUser(
  email: string,
  name: string,
  role: "ATTENDEE" | "ORGANIZER" | "PLATFORM_ADMIN",
  passwordHash: string,
) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, name, role, emailVerified: true, locale: "ru" },
    });
    await tx.account.create({
      data: {
        userId: user.id,
        providerId: "credential",
        accountId: user.id,
        password: passwordHash,
      },
    });
    return user;
  });
}

async function main() {
  console.log("Truncating...");
  await truncate();

  const passwordHash = await hashPassword(PASSWORD);

  console.log("Platform settings...");
  await prisma.platformSetting.createMany({
    data: [
      { key: "PLATFORM_ACTIVATION_FEE_KZT", value: "15000" },
      { key: "PLATFORM_FEE_PERCENT", value: "3.5" },
      { key: "PLATFORM_FEE_FIXED_KZT", value: "100" },
      { key: "CHECKOUT_HOLD_MINUTES", value: "15" },
    ],
  });

  console.log("Users...");
  const admin = await createUser("admin@biletflow.kz", "Platform Admin", "PLATFORM_ADMIN", passwordHash);

  const organizers = [];
  for (const [i, spec] of [
    { email: "organizer@biletflow.kz", name: "Aigerim Nurlanova", org: "Almaty Jazz Collective" },
    { email: "organizer2@biletflow.kz", name: "Daniyar Seitov", org: "KBTU Student Union" },
    { email: "organizer3@biletflow.kz", name: "Zarina Abenova", org: "Astana Tech Meetups" },
  ].entries()) {
    const user = await createUser(spec.email, spec.name, "ORGANIZER", passwordHash);
    const profile = await prisma.organizerProfile.create({
      data: {
        userId: user.id,
        displayName: spec.org,
        description: `${spec.org} organises events across Kazakhstan.`,
        contactEmail: spec.email,
        contactPhone: `+7 70${i} 000 00 0${i}`,
        verificationStatus: i === 2 ? "PENDING_REVIEW" : "APPROVED",
        verifiedAt: i === 2 ? null : new Date(),
      },
    });
    const payout = await prisma.payoutAccount.create({
      data: {
        organizerProfileId: profile.id,
        holderName: spec.name,
        bankName: pick(["Kaspi Bank", "Halyk Bank", "Forte Bank"]),
        ibanLast4: String(randInt(1000, 9999)),
        isDefault: true,
      },
    });
    organizers.push({ user, profile, payout });
  }

  const eventAdmins = [
    await createUser("scanner@biletflow.kz", "Marat Iskakov", "ATTENDEE", passwordHash),
    await createUser("scanner2@biletflow.kz", "Gulnara Amanova", "ATTENDEE", passwordHash),
  ];

  const attendees = [];
  const firstNames = ["Aliya", "Timur", "Dana", "Yerlan", "Saule", "Nurlan", "Madina", "Askar", "Aisha", "Ruslan"];
  for (let i = 0; i < 10; i++) {
    attendees.push(
      await createUser(
        `attendee${i + 1}@example.kz`,
        `${firstNames[i]} ${pick(["Bekova", "Sultanov", "Zhaksylykova", "Omarov"])}`,
        "ATTENDEE",
        passwordHash,
      ),
    );
  }

  console.log("Venues...");
  const venues = await Promise.all([
    prisma.venue.create({
      data: {
        name: "Almaty Central Concert Hall",
        address: "Abai Avenue 103",
        city: "Almaty",
        capacity: 800,
      },
    }),
    prisma.venue.create({
      data: {
        name: "KBTU Main Auditorium",
        address: "Tole Bi 59",
        city: "Almaty",
        capacity: 300,
      },
    }),
    prisma.venue.create({
      data: { name: "Astana Hub", address: "Mangilik El 55/8", city: "Astana", capacity: 200 },
    }),
  ]);

  console.log("Events...");
  const eventSpecs = [
    {
      slug: "almaty-jazz-night",
      title: "Almaty Jazz Night",
      category: "Music",
      organizer: 0,
      venue: 0,
      status: "PUBLISHED" as const,
      startsAt: daysFromNow(21),
      paid: true,
      types: [
        { name: "General Admission", priceKzt: 8000, quantity: 300 },
        { name: "VIP", priceKzt: 20000, quantity: 50 },
      ],
    },
    {
      slug: "kbtu-freshers-welcome",
      title: "KBTU Freshers Welcome",
      category: "Community",
      organizer: 1,
      venue: 1,
      status: "PUBLISHED" as const,
      startsAt: daysFromNow(10),
      paid: false,
      types: [{ name: "Free Entry", priceKzt: 0, quantity: 250 }],
    },
    {
      slug: "astana-devfest",
      title: "Astana DevFest 2026",
      category: "Technology",
      organizer: 2,
      venue: 2,
      status: "PUBLISHED" as const,
      startsAt: daysFromNow(3),
      paid: true,
      types: [
        { name: "Standard", priceKzt: 12000, quantity: 150 },
        { name: "Student", priceKzt: 5000, quantity: 50 },
      ],
    },
    {
      slug: "spring-charity-gala",
      title: "Spring Charity Gala",
      category: "Community",
      organizer: 0,
      venue: 0,
      status: "COMPLETED" as const,
      startsAt: daysFromNow(-14),
      paid: true,
      types: [{ name: "Seat", priceKzt: 15000, quantity: 200 }],
    },
    {
      slug: "winter-film-screening",
      title: "Winter Film Screening",
      category: "Film",
      organizer: 1,
      venue: 1,
      status: "CANCELLED" as const,
      startsAt: daysFromNow(-5),
      paid: false,
      types: [{ name: "Free Entry", priceKzt: 0, quantity: 120 }],
    },
    {
      slug: "summer-open-air-draft",
      title: "Summer Open Air (draft)",
      category: "Music",
      organizer: 0,
      venue: 0,
      status: "DRAFT" as const,
      startsAt: daysFromNow(60),
      paid: true,
      types: [{ name: "Early Bird", priceKzt: 9000, quantity: 400 }],
    },
  ];

  const events = [];
  for (const spec of eventSpecs) {
    const organizer = organizers[spec.organizer]!;
    const event = await prisma.event.create({
      data: {
        slug: spec.slug,
        organizerId: organizer.user.id,
        venueId: venues[spec.venue]!.id,
        title: spec.title,
        description: `${spec.title} — demonstration event seeded for BiletFlow.`,
        category: spec.category,
        status: spec.status,
        visibility: "PUBLIC",
        startsAt: spec.startsAt,
        endsAt: new Date(spec.startsAt.getTime() + 4 * 3600_000),
        capacity: spec.types.reduce((sum, t) => sum + t.quantity, 0),
        paidSalesActive: spec.paid && spec.status !== "DRAFT",
        refundPolicy: spec.paid ? "UNTIL_48H_BEFORE" : "NO_REFUNDS",
        publishedAt: spec.status === "DRAFT" ? null : new Date(),
        cancelledAt: spec.status === "CANCELLED" ? daysFromNow(-7) : null,
        cancellationReason: spec.status === "CANCELLED" ? "Venue became unavailable" : null,
        ticketTypes: {
          create: spec.types.map((t, order) => ({ ...t, displayOrder: order })),
        },
      },
      include: { ticketTypes: true },
    });

    if (spec.paid && spec.status !== "DRAFT") {
      await prisma.paidSalesActivation.create({
        data: {
          eventId: event.id,
          organizerId: organizer.user.id,
          feeKzt: 15000,
          feePaid: true,
          identityVerified: true,
          payoutAccountConnected: true,
          termsAcceptedAt: new Date(),
          activatedAt: new Date(),
          reviewedById: admin.id,
        },
      });
    }

    for (const staff of eventAdmins) {
      await prisma.staffAssignment.create({
        data: { eventId: event.id, userId: staff.id, role: "EVENT_ADMIN" },
      });
    }

    await prisma.auditLog.create({
      data: {
        actorUserId: organizer.user.id,
        eventId: event.id,
        action: spec.status === "CANCELLED" ? "event.cancelled" : "event.published",
        entityType: "Event",
        entityId: event.id,
        description: `${spec.title} ${spec.status === "CANCELLED" ? "cancelled" : "published"}`,
      },
    });

    events.push({ event, spec, organizer });
  }

  console.log("Campaigns...");
  const campaigns = [];
  for (const target of [events[0]!, events[2]!]) {
    const campaign = await prisma.promotionalCampaign.create({
      data: {
        eventId: target.event.id,
        name: `${target.spec.title} — Early Bird`,
        discountType: "PERCENT",
        discountValue: 20,
        status: "ACTIVE",
        maxRedemptions: 50,
        perUserLimit: 1,
        endsAt: daysFromNow(30),
        promoCode: {
          create: { code: generatePromoCode(), qrToken: generateCampaignToken() },
        },
        ticketTypes: {
          create: target.event.ticketTypes.map((tt) => ({ ticketTypeId: tt.id })),
        },
      },
      include: { promoCode: true },
    });
    campaigns.push(campaign);

    await prisma.auditLog.create({
      data: {
        actorUserId: target.organizer.user.id,
        eventId: target.event.id,
        action: "campaign.created",
        entityType: "PromotionalCampaign",
        entityId: campaign.id,
        description: `Campaign "${campaign.name}" created`,
      },
    });
  }

  console.log("Orders and tickets...");
  let orderCounter = 1000;
  let ticketCount = 0;

  for (const { event, spec } of events) {
    if (spec.status === "DRAFT") continue;

    const orderTarget = spec.status === "COMPLETED" ? 60 : randInt(25, 50);
    const campaign = campaigns.find((c) => c.eventId === event.id);

    for (let i = 0; i < orderTarget; i++) {
      const buyer = pick(attendees);
      const ticketType = pick(event.ticketTypes);
      const quantity = randInt(1, 2);
      const subtotalKzt = ticketType.priceKzt * quantity;

      // Roughly a fifth of paid orders come through the campaign.
      const useCampaign = Boolean(campaign) && subtotalKzt > 0 && rand() < 0.2;
      const discountKzt = useCampaign ? Math.round(subtotalKzt * 0.2) : 0;
      const totalKzt = subtotalKzt - discountKzt;
      const feeKzt = totalKzt > 0 ? Math.round((totalKzt * 3.5) / 100) + 100 : 0;

      const createdAt = new Date(
        event.startsAt.getTime() - randInt(1, 30) * 86_400_000,
      );

      const order = await prisma.order.create({
        data: {
          reference: `BF-${orderCounter++}`,
          eventId: event.id,
          userId: buyer.id,
          status: "PAID",
          subtotalKzt,
          discountKzt,
          feeKzt,
          totalKzt,
          campaignId: useCampaign ? campaign!.id : null,
          promoCodeId: useCampaign ? campaign!.promoCode!.id : null,
          paidAt: createdAt,
          createdAt,
          items: {
            create: {
              ticketTypeId: ticketType.id,
              quantity,
              unitPriceKzt: ticketType.priceKzt,
              discountKzt,
              totalKzt,
            },
          },
        },
        include: { items: true },
      });

      if (totalKzt > 0) {
        await prisma.payment.create({
          data: {
            purpose: "TICKET_ORDER",
            orderId: order.id,
            providerIntentId: `sim_${order.id}`,
            status: "SUCCEEDED",
            amountKzt: totalKzt,
            feeKzt,
            succeededAt: createdAt,
          },
        });
      }

      if (useCampaign) {
        // perUserLimit is 1, so skip if this buyer already redeemed this campaign.
        const existing = await prisma.promoRedemption.findUnique({
          where: { campaignId_userId: { campaignId: campaign!.id, userId: buyer.id } },
        });
        if (!existing) {
          await prisma.promoRedemption.create({
            data: {
              campaignId: campaign!.id,
              promoCodeId: campaign!.promoCode!.id,
              orderId: order.id,
              userId: buyer.id,
              discountKzt,
            },
          });
          await prisma.promotionalCampaign.update({
            where: { id: campaign!.id },
            data: { redeemed: { increment: 1 } },
          });
        }
      }

      const orderItem = order.items[0]!;
      for (let t = 0; t < quantity; t++) {
        const attendeeRecord = await prisma.attendee.create({
          data: {
            fullName: buyer.name,
            email: buyer.email,
            phone: `+7 70${randInt(0, 9)} ${randInt(100, 999)} ${randInt(10, 99)} ${randInt(10, 99)}`,
          },
        });

        const ticket = await prisma.ticket.create({
          data: {
            code: "pending",
            eventId: event.id,
            orderId: order.id,
            orderItemId: orderItem.id,
            ticketTypeId: ticketType.id,
            attendeeId: attendeeRecord.id,
            status: spec.status === "CANCELLED" ? "CANCELLED" : "VALID",
            issuedAt: createdAt,
          },
        });

        await prisma.ticket.update({
          where: { id: ticket.id },
          data: { code: buildTicketCode(ticket.id, TICKET_SIGNING_KEY) },
        });
        ticketCount++;

        // The completed event has most of its attendees already checked in.
        if (spec.status === "COMPLETED" && rand() < 0.8) {
          await prisma.checkInRecord.create({
            data: {
              ticketId: ticket.id,
              eventId: event.id,
              checkedInById: pick(eventAdmins).id,
              checkedInAt: new Date(event.startsAt.getTime() + randInt(0, 90) * 60_000),
              deviceLabel: pick(["Door A", "Door B"]),
            },
          });
          await prisma.ticket.update({
            where: { id: ticket.id },
            data: { status: "CHECKED_IN" },
          });
        }
      }

      await prisma.ticketType.update({
        where: { id: ticketType.id },
        data: { sold: { increment: quantity } },
      });
    }
  }

  console.log("Support cases...");
  const firstPaidOrder = await prisma.order.findFirst({
    where: { totalKzt: { gt: 0 } },
    include: { event: true },
  });

  if (firstPaidOrder) {
    const supportCase = await prisma.supportCase.create({
      data: {
        reference: "CASE-1001",
        audience: "ATTENDEE_TO_ORGANIZER",
        category: "TICKET_DELIVERY",
        status: "IN_PROGRESS",
        subject: "I did not receive my ticket email",
        requesterId: firstPaidOrder.userId,
        eventId: firstPaidOrder.eventId,
        orderId: firstPaidOrder.id,
      },
    });
    await prisma.supportMessage.createMany({
      data: [
        {
          caseId: supportCase.id,
          authorId: firstPaidOrder.userId,
          body: "I paid but the confirmation email never arrived. Order BF-1000.",
        },
        {
          caseId: supportCase.id,
          authorId: organizers[0]!.user.id,
          body: "Thanks for reaching out — I can see your order and have re-sent the ticket.",
        },
      ],
    });
  }

  const counts = {
    users: await prisma.user.count(),
    events: await prisma.event.count(),
    ticketTypes: await prisma.ticketType.count(),
    orders: await prisma.order.count(),
    tickets: ticketCount,
    checkIns: await prisma.checkInRecord.count(),
    campaigns: await prisma.promotionalCampaign.count(),
    redemptions: await prisma.promoRedemption.count(),
    auditEntries: await prisma.auditLog.count(),
  };

  console.log("\nSeed complete:");
  console.table(counts);
  console.log(`\nAll logins use the password: ${PASSWORD}`);
  console.log("  admin@biletflow.kz      Platform Admin");
  console.log("  organizer@biletflow.kz  Organizer with paid events");
  console.log("  scanner@biletflow.kz    Event Admin (mobile app)");
  console.log("  attendee1@example.kz    Attendee with orders\n");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
