import type { EventFilters } from "@/lib/events";
import {
  getPublicEventBySlug,
  listCategoryCounts,
  listPublicCities,
  listPublicEvents,
} from "@/lib/events";

function presentTicketType(type: {
  id: string;
  name: string;
  description: string | null;
  priceKzt: number;
  quantity: number;
  sold: number;
  reserved: number;
  maxPerOrder: number;
  salesStartAt: Date | null;
  salesEndAt: Date | null;
}) {
  return {
    id: type.id,
    name: type.name,
    description: type.description,
    priceKzt: type.priceKzt,
    quantity: type.quantity,
    sold: type.sold,
    reserved: type.reserved,
    maxPerOrder: type.maxPerOrder,
    available: Math.max(0, type.quantity - type.sold - type.reserved),
    salesStartAt: type.salesStartAt?.toISOString() ?? null,
    salesEndAt: type.salesEndAt?.toISOString() ?? null,
  };
}

export function presentPublicEventListItem(
  event: Awaited<ReturnType<typeof listPublicEvents>>[number],
) {
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.description,
    category: event.category,
    coverImageUrl: event.coverImageUrl,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    timezone: event.timezone,
    capacity: event.capacity,
    paidSalesActive: event.paidSalesActive,
    venue: event.venue,
    totalQuantity: event.totalQuantity,
    totalSold: event.totalSold,
    remaining: event.remaining,
    percentSold: event.percentSold,
    minPriceKzt: event.minPriceKzt,
    isFree: event.isFree,
    isSoldOut: event.isSoldOut,
    ticketTypes: event.ticketTypes.map(presentTicketType),
  };
}

export function presentPublicEventDetail(
  event: NonNullable<Awaited<ReturnType<typeof getPublicEventBySlug>>>,
) {
  return {
    ...presentPublicEventListItem(event),
    status: event.status,
    refundPolicy: event.refundPolicy,
    registrationOpensAt: event.registrationOpensAt?.toISOString() ?? null,
    registrationClosesAt: event.registrationClosesAt?.toISOString() ?? null,
    cancellationReason: event.cancellationReason,
    venue: event.venue,
    organizer: {
      name: event.organizer.organizerProfile?.displayName ?? event.organizer.name,
      verificationStatus:
        event.organizer.organizerProfile?.verificationStatus ?? null,
      description: event.organizer.organizerProfile?.description ?? null,
    },
  };
}

export function parseEventListFilters(url: URL): EventFilters {
  const category = url.searchParams.get("category")?.trim() || undefined;
  const city = url.searchParams.get("city")?.trim() || undefined;
  const query = url.searchParams.get("query")?.trim() || undefined;
  const price = url.searchParams.get("price");
  const date = url.searchParams.get("date");
  const availability = url.searchParams.get("availability");
  const sort = url.searchParams.get("sort");
  const takeRaw = url.searchParams.get("take");
  const take = takeRaw ? Number.parseInt(takeRaw, 10) : undefined;

  return {
    category,
    city,
    query,
    price:
      price === "free" || price === "under10k" || price === "over10k"
        ? price
        : undefined,
    date:
      date === "today" ||
      date === "weekend" ||
      date === "week" ||
      date === "month"
        ? date
        : undefined,
    availability:
      availability === "available" || availability === "almostFull"
        ? availability
        : undefined,
    sort:
      sort === "date" || sort === "price" || sort === "popularity"
        ? sort
        : undefined,
    take: Number.isFinite(take) && take && take > 0 ? Math.min(take, 100) : undefined,
  };
}

export async function listPublicEventsPayload(filters: EventFilters) {
  const [events, cities, categories] = await Promise.all([
    listPublicEvents(filters),
    listPublicCities(),
    listCategoryCounts(),
  ]);
  return {
    events: events.map(presentPublicEventListItem),
    cities,
    categories,
  };
}

export async function getPublicEventPayload(slug: string) {
  const event = await getPublicEventBySlug(slug);
  if (!event) return null;
  return { event: presentPublicEventDetail(event) };
}
