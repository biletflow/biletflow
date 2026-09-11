import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { BrandMark } from "@/components/brand-mark";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export async function SiteHeader() {
  const t = await getTranslations("nav");

  return (
    <header className="border-ink-300 bg-background/95 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label={t("home")}>
          <BrandMark />
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <Link
            href="/events"
            className="text-ink-700 hover:text-brand text-sm font-medium transition-colors"
          >
            {t("browse")}
          </Link>
          <Link
            href="/events"
            className="text-ink-700 hover:text-brand text-sm font-medium transition-colors"
          >
            {t("categories")}
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <Suspense>
            <LocaleSwitcher />
          </Suspense>
          <Link
            href="/sign-in"
            className="text-ink-800 hover:text-brand hidden text-sm font-semibold transition-colors sm:block"
          >
            {t("signIn")}
          </Link>
          <Link
            href="/sign-up"
            className={cn(buttonVariants(), "h-9 px-4 text-sm font-semibold")}
          >
            {t("getStarted")}
          </Link>
        </div>
      </div>
    </header>
  );
}
