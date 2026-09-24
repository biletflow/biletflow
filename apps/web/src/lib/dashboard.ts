import { prisma } from "@biletflow/db";

export async function listOrganizerEvents() {
  return prisma.event.findMany({
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      visibility: true,
      startsAt: true,
      endsAt: true,
      capacity: true,
      organizer: {
        select: {
          name: true,
          organizerProfile: { select: { displayName: true } },
        },
      },
      venue: { select: { name: true, city: true } },
      ticketTypes: {
        select: { quantity: true, sold: true, reserved: true },
      },
    },
  });
}

export async function listAdminUsers() {
  return prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      emailVerified: true,
      locale: true,
      createdAt: true,
      organizerProfile: {
        select: {
          displayName: true,
          verificationStatus: true,
        },
      },
    },
  });
}
