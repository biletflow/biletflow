"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock3 } from "lucide-react";

type Row = {
  id: string;
  eventTitle: string;
  organizerName: string;
  feePaid: boolean;
  identityVerified: boolean;
};

const translations = {
  en: {
    title: "Paid sales activation",
    empty: "No activation requests",
    paid: "Fee paid",
    unpaid: "Fee pending",
    approved: "Approved",
    pending: "Not approved",
    approve: "Approve",
    reject: "Reject",
    revoke: "Revoke approval",
    confirm: "Revoke approval and disable paid sales for this event?",
    failed: "Review failed",
  },
  ru: {
    title: "Активация платных продаж",
    empty: "Нет заявок на активацию",
    paid: "Сбор оплачен",
    unpaid: "Ожидается оплата",
    approved: "Одобрено",
    pending: "Не одобрено",
    approve: "Одобрить",
    reject: "Отклонить",
    revoke: "Отозвать одобрение",
    confirm: "Отозвать одобрение и отключить платные продажи?",
    failed: "Не удалось обработать заявку",
  },
  kk: {
    title: "Ақылы сатылымды белсендіру",
    empty: "Белсендіру өтінімдері жоқ",
    paid: "Төлем жасалды",
    unpaid: "Төлем күтілуде",
    approved: "Мақұлданды",
    pending: "Мақұлданбаған",
    approve: "Мақұлдау",
    reject: "Қабылдамау",
    revoke: "Мақұлдауды қайтарып алу",
    confirm: "Мақұлдауды қайтарып, ақылы сатылымды өшіру керек пе?",
    failed: "Өтінімді өңдеу мүмкін болмады",
  },
};

export default function ActivationReviews({
  rows,
  locale,
}: {
  rows: Row[];
  locale: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const t = translations[
    locale === "ru" ? "ru" : locale === "kk" ? "kk" : "en"
  ];

  async function review(id: string, decision: "APPROVE" | "REJECT") {
    setBusy(id);
    setError("");

    try {
      const response = await fetch(
        "/api/admin/activations/" + id + "/review",
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
        },
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message ?? t.failed);
      }

      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-10 space-y-4">
      <h2 className="text-xl font-bold">{t.title}</h2>

      {error && (
        <p role="alert" className="text-red-700">{error}</p>
      )}

      {rows.length === 0 && (
        <p className="text-ink-600">{t.empty}</p>
      )}

      {rows.map((row) => (
        <div
          key={row.id}
          className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-ink-300 bg-white p-5"
        >
          <div className="space-y-2">
            <strong>{row.eventTitle}</strong>

            <p className="text-ink-600 text-sm">
              {row.organizerName} · {row.feePaid ? t.paid : t.unpaid}
            </p>

            {row.identityVerified ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="size-4" aria-hidden />
                {t.approved}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                <Clock3 className="size-4" aria-hidden />
                {t.pending}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {row.identityVerified ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  if (window.confirm(t.confirm)) {
                    void review(row.id, "REJECT");
                  }
                }}
                className="rounded-lg border border-ink-300 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-100 disabled:opacity-40"
              >
                {t.revoke}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy !== null || !row.feePaid}
                  onClick={() => void review(row.id, "APPROVE")}
                  className="rounded-lg bg-brand px-4 py-2 text-white disabled:opacity-40"
                >
                  {t.approve}
                </button>

                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void review(row.id, "REJECT")}
                  className="rounded-lg border border-ink-300 px-4 py-2 disabled:opacity-40"
                >
                  {t.reject}
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
