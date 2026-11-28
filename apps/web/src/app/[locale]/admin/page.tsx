import { prisma } from "@biletflow/db";
import ActivationReviews from "@/components/admin/activation-reviews";
import ModerationReports from "@/components/admin/moderation-reports";
import { listEventReports } from "@/lib/admin";
import { ShieldCheck, UserRound } from "lucide-react";
import { setRequestLocale } from "next-intl/server";

import { requirePageRole } from "@/lib/auth-guard";
import { listAdminUsers } from "@/lib/dashboard";


const adminStatusLabels: Record<string, string[]> =
{
  "ACTIVE": [
    "Active",
    "Активен",
    "Белсенді"
  ],
  "SUSPENDED": [
    "Suspended",
    "Заблокирован",
    "Бұғатталған"
  ],
  "ATTENDEE": [
    "Attendee",
    "Участник",
    "Қатысушы"
  ],
  "ORGANIZER": [
    "Organizer",
    "Организатор",
    "Ұйымдастырушы"
  ],
  "PLATFORM_ADMIN": [
    "Platform admin",
    "Администратор платформы",
    "Платформа әкімшісі"
  ],
  "NOT_STARTED": [
    "Not started",
    "Не начато",
    "Басталмаған"
  ],
  "PENDING_REVIEW": [
    "Pending review",
    "На рассмотрении",
    "Қаралуда"
  ],
  "APPROVED": [
    "Approved",
    "Одобрено",
    "Мақұлданды"
  ],
  "REJECTED": [
    "Rejected",
    "Отклонено",
    "Қабылданбады"
  ],
  "EMAIL VERIFIED": [
    "Email verified",
    "Email подтверждён",
    "Email расталды"
  ],
  "NOT VERIFIED": [
    "Not verified",
    "Не подтверждён",
    "Расталмаған"
  ]
};

function adminLabel(value: string, locale: string) {
  const index = locale === "ru" ? 1 : locale === "kk" ? 2 : 0;
  return adminStatusLabels[value]?.[index] ?? value;
}

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requirePageRole(locale, ["PLATFORM_ADMIN"]);
  const [users, reports] = await Promise.all([listAdminUsers(), listEventReports()]);
  const activations = await prisma.paidSalesActivation.findMany({
    where: {
      OR: [
        { feePaid: true },
        { event: { ticketTypes: { some: { priceKzt: { gt: 0 } } } } },
      ],
    },
    include: { event: { select: { title: true } }, organizer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return (
    <div className="bg-ink-100 min-h-[70vh]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div>
          <p className="text-brand text-xs font-bold tracking-wider uppercase">{locale === "ru" ? "Администратор платформы" : locale === "kk" ? "Платформа әкімшісі" : "Platform admin"}</p>
          <h1 className="font-display text-ink-900 mt-1 text-3xl font-extrabold tracking-tight">
            {locale === "ru" ? "Панель администратора" : locale === "kk" ? "Әкімші тақтасы" : "Admin Dashboard"}
          </h1>
          <p className="text-ink-600 mt-2 text-sm">
            {locale === "ru" ? "Управление пользователями, мероприятиями и заявками платформы." : locale === "kk" ? "Пайдаланушыларды, іс-шараларды және платформа өтінімдерін басқару." : "Manage users, events and platform requests."}
          </p>
        </div>

        <ActivationReviews locale={locale} rows={activations.map((item) => ({ id: item.id, eventTitle: item.event.title, organizerName: item.organizer.name, feePaid: item.feePaid, identityVerified: item.identityVerified }))} />
        <ModerationReports locale={locale} reports={reports} />
        {users.length === 0 ? (
          <div className="border-ink-300 mt-8 rounded-xl border border-dashed bg-white p-12 text-center">
            <p className="text-ink-900 font-bold">{locale === "ru" ? "Пользователи не найдены" : locale === "kk" ? "Пайдаланушылар табылмады" : "No users found"}</p>
            <p className="text-ink-600 mt-1 text-sm">{locale === "ru" ? "Пользователи пока не зарегистрированы." : locale === "kk" ? "Тіркелген пайдаланушылар жоқ." : "No registered users to display."}</p>
          </div>
        ) : (
          <div className="border-ink-300 mt-8 overflow-hidden rounded-xl border bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-ink-200 text-ink-700 text-xs uppercase">
                  <tr>
                    <th className="px-5 py-3 font-bold">{locale === "ru" ? "Пользователь" : locale === "kk" ? "Пайдаланушы" : "User"}</th>
                    <th className="px-5 py-3 font-bold">{locale === "ru" ? "Роль" : locale === "kk" ? "Рөл" : "Role"}</th>
                    <th className="px-5 py-3 font-bold">{locale === "ru" ? "Статус" : locale === "kk" ? "Күй" : "Status"}</th>
                    <th className="px-5 py-3 font-bold">{locale === "ru" ? "Подтверждение" : locale === "kk" ? "Растау" : "Verification"}</th>
                    <th className="px-5 py-3 font-bold">{locale === "ru" ? "Дата регистрации" : locale === "kk" ? "Тіркелген күні" : "Created"}</th>
                  </tr>
                </thead>
                <tbody className="divide-ink-200 divide-y">
                  {users.map((user) => (
                    <tr key={user.id} className="text-ink-700">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="bg-brand-tint text-brand flex size-9 items-center justify-center rounded-full">
                            <UserRound className="size-4" aria-hidden />
                          </span>
                          <div>
                            <p className="text-ink-900 font-semibold">{user.name}</p>
                            <p className="text-ink-500 text-xs">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-medium">{adminLabel(user.role, locale)}</td>
                      <td className="px-5 py-4">{adminLabel(user.status, locale)}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5">
                          <ShieldCheck className="size-4" aria-hidden />
                          {adminLabel(
        user.organizerProfile?.verificationStatus ??
        (user.emailVerified ? "EMAIL VERIFIED" : "NOT VERIFIED"),
        locale
    )}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
                          user.createdAt,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
