import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

export async function AuthPlaceholder({ mode }: { mode: "sign-in" | "sign-up" }) {
  const t = await getTranslations("auth");

  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="font-display text-ink-900 text-3xl font-extrabold tracking-tight">
        {mode === "sign-in" ? t("signInTitle") : t("signUpTitle")}
      </h1>
      <p className="text-ink-600 mt-3 text-sm leading-relaxed">{t("notReady")}</p>
      <Link
        href="/events"
        className="text-brand hover:text-brand-dark mt-6 inline-block text-sm font-semibold"
      >
        {t("back")}
      </Link>
    </div>
  );
}
