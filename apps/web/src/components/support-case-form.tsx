"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";

const CATEGORIES = [
  "TICKET_DELIVERY",
  "PAYMENT",
  "REFUND",
  "SEATING",
  "EVENT_INFORMATION",
  "CHECK_IN",
  "ACCOUNT",
  "TECHNICAL",
] as const;

export function SupportCaseForm({
  eventId,
  orderId,
  ticketId,
}: {
  eventId?: string;
  orderId?: string;
  ticketId?: string;
}) {
  const t = useTranslations("support");
  const router = useRouter();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>(
    "TICKET_DELIVERY",
  );
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/support/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          subject: subject.trim(),
          body: body.trim(),
          ...(eventId ? { eventId } : {}),
          ...(orderId ? { orderId } : {}),
          ...(ticketId ? { ticketId } : {}),
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        case?: { id: string };
        error?: { code?: string };
      } | null;
      if (!response.ok || !payload?.case?.id) {
        setError(t("errorGeneric"));
        return;
      }
      router.push(`/support/${payload.case.id}`);
      router.refresh();
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border-ink-300 mt-8 space-y-4 rounded-xl border bg-white p-5"
    >
      <h2 className="text-ink-900 text-lg font-bold">{t("new")}</h2>

      <label className="block">
        <span className="text-ink-700 text-sm font-semibold">{t("category")}</span>
        <select
          value={category}
          onChange={(event) =>
            setCategory(event.target.value as (typeof CATEGORIES)[number])
          }
          className="border-ink-300 mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
        >
          {CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {t(`categories.${value}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-ink-700 text-sm font-semibold">{t("subject")}</span>
        <input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          required
          minLength={3}
          maxLength={200}
          className="border-ink-300 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
        />
      </label>

      <label className="block">
        <span className="text-ink-700 text-sm font-semibold">{t("message")}</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
          minLength={3}
          maxLength={5000}
          rows={5}
          className="border-ink-300 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
        />
      </label>

      {error ? (
        <p role="alert" className="text-error text-sm">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? t("sending") : t("submit")}
      </Button>
    </form>
  );
}
