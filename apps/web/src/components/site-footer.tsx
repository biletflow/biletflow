import { getTranslations } from "next-intl/server";

import { BrandMark } from "@/components/brand-mark";
import { Link } from "@/i18n/navigation";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  const nav = await getTranslations("nav");
  const common = await getTranslations("common");

  return (
    <footer className="bg-ink-900 mt-20 text-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <BrandMark onDark />
            <p className="text-ink-400 mt-4 max-w-xs text-sm leading-relaxed">
              {t("tagline")}
            </p>
          </div>
          <Link
            href="/events"
            className="text-ink-400 text-sm transition-colors hover:text-white"
          >
            {nav("browse")}
          </Link>
        </div>

        <div className="border-warning/40 bg-warning/10 mt-12 rounded-lg border px-4 py-3">
          <p className="text-warning text-xs font-medium">{common("simulatedPayments")}</p>
        </div>

        <p className="text-ink-500 mt-6 text-xs">
          {t("rights", { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}
