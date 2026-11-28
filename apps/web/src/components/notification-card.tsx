"use client";

import { useState } from "react";
import { ArrowUpRight, Check, Circle } from "lucide-react";
import { useRouter } from "@/i18n/navigation";

type Props = {
  id: string;
  type: string;
  payload: unknown;
  subject: string;
  body: string;
  read: boolean;
  date: string;
  locale: string;
};

const labels = {
  en: {
    open: "Open",
    mark: "Mark as read",
    read: "Read",
    unread: "Unread",
    error: "Could not open notification. Try again.",
  },
  ru: {
    open: "Открыть",
    mark: "Отметить прочитанным",
    read: "Прочитано",
    unread: "Новое",
    error: "Не удалось открыть уведомление. Повторите попытку.",
  },
  kk: {
    open: "Ашу",
    mark: "Оқылған деп белгілеу",
    read: "Оқылды",
    unread: "Жаңа",
    error: "Хабарландыруды ашу мүмкін болмады. Қайталап көріңіз.",
  },
};

export function NotificationCard(props: Props) {
  const router = useRouter();
  const [read, setRead] = useState(props.read);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  const t = labels[
    props.locale === "ru" ? "ru" :
    props.locale === "kk" ? "kk" : "en"
  ];

  const payload =
    props.payload && typeof props.payload === "object"
      ? props.payload as Record<string, unknown>
      : {};

  let href: string | null = null;

  switch (props.type) {
    case "SUPPORT_MESSAGE":
      href = typeof payload.caseId === "string"
        ? "/support/" + encodeURIComponent(payload.caseId)
        : "/support";
      break;

    case "ORDER_CONFIRMATION":
    case "TICKET_DELIVERY":
      href = "/tickets";
      break;

    case "REFUND_COMPLETED":
    case "PAYMENT_FAILED":
    case "EVENT_CANCELLED":
    case "EVENT_UPDATED":
      href = "/tickets?tab=orders";
      break;
  }

  async function open() {
    if (pending) return;

    setPending(true);
    setError(false);

    try {
      if (!read) {
        const response = await fetch(
          "/api/notifications/" + props.id + "/read",
          {
            method: "POST",
            credentials: "same-origin",
          },
        );

        if (!response.ok) {
          throw new Error("Read failed");
        }

        setRead(true);
      }

      if (href) {
        router.push(href);
      }
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => void open()}
        disabled={pending || (read && !href)}
        className={
          "block w-full rounded-xl border bg-white p-5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-default " +
          (read
            ? "border-ink-200"
            : "border-brand") +
          (href || !read
            ? " hover:bg-brand-tint cursor-pointer"
            : "")
        }
      >
        <span className="flex items-start justify-between gap-3">
          <span className="font-bold text-ink-900">
            {props.subject}
          </span>

          {read ? (
            <Check className="size-4 shrink-0 text-ink-500" aria-hidden />
          ) : (
            <Circle className="size-3 shrink-0 fill-brand text-brand" aria-hidden />
          )}
        </span>

        <span className="mt-2 block whitespace-pre-wrap text-sm text-ink-700">
          {props.body}
        </span>

        <span className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-ink-500">{props.date}</span>

          <span className="flex items-center gap-3">
            <span className={read ? "text-ink-500" : "font-semibold text-brand"}>
              {read ? t.read : t.unread}
            </span>

            {(href || !read) && (
              <span className="inline-flex items-center gap-1 font-semibold text-brand">
                {href ? t.open : t.mark}
                {href && <ArrowUpRight className="size-3" aria-hidden />}
              </span>
            )}
          </span>
        </span>
      </button>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {t.error}
        </p>
      )}
    </li>
  );
}
