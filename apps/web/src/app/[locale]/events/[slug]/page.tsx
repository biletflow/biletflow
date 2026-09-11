import { BadgeCheck, CalendarDays, MapPin, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { TicketSelector, type SelectableTicketType } from "@/components/ticket-selector";
import { Link } from "@/i18n/navigation";
import { getPublicEventBySlug, listRelatedEvents } from "@/lib/events";
import {
  categoryGradient,
  formatEventDate,
  formatEventDateTime,
  formatKzt,
} from "@/lib/format";
import { labelOf } from "@/lib/labels";

import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getPublicEventBySlug(slug);
  if (!event) return {};

  return {
    title: `${event.title} — BiletFlow`,
    description: event.description?.slice(0, 160),
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const event = await getPublicEventBySlug(slug);
  if (!event) notFound();

  const t = await getTranslations("event");
  const tCity = await getTranslations("cities");
  const tCategory = await getTranslations("categories");
  const tCountry = await getTranslations("countries");
  const related = await listRelatedEvents(event.id, event.category);

  const isCancelled = event.status === "CANCELLED";
  const hasPaidTickets = event.ticketTypes.some((type) => type.priceKzt > 0);
  // SRS 4.4: paid sales require an activated event; free tickets never do.
  const paidSalesBlocked = hasPaidTickets && !event.paidSalesActive;

  const ticketTypes: SelectableTicketType[] = event.ticketTypes.map((type) => ({
    id: type.id,
    name: type.name,
    description: type.description,
    priceKzt: type.priceKzt,
    available: Math.max(0, type.quantity - type.sold - type.reserved),
    maxPerOrder: type.maxPerOrder,
    salesStartAt: type.salesStartAt?.toISOString() ?? null,
    salesEndAt: type.salesEndAt?.toISOString() ?? null,
  }));

  const organizerName =
    event.organizer.organizerProfile?.displayName ?? event.organizer.name;
  const isVerified = event.organizer.organizerProfile?.verificationStatus === "APPROVED";

  return (
    <>
      <div
        className={`relative bg-gradient-to-br ${categoryGradient(event.category)} h-64 sm:h-80`}
      >
        <div className="absolute inset-0 bg-black/25" aria-hidden />
        <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-end px-4 pb-8 sm:px-6 lg:px-8">
          {event.category ? (
            <span className="text-brand w-fit rounded-md bg-white px-2.5 py-1 text-xs font-bold">
              {labelOf(tCategory, event.category)}
            </span>
          ) : null}
          <h1 className="font-display mt-3 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            {event.title}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/90">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden />
              {formatEventDateTime(event.startsAt, locale, event.timezone)}
            </span>
            {event.venue ? (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden />
                {event.venue.name}, {labelOf(tCity, event.venue.city)}
              </span>
            ) : null}
            {event.capacity ? (
              <span className="flex items-center gap-1.5">
                <Users className="size-4" aria-hidden />
                {t("capacity", { count: event.capacity })}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="bg-ink-100">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-8">
          <div className="space-y-6">
            {isCancelled ? (
              <div className="border-error/30 bg-error-bg rounded-xl border p-5">
                <p className="text-error font-bold">{t("cancelled")}</p>
                <p className="text-ink-700 mt-1 text-sm">
                  {event.cancellationReason ?? t("cancelledBody")}
                </p>
              </div>
            ) : null}

            <section className="border-ink-300 rounded-xl border bg-white p-6">
              <h2 className="text-ink-900 text-lg font-bold">{t("about")}</h2>
              <p className="text-ink-700 mt-3 text-sm leading-relaxed whitespace-pre-line">
                {event.description}
              </p>
            </section>

            {event.venue ? (
              <section className="border-ink-300 rounded-xl border bg-white p-6">
                <h2 className="text-ink-900 text-lg font-bold">{t("venue")}</h2>
                <div className="mt-3 flex items-start gap-3">
                  <span className="bg-brand-tint text-brand flex size-10 shrink-0 items-center justify-center rounded-lg">
                    <MapPin className="size-5" aria-hidden />
                  </span>
                  <div>
                    <p className="text-ink-900 font-semibold">{event.venue.name}</p>
                    <p className="text-ink-600 text-sm">
                      {event.venue.address}, {labelOf(tCity, event.venue.city)},{" "}
                      {labelOf(tCountry, event.venue.country)}
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="border-ink-300 rounded-xl border bg-white p-6">
              <h2 className="text-ink-900 text-lg font-bold">{t("organizer")}</h2>
              <div className="mt-3 flex items-start gap-3">
                <span className="bg-brand flex size-10 shrink-0 items-center justify-center rounded-lg text-base font-bold text-white">
                  {organizerName.charAt(0).toUpperCase()}
                </span>
                <div>
                  <p className="text-ink-900 flex items-center gap-1.5 font-semibold">
                    {organizerName}
                    {isVerified ? (
                      <BadgeCheck className="text-brand size-4" aria-hidden />
                    ) : null}
                  </p>
                  {isVerified ? (
                    <p className="text-ink-600 text-sm">{t("verifiedOrganizer")}</p>
                  ) : null}
                </div>
              </div>
            </section>

            {event.refundPolicy ? (
              <section className="border-ink-300 rounded-xl border bg-white p-6">
                <h2 className="text-ink-900 text-lg font-bold">{t("refundPolicy")}</h2>
                <p className="text-ink-600 mt-2 text-sm leading-relaxed">
                  {t(`refund.${event.refundPolicy}`)}
                </p>
              </section>
            ) : null}
          </div>

          <div>
            <TicketSelector
              ticketTypes={ticketTypes}
              disabled={isCancelled || paidSalesBlocked}
              disabledReason={
                isCancelled ? t("cancelled") : t("paidSalesInactive")
              }
            />
          </div>
        </div>

        {related.length > 0 ? (
          <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
            <h2 className="font-display text-ink-900 text-2xl font-extrabold tracking-tight">
              {t("relatedHeading")}
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {related.map((item) => {
                const prices = item.ticketTypes.map((type) => type.priceKzt);
                const from = prices.length ? Math.min(...prices) : 0;
                return (
                  <Link
                    key={item.slug}
                    href={`/events/${item.slug}`}
                    className="border-ink-300 hover:border-brand group rounded-xl border bg-white p-4 transition-colors"
                  >
                    <p className="text-ink-900 group-hover:text-brand line-clamp-2 font-semibold transition-colors">
                      {item.title}
                    </p>
                    <p className="text-ink-600 mt-1.5 text-sm">
                      {formatEventDate(item.startsAt, locale, item.timezone)} ·{" "}
                      {item.venue ? labelOf(tCity, item.venue.city) : ""}
                    </p>
                    <p className="text-brand mt-2 text-sm font-bold">
                      {from === 0 ? t("freeTicket") : formatKzt(from, locale)}
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
