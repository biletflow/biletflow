import { headers } from "next/headers";
import { setRequestLocale } from "next-intl/server";

import { AuthForm } from "@/components/auth-form";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { homePathForRole } from "@/lib/auth-home";

export default async function SignUpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) {
    redirect({
      href: homePathForRole(
        "role" in session.user ? String(session.user.role) : undefined,
      ),
      locale,
    });
  }

  return <AuthForm mode="sign-up" />;
}
