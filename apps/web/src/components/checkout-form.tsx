"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { checkoutItems, retainAvailableSeats, toggleSeat, type SeatSection } from "@/lib/seat-selection";

import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { formatKzt } from "@/lib/format";
import { labelOf } from "@/lib/labels";

const seatCopy = {
  en: { title: "Choose your seats", row: "Row", refresh: "Refresh seats", loading: "Loading seats…", empty: "No free seats are available.", error: "Could not load seats. Refresh to try again.", selected: "Selected", accessible: "Accessible seat", limit: "Maximum seats per order", conflict: "A selected seat may no longer be available. Review your selection and try again.", choose: "Select at least one seat." },
  ru: { title: "Выберите места", row: "Ряд", refresh: "Обновить места", loading: "Загрузка мест…", empty: "Свободных мест нет.", error: "Не удалось загрузить места. Обновите карту.", selected: "Выбрано", accessible: "Доступное место", limit: "Максимум мест в заказе", conflict: "Выбранное место могло стать недоступным. Проверьте выбор и повторите.", choose: "Выберите хотя бы одно место." },
  kk: { title: "Орындарды таңдаңыз", row: "Қатар", refresh: "Орындарды жаңарту", loading: "Орындар жүктелуде…", empty: "Бос орындар жоқ.", error: "Орындарды жүктеу мүмкін болмады. Қайта жаңартыңыз.", selected: "Таңдалды", accessible: "Бейімделген орын", limit: "Тапсырыстағы ең көп орын", conflict: "Таңдалған орын бос болмауы мүмкін. Таңдауды тексеріп, қайталаңыз.", choose: "Кемінде бір орын таңдаңыз." },
} as const;

function checkoutErrorKey(code: string) {
  if (code === "HOLD_EXPIRED") return "errorHoldExpired";
  if (code === "CONFLICT") return "errorConflict";
  if (code === "VALIDATION_FAILED") return "errorValidation";
  if (code === "PROMO_INVALID") return "errorPromo";
  return "errorGeneric";
}

