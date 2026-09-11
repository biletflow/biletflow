import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // SRS 7: Kazakh and Russian are the primary customer-facing locales, English additional.
  locales: ["ru", "kk", "en"],
  defaultLocale: "ru",
});

export type Locale = (typeof routing.locales)[number];

export const localeLabels: Record<Locale, string> = {
  ru: "RU",
  kk: "KZ",
  en: "EN",
};
