"use client";

import { useCallback, useEffect, useState } from "react";

type Campaign = {
  id: string;
  name: string;
  discountType: "PERCENT" | "FIXED_KZT";
  discountValue: number;
  status: "ACTIVE" | "DISABLED";
  promoCode: string | null;
  campaignUrl: string | null;
  qrPngPath: string;
  redeemed: number;
  maxRedemptions: number | null;
};

const copy = {
  en: {
    heading: "Promo campaigns",
    name: "Campaign name",
    type: "Discount type",
    percent: "Percent",
    fixed: "Fixed ₸",
    value: "Discount value",
    create: "Create campaign",
    disable: "Disable",
    enable: "Enable",
    code: "Promo code",
    link: "Campaign link",
    qr: "Campaign QR",
    redeemed: "Redeemed",
    empty: "No campaigns yet.",
    error: "Request failed",
    created: "Campaign created.",
    updated: "Campaign updated.",
  },
  ru: {
    heading: "Промокампании",
    name: "Название",
    type: "Тип скидки",
    percent: "Процент",
    fixed: "Фикс. ₸",
    value: "Значение скидки",
    create: "Создать кампанию",
    disable: "Отключить",
    enable: "Включить",
    code: "Промокод",
    link: "Ссылка кампании",
    qr: "QR кампании",
    redeemed: "Использовано",
    empty: "Кампаний пока нет.",
    error: "Ошибка запроса",
    created: "Кампания создана.",
    updated: "Кампания обновлена.",
  },
  kk: {
    heading: "Промо-науқандар",
    name: "Атауы",
    type: "Жеңілдік түрі",
    percent: "Пайыз",
    fixed: "Бекітілген ₸",
    value: "Жеңілдік мәні",
    create: "Науқан құру",
    disable: "Өшіру",
    enable: "Қосу",
    code: "Промокод",
    link: "Науқан сілтемесі",
    qr: "Науқан QR",
    redeemed: "Қолданылды",
    empty: "Әлі науқан жоқ.",
    error: "Сұрау қатесі",
    created: "Науқан жасалды.",
    updated: "Науқан жаңартылды.",
  },
} as const;

async function request(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.error?.code || `HTTP ${response.status}`);
  }
  return data;
}

export default function EventCampaigns({
  eventId,
  locale,
}: {
  eventId: string;
  locale: string;
}) {
  const t = copy[locale as keyof typeof copy] ?? copy.en;
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [name, setName] = useState("");
  const [discountType, setDiscountType] = useState<"PERCENT" | "FIXED_KZT">(
    "PERCENT",
  );
  const [discountValue, setDiscountValue] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const data = await request(
      `/api/organizer/events/${eventId}/campaigns`,
      "GET",
    );
    setCampaigns(data.campaigns ?? []);
  }, [eventId]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      load().catch((err: Error) => {
        if (active) setError(err.message);
      });
    });
    return () => {
      active = false;
    };
  }, [load]);

  async function run(operation: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await operation();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  async function createCampaign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => {
      await request(`/api/organizer/events/${eventId}/campaigns`, "POST", {
        name: name.trim(),
        discountType,
        discountValue,
        ticketTypeIds: [],
      });
      setName("");
      setDiscountValue(10);
      await load();
      setNotice(t.created);
    });
  }

  async function setStatus(campaignId: string, status: "ACTIVE" | "DISABLED") {
    await run(async () => {
      await request(`/api/organizer/campaigns/${campaignId}`, "PUT", { status });
      await load();
      setNotice(t.updated);
    });
  }

  const inputStyle =
    "mt-1 w-full rounded-lg border border-ink-300 bg-white p-3 text-ink-900";
  const labelStyle = "block text-sm font-semibold text-ink-700";

  return (
    <section className="space-y-4 rounded-xl border border-ink-300 bg-white p-6">
      <h2 className="text-xl font-bold">{t.heading}</h2>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="rounded-lg bg-green-50 p-3 text-green-700">
          {notice}
        </p>
      ) : null}

      {campaigns.length === 0 ? (
        <p className="text-ink-600 text-sm">{t.empty}</p>
      ) : (
        <ul className="space-y-4">
          {campaigns.map((campaign) => (
            <li
              key={campaign.id}
              className="border-ink-200 space-y-2 rounded-lg border p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong>{campaign.name}</strong>
                <span className="text-ink-600 text-xs font-bold uppercase">
                  {campaign.status}
                </span>
              </div>
              <p className="text-ink-700 text-sm">
                {campaign.discountType === "PERCENT"
                  ? `${campaign.discountValue}%`
                  : `₸${campaign.discountValue}`}{" "}
                · {t.redeemed}: {campaign.redeemed}
                {campaign.maxRedemptions != null
                  ? ` / ${campaign.maxRedemptions}`
                  : ""}
              </p>
              {campaign.promoCode ? (
                <p className="text-sm">
                  {t.code}: <code>{campaign.promoCode}</code>
                </p>
              ) : null}
              {campaign.campaignUrl ? (
                <p className="text-sm break-all">
                  {t.link}: {campaign.campaignUrl}
                </p>
              ) : null}
              {/* Session cookie required; next/image would drop it. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={campaign.qrPngPath}
                alt={t.qr}
                width={120}
                height={120}
                className="border-ink-200 rounded-lg border bg-white p-1"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  setStatus(
                    campaign.id,
                    campaign.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
                  )
                }
                className="text-brand text-sm font-semibold underline disabled:opacity-50"
              >
                {campaign.status === "ACTIVE" ? t.disable : t.enable}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={createCampaign} className="grid gap-3 sm:grid-cols-3">
        <label className={`${labelStyle} sm:col-span-3`}>
          {t.name}
          <input
            required
            minLength={2}
            maxLength={120}
            className={inputStyle}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className={labelStyle}>
          {t.type}
          <select
            className={inputStyle}
            value={discountType}
            onChange={(event) =>
              setDiscountType(event.target.value as "PERCENT" | "FIXED_KZT")
            }
          >
            <option value="PERCENT">{t.percent}</option>
            <option value="FIXED_KZT">{t.fixed}</option>
          </select>
        </label>
        <label className={labelStyle}>
          {t.value}
          <input
            required
            type="number"
            min={1}
            max={discountType === "PERCENT" ? 100 : 1_000_000}
            className={inputStyle}
            value={discountValue}
            onChange={(event) => setDiscountValue(Number(event.target.value))}
          />
        </label>
        <button
          disabled={busy}
          className="bg-brand self-end rounded-lg px-5 py-3 font-bold text-white disabled:opacity-50"
        >
          {t.create}
        </button>
      </form>
    </section>
  );
}
