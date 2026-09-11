"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function EventFilters({ priceLabels }: { priceLabels: [string, string] }) {
  const t = useTranslations("events");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const groups = [
    {
      param: "price",
      legend: t("priceRange"),
      options: [
        { value: "", label: t("allPrices") },
        { value: "free", label: t("free") },
        { value: "under10k", label: t("under", { amount: priceLabels[0] }) },
        { value: "over10k", label: t("over", { amount: priceLabels[1] }) },
      ],
    },
    {
      param: "date",
      legend: t("date"),
      options: [
        { value: "", label: t("anyDate") },
        { value: "today", label: t("today") },
        { value: "weekend", label: t("thisWeekend") },
        { value: "week", label: t("thisWeek") },
        { value: "month", label: t("thisMonth") },
      ],
    },
    {
      param: "availability",
      legend: t("status"),
      options: [
        { value: "", label: t("anyAvailability") },
        { value: "available", label: t("available") },
        { value: "almostFull", label: t("almostFull") },
      ],
    },
  ];

  function setParam(param: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(param, value);
    } else {
      next.delete(param);
    }
    startTransition(() => {
      router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
    });
  }

  const hasFilters = ["price", "date", "availability", "category", "city", "q"].some(
    (param) => searchParams.get(param),
  );

  return (
    <aside
      className={cn(
        "border-ink-300 h-fit rounded-xl border bg-white p-5",
        isPending && "opacity-60",
      )}
      aria-busy={isPending}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-ink-900 text-base font-bold">{t("filters")}</h2>
        {hasFilters ? (
          <button
            type="button"
            onClick={() => startTransition(() => router.replace(pathname))}
            className="text-brand hover:text-brand-dark text-xs font-semibold"
          >
            {t("clearFilters")}
          </button>
        ) : null}
      </div>

      {groups.map((group) => {
        const current = searchParams.get(group.param) ?? "";
        return (
          <fieldset key={group.param} className="mt-6">
            <legend className="text-ink-500 text-xs font-bold tracking-wider uppercase">
              {group.legend}
            </legend>
            <div className="mt-3 space-y-2.5">
              {group.options.map((option) => (
                <label
                  key={option.value || "all"}
                  className="text-ink-700 hover:text-ink-900 flex cursor-pointer items-center gap-2.5 text-sm"
                >
                  <input
                    type="radio"
                    name={group.param}
                    checked={current === option.value}
                    onChange={() => setParam(group.param, option.value)}
                    className="accent-brand size-4"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}
    </aside>
  );
}
