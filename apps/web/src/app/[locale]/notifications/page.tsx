import { prisma } from "@biletflow/db";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth-guard";

export default async function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/sign-in?next=${encodeURIComponent("/notifications")}`);
  const t = await getTranslations("notifications");
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id, channel: "IN_APP" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, subject: true, body: true, readAt: true, createdAt: true },
  });
  return <div className="bg-ink-100 min-h-[70vh] px-4 py-10"><div className="mx-auto max-w-3xl">
    <h1 className="font-display text-3xl font-extrabold text-ink-900">{t("title")}</h1>
    <p className="mt-2 text-sm text-ink-600">{t("lead")}</p>
    <ul className="mt-8 space-y-3">{notifications.length === 0 ? <li className="rounded-xl border border-dashed border-ink-300 bg-white p-8 text-center text-ink-600">{t("empty")}</li> : notifications.map((notification) => <li key={notification.id} className={`rounded-xl border bg-white p-5 ${notification.readAt ? "border-ink-200" : "border-brand"}`}><p className="font-bold text-ink-900">{notification.subject}</p><p className="mt-2 whitespace-pre-wrap text-sm text-ink-700">{notification.body}</p><time className="mt-3 block text-xs text-ink-500">{notification.createdAt.toLocaleString(locale)}</time></li>)}</ul>
  </div></div>;
}
