import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect as hardRedirect } from "next/navigation";

import { TicketQr } from "@/components/ticket-qr";
import { Link } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth-guard";
import { formatEventDateTime } from "@/lib/format";
import { labelOf } from "@/lib/labels";
import { listTicketsForUser } from "@/lib/tickets";

export default async function TicketsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getSessionUser();
  if (!user) {
    hardRedirect(`/${locale}/sign-in?next=${encodeURIComponent("/tickets")}`);
  }

  const t = await getTranslations("tickets");
  const tType = await getTranslations("ticketTypes");
  const tickets = await listTicketsForUser(user.id);

  return (
    <div className="bg-ink-100 min-h-[70vh]">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="font-display text-ink-900 text-3xl font-extrabold tracking-tight">
          {t("title")}
        </h1>
        {tickets.length === 0 ? (
          <div className="border-ink-300 mt-8 rounded-xl border border-dashed bg-white p-12 text-center">
            <p className="text-ink-900 font-bold">{t("empty")}</p>
            <p className="text-ink-600 mt-1 text-sm">{t("emptyBody")}</p>
            <Link
              href="/events"
              className="text-brand mt-4 inline-block text-sm font-semibold"
            >
              {t("browse")}
            </Link>
          </div>
        ) : (
          <ul className="mt-8 space-y-5">
            {tickets.map((ticket) => (
              <li
                key={ticket.id}
                className="border-ink-300 flex flex-col gap-5 rounded-xl border bg-white p-5 sm:flex-row sm:items-center"
              >
                <TicketQr
                  src={`/api/tickets/${ticket.id}/qr.png`}
                  alt={t("qrAlt", { event: ticket.event.title })}
                  show={ticket.status === "VALID" || ticket.status === "CHECKED_IN"}
                />
                <div className="min-w-0">
                  <Link
                    href={`/events/${ticket.event.slug}`}
                    className="text-ink-900 hover:text-brand text-lg font-bold"
                  >
                    {ticket.event.title}
                  </Link>
                  <p className="text-ink-600 mt-1 text-sm">
                    {formatEventDateTime(
                      ticket.event.startsAt,
                      locale,
                      ticket.event.timezone,
                    )}
                  </p>
                  <p className="text-ink-800 mt-3 text-sm">
                    {labelOf(tType, ticket.ticketType.name)}
                  </p>
                  <p className="text-ink-600 text-sm">
                    {t("holder")}: {ticket.attendee.fullName}
                  </p>
                  <p
                    className={`mt-2 text-xs font-bold tracking-wider uppercase ${
                      ticket.status === "VALID"
                        ? "text-brand"
                        : ticket.status === "CHECKED_IN"
                          ? "text-ink-700"
                          : "text-error"
                    }`}
                  >
                    {t(`status.${ticket.status}`)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
