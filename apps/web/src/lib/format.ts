/**
 * Display formatting. The design renders amounts with a leading ₸ and locale-aware
 * grouping (₸8,500 in English, ₸8 500 in Russian and Kazakh).
 */

export function formatKzt(amountKzt: number, locale: string): string {
  if (amountKzt === 0) return "₸0";
  return `₸${new Intl.NumberFormat(locale).format(amountKzt)}`;
}

export function formatEventDate(
  date: Date,
  locale: string,
  timeZone = "Asia/Almaty",
): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(date);
}

export function formatEventTime(
  date: Date,
  locale: string,
  timeZone = "Asia/Almaty",
): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(date);
}

export function formatEventDateTime(
  date: Date,
  locale: string,
  timeZone = "Asia/Almaty",
): string {
  return `${formatEventDate(date, locale, timeZone)} · ${formatEventTime(date, locale, timeZone)}`;
}

/** Deterministic gradient per category, used until organizers upload cover images. */
export function categoryGradient(category: string | null): string {
  const gradients = [
    "from-violet-600 via-purple-600 to-indigo-700",
    "from-sky-500 via-blue-600 to-indigo-700",
    "from-emerald-500 via-teal-600 to-cyan-700",
    "from-amber-500 via-orange-600 to-rose-600",
    "from-fuchsia-500 via-pink-600 to-rose-600",
    "from-slate-600 via-slate-700 to-zinc-800",
  ];

  if (!category) return gradients[0]!;

  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = (hash * 31 + category.charCodeAt(i)) % 1_000_003;
  }
  return gradients[hash % gradients.length]!;
}
