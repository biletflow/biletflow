import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect as hardRedirect } from "next/navigation";

import { SupportCaseForm } from "@/components/support-case-form";
import { Link } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth-guard";
import { listSupportCases, presentSupportCase } from "@/lib/support";

export default async function SupportPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    eventId?: string;
    orderId?: string;
    ticketId?: string;
  }>;
}) {
  const { locale } = await params;
  const links = await searchParams;
  setRequestLocale(locale);

  const user = await getSessionUser();
  if (!user) {
    hardRedirect(`/${locale}/sign-in?next=${encodeURIComponent("/support")}`);
  }

  const t = await getTranslations("support");
  const cases = (await listSupportCases(user)).map(presentSupportCase);

  return (
    <div className="bg-ink-100 min-h-[70vh]">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="font-display text-ink-900 text-3xl font-extrabold tracking-tight">
          {t("title")}
        </h1>
        <p className="text-ink-600 mt-2 text-sm">{t("lead")}</p>

        {cases.length === 0 ? (
          <div className="border-ink-300 mt-8 rounded-xl border border-dashed bg-white p-12 text-center">
            <p className="text-ink-900 font-bold">{t("empty")}</p>
            <p className="text-ink-600 mt-1 text-sm">{t("emptyBody")}</p>
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {cases.map((supportCase) => (
              <li key={supportCase.id}>
                <Link
                  href={`/support/${supportCase.id}`}
                  className="border-ink-300 block rounded-xl border bg-white p-5 transition-colors hover:border-brand"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-ink-500 text-xs font-bold tracking-wider uppercase">
                        {supportCase.reference}
                      </p>
                      <p className="text-ink-900 mt-1 font-bold">
                        {supportCase.subject}
                      </p>
                      <p className="text-ink-600 mt-1 text-sm">
                        {t(`categories.${supportCase.category}`)}
                      </p>
                    </div>
                    <span className="text-brand text-xs font-bold tracking-wider uppercase">
                      {t(`status.${supportCase.status}`)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <SupportCaseForm
          eventId={links.eventId}
          orderId={links.orderId}
          ticketId={links.ticketId}
        />
      </div>
    </div>
  );
}
