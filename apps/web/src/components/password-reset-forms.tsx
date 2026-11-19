"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { requestPasswordResetSchema } from "@biletflow/shared";

export function ForgotPasswordForm({ locale }: { locale: string }) {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const parsed = requestPasswordResetSchema.safeParse({ email });
    if (!parsed.success) {
      setError(t("errorValidation"));
      return;
    }
    setPending(true);
    const redirectTo = `${window.location.origin}/${locale}/reset-password`;
    const { error: authError } = await authClient.requestPasswordReset({
      email: parsed.data.email,
      redirectTo,
    });
    setPending(false);
    if (authError) {
      setError(t("errorGeneric"));
      return;
    }
    setDone(true);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-ink-900 text-3xl font-extrabold tracking-tight">
        {t("forgotTitle")}
      </h1>
      <p className="text-ink-600 mt-3 text-sm leading-relaxed">{t("forgotLead")}</p>

      {done ? (
        <p role="status" className="border-ink-300 mt-8 rounded-xl border bg-white p-6 text-sm">
          {t("forgotSent")}
        </p>
      ) : (
        <form
          onSubmit={onSubmit}
          className="border-ink-300 mt-8 space-y-4 rounded-xl border bg-white p-6 shadow-sm"
        >
          <label className="block">
            <span className="text-ink-800 text-sm font-semibold">{t("email")}</span>
            <input
              type="email"
              required
              autoComplete="email"
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
          <Button type="submit" disabled={pending} className="h-11 w-full">
            {pending ? t("sendingReset") : t("sendReset")}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm">
        <Link href="/sign-in" className="text-brand font-semibold">
          {t("signInLink")}
        </Link>
      </p>
    </div>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < 10) {
      setError(t("errorValidation"));
      return;
    }
    setPending(true);
    const { error: authError } = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    setPending(false);
    if (authError) {
      setError(t("errorGeneric"));
      return;
    }
    router.replace("/sign-in");
    router.refresh();
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="font-display text-ink-900 text-3xl font-extrabold tracking-tight">
          {t("resetTitle")}
        </h1>
        <p role="alert" className="text-error mt-4 text-sm">
          {t("resetInvalid")}
        </p>
        <p className="mt-6 text-center text-sm">
          <Link href="/forgot-password" className="text-brand font-semibold">
            {t("forgotTitle")}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-ink-900 text-3xl font-extrabold tracking-tight">
        {t("resetTitle")}
      </h1>
      <p className="text-ink-600 mt-3 text-sm leading-relaxed">{t("resetLead")}</p>
      <form
        onSubmit={onSubmit}
        className="border-ink-300 mt-8 space-y-4 rounded-xl border bg-white p-6 shadow-sm"
      >
        <label className="block">
          <span className="text-ink-800 text-sm font-semibold">{t("password")}</span>
          <input
            type="password"
            required
            minLength={10}
            maxLength={200}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="border-ink-300 text-ink-900 mt-1 h-11 w-full rounded-lg border px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          <span className="text-ink-500 mt-1 block text-xs">{t("passwordHint")}</span>
        </label>
        {error ? (
          <p role="alert" className="text-error text-sm font-medium">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} className="h-11 w-full">
          {pending ? t("savingPassword") : t("savePassword")}
        </Button>
      </form>
    </div>
  );
}
