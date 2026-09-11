import { ArrowRight, BarChart3, LifeBuoy, QrCode, Zap } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { EventCard } from "@/components/event-card";
import { HeroSearch } from "@/components/hero-search";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { listCategoryCounts, listPublicCities, listPublicEvents } from "@/lib/events";
import { labelOf } from "@/lib/labels";
import { cn } from "@/lib/utils";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("home");
  const tCategory = await getTranslations("categories");
  const [events, categories, cities] = await Promise.all([
    listPublicEvents({ take: 6 }),
    listCategoryCounts(),
    listPublicCities(),
  ]);

  const features = [
    { icon: Zap, title: t("features.bookingTitle"), body: t("features.bookingBody") },
    { icon: QrCode, title: t("features.qrTitle"), body: t("features.qrBody") },
    {
      icon: BarChart3,
      title: t("features.organizerTitle"),
      body: t("features.organizerBody"),
    },
    {
      icon: LifeBuoy,
      title: t("features.supportTitle"),
      body: t("features.supportBody"),
    },
  ];

  return (
    <>
      <section className="bg-brand relative overflow-hidden">
        <div
          className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-white/5"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute bottom-10 left-10 size-24 rounded-full bg-white/5"
          aria-hidden
        />

        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-bold tracking-wider text-white uppercase">
            {t("eyebrow")}
          </span>

          <h1 className="font-display mt-6 max-w-2xl text-4xl leading-[1.05] font-extrabold tracking-tight text-white sm:text-6xl">
            {t("headline")}{" "}
            <span className="text-brand-tint">{t("headlineAccent")}</span>
          </h1>

          <p className="mt-5 max-w-lg text-base leading-relaxed text-white/80">
            {t("subhead")}
          </p>

          <div className="mt-8">
            <HeroSearch cities={cities} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-brand text-xs font-bold tracking-wider uppercase">
              {t("featuredEyebrow")}
            </p>
            <h2 className="font-display text-ink-900 mt-1 text-3xl font-extrabold tracking-tight">
              {t("featured")}
            </h2>
          </div>
          <Link
            href="/events"
            className="text-brand hover:text-brand-dark hidden items-center gap-1 text-sm font-semibold sm:flex"
          >
            {t("viewAll")}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </section>

      {categories.length > 0 ? (
        <section className="bg-ink-100 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-ink-900 text-3xl font-extrabold tracking-tight">
              {t("categoriesHeading")}
            </h2>

            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {categories.map(({ category, count }) => (
                <Link
                  key={category}
                  href={{ pathname: "/events", query: { category } }}
                  className="border-ink-300 hover:border-brand group rounded-xl border bg-white p-5 transition-colors"
                >
                  <p className="text-ink-900 group-hover:text-brand font-bold transition-colors">
                    {labelOf(tCategory, category)}
                  </p>
                  <p className="text-ink-500 mt-1 text-sm">{count}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div key={feature.title}>
              <span className="bg-brand-tint text-brand flex size-11 items-center justify-center rounded-xl">
                <feature.icon className="size-5" aria-hidden />
              </span>
              <h3 className="text-ink-900 mt-4 text-base font-bold">{feature.title}</h3>
              <p className="text-ink-600 mt-1.5 text-sm leading-relaxed">
                {feature.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className="bg-brand-dark relative overflow-hidden rounded-2xl px-8 py-14 text-center">
          <div
            className="pointer-events-none absolute -top-16 -left-16 size-64 rounded-full bg-white/5"
            aria-hidden
          />
          <h2 className="font-display relative text-3xl font-extrabold tracking-tight text-white">
            {t("organizerHeading")}
          </h2>
          <p className="relative mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/80">
            {t("organizerBody")}
          </p>
          <Link
            href="/sign-up"
            className={cn(
              buttonVariants({ variant: "secondary" }),
              "relative mt-7 h-11 px-6 text-sm font-bold",
            )}
          >
            {t("organizerCta")}
          </Link>
        </div>
      </section>
    </>
  );
}