export function CheckoutForm({
  eventId,
  eventSlug,
  eventTitle,
  assignedSeating,
  locale,
  ticketType,
  initialQuantity,
  attendee,
  initialCampaignToken,
}: {
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  assignedSeating: boolean;
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
  initialCampaignToken?: string;
}) {
  const t = useTranslations("checkout");
  const tEvent = useTranslations("event");
  const tType = useTranslations("ticketTypes");
  const tAuth = useTranslations("auth");
  const router = useRouter();
  const idempotencyKey = useRef(crypto.randomUUID());
  const maxQuantity = Math.min(ticketType.available, ticketType.maxPerOrder ?? 10);
  const [generalQuantity, setQuantity] = useState(
    Math.min(Math.max(1, initialQuantity), maxQuantity),
  );
  const seatText = seatCopy[locale as keyof typeof seatCopy] ?? seatCopy.en;
  const [sections, setSections] = useState<SeatSection[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [seatLoading, setSeatLoading] = useState(assignedSeating);
  const [seatError, setSeatError] = useState(false);
  const [seatConflict, setSeatConflict] = useState(false);
  const quantity = assignedSeating ? selected.length : generalQuantity;
  const refreshSeats = useCallback(async (signal?: AbortSignal) => {
    setSeatLoading(true);
    setSeatError(false);
    try {
      const response = await fetch("/api/events/" + encodeURIComponent(eventSlug) + "/seats", { cache: "no-store", signal });
      if (!response.ok) throw new Error("seat map");
      const data = await response.json() as { sections: SeatSection[] };
      if (signal?.aborted) return;
      setSections(data.sections);
      setSelected((previous) => retainAvailableSeats(previous, data.sections, maxQuantity));
    } catch {
      if (!signal?.aborted) setSeatError(true);
    } finally {
      if (!signal?.aborted) setSeatLoading(false);
    }
  }, [eventSlug, maxQuantity]);
  useEffect(() => {
    if (!assignedSeating) return;
    const controller = new AbortController();
    void refreshSeats(controller.signal);
    return () => controller.abort();
  }, [assignedSeating, refreshSeats]);
  const [fullName, setFullName] = useState(attendee.fullName);
  const [email, setEmail] = useState(attendee.email);
  const [promoCode, setPromoCode] = useState("");
  const [campaignToken] = useState(initialCampaignToken?.trim() || "");
  const [discountKzt, setDiscountKzt] = useState(0);
  const [promoLabel, setPromoLabel] = useState<string | null>(
    campaignToken ? t("campaignApplied") : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isFree = ticketType.priceKzt === 0;
  const subtotalKzt = ticketType.priceKzt * quantity;
  const totalKzt = Math.max(0, subtotalKzt - discountKzt);

  useEffect(() => {
    if (!campaignToken || isFree || quantity < 1) return;
    void applyPromo();
    // Preview once when a campaign link lands on checkout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignToken, quantity]);

  async function applyPromo() {
    setError(null);
    if (quantity < 1) return;
    const code = promoCode.trim();
    if (!code && !campaignToken) {
      setDiscountKzt(0);
      setPromoLabel(null);
      return;
    }
    const response = await fetch("/api/promo/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId,
        ...(code ? { code } : {}),
        ...(campaignToken ? { campaignToken } : {}),
        items: [
          {
            ticketTypeId: ticketType.id,
            quantity,
            unitPriceKzt: ticketType.priceKzt,
          },
        ],
      }),
    });
    const body = (await response.json().catch(() => null)) as {
      totals?: { discountKzt?: number } | null;
      campaign?: { name?: string };
      error?: { code?: string };
    } | null;
    if (!response.ok) {
      setDiscountKzt(0);
      setPromoLabel(null);
      setError(t(checkoutErrorKey(body?.error?.code ?? "")));
      return;
    }
    setDiscountKzt(body?.totals?.discountKzt ?? 0);
    setPromoLabel(body?.campaign?.name ?? t("promoApplied"));
  }

  async function onSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setError(null);
    if (pending || quantity < 1 || quantity > maxQuantity || (assignedSeating && (seatLoading || seatError))) return;
    setSeatConflict(false);
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
          items: checkoutItems(ticketType.id, quantity, assignedSeating, selected),
          attendees,
          ...(promoCode.trim() ? { promoCode: promoCode.trim() } : {}),
          ...(campaignToken ? { campaignToken } : {}),
          clientIdempotencyKey: idempotencyKey.current,
        }),
      });
      const body = (await created.json().catch(() => null)) as {
        order?: { id: string; status: string };
        error?: { code?: string };
      } | null;
      if (!created.ok || !body?.order) {
        idempotencyKey.current = crypto.randomUUID();
        if (assignedSeating && [404, 409].includes(created.status)) {
          setSeatConflict(true);
          await refreshSeats();
        } else {
          setError(t(checkoutErrorKey(body?.error?.code ?? "")));
        }
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
      const gateway = new URL(paid.url, window.location.origin);
      gateway.searchParams.set("locale", locale);
      window.location.assign(gateway.toString());
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
        {assignedSeating ? <div className="space-y-3 border-t border-ink-200 pt-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold">{seatText.title}</h2>
            <Button type="button" variant="outline" disabled={pending || seatLoading} onClick={() => { void refreshSeats(); }}>{seatText.refresh}</Button>
          </div>
          <p className="text-xs text-ink-600">{seatText.limit}: {maxQuantity}</p>
          {seatLoading ? <p role="status">{seatText.loading}</p> : seatError ? <p role="alert">{seatText.error}</p> : sections.length === 0 ? <p>{seatText.empty}</p> : sections.map((section) => <div key={section.id} className="space-y-2 rounded-lg border border-ink-200 p-3">
            <h3 className="font-semibold">{section.name}</h3>
            {section.rows.map((row) => <div key={row.id} className="space-y-1">
              <p className="text-xs font-medium">{seatText.row} {row.label}</p>
              <div className="flex flex-wrap gap-2">{row.seats.map((seat) => {
                const active = selected.includes(seat.id);
                return <button key={seat.id} type="button" aria-pressed={active} aria-label={section.name + " " + seatText.row + " " + row.label + " " + seat.number + (seat.isAccessible ? " (" + seatText.accessible + ")" : "")}
                  disabled={pending || (!active && quantity >= maxQuantity)}
                  className={"min-w-10 rounded-lg border px-3 py-2 font-semibold disabled:opacity-50 " + (active ? "bg-brand border-brand text-white" : "bg-green-50 border-green-300 text-green-800")}
                  onClick={() => { setSelected((previous) => toggleSeat(previous, seat.id, maxQuantity)); setDiscountKzt(0); if (!campaignToken) setPromoLabel(null); setSeatConflict(false); }}>
                  {seat.number}{seat.isAccessible ? " *" : ""}
                </button>;
              })}</div>
            </div>)}
          </div>)}
          <p aria-live="polite">{seatText.selected}: {quantity}</p>
          {quantity === 0 && <p className="text-xs text-ink-600">{seatText.choose}</p>}
          {seatConflict && <p role="alert" className="text-error">{seatText.conflict}</p>}
        </div> : <label className="flex items-center justify-between gap-3">
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
              setDiscountKzt(0);
              if (!campaignToken) setPromoLabel(null);
            }}
            className="border-ink-300 text-ink-900 h-10 w-20 rounded-lg border px-2 text-right text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </label>}
        {discountKzt > 0 ? (
          <div className="flex justify-between gap-3 text-sm">
            <span className="text-ink-600">{t("discount")}</span>
            <span className="text-brand font-semibold">
              −{formatKzt(discountKzt, locale)}
            </span>
          </div>
        ) : null}
        <div className="flex justify-between gap-3 pt-1 text-base font-bold">
          <span className="text-ink-900">{tEvent("total")}</span>
          <span className="text-ink-900">
            {isFree && totalKzt === 0
              ? tEvent("freeTicket")
              : formatKzt(totalKzt, locale)}
          </span>
        </div>
      </div>

      {!isFree ? (
        <div className="space-y-2">
          <label className="block">
            <span className="text-ink-800 text-sm font-semibold">
              {t("promoCode")}
            </span>
            <div className="mt-1 flex gap-2">
              <input
                name="promoCode"
                type="text"
                autoComplete="off"
                maxLength={32}
                value={promoCode}
                onChange={(event) => {
                  setPromoCode(event.target.value);
                  setDiscountKzt(0);
                  if (!campaignToken) setPromoLabel(null);
                }}
                className="border-ink-300 text-ink-900 h-11 flex-1 rounded-lg border px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <Button
                type="button"
                variant="outline"
                disabled={pending || quantity < 1}
                onClick={() => {
                  void applyPromo();
                }}
                className="h-11"
              >
                {t("applyPromo")}
              </Button>
            </div>
          </label>
          {promoLabel ? (
            <p className="text-brand text-xs font-medium">{promoLabel}</p>
          ) : null}
          {campaignToken ? (
            <p className="text-ink-600 text-xs">{t("campaignLinkHint")}</p>
          ) : null}
        </div>
      ) : null}

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
        disabled={pending || maxQuantity < 1 || quantity < 1 || (assignedSeating && (seatLoading || seatError))}
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
