import { setRequestLocale } from "next-intl/server";

import { ResetPasswordForm } from "@/components/password-reset-forms";

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  return <ResetPasswordForm token={query.token ?? ""} />;
}
