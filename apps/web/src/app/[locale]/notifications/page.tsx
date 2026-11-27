import { prisma } from "@biletflow/db";
import { NotificationCard } from "@/components/notification-card";
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
    select: { id: true, type: true, payload: true, subject: true, body: true, readAt: true, createdAt: true },
  });
  return <div className="bg-ink-100 min-h-[70vh] px-4 py-10"><div className="mx-auto max-w-3xl">
    <h1 className="font-display text-3xl font-extrabold text-ink-900">{t("title")}</h1>
    <p className="mt-2 text-sm text-ink-600">{t("lead")}</p>
    <ul className="mt-8 space-y-3">{notifications.length === 0 ? <li className="rounded-xl border border-dashed border-ink-300 bg-white p-8 text-center text-ink-600">{t("empty")}</li> : notifications.map((notification) => <NotificationCard
      key={notification.id}
      id={notification.id}
      type={notification.type}
      payload={notification.payload}
      subject={notification.subject}
      body={notification.body}
      read={Boolean(notification.readAt)}
      date={notification.createdAt.toLocaleString(locale)}
      locale={locale}
    />)}</ul>
  </div></div>;
}
