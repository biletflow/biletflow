import { Suspense } from "react";
import { Menu } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { BrandMark } from "@/components/brand-mark";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SignedInNav } from "@/components/signed-in-nav";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getSessionUser, roleOf } from "@/lib/auth-guard";
import { dashboardPathForRole } from "@/lib/auth-home";
import { cn } from "@/lib/utils";

export async function SiteHeader() {
  const t = await getTranslations("nav");
  const user = await getSessionUser();
  const role = roleOf(user);
  const dashboardHref = dashboardPathForRole(role);
  const displayName = user?.name?.trim() || user?.email || "";
  const dashboardLabel =
    role === "PLATFORM_ADMIN"
      ? t("admin")
      : role === "ORGANIZER"
        ? t("organizer")
        : undefined;

  function accountLinks(compact = false) {
    if (user) {
      return (
        <SignedInNav
          name={displayName}
          dashboardHref={dashboardHref}
          dashboardLabel={dashboardLabel}
          compact={compact}
        />
      );
    }
    return (
      <>
        <Link
          href="/sign-in"
          className="text-ink-800 hover:text-brand text-sm font-semibold transition-colors"
        >
          {t("signIn")}
        </Link>
        <Link
          href="/sign-up"
          className={cn(buttonVariants(), "h-9 px-4 text-sm font-semibold")}
        >
          {t("getStarted")}
        </Link>
      </>
    );
  }

  return (
    <header className="border-ink-300 bg-background/95 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-6 sm:px-6 lg:px-8">
        <Link href="/" aria-label={t("home")}>
          <BrandMark />
        </Link>

        <nav className="hidden items-center gap-6 xl:flex">
          <Link
            href="/events"
            className="text-ink-700 hover:text-brand text-sm font-medium transition-colors"
          >
            {t("browse")}
          </Link>
          <Link
            href="/#categories"
            className="text-ink-700 hover:text-brand text-sm font-medium transition-colors"
          >
            {t("categories")}
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <Suspense>
            <LocaleSwitcher />
          </Suspense>
          <div className="hidden items-center gap-3 xl:flex">
            {accountLinks()}
          </div>
          <details className="xl:hidden">
            <summary className="text-ink-900 hover:bg-brand-tint flex size-11 cursor-pointer list-none items-center justify-center rounded-lg [&::-webkit-details-marker]:hidden">
              <Menu className="size-5" aria-hidden />
              <span className="sr-only">{t("menu")}</span>
            </summary>
            <nav
              aria-label={t("menu")}
              className="border-ink-300 absolute top-full right-4 left-4 flex flex-col items-start gap-4 rounded-xl border bg-white p-4 shadow-lg sm:left-auto sm:min-w-52"
            >
              <Link
                href="/events"
                className="text-ink-800 hover:text-brand text-sm font-semibold"
              >
                {t("browse")}
              </Link>
              <Link
                href="/#categories"
                className="text-ink-800 hover:text-brand text-sm font-semibold"
              >
                {t("categories")}
              </Link>
              {accountLinks(true)}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
