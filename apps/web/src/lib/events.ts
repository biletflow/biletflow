import { prisma } from "@biletflow/db";

/**
 * Read models for the public event pages. Only PUBLISHED + PUBLIC events are ever
 * returned here; UNLISTED events are reachable by direct slug only, and PRIVATE and
 * DRAFT events are not reachable at all.
 */

const PUBLIC_LIST_WHERE = {
  status: "PUBLISHED",
  visibility: "PUBLIC",
} as const;

function ticketTypeSelect() {
  return {
    where: { isHidden: false },
    orderBy: { displayOrder: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      priceKzt: true,
      quantity: true,
      sold: true,
      reserved: true,
      maxPerOrder: true,
      salesStartAt: true,
      salesEndAt: true,
    },
  } as const;
}

export type EventListItem = Awaited<ReturnType<typeof listPublicEvents>>[number];

export type EventFilters = {
  category?: string;
  city?: string;
  query?: string;
  price?: "free" | "under10k" | "over10k";
  date?: "today" | "weekend" | "week" | "month";
  availability?: "available" | "almostFull";
  sort?: "date" | "price" | "popularity";
  take?: number;
};

export async function listPublicEvents(options?: EventFilters) {
  const events = await prisma.event.findMany({
    where: {
      ...PUBLIC_LIST_WHERE,
      ...(options?.category ? { category: options.category } : {}),
      ...(options?.city ? { venue: { city: options.city } } : {}),
      ...(options?.date ? { startsAt: dateRange(options.date) } : {}),
      ...(options?.query
        ? {
            OR: [
              { title: { contains: options.query, mode: "insensitive" as const } },
              { description: { contains: options.query, mode: "insensitive" as const } },
              { venue: { name: { contains: options.query, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    },
    orderBy: { startsAt: "asc" },
    take: options?.take,
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      category: true,
      coverImageUrl: true,
      startsAt: true,
      endsAt: true,
      timezone: true,
      capacity: true,
      paidSalesActive: true,
      venue: { select: { name: true, city: true } },
      ticketTypes: ticketTypeSelect(),
    },
  });

  // Price and availability derive from the aggregated ticket-type counters, so they
  // are applied after summarising rather than in the SQL predicate.
  let withStats = events.map((event) => ({ ...event, ...summarise(event) }));

  if (options?.price === "free") {
    withStats = withStats.filter((event) => event.isFree);
  } else if (options?.price === "under10k") {
    withStats = withStats.filter((event) => event.minPriceKzt < 10_000);
  } else if (options?.price === "over10k") {
    withStats = withStats.filter((event) => event.minPriceKzt >= 10_000);
  }

  if (options?.availability === "available") {
    withStats = withStats.filter((event) => !event.isSoldOut && event.percentSold < 90);
  } else if (options?.availability === "almostFull") {
    withStats = withStats.filter((event) => !event.isSoldOut && event.percentSold >= 90);
  }

  if (options?.sort === "price") {
    withStats.sort((a, b) => a.minPriceKzt - b.minPriceKzt);
  } else if (options?.sort === "popularity") {
    withStats.sort((a, b) => b.percentSold - a.percentSold);
  }

  return withStats;
}

/** Date buckets are evaluated in Asia/Almaty, the timezone every seeded event uses. */
function dateRange(bucket: NonNullable<EventFilters["date"]>) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (bucket === "today") {
    return { gte: start, lte: end };
  }

  if (bucket === "weekend") {
    // Next Saturday 00:00 through Sunday 23:59; today counts if it is already the weekend.
    const day = now.getDay();
    const daysUntilSaturday = (6 - day + 7) % 7;
    const saturday = new Date(now);
    saturday.setDate(now.getDate() + daysUntilSaturday);
    saturday.setHours(0, 0, 0, 0);
    const sunday = new Date(saturday);
    sunday.setDate(saturday.getDate() + 1);
    sunday.setHours(23, 59, 59, 999);
    return { gte: saturday, lte: sunday };
  }

  if (bucket === "week") {
    end.setDate(end.getDate() + 7);
    return { gte: start, lte: end };
  }

  end.setMonth(end.getMonth() + 1);
  return { gte: start, lte: end };
}

export async function getPublicEventBySlug(slug: string) {
  const event = await prisma.event.findFirst({
    where: {
      slug,
      status: { in: ["PUBLISHED", "CANCELLED", "COMPLETED"] },
      visibility: { in: ["PUBLIC", "UNLISTED"] },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      category: true,
      coverImageUrl: true,
      status: true,
      startsAt: true,
      endsAt: true,
      timezone: true,
      capacity: true,
      paidSalesActive: true,
      refundPolicy: true,
      registrationOpensAt: true,
      registrationClosesAt: true,
      cancellationReason: true,
      venue: { select: { name: true, address: true, city: true, country: true } },
      organizer: {
        select: {
          name: true,
          organizerProfile: {
            select: { displayName: true, verificationStatus: true, description: true },
          },
        },
      },
      ticketTypes: ticketTypeSelect(),
    },
  });

  if (!event) return null;
  return { ...event, ...summarise(event) };
}

export async function listRelatedEvents(eventId: string, category: string | null) {
  return prisma.event.findMany({
    where: {
      ...PUBLIC_LIST_WHERE,
      id: { not: eventId },
      ...(category ? { category } : {}),
    },
    orderBy: { startsAt: "asc" },
    take: 3,
    select: {
      slug: true,
      title: true,
      category: true,
      startsAt: true,
      timezone: true,
      venue: { select: { city: true } },
      ticketTypes: {
        where: { isHidden: false },
        select: { priceKzt: true, quantity: true, sold: true, reserved: true },
      },
    },
  });
}

export async function listPublicCities() {
  const venues = await prisma.venue.findMany({
    where: { events: { some: PUBLIC_LIST_WHERE } },
    select: { city: true },
    distinct: ["city"],
    orderBy: { city: "asc" },
  });

  return venues.map((venue) => venue.city);
}

export async function listCategoryCounts() {
  const grouped = await prisma.event.groupBy({
    by: ["category"],
    where: PUBLIC_LIST_WHERE,
    _count: { _all: true },
  });

  return grouped
    .filter((row): row is typeof row & { category: string } => row.category !== null)
    .map((row) => ({ category: row.category, count: row._count._all }))
    .sort((a, b) => b.count - a.count);
}

type SummarisableEvent = {
  ticketTypes: { priceKzt: number; quantity: number; sold: number; reserved: number }[];
};

/**
 * Capacity figures come from the ticket-type counters, which are the authoritative
 * source per docs/data-model.md — never from counting ticket rows.
 */
function summarise(event: SummarisableEvent) {
  const totalQuantity = event.ticketTypes.reduce((sum, t) => sum + t.quantity, 0);
  const totalSold = event.ticketTypes.reduce((sum, t) => sum + t.sold, 0);
  const reserved = event.ticketTypes.reduce((sum, t) => sum + t.reserved, 0);
  const prices = event.ticketTypes.map((t) => t.priceKzt);

  return {
    totalQuantity,
    totalSold,
    remaining: Math.max(0, totalQuantity - totalSold - reserved),
    percentSold: totalQuantity === 0 ? 0 : Math.round((totalSold / totalQuantity) * 100),
    minPriceKzt: prices.length ? Math.min(...prices) : 0,
    isFree: prices.length > 0 && prices.every((p) => p === 0),
    isSoldOut: totalQuantity > 0 && totalSold + reserved >= totalQuantity,
  };
}
