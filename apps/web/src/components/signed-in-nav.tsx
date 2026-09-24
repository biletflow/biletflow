"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";

export function SignedInNav({ name }: { name: string }) {
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
    <div className="flex items-center gap-3">
      <span className="text-ink-800 hidden max-w-40 truncate text-sm font-semibold sm:block">
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
