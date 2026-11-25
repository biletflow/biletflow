"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Report = {
  id: string;
  reason: string;
  details: string | null;
  createdAt: string;
  event: { id: string; title: string; slug: string; paidSalesSuspended: boolean } | null;
};

export default function ModerationReports({
  locale,
  reports,
}: {
  locale: string;
  reports: Report[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const labels = locale === "ru"
    ? { title: "Жалобы на мероприятия", empty: "Открытых жалоб нет", suspend: "Заблокировать мероприятие", prompt: "Причина блокировки мероприятия", failure: "Не удалось заблокировать мероприятие" }
    : locale === "kk"
      ? { title: "Іс-шараларға шағымдар", empty: "Ашық шағымдар жоқ", suspend: "Іс-шараны бұғаттау", prompt: "Бұғаттау себебі", failure: "Іс-шараны бұғаттау мүмкін болмады" }
      : { title: "Event moderation reports", empty: "No open reports", suspend: "Suspend event", prompt: "Reason for suspension", failure: "Could not suspend event" };

  async function suspend(eventId: string) {
    const reason = window.prompt(labels.prompt);
    if (!reason?.trim()) return;
    setBusy(eventId);
    setError("");
    try {
      const response = await fetch(`/api/admin/events/${eventId}/suspend`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? labels.failure);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : labels.failure);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-10 space-y-4">
      <h2 className="text-xl font-bold">{labels.title}</h2>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {reports.length === 0 && <p className="text-ink-600">{labels.empty}</p>}
      {reports.map((report) => (
        <div key={report.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-ink-300 bg-white p-4">
          <div className="space-y-1">
            <p className="font-semibold">{report.event?.title ?? "Unknown event"}</p>
            <p className="text-ink-600 text-sm">{report.reason}</p>
            {report.details && <p className="text-ink-600 text-sm">{report.details}</p>}
            <p className="text-ink-500 text-xs">{new Date(report.createdAt).toLocaleDateString(locale)}</p>
          </div>
          {report.event && (
            <button
              type="button"
              disabled={busy !== null || report.event.paidSalesSuspended}
              onClick={() => void suspend(report.event!.id)}
              className="rounded-lg border border-red-300 px-4 py-2 text-red-700 disabled:opacity-50"
            >
              {labels.suspend}
            </button>
          )}
        </div>
      ))}
    </section>
  );
}
