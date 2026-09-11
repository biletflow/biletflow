import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { EventCard } from "@/components/event-card";
import { EventFilters } from "@/components/event-filters";
import { EventToolbar } from "@/components/event-toolbar";
import {
  listCategoryCounts,
  listPublicCities,
  listPublicEvents,
  type EventFilters as Filters,
} from "@/lib/events";
import { formatKzt } from "@/lib/format";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function oneOf<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}

export default async function EventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = await searchParams;
  const t = await getTranslations("events");

  const filters: Filters = {
    query: single(query.q),
    city: single(query.city),
    category: single(query.category),
    price: oneOf(single(query.price), ["free", "under10k", "over10k"] as const),
    date: oneOf(single(query.date), ["today", "weekend", "week", "month"] as const),
    availability: oneOf(single(query.availability), ["available", "almostFull"] as const),
    sort: oneOf(single(query.sort), ["date", "price", "popularity"] as const),
  };

  const [events, categories, cities] = await Promise.all([
    listPublicEvents(filters),
    listCategoryCounts(),
    listPublicCities(),
  ]);

  return (
    <>
      <Suspense>
        <EventToolbar
          categories={categories.map((entry) => entry.category)}
          cities={cities}
        />
      </Suspense>

      <div className="bg-ink-100 min-h-[60vh]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[260px_1fr] lg:px-8">
          <Suspense>
            <EventFilters
              priceLabels={[formatKzt(10_000, locale), formatKzt(10_000, locale)]}
            />
          </Suspense>

          <div>
            <p className="text-ink-700 text-sm font-semibold">
              {t("resultCount", { count: events.length })}
            </p>

            {events.length === 0 ? (
              <div className="border-ink-300 mt-4 rounded-xl border border-dashed bg-white p-12 text-center">
                <p className="text-ink-900 font-bold">{t("emptyTitle")}</p>
                <p className="text-ink-600 mt-1 text-sm">{t("emptyBody")}</p>
              </div>
            ) : (
              <div className="mt-4 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {events.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
