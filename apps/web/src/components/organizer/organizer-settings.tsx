"use client";

import { useCallback, useEffect, useState } from "react";

import { formatKzt } from "@/lib/format";

type Profile = {
  id: string | null;
  displayName: string;
  description: string | null;
  contactEmail: string;
  contactPhone: string | null;
  websiteUrl: string | null;
  verificationStatus: string;
};

type Account = {
  id: string;
  holderName: string;
  bankName: string;
  ibanLast4: string;
  isDefault: boolean;
};

type Payout = {
  id: string;
  status: string;
  netKzt: number;
  simulated: boolean;
  createdAt: string;
  event: { title: string };
  payoutAccount: { bankName: string; ibanLast4: string };
};

const copy = {
  en: {
    heading: "Organizer profile",
    profile: "Profile",
    displayName: "Display name",
    description: "Description",
    contactEmail: "Contact email",
    contactPhone: "Contact phone",
    websiteUrl: "Website",
    save: "Save profile",
    verification: "Verification",
    payoutsHeading: "Payout accounts",
    holder: "Account holder",
    bank: "Bank",
    ibanLast4: "IBAN last 4",
    addAccount: "Add simulated payout account",
    accountsEmpty: "No payout accounts yet. Add one to unlock paid-sales activation.",
    payoutHistory: "Simulated payouts",
    payoutsEmpty: "No payouts yet.",
    saved: "Profile saved.",
    accountAdded: "Payout account added.",
    error: "Request failed",
  },
  ru: {
    heading: "Профиль организатора",
    profile: "Профиль",
    displayName: "Отображаемое имя",
    description: "Описание",
    contactEmail: "Контактный email",
    contactPhone: "Телефон",
    websiteUrl: "Сайт",
    save: "Сохранить профиль",
    verification: "Проверка",
    payoutsHeading: "Счета для выплат",
    holder: "Владелец счёта",
    bank: "Банк",
    ibanLast4: "Последние 4 цифры IBAN",
    addAccount: "Добавить тестовый счёт",
    accountsEmpty: "Счетов пока нет. Добавьте счёт для активации платных продаж.",
    payoutHistory: "Тестовые выплаты",
    payoutsEmpty: "Выплат пока нет.",
    saved: "Профиль сохранён.",
    accountAdded: "Счёт добавлен.",
    error: "Ошибка запроса",
  },
  kk: {
    heading: "Ұйымдастырушы профилі",
    profile: "Профиль",
    displayName: "Көрсетілетін атау",
    description: "Сипаттама",
    contactEmail: "Байланыс email",
    contactPhone: "Телефон",
    websiteUrl: "Сайт",
    save: "Профильді сақтау",
    verification: "Тексеру",
    payoutsHeading: "Төлем шоттары",
    holder: "Шот иесі",
    bank: "Банк",
    ibanLast4: "IBAN соңғы 4 цифры",
    addAccount: "Сынақ шотын қосу",
    accountsEmpty: "Шот жоқ. Ақылы сатылым үшін шот қосыңыз.",
    payoutHistory: "Сынақ төлемдер",
    payoutsEmpty: "Төлем жоқ.",
    saved: "Профиль сақталды.",
    accountAdded: "Шот қосылды.",
    error: "Сұрау қатесі",
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

export default function OrganizerSettings({ locale }: { locale: string }) {
  const t = copy[locale as keyof typeof copy] ?? copy.en;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [payoutForm, setPayoutForm] = useState({
    holderName: "",
    bankName: "",
    ibanLast4: "",
  });

  const load = useCallback(async () => {
    const [profileRes, accountsRes, payoutsRes] = await Promise.all([
      request("/api/organizer/profile", "GET"),
      request("/api/organizer/payout-accounts", "GET"),
      request("/api/organizer/payouts", "GET"),
    ]);
    setProfile(profileRes.profile);
    setAccounts(accountsRes.accounts ?? []);
    setPayouts(payoutsRes.payouts ?? []);
  }, []);

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

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    await run(async () => {
      const payload = {
        displayName: profile.displayName.trim(),
        description: profile.description?.trim() || undefined,
        contactEmail: profile.contactEmail.trim(),
        contactPhone: profile.contactPhone?.trim() || undefined,
        websiteUrl: profile.websiteUrl?.trim() || undefined,
      };
      const { profile: saved } = await request(
        "/api/organizer/profile",
        "PUT",
        payload,
      );
      setProfile(saved);
      setNotice(t.saved);
    });
  }

  async function addAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => {
      await request("/api/organizer/payout-accounts", "POST", payoutForm);
      setPayoutForm({ holderName: "", bankName: "", ibanLast4: "" });
      await load();
      setNotice(t.accountAdded);
    });
  }

  const inputStyle =
    "mt-1 w-full rounded-lg border border-ink-300 bg-white p-3 text-ink-900";
  const labelStyle = "block text-sm font-semibold text-ink-700";

  return (
    <div className="mx-auto max-w-3xl space-y-7 px-4 py-10">
      <h1 className="font-display text-3xl font-extrabold">{t.heading}</h1>
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

      {profile ? (
        <form
          onSubmit={saveProfile}
          className="space-y-4 rounded-xl border border-ink-300 bg-white p-6"
        >
          <h2 className="text-xl font-bold">{t.profile}</h2>
          <p className="text-ink-600 text-sm">
            {t.verification}: {profile.verificationStatus}
          </p>
          <label className={labelStyle}>
            {t.displayName}
            <input
              required
              minLength={2}
              maxLength={120}
              className={inputStyle}
              value={profile.displayName}
              onChange={(event) =>
                setProfile({ ...profile, displayName: event.target.value })
              }
            />
          </label>
          <label className={labelStyle}>
            {t.description}
            <textarea
              maxLength={2000}
              rows={4}
              className={inputStyle}
              value={profile.description ?? ""}
              onChange={(event) =>
                setProfile({ ...profile, description: event.target.value })
              }
            />
          </label>
          <label className={labelStyle}>
            {t.contactEmail}
            <input
              required
              type="email"
              className={inputStyle}
              value={profile.contactEmail}
              onChange={(event) =>
                setProfile({ ...profile, contactEmail: event.target.value })
              }
            />
          </label>
          <label className={labelStyle}>
            {t.contactPhone}
            <input
              className={inputStyle}
              value={profile.contactPhone ?? ""}
              onChange={(event) =>
                setProfile({ ...profile, contactPhone: event.target.value })
              }
            />
          </label>
          <label className={labelStyle}>
            {t.websiteUrl}
            <input
              type="url"
              className={inputStyle}
              value={profile.websiteUrl ?? ""}
              onChange={(event) =>
                setProfile({ ...profile, websiteUrl: event.target.value })
              }
            />
          </label>
          <button
            disabled={busy}
            className="bg-brand rounded-lg px-5 py-3 font-bold text-white disabled:opacity-50"
          >
            {t.save}
          </button>
        </form>
      ) : null}

      <section className="space-y-4 rounded-xl border border-ink-300 bg-white p-6">
        <h2 className="text-xl font-bold">{t.payoutsHeading}</h2>
        {accounts.length === 0 ? (
          <p className="text-ink-600 text-sm">{t.accountsEmpty}</p>
        ) : (
          <ul className="space-y-3">
            {accounts.map((account) => (
              <li
                key={account.id}
                className="border-ink-200 rounded-lg border p-3 text-sm"
              >
                <strong>{account.holderName}</strong>
                <p className="text-ink-600 mt-1">
                  {account.bankName} · •••• {account.ibanLast4}
                  {account.isDefault ? " · default" : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addAccount} className="grid gap-3 sm:grid-cols-3">
          <label className={labelStyle}>
            {t.holder}
            <input
              required
              minLength={2}
              className={inputStyle}
              value={payoutForm.holderName}
              onChange={(event) =>
                setPayoutForm({ ...payoutForm, holderName: event.target.value })
              }
            />
          </label>
          <label className={labelStyle}>
            {t.bank}
            <input
              required
              minLength={2}
              className={inputStyle}
              value={payoutForm.bankName}
              onChange={(event) =>
                setPayoutForm({ ...payoutForm, bankName: event.target.value })
              }
            />
          </label>
          <label className={labelStyle}>
            {t.ibanLast4}
            <input
              required
              pattern="\d{4}"
              maxLength={4}
              className={inputStyle}
              value={payoutForm.ibanLast4}
              onChange={(event) =>
                setPayoutForm({ ...payoutForm, ibanLast4: event.target.value })
              }
            />
          </label>
          <button
            disabled={busy}
            className="bg-ink-900 rounded-lg px-5 py-3 font-bold text-white disabled:opacity-50 sm:col-span-3"
          >
            {t.addAccount}
          </button>
        </form>
      </section>

      <section className="space-y-4 rounded-xl border border-ink-300 bg-white p-6">
        <h2 className="text-xl font-bold">{t.payoutHistory}</h2>
        {payouts.length === 0 ? (
          <p className="text-ink-600 text-sm">{t.payoutsEmpty}</p>
        ) : (
          <ul className="space-y-3">
            {payouts.map((payout) => (
              <li
                key={payout.id}
                className="border-ink-200 rounded-lg border p-3 text-sm"
              >
                <div className="flex justify-between gap-3">
                  <strong>{payout.event.title}</strong>
                  <span>{formatKzt(payout.netKzt, locale)}</span>
                </div>
                <p className="text-ink-600 mt-1">
                  {payout.status} · {payout.payoutAccount.bankName} · ••••{" "}
                  {payout.payoutAccount.ibanLast4}
                  {payout.simulated ? " · simulated" : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
