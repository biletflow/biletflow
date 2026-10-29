"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Row = { id: string; eventTitle: string; organizerName: string; feePaid: boolean; identityVerified: boolean };
export default function ActivationReviews({ rows, locale }: { rows: Row[]; locale: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function review(id: string, decision: "APPROVE" | "REJECT") {
    setBusy(id); setError("");
    try {
      const response = await fetch(`/api/admin/activations/${id}/review`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "Review failed");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Review failed"); }
    finally { setBusy(null); }
  }
  const title = locale === "ru" ? "Активация платных продаж" : locale === "kk" ? "Ақылы сатылымды мақұлдау" : "Paid sales activation requests";
  return <section className="mt-10 space-y-4"><h2 className="text-xl font-bold">{title}</h2>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {rows.length === 0 && <p className="text-ink-600">No activation requests</p>}
    {rows.map((row) => <div key={row.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-ink-300 bg-white p-4">
      <div><strong>{row.eventTitle}</strong><p className="text-ink-600 text-sm">{row.organizerName} · {row.feePaid ? "Fee paid" : "Fee pending"} · {row.identityVerified ? "Approved" : "Not approved"}</p></div>
      <div className="flex gap-2">
        <button type="button" disabled={busy !== null || !row.feePaid} onClick={() => void review(row.id, "APPROVE")} className="bg-brand rounded-lg px-4 py-2 text-white disabled:opacity-40">Approve</button>
        <button type="button" disabled={busy !== null} onClick={() => void review(row.id, "REJECT")} className="rounded-lg border border-ink-300 px-4 py-2 disabled:opacity-40">Reject</button>
      </div>
    </div>)}
  </section>;
}
