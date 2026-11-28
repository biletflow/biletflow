"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Order = {
  id: string;
  reference: string;
  status: string;
  totalKzt: number;
  refundPolicy?: string;
  eventStartsAt?: string;
  eventTitle?: string;
  tickets: { id: string; status: string }[];
};

const copy = {
  en: {
    history: "Order history",
    empty: "No orders yet",
    loading: "Loading orders...",
    refund: "Refund order",
    policy: "Refund policy",
    noRefund: "Tickets for this event are non-refundable.",
    until: (h: number) => `Refundable up to ${h} hours before the event starts.`,
    closed: (h: number) => `Refunds are not available less than ${h} hours before the event.`,
    used: "Checked-in tickets cannot be refunded.",
    unpaid: "Only paid orders can be refunded.",
    confirm: "Refund this order? All tickets will become invalid.",
    failed: "Could not complete the request.",
    success: "Refund completed successfully.",
    support: "Ask about a refund",
    total: "Total",
    paid: "Confirmed",
    refunded: "Refunded",
    pending: "Awaiting payment",
    cancelled: "Cancelled",
    expired: "Expired",
    failedPayment: "Payment failed",
    unknown: "Unavailable",
  },
  ru: {
    history: "История заказов",
    empty: "Заказов пока нет",
    loading: "Загрузка заказов...",
    refund: "Вернуть заказ",
    policy: "Условия возврата",
    noRefund: "Билеты на это мероприятие не подлежат возврату.",
    until: (h: number) => `Возврат возможен не позднее чем за ${h} часов до начала мероприятия.`,
    closed: (h: number) => `До начала мероприятия осталось менее ${h} часов. Возврат недоступен.`,
    used: "Использованные билеты нельзя вернуть.",
    unpaid: "Вернуть можно только оплаченный заказ.",
    confirm: "Вернуть заказ? Все билеты станут недействительными.",
    failed: "Не удалось выполнить запрос.",
    success: "Возврат успешно выполнен.",
    support: "Вопрос о возврате",
    total: "Итого",
    paid: "Подтверждён",
    refunded: "Возвращён",
    pending: "Ожидает оплаты",
    cancelled: "Отменён",
    expired: "Срок истёк",
    failedPayment: "Оплата не прошла",
    unknown: "Недоступно",
  },
  kk: {
    history: "Тапсырыстар тарихы",
    empty: "Тапсырыстар жоқ",
    loading: "Тапсырыстар жүктелуде...",
    refund: "Тапсырысты қайтару",
    policy: "Билетті қайтару шарттары",
    noRefund: "Бұл іс-шараның билеттері қайтарылмайды.",
    until: (h: number) => `Билеттерді іс-шара басталғанға дейін кемінде ${h} сағат бұрын қайтаруға болады.`,
    closed: (h: number) => `Іс-шараның басталуына ${h} сағаттан аз уақыт қалды. Қайтару мүмкін емес.`,
    used: "Пайдаланылған билеттерді қайтару мүмкін емес.",
    unpaid: "Тек төленген тапсырысты қайтаруға болады.",
    confirm: "Тапсырысты қайтару керек пе? Барлық билет жарамсыз болады.",
    failed: "Сұрауды орындау мүмкін болмады.",
    success: "Қайтару сәтті орындалды.",
    support: "Қайтару туралы сұрау",
    total: "Жиыны",
    paid: "Расталды",
    refunded: "Қайтарылды",
    pending: "Төлем күтілуде",
    cancelled: "Бас тартылды",
    expired: "Мерзімі аяқталды",
    failedPayment: "Төлем өтпеді",
    unknown: "Қолжетімсіз",
  },
};

export default function OrderHistory({ locale }: { locale: string }) {
  const t = copy[locale as keyof typeof copy] ?? copy.en;
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    fetch("/api/orders", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error();
        const data = await response.json();
        setOrders(data.orders ?? []);
      })
      .catch(() => setError(t.failed))
      .finally(() => setLoading(false));
  }, [t.failed]);

  function hours(order: Order) {
    return order.refundPolicy === "UNTIL_48H_BEFORE" ? 48
      : order.refundPolicy === "UNTIL_24H_BEFORE" ? 24 : null;
  }

  function blocked(order: Order) {
    if (order.refundPolicy === "NO_REFUNDS") return t.noRefund;
    if (order.tickets.some(ticket => ticket.status === "CHECKED_IN")) return t.used;

    const h = hours(order);
    const start = Date.parse(order.eventStartsAt ?? "");

    if (h !== null && Number.isFinite(start) &&
        start - now < h * 3600000) return t.closed(h);

    return null;
  }

  function errorMessage(reason: string) {
    switch (reason) {
      case "REFUND_NOT_ALLOWED": return t.noRefund;
      case "REFUND_WINDOW_24H": return t.closed(24);
      case "REFUND_WINDOW_48H": return t.closed(48);
      case "REFUND_CHECKED_IN": return t.used;
      case "REFUND_UNPAID": return t.unpaid;
      default: return t.failed;
    }
  }

  async function refund(order: Order) {
    if (busy || blocked(order) || !window.confirm(t.confirm)) return;
    setBusy(order.id);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(order.id)}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(errorMessage(data.error?.reason ?? data.error?.code));
        return;
      }

      setOrders(previous => previous.map(item =>
        item.id === order.id
          ? {
              ...item,
              status: "REFUNDED",
              tickets: item.tickets.map(ticket => ({
                ...ticket, status: "REFUNDED",
              })),
            }
          : item
      ));

      setMessage(t.success);
      router.refresh();
    } catch {
      setError(t.failed);
    } finally {
      setBusy(null);
    }
  }

  const statuses: Record<string, string> = {
    PAID: t.paid,
    REFUNDED: t.refunded,
    AWAITING_PAYMENT: t.pending,
    PENDING: t.pending,
    CANCELLED: t.cancelled,
    EXPIRED: t.expired,
    FAILED: t.failedPayment,
  };

  return (
    <section className="mt-6 space-y-4">
      <h2 className="text-2xl font-bold">{t.history}</h2>

      {loading && <p>{t.loading}</p>}
      {!loading && !orders.length && !error && <p>{t.empty}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
      {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-green-700">{message}</p>}

      {orders.map(order => {
        const reason = blocked(order);
        const h = hours(order);

        return (
          <article key={order.id} className="rounded-xl border border-ink-300 bg-white p-5">
            {order.eventTitle && <h3 className="text-lg font-bold">{order.eventTitle}</h3>}
            <p className="font-semibold">{order.reference}</p>

            <p className="mt-2 text-sm font-medium text-brand">
              {statuses[order.status] ?? t.unknown}
            </p>

            <p className="mt-2">
              {t.total}: {new Intl.NumberFormat(locale, {
                style: "currency",
                currency: "KZT",
                maximumFractionDigits: 0,
              }).format(order.totalKzt)}
            </p>

            {order.status === "PAID" && (
              <div className="mt-4 space-y-3">
                {(reason || h !== null) && (
                  <div className="rounded-lg bg-ink-100 p-3 text-sm">
                    <strong>{t.policy}</strong>
                    <p className="mt-1">{reason ?? (h !== null ? t.until(h) : "")}</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={busy !== null || reason !== null}
                    onClick={() => refund(order)}
                    className="rounded-lg bg-brand px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t.refund}
                  </button>

                  <a
                    href={`/${locale}/support?orderId=${encodeURIComponent(order.id)}`}
                    className="rounded-lg border border-brand px-4 py-2 text-brand"
                  >
                    {t.support}
                  </a>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}