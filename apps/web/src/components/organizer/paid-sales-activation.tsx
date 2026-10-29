"use client";

import { useCallback, useEffect, useState } from "react";

type Activation = {
  id: string; feeKzt: number; feePaid: boolean; identityVerified: boolean;
  payoutAccountConnected: boolean; termsAccepted: boolean; activated: boolean;
};
const labels = {
  en: { title: "Paid sales activation", fee: "Activation fee (simulated)", paid: "Fee paid", identity: "Identity approved by admin", payout: "Payout account connected", terms: "Terms accepted", activated: "Paid sales enabled", accept: "Accept terms", pay: "Pay simulated fee", refresh: "Refresh status", pending: "Waiting for admin approval", error: "Unable to update activation" },
  ru: { title: "Активация платных продаж", fee: "Взнос за активацию (симуляция)", paid: "Взнос оплачен", identity: "Подтверждено администратором", payout: "Счёт для выплат подключён", terms: "Условия приняты", activated: "Продажи активированы", accept: "Принять условия", pay: "Оплатить тестовый взнос", refresh: "Обновить статус", pending: "Ожидает подтверждения администратора", error: "Не удалось обновить статус" },
  kk: { title: "Ақылы сатылымды іске қосу", fee: "Іске қосу жарнасы (сынақ)", paid: "Жарна төленді", identity: "Әкімші растады", payout: "Төлем шоты қосылды", terms: "Шарттар қабылданды", activated: "Сатылым қосылды", accept: "Шарттарды қабылдау", pay: "Сынақ жарнасын төлеу", refresh: "Күйді жаңарту", pending: "Әкімші мақұлдауын күтуде", error: "Күйді жаңарту мүмкін болмады" },
} as const;

export default function PaidSalesActivation({ eventId, locale }: { eventId: string; locale: string }) {
  const t = labels[locale as keyof typeof labels] ?? labels.en;
  const [data, setData] = useState<Activation | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const base = `/api/organizer/events/${eventId}/activation`;
  const load = useCallback(async () => {
    const response = await fetch(base, { credentials: "same-origin", cache: "no-store" });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error?.message ?? t.error);
    setData(json.activation as Activation);
  }, [base, t.error]);
  useEffect(() => { void Promise.resolve().then(load).catch((e: Error) => setError(e.message)); }, [load]);
  async function act(action: "accept-terms" | "pay-fee") {
    setBusy(true); setError("");
    try {
      const response = await fetch(`${base}/${action}`, { method: "POST", credentials: "same-origin" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? t.error);
      if (action === "pay-fee" && typeof result.url === "string") {
        // The server supplies the simulated gateway URL. Never construct payment URLs client-side.
        window.location.assign(result.url);
        return;
      }
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : t.error); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4 rounded-xl border border-ink-300 bg-white p-6">
    <h2 className="text-xl font-bold">{t.title}</h2>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {data && <>
      <p>{t.fee}: <strong>{data.feeKzt.toLocaleString()} KZT</strong></p>
      <ul className="space-y-2 text-sm">
        {([["feePaid",t.paid],["identityVerified",t.identity],["payoutAccountConnected",t.payout],["termsAccepted",t.terms],["activated",t.activated]] as const).map(([key,label]) =>
          <li key={key}>{data[key] ? "✓" : "○"} {label}</li>)}
      </ul>
      {!data.termsAccepted && <button disabled={busy} onClick={() => void act("accept-terms")} className="bg-ink-900 rounded-lg px-4 py-2 text-white disabled:opacity-50">{t.accept}</button>}
      {!data.feePaid && <button disabled={busy} onClick={() => void act("pay-fee")} className="bg-brand ml-2 rounded-lg px-4 py-2 text-white disabled:opacity-50">{t.pay}</button>}
      {!data.activated && <p className="text-ink-600 text-sm">{t.pending}</p>}
    </>}
    <div><button disabled={busy} type="button" onClick={() => { void load().catch((e: Error) => setError(e.message)); }} className="text-brand text-sm underline">{t.refresh}</button></div>
  </section>;
}
