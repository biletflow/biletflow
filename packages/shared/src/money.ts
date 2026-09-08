/**
 * All monetary values are whole KZT held in integers. Never use floats for money:
 * a float subtotal will eventually disagree with the sum of its order items.
 */

export const CURRENCY = "KZT" as const;

export type DiscountType = "PERCENT" | "FIXED_KZT";

export interface FeeConfig {
  percent: number;
  fixedKzt: number;
}

export const DEFAULT_FEE_CONFIG: FeeConfig = { percent: 3.5, fixedKzt: 100 };

/** Discount is capped at the subtotal so an order total can never go negative. */
export function computeDiscountKzt(
  subtotalKzt: number,
  discountType: DiscountType,
  discountValue: number,
): number {
  const raw =
    discountType === "PERCENT"
      ? Math.round((subtotalKzt * discountValue) / 100)
      : Math.round(discountValue);

  return Math.max(0, Math.min(raw, subtotalKzt));
}

/** Simulated processing fee, deducted from the organizer payout, not added to the total. */
export function computeProcessingFeeKzt(
  amountKzt: number,
  config: FeeConfig = DEFAULT_FEE_CONFIG,
): number {
  if (amountKzt <= 0) return 0;
  return Math.round((amountKzt * config.percent) / 100) + config.fixedKzt;
}

export interface OrderTotals {
  subtotalKzt: number;
  discountKzt: number;
  feeKzt: number;
  totalKzt: number;
  organizerNetKzt: number;
}

export function computeOrderTotals(
  items: ReadonlyArray<{ unitPriceKzt: number; quantity: number }>,
  discount?: { type: DiscountType; value: number },
  feeConfig: FeeConfig = DEFAULT_FEE_CONFIG,
): OrderTotals {
  const subtotalKzt = items.reduce((sum, item) => sum + item.unitPriceKzt * item.quantity, 0);
  const discountKzt = discount
    ? computeDiscountKzt(subtotalKzt, discount.type, discount.value)
    : 0;
  const totalKzt = subtotalKzt - discountKzt;
  const feeKzt = computeProcessingFeeKzt(totalKzt, feeConfig);

  return {
    subtotalKzt,
    discountKzt,
    feeKzt,
    totalKzt,
    organizerNetKzt: totalKzt - feeKzt,
  };
}

export function formatKzt(amountKzt: number, locale = "ru-KZ"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: CURRENCY,
    maximumFractionDigits: 0,
  }).format(amountKzt);
}
