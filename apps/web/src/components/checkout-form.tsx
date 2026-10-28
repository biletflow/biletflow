"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { formatKzt } from "@/lib/format";
import { labelOf } from "@/lib/labels";

function checkoutErrorKey(code: string) {
  if (code === "CONFLICT" || code === "HOLD_EXPIRED") return "errorConflict";
  if (code === "VALIDATION_FAILED") return "errorValidation";
  return "errorGeneric";
}

export function CheckoutForm({
  eventId,
  eventSlug,
  eventTitle,
  locale,
  ticketType,
  initialQuantity,
  attendee,
}: {
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  locale: string;
  ticketType: {
    id: string;
    name: string;
    priceKzt: number;
    available: number;
    maxPerOrder: number | null;
  };
  initialQuantity: number;
  attendee: { fullName: string; email: string };
}) {
  const t = useTranslations("checkout");
  const tEvent = useTranslations("event");
  const tType = useTranslations("ticketTypes");
  const tAuth = useTranslations("auth");
  const router = useRouter();
  const idempotencyKey = useRef(crypto.randomUUID());
  const maxQuantity = Math.min(ticketType.available, ticketType.maxPerOrder ?? 10);
  const [quantity, setQuantity] = useState(
    Math.min(Math.max(1, initialQuantity), maxQuantity),
  );
  const [fullName, setFullName] = useState(attendee.fullName);
  const [email, setEmail] = useState(attendee.email);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isFree = ticketType.priceKzt === 0;
  const totalKzt = ticketType.priceKzt * quantity;

  async function onSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setError(null);
    setPending(true);
    const attendees = Array.from({ length: quantity }, () => ({
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
    }));
    try {
      const created = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          items: [{ ticketTypeId: ticketType.id, quantity }],
          attendees,
          clientIdempotencyKey: idempotencyKey.current,
        }),
      });
      const body = (await created.json().catch(() => null)) as {
        order?: { id: string; status: string };
        error?: { code?: string };
      } | null;
      if (!created.ok || !body?.order) {
        idempotencyKey.current = crypto.randomUUID();
        setError(t(checkoutErrorKey(body?.error?.code ?? "")));
        return;
      }
      if (body.order.status === "PAID") {
        router.replace("/tickets");
        router.refresh();
        return;
      }
      const payment = await fetch(`/api/orders/${body.order.id}/pay`, {
        method: "POST",
      });
      const paid = (await payment.json().catch(() => null)) as {
        url?: string;
        error?: { code?: string };
      } | null;
      if (!payment.ok || !paid?.url) {
        setError(t(checkoutErrorKey(paid?.error?.code ?? "")));
        return;
      }
      window.location.assign(paid.url);
    } catch {
      idempotencyKey.current = crypto.randomUUID();
      setError(t("errorGeneric"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border-ink-300 mx-auto max-w-lg space-y-5 rounded-xl border bg-white p-6"
    >
      <div>
        <p className="text-brand text-xs font-bold tracking-wider uppercase">
          {t("title")}
        </p>
        <h1 className="font-display text-ink-900 mt-1 text-2xl font-extrabold tracking-tight">
          {eventTitle}
        </h1>
        <p className="text-ink-600 mt-2 text-sm">{t("lead")}</p>
      </div>

      <div className="border-ink-200 space-y-2 rounded-lg border px-4 py-3 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-ink-600">{labelOf(tType, ticketType.name)}</span>
          <span className="text-ink-900 font-semibold">
            {isFree ? tEvent("freeTicket") : formatKzt(ticketType.priceKzt, locale)}
          </span>
        </div>
        <label className="flex items-center justify-between gap-3">
          <span className="text-ink-600">{tEvent("quantity")}</span>
          <input
            name="quantity"
            type="number"
            min={1}
            max={maxQuantity}
            value={quantity}
            onChange={(event) => {
              const next = Number.parseInt(event.target.value, 10);
              if (!Number.isFinite(next)) return;
              setQuantity(Math.min(maxQuantity, Math.max(1, next)));
            }}
            className="border-ink-300 text-ink-900 h-10 w-20 rounded-lg border px-2 text-right text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </label>
        <div className="flex justify-between gap-3 pt-1 text-base font-bold">
          <span className="text-ink-900">{tEvent("total")}</span>
          <span className="text-ink-900">
            {isFree ? tEvent("freeTicket") : formatKzt(totalKzt, locale)}
          </span>
        </div>
      </div>

      <label className="block">
        <span className="text-ink-800 text-sm font-semibold">{tAuth("name")}</span>
        <input
          name="fullName"
          type="text"
          autoComplete="name"
          required
          minLength={2}
          maxLength={120}
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          className="border-ink-300 text-ink-900 mt-1 h-11 w-full rounded-lg border px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </label>

      <label className="block">
        <span className="text-ink-800 text-sm font-semibold">{tAuth("email")}</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="border-ink-300 text-ink-900 mt-1 h-11 w-full rounded-lg border px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </label>

      {error ? (
        <p role="alert" className="text-error text-sm font-medium">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={pending || maxQuantity < 1}
        className="h-11 w-full text-sm font-semibold"
      >
        {pending
          ? t("submitting")
          : isFree
            ? t("submitFree")
            : t("submitPaid")}
      </Button>

      <p className="text-center text-sm">
        <Link
          href={`/events/${eventSlug}`}
          className="text-ink-600 hover:text-brand font-medium"
        >
          {t("back")}
        </Link>
      </p>
    </form>
  );
}
