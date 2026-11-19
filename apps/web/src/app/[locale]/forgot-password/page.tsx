import { setRequestLocale } from "next-intl/server";

import { ForgotPasswordForm } from "@/components/password-reset-forms";

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ForgotPasswordForm locale={locale} />;
}
