"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";

export function SignedInNav({
  name,
  dashboardHref,
  dashboardLabel,
  compact = false,
}: {
  name: string;
  dashboardHref?: "/admin" | "/organizer";
  dashboardLabel?: string;
  compact?: boolean;
}) {
  const t = useTranslations("nav");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <div
      className={
        compact ? "flex flex-col items-start gap-4" : "flex items-center gap-3"
      }
    >
      <Link
        href="/tickets"
        className="text-ink-800 hover:text-brand text-sm font-semibold transition-colors"
      >
        {t("tickets")}
      </Link>
      <Link
        href="/support"
        className="text-ink-800 hover:text-brand text-sm font-semibold transition-colors"
      >
        {t("support")}
      </Link>
      <Link
        href="/notifications"
        className="text-ink-800 hover:text-brand text-sm font-semibold transition-colors"
      >
        {t("notifications")}
      </Link>
      {dashboardHref && dashboardLabel ? (
        <Link
          href={dashboardHref}
          className="text-ink-800 hover:text-brand text-sm font-semibold transition-colors"
        >
          {dashboardLabel}
        </Link>
      ) : null}
      <span className="text-ink-800 max-w-40 truncate text-sm font-semibold">
        {name}
      </span>
      <button
        type="button"
        onClick={signOut}
        disabled={pending}
        className="text-ink-800 hover:text-brand text-sm font-semibold transition-colors disabled:opacity-50"
      >
        {pending ? t("signingOut") : t("signOut")}
      </button>
    </div>
  );
}
