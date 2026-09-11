"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { usePathname, useRouter } from "@/i18n/navigation";
import { labelOf } from "@/lib/labels";
import { cn } from "@/lib/utils";

export function EventToolbar({
  categories,
  cities,
}: {
  categories: string[];
  cities: string[];
}) {
  const t = useTranslations("events");
  const tCity = useTranslations("cities");
  const tCategory = useTranslations("categories");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  function apply(changes: Record<string, string>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
    }
    startTransition(() => {
      router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
    });
  }

  const activeCategory = searchParams.get("category") ?? "";

  return (
    <div className="border-ink-300 border-b bg-white">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <form
          onSubmit={(formEvent) => {
            formEvent.preventDefault();
            apply({ q: query.trim() });
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <div className="border-ink-300 focus-within:border-brand flex flex-1 items-center gap-2 rounded-lg border px-3">
            <Search className="text-ink-500 size-4 shrink-0" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(changeEvent) => setQuery(changeEvent.target.value)}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              className="text-ink-900 placeholder:text-ink-500 h-10 w-full bg-transparent text-sm outline-none"
            />
          </div>

          <select
            value={searchParams.get("city") ?? ""}
            onChange={(changeEvent) => apply({ city: changeEvent.target.value })}
            aria-label={t("allCities")}
            className="border-ink-300 text-ink-800 h-10 rounded-lg border px-3 text-sm"
          >
            <option value="">{t("allCities")}</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {labelOf(tCity, city)}
              </option>
            ))}
          </select>

          <select
            value={searchParams.get("sort") ?? "date"}
            onChange={(changeEvent) => apply({ sort: changeEvent.target.value })}
            aria-label={t("sortBy")}
            className="border-ink-300 text-ink-800 h-10 rounded-lg border px-3 text-sm"
          >
            <option value="date">{t("sortDate")}</option>
            <option value="price">{t("sortPrice")}</option>
            <option value="popularity">{t("sortPopular")}</option>
          </select>
        </form>

        <div className="mt-3 flex flex-wrap gap-2">
          <CategoryChip
            label={t("allCategories")}
            active={!activeCategory}
            onClick={() => apply({ category: "" })}
          />
          {categories.map((category) => (
            <CategoryChip
              key={category}
              label={labelOf(tCategory, category)}
              active={activeCategory === category}
              onClick={() => apply({ category })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-brand text-white" : "bg-ink-200 text-ink-700 hover:bg-ink-300",
      )}
    >
      {label}
    </button>
  );
}
