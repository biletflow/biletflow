import { setRequestLocale } from "next-intl/server";

import { AuthForm } from "@/components/auth-form";
import { redirect } from "@/i18n/navigation";
import { getSessionUser, roleOf } from "@/lib/auth-guard";
import { homePathForRole } from "@/lib/auth-home";

export default async function SignInPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getSessionUser();
  if (user) {
    redirect({ href: homePathForRole(roleOf(user)), locale });
  }

  return <AuthForm mode="sign-in" />;
}
