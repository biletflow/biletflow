"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { usePathname, useRouter } from "@/i18n/navigation";
import { localeLabels, routing, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("common");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchTo(next: Locale) {
    if (next === locale) return;
    const query = Object.fromEntries(searchParams.entries());
    startTransition(() => {
      router.replace(
        { pathname, query: Object.keys(query).length ? query : undefined },
        { locale: next },
      );
    });
  }

  return (
    <div
      className="bg-ink-200 flex items-center rounded-lg p-0.5"
      role="group"
      aria-label={t("language")}
    >
      {routing.locales.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => switchTo(option)}
          disabled={isPending}
          aria-current={option === locale ? "true" : undefined}
          className={cn(
            "rounded-md px-2 py-1 text-xs font-bold transition-colors",
            option === locale
              ? "bg-brand text-white"
              : "text-ink-600 hover:text-ink-900",
          )}
        >
          {localeLabels[option]}
        </button>
      ))}
    </div>
  );
}
