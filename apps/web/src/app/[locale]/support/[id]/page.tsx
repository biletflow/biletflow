import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect as hardRedirect } from "next/navigation";

import { SupportThread } from "@/components/support-thread";
import { Link } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth-guard";
import {
  canManageSupportCase,
  getSupportCaseOrThrow,
  presentSupportCase,
} from "@/lib/support";

export default async function SupportCasePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const user = await getSessionUser();
  if (!user) {
    hardRedirect(
      `/${locale}/sign-in?next=${encodeURIComponent(`/support/${id}`)}`,
    );
  }

  const t = await getTranslations("support");

  let supportCase;
  try {
    supportCase = await getSupportCaseOrThrow(user, id);
  } catch {
    hardRedirect(`/${locale}/support`);
  }

  const presented = presentSupportCase(supportCase);
  const canManage = await canManageSupportCase(user, supportCase);

  return (
    <div className="bg-ink-100 min-h-[70vh]">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href="/support"
          className="text-brand text-sm font-semibold"
        >
          {t("back")}
        </Link>
        <SupportThread
          caseId={id}
          initialCase={presented}
          canManage={canManage}
          locale={locale}
        />
      </div>
    </div>
  );
}
