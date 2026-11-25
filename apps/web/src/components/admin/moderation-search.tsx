"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Result = { id: string; label: string; kind: "events" | "users"; suspended: boolean };
type SearchResponse = {
  events: { id: string; title: string; paidSalesSuspended: boolean }[];
  users: { id: string; name: string; email: string; status: string }[];
};

const labels = {
  en: { title: "Find events and users", query: "Event title, name or email", search: "Search", results: "No matches", suspend: "Suspend", restore: "Restore", reason: "Reason for this change", error: "Moderation request failed" },
  ru: { title: "Поиск событий и пользователей", query: "Название, имя или email", search: "Поиск", results: "Ничего не найдено", suspend: "Заблокировать", restore: "Восстановить", reason: "Причина изменения", error: "Не удалось выполнить запрос" },
  kk: { title: "Іс-шаралар мен пайдаланушыларды іздеу", query: "Атауы, аты немесе email", search: "Іздеу", results: "Нәтиже табылмады", suspend: "Бұғаттау", restore: "Қалпына келтіру", reason: "Өзгерту себебі", error: "Сұрау орындалмады" },
} as const;

export default function ModerationSearch({ locale }: { locale: string }) {
  const router = useRouter();
  const t = labels[locale as keyof typeof labels] ?? labels.en;
  const [results, setResults] = useState<Result[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/admin/search?q=" + encodeURIComponent(query));
      if (!response.ok) throw new Error(t.error);
      const matches: SearchResponse = await response.json();
      setResults([
        ...matches.events.map((item): Result => ({ id: item.id, label: item.title, kind: "events", suspended: item.paidSalesSuspended })),
        ...matches.users.map((item): Result => ({ id: item.id, label: item.name + " · " + item.email, kind: "users", suspended: item.status === "SUSPENDED" })),
      ]);
    } catch {
      setError(t.error);
    } finally {
      setBusy(false);
    }
  }

  async function change(result: Result) {
    const reason = window.prompt(t.reason)?.trim();
    if (!reason) return;
    setError("");
    setBusy(true);
    const suspended = !result.suspended;
    try {
      const response = await fetch("/api/admin/" + result.kind + "/" + result.id + "/suspend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suspended, reason }),
      });
      if (!response.ok) throw new Error(t.error);
      setResults((items) => items?.map((item) =>
        item.id === result.id && item.kind === result.kind ? { ...item, suspended } : item,
      ) ?? null);
      router.refresh();
    } catch {
      setError(t.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 space-y-4 rounded-xl border border-ink-300 bg-white p-4">
      <h2 className="text-xl font-bold">{t.title}</h2>
      <form onSubmit={search} className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          {t.query}
          <input required minLength={2} name="q" className="rounded-lg border border-ink-300 px-3 py-2" />
        </label>
        <button className="rounded-lg bg-brand px-4 py-2 text-white disabled:opacity-50" disabled={busy}>{t.search}</button>
      </form>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {results?.length === 0 && <p>{t.results}</p>}
      <ul className="divide-y divide-ink-200">
        {results?.map((result) => (
          <li key={result.kind + "/" + result.id} className="flex items-center justify-between gap-4 py-2">
            <span>{result.label}</span>
            <button type="button" disabled={busy} onClick={() => void change(result)} className="rounded-lg border border-ink-300 px-3 py-2 disabled:opacity-50">
              {result.suspended ? t.restore : t.suspend}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
