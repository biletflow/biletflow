"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { labelOf } from "@/lib/labels";

export function HeroSearch({ cities }: { cities: string[] }) {
  const t = useTranslations("home");
  const tCity = useTranslations("cities");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");

  function submit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    const search = new URLSearchParams();
    if (query.trim()) search.set("q", query.trim());
    if (city) search.set("city", city);
    const suffix = search.size ? `?${search}` : "";
    router.push(`/events${suffix}`);
  }

  return (
    <form
      onSubmit={submit}
      className="flex w-full max-w-xl flex-col gap-2 rounded-xl bg-white p-2 shadow-xl sm:flex-row sm:items-center"
    >
      <div className="flex flex-1 items-center gap-2 px-2">
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

      <div className="border-ink-300 hidden h-6 border-l sm:block" />

      <select
        value={city}
        onChange={(changeEvent) => setCity(changeEvent.target.value)}
        aria-label={t("allCities")}
        className="text-ink-800 h-10 rounded-md bg-transparent px-2 text-sm outline-none"
      >
        <option value="">{t("allCities")}</option>
        {cities.map((option) => (
          <option key={option} value={option}>
            {labelOf(tCity, option)}
          </option>
        ))}
      </select>

      <Button type="submit" className="h-10 shrink-0">
        {t("findEvents")}
      </Button>
    </form>
  );
}
