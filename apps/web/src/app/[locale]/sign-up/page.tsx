import { setRequestLocale } from "next-intl/server";

import { AuthPlaceholder } from "@/components/auth-placeholder";

export default async function SignUpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AuthPlaceholder mode="sign-up" />;
}
