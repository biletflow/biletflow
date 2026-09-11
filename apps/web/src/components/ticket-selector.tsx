"use client";

import { Check, Minus, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { formatEventDate, formatKzt } from "@/lib/format";
import { labelOf } from "@/lib/labels";
import { cn } from "@/lib/utils";

export type SelectableTicketType = {
  id: string;
  name: string;
  description: string | null;
  priceKzt: number;
  available: number;
  maxPerOrder: number | null;
  salesStartAt: string | null;
  salesEndAt: string | null;
};

/** Why a ticket type cannot currently be bought, or null when it can. */
function blockedReason(
  type: SelectableTicketType,
  now: Date,
): "soldOut" | "salesEnded" | "salesNotOpen" | null {
  if (type.available <= 0) return "soldOut";
  if (type.salesEndAt && new Date(type.salesEndAt) < now) return "salesEnded";
  if (type.salesStartAt && new Date(type.salesStartAt) > now) return "salesNotOpen";
  return null;
}

export function TicketSelector({
  ticketTypes,
  disabled = false,
  disabledReason,
}: {
  ticketTypes: SelectableTicketType[];
  disabled?: boolean;
  disabledReason?: string;
}) {
  const t = useTranslations("event");
  const tType = useTranslations("ticketTypes");
  const locale = useLocale();
  const now = new Date();

  const selectable = ticketTypes.filter((type) => !blockedReason(type, now));
  const [selectedId, setSelectedId] = useState(selectable[0]?.id ?? null);
  const [quantity, setQuantity] = useState(1);

  const selected = ticketTypes.find((type) => type.id === selectedId) ?? null;
  const maxQuantity = selected
    ? Math.min(selected.available, selected.maxPerOrder ?? 10)
    : 1;
  const subtotal = selected ? selected.priceKzt * quantity : 0;
  const isFree = selected?.priceKzt === 0;

  function select(type: SelectableTicketType) {
    setSelectedId(type.id);
    setQuantity(1);
  }

  return (
    <div className="border-ink-300 sticky top-20 rounded-xl border bg-white p-5">
      <h2 className="text-ink-900 text-lg font-bold">{t("selectTickets")}</h2>

      <div className="mt-4 space-y-2.5">
        {ticketTypes.map((type) => {
          const reason = blockedReason(type, now);
          const isSelected = type.id === selectedId;

          return (
            <button
              key={type.id}
              type="button"
              onClick={() => !reason && select(type)}
              disabled={Boolean(reason)}
              aria-pressed={isSelected}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                reason && "border-ink-300 cursor-not-allowed opacity-55",
                !reason && isSelected && "border-brand bg-brand-ultralight",
                !reason && !isSelected && "border-ink-300 hover:border-brand-light",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="text-ink-900 block text-sm font-semibold">
                  {labelOf(tType, type.name)}
                </span>
                {type.salesEndAt ? (
                  <span className="text-ink-500 block text-xs">
                    {t("salesEnd", {
                      date: formatEventDate(new Date(type.salesEndAt), locale),
                    })}
                  </span>
                ) : null}
                {reason ? (
                  <span className="text-error mt-0.5 block text-xs font-semibold">
                    {t(reason)}
                  </span>
                ) : (
                  <span className="text-success mt-0.5 block text-xs font-medium">
                    {t("remaining", { count: type.available })}
                  </span>
                )}
              </span>

              <span className="text-ink-900 shrink-0 text-sm font-bold">
                {type.priceKzt === 0 ? t("freeTicket") : formatKzt(type.priceKzt, locale)}
              </span>

              {isSelected && !reason ? (
                <span
                  className="bg-brand flex size-5 shrink-0 items-center justify-center rounded-full"
                  aria-hidden
                >
                  <Check className="size-3 text-white" />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {selected ? (
        <>
          <div className="border-ink-300 mt-5 flex items-center justify-between border-t pt-4">
            <span className="text-ink-700 text-sm font-medium">{t("quantity")}</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                disabled={quantity <= 1}
                aria-label={t("decreaseQuantity")}
                className="border-ink-300 text-ink-700 hover:border-brand flex size-8 items-center justify-center rounded-full border disabled:opacity-40"
              >
                <Minus className="size-3.5" aria-hidden />
              </button>
              <span
                className="text-ink-900 w-6 text-center text-sm font-bold"
                aria-live="polite"
              >
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}
                disabled={quantity >= maxQuantity}
                aria-label={t("increaseQuantity")}
                className="border-ink-300 text-ink-700 hover:border-brand flex size-8 items-center justify-center rounded-full border disabled:opacity-40"
              >
                <Plus className="size-3.5" aria-hidden />
              </button>
            </div>
          </div>

          <div className="border-ink-300 mt-4 space-y-1.5 border-t pt-4">
            <div className="flex justify-between text-sm">
              <span className="text-ink-600">
                {labelOf(tType, selected.name)} × {quantity}
              </span>
              <span className="text-ink-900 font-medium">
                {isFree ? t("freeTicket") : formatKzt(subtotal, locale)}
              </span>
            </div>
            <div className="flex justify-between pt-1 text-base font-bold">
              <span className="text-ink-900">{t("total")}</span>
              <span className="text-ink-900">
                {isFree ? t("freeTicket") : formatKzt(subtotal, locale)}
              </span>
            </div>
          </div>
        </>
      ) : null}

      {disabled ? (
        <p className="bg-warning-bg text-warning mt-5 rounded-lg px-3 py-2.5 text-xs font-medium">
          {disabledReason}
        </p>
      ) : (
        <>
          <button
            type="button"
            disabled
            className={cn(buttonVariants(), "mt-5 h-11 w-full text-sm font-bold")}
          >
            {isFree ? t("register") : t("buyTickets")}
          </button>
          <p className="text-ink-500 mt-2 text-center text-xs">{t("checkoutSoon")}</p>
        </>
      )}
    </div>
  );
}
