import { notFound, redirect as hardRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { CheckoutForm } from "@/components/checkout-form";
import { Link } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth-guard";
import { getPublicEventBySlug } from "@/lib/events";

function parseQuantity(value: string | undefined, max: number) {
  const parsed = Number.parseInt(value ?? "1", 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(max, Math.max(1, parsed));
}

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ ticketTypeId?: string; quantity?: string }>;
}) {
  const { locale, slug } = await params;
  const query = await searchParams;
  setRequestLocale(locale);

  const user = await getSessionUser();
  const next = `/events/${slug}/checkout?ticketTypeId=${encodeURIComponent(query.ticketTypeId ?? "")}&quantity=${encodeURIComponent(query.quantity ?? "1")}`;
  if (!user) {
    hardRedirect(
      `/${locale}/sign-in?next=${encodeURIComponent(next)}`,
    );
  }

  const event = await getPublicEventBySlug(slug);
  if (!event) notFound();

  const t = await getTranslations("event");
  const tCheckout = await getTranslations("checkout");
  const ticketType = event.ticketTypes.find((type) => type.id === query.ticketTypeId);
  if (!ticketType) notFound();

  const isCancelled = event.status === "CANCELLED";
  const paidSalesBlocked = ticketType.priceKzt > 0 && !event.paidSalesActive;
  const available = Math.max(0, ticketType.quantity - ticketType.sold - ticketType.reserved);
  const maxQuantity = Math.min(available, ticketType.maxPerOrder ?? 10);

  if (isCancelled || paidSalesBlocked || maxQuantity < 1) {
    return (
      <div className="bg-ink-100 min-h-[70vh] px-4 py-16">
        <div className="border-ink-300 mx-auto max-w-lg rounded-xl border bg-white p-6 text-center">
          <h1 className="font-display text-ink-900 text-2xl font-extrabold tracking-tight">
            {tCheckout("title")}
          </h1>
          <p className="text-ink-600 mt-3 text-sm">
            {isCancelled
              ? t("cancelled")
              : paidSalesBlocked
                ? t("paidSalesInactive")
                : t("soldOut")}
          </p>
          <Link
            href={`/events/${slug}`}
            className="text-brand mt-6 inline-block text-sm font-semibold"
          >
            {tCheckout("back")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-ink-100 min-h-[70vh] px-4 py-12">
      <CheckoutForm
        eventId={event.id}
        eventSlug={event.slug}
        eventTitle={event.title}
        locale={locale}
        ticketType={{
          id: ticketType.id,
          name: ticketType.name,
          priceKzt: ticketType.priceKzt,
          available,
          maxPerOrder: ticketType.maxPerOrder,
        }}
        initialQuantity={parseQuantity(query.quantity, maxQuantity)}
        attendee={{
          fullName: user.name?.trim() || "",
          email: user.email,
        }}
      />
    </div>
  );
}
