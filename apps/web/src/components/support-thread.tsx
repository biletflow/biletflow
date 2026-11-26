"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

type Message = {
  id: string;
  body: string;
  isSystem: boolean;
  createdAt: string;
  author: { id: string; name: string; role: string };
};

type SupportCase = {
  id: string;
  reference: string;
  status: string;
  subject: string;
  category: string;
  messages: Message[];
  event: { id: string; title: string; slug: string } | null;
  order: { id: string; reference: string } | null;
  assignee: { id: string; name: string; role: string } | null;
};

const STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_CUSTOMER",
  "RESOLVED",
] as const;

export function SupportThread({
  caseId,
  initialCase,
  canManage,
  currentUserId,
  locale,
}: {
  caseId: string;
  initialCase: SupportCase;
  canManage: boolean;
  currentUserId: string;
  locale: string;
}) {
  const t = useTranslations("support");
  const [supportCase, setSupportCase] = useState(initialCase);
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState(initialCase.status);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (supportCase.status === "RESOLVED") return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/support/cases/${caseId}`);
        if (!response.ok) return;
        const payload = (await response.json()) as { case?: SupportCase };
        if (payload.case) {
          setSupportCase(payload.case);
          setStatus(payload.case.status);
        }
      } catch {
        // Keep the last good thread if a poll fails.
      }
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [caseId, supportCase.status]);

  async function sendReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/support/cases/${caseId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply.trim() }),
      });
      const payload = (await response.json().catch(() => null)) as {
        case?: SupportCase;
      } | null;
      if (!response.ok || !payload?.case) {
        setError(t("errorGeneric"));
        return;
      }
      setSupportCase(payload.case);
      setReply("");
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setPending(false);
    }
  }

  async function changeStatus(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/support/cases/${caseId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = (await response.json().catch(() => null)) as {
        case?: SupportCase;
      } | null;
      if (!response.ok || !payload?.case) {
        setError(t("errorGeneric"));
        return;
      }
      setSupportCase(payload.case);
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setPending(false);
    }
  }

  async function assignToMe(assigneeId: string | null) {
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/support/cases/${caseId}/assignee`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId }),
      });
      const payload = (await response.json().catch(() => null)) as { case?: SupportCase } | null;
      if (!response.ok || !payload?.case) {
        setError(t("errorGeneric"));
        return;
      }
      setSupportCase(payload.case);
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="border-ink-300 rounded-xl border bg-white p-5">
        <p className="text-ink-500 text-xs font-bold tracking-wider uppercase">
          {supportCase.reference}
        </p>
        <h1 className="font-display text-ink-900 mt-1 text-2xl font-extrabold tracking-tight">
          {supportCase.subject}
        </h1>
        <p className="text-ink-600 mt-2 text-sm">
          {t(`categories.${supportCase.category}`)} ·{" "}
          {t(`status.${supportCase.status}`)}
        </p>
        {supportCase.event ? (
          <p className="text-ink-600 mt-1 text-sm">{supportCase.event.title}</p>
        ) : null}
        {supportCase.order ? (
          <p className="text-ink-600 mt-1 text-sm">
            {t("order")}: {supportCase.order.reference}
          </p>
        ) : null}
        {canManage ? <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="font-semibold text-ink-700">{t("assignee")}: {supportCase.assignee?.name ?? t("unassigned")}</span>
          {supportCase.assignee?.id === currentUserId ? <button type="button" className="text-brand font-semibold" disabled={pending} onClick={() => assignToMe(null)}>{t("unassign")}</button> : <button type="button" className="text-brand font-semibold" disabled={pending} onClick={() => assignToMe(currentUserId)}>{t("assignToMe")}</button>}
        </div> : null}
      </div>

      <ul className="space-y-3">
        {supportCase.messages.map((message) => (
          <li
            key={message.id}
            className={`rounded-xl border p-4 ${
              message.isSystem
                ? "border-ink-200 bg-ink-100 text-ink-600 text-sm"
                : "border-ink-300 bg-white"
            }`}
          >
            {!message.isSystem ? (
              <p className="text-ink-500 mb-1 text-xs font-semibold">
                {message.author.name} ·{" "}
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(message.createdAt))}
              </p>
            ) : null}
            <p className="text-ink-900 whitespace-pre-wrap text-sm">
              {message.body}
            </p>
          </li>
        ))}
      </ul>

      {supportCase.status !== "RESOLVED" ? (
        <form
          onSubmit={sendReply}
          className="border-ink-300 space-y-3 rounded-xl border bg-white p-5"
        >
          <label className="block">
            <span className="text-ink-700 text-sm font-semibold">{t("reply")}</span>
            <textarea
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              required
              minLength={1}
              maxLength={5000}
              rows={4}
              className="border-ink-300 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>
          <Button type="submit" disabled={pending}>
            {pending ? t("sending") : t("send")}
          </Button>
        </form>
      ) : null}

      {canManage ? (
        <form
          onSubmit={changeStatus}
          className="border-ink-300 flex flex-wrap items-end gap-3 rounded-xl border bg-white p-5"
        >
          <label className="min-w-48 flex-1">
            <span className="text-ink-700 text-sm font-semibold">
              {t("updateStatus")}
            </span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="border-ink-300 mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
            >
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {t(`status.${value}`)}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" disabled={pending}>
            {t("saveStatus")}
          </Button>
        </form>
      ) : null}

      {error ? (
        <p role="alert" className="text-error text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
