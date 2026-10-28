import { redirect as hardRedirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { AuthForm } from "@/components/auth-form";
import { redirect } from "@/i18n/navigation";
import { getSessionUser, roleOf } from "@/lib/auth-guard";
import { homePathForRole, safeNextPath } from "@/lib/auth-home";

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  const next = safeNextPath((await searchParams).next);
  setRequestLocale(locale);

  const user = await getSessionUser();
  if (user) {
    if (next) hardRedirect(`/${locale}${next}`);
    redirect({ href: homePathForRole(roleOf(user)), locale });
  }

  return <AuthForm mode="sign-in" next={next} />;
}
