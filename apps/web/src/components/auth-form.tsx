"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { homePathForRole } from "@/lib/auth-home";
import { signInSchema, signUpSchema } from "@biletflow/shared";

type Mode = "sign-in" | "sign-up";

function roleOf(user: unknown) {
  if (user && typeof user === "object" && "role" in user) {
    return String((user as { role?: unknown }).role);
  }
}

function messageKey(error: { code?: string; message?: string; status?: number } | null) {
  const code = error?.code ?? error?.message ?? "";
  if (code === "VALIDATION_FAILED") return "errorValidation";
  if (code === "FORBIDDEN" || error?.status === 403) return "errorForbidden";
  if (code === "USER_ALREADY_EXISTS") return "errorExists";
  if (code === "INVALID_EMAIL_OR_PASSWORD" || error?.status === 401) {
    return "errorInvalid";
  }
  return "errorGeneric";
}

export function AuthForm({ mode }: { mode: Mode }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setError(null);

    const form = new FormData(formEvent.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    if (mode === "sign-in") {
      const parsed = signInSchema.safeParse({ email, password });
      if (!parsed.success) {
        setError(t("errorValidation"));
        return;
      }
      setPending(true);
      const { data, error: authError } = await authClient.signIn.email(parsed.data);
      setPending(false);
      if (authError) {
        setError(t(messageKey(authError)));
        return;
      }
      router.replace(homePathForRole(roleOf(data?.user)));
      router.refresh();
      return;
    }

    const parsed = signUpSchema.safeParse({
      name: String(form.get("name") ?? ""),
      email,
      password,
      locale,
    });
    if (!parsed.success) {
      setError(t("errorValidation"));
      return;
    }
    setPending(true);
    const { data, error: authError } = await authClient.signUp.email(parsed.data);
    setPending(false);
    if (authError) {
      setError(t(messageKey(authError)));
      return;
    }
    router.replace(homePathForRole(roleOf(data?.user)));
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-ink-900 text-3xl font-extrabold tracking-tight">
        {mode === "sign-in" ? t("signInTitle") : t("signUpTitle")}
      </h1>
      <p className="text-ink-600 mt-3 text-sm leading-relaxed">
        {mode === "sign-in" ? t("signInLead") : t("signUpLead")}
      </p>

      <form
        onSubmit={onSubmit}
        className="border-ink-300 mt-8 space-y-4 rounded-xl border bg-white p-6 shadow-sm"
      >
        {mode === "sign-up" ? (
          <label className="block">
            <span className="text-ink-800 text-sm font-semibold">{t("name")}</span>
            <input
              name="name"
              type="text"
              autoComplete="name"
              required
              minLength={2}
              maxLength={120}
              className="border-ink-300 text-ink-900 mt-1 h-11 w-full rounded-lg border px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </label>
        ) : null}

        <label className="block">
          <span className="text-ink-800 text-sm font-semibold">{t("email")}</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="border-ink-300 text-ink-900 mt-1 h-11 w-full rounded-lg border px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </label>

        <label className="block">
          <span className="text-ink-800 text-sm font-semibold">{t("password")}</span>
          <input
            name="password"
            type="password"
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            required
            minLength={mode === "sign-up" ? 10 : 1}
            maxLength={200}
            className="border-ink-300 text-ink-900 mt-1 h-11 w-full rounded-lg border px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          {mode === "sign-up" ? (
            <span className="text-ink-500 mt-1 block text-xs">{t("passwordHint")}</span>
          ) : null}
        </label>

        {error ? (
          <p role="alert" className="text-error text-sm font-medium">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={pending} className="h-11 w-full text-sm font-semibold">
          {pending
            ? mode === "sign-in"
              ? t("signingIn")
              : t("signingUp")
            : mode === "sign-in"
              ? t("submitSignIn")
              : t("submitSignUp")}
        </Button>
      </form>

      <p className="text-ink-600 mt-6 text-center text-sm">
        {mode === "sign-in" ? t("noAccount") : t("haveAccount")}{" "}
        <Link
          href={mode === "sign-in" ? "/sign-up" : "/sign-in"}
          className="text-brand hover:text-brand-dark font-semibold"
        >
          {mode === "sign-in" ? t("signUpLink") : t("signInLink")}
        </Link>
      </p>
      <p className="mt-3 text-center">
        <Link href="/events" className="text-ink-600 hover:text-ink-800 text-sm">
          {t("back")}
        </Link>
      </p>
    </div>
  );
}
