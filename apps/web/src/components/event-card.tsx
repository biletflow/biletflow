import { CalendarDays, MapPin } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { categoryGradient, formatEventDateTime, formatKzt } from "@/lib/format";
import { labelOf } from "@/lib/labels";

import type { EventListItem } from "@/lib/events";

export async function EventCard({ event }: { event: EventListItem }) {
  const locale = await getLocale();
  const t = await getTranslations("common");
  const tEvent = await getTranslations("event");
  const tCity = await getTranslations("cities");
  const tCategory = await getTranslations("categories");

  const price = event.isFree
    ? tEvent("freeTicket")
    : formatKzt(event.minPriceKzt, locale);

  return (
    <Link
      href={`/events/${event.slug}`}
      className="group border-ink-300 focus-visible:ring-brand block overflow-hidden rounded-xl border bg-white transition-shadow hover:shadow-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <div
        className={`relative h-44 bg-gradient-to-br ${categoryGradient(event.category)}`}
      >
        {event.category ? (
          <Badge className="text-brand absolute top-3 left-3 bg-white hover:bg-white">
            {labelOf(tCategory, event.category)}
          </Badge>
        ) : null}
        <span className="text-ink-900 absolute top-3 right-3 rounded-md bg-white px-2 py-1 text-sm font-bold">
          {price}
        </span>
      </div>

      <div className="p-4">
        <h3 className="text-ink-900 group-hover:text-brand line-clamp-2 text-base font-bold transition-colors">
          {event.title}
        </h3>

        <p className="text-ink-600 mt-2 flex items-center gap-1.5 text-sm">
          <CalendarDays className="size-4 shrink-0" aria-hidden />
          {formatEventDateTime(event.startsAt, locale, event.timezone)}
        </p>
        <p className="text-ink-600 mt-1 flex items-center gap-1.5 text-sm">
          <MapPin className="size-4 shrink-0" aria-hidden />
          <span className="truncate">
            {event.venue
              ? `${event.venue.name}, ${labelOf(tCity, event.venue.city)}`
              : "—"}
          </span>
        </p>

        {event.totalQuantity > 0 ? (
          <div className="mt-4">
            <div
              className="bg-ink-300 h-1.5 overflow-hidden rounded-full"
              role="progressbar"
              aria-valuenow={event.percentSold}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t("percentSold", { percent: event.percentSold })}
            >
              <div
                className="bg-brand h-full rounded-full"
                style={{ width: `${event.percentSold}%` }}
              />
            </div>
            <p className="text-ink-500 mt-1.5 text-right text-xs">
              {t("percentSold", { percent: event.percentSold })}
            </p>
          </div>
        ) : null}
      </div>
    </Link>
  );
}
