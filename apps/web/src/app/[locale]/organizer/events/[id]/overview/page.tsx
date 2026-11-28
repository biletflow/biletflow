import { prisma } from "@biletflow/db";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import DuplicateEvent from "@/components/organizer/duplicate-event";
import { requirePageRole } from "@/lib/auth-guard";
import { formatKzt, formatEventDateTime } from "@/lib/format";
import { dateKey, summarizeSales } from "@/lib/organizer-report";

const words = {
  en: { back: "All events", title: "Event overview", edit: "Edit event", duplicate: "Duplicate as draft", duplicateError: "Could not duplicate event", capacity: "Ticket capacity", sold: "Sold", remaining: "Available", reserved: "Reserved", refunded: "Refunded tickets", attendance: "Checked in", absent: "Not checked in", gross: "Gross sales", discounts: "Discounts", fees: "Processing fees", refunds: "Refunds", net: "Estimated net revenue", finance: "Sales (simulated KZT)", days: "Sales over time", types: "Ticket types", campaigns: "Campaign sales", orders: "Orders", attendees: "Attendees", history: "Activity history", filter: "Apply filters", from: "From", to: "To", type: "Ticket type", all: "All", action: "Action", none: "No records", date: "Date", name: "Name", email: "Email", status: "Status", total: "Total", count: "Tickets", order: "Order", user: "User", details: "Details", redemptions: "Completed orders", issued: "Issued tickets", note: "Revenue includes orders paid in the selected dates and their recorded refunds and fees. A refund does not return the processing fee. Inventory and attendance reflect current status. Ticket type filters detail rows only. Saved payout rows on the profile are a separate simulated snapshot and are not this net.", limit: "Showing the latest 200 activity entries." },
  ru: { back: "Все мероприятия", title: "Обзор мероприятия", edit: "Редактировать", duplicate: "Копировать в черновик", duplicateError: "Не удалось скопировать", capacity: "Вместимость по билетам", sold: "Продано", remaining: "Доступно", reserved: "Забронировано", refunded: "Возвращено билетов", attendance: "Прошли регистрацию", absent: "Не пришли", gross: "Валовые продажи", discounts: "Скидки", fees: "Комиссии", refunds: "Возвраты", net: "Расчётная чистая выручка", finance: "Продажи (симуляция, KZT)", days: "Продажи по датам", types: "Типы билетов", campaigns: "Продажи по кампаниям", orders: "Заказы", attendees: "Посетители", history: "История действий", filter: "Применить", from: "С", to: "По", type: "Тип билета", all: "Все", action: "Действие", none: "Нет записей", date: "Дата", name: "Имя", email: "Email", status: "Статус", total: "Сумма", count: "Билеты", order: "Заказ", user: "Пользователь", details: "Описание", redemptions: "Завершённые заказы", issued: "Выдано билетов", note: "Выручка учитывает заказы, оплаченные в выбранные даты, их возвраты и комиссии. Возврат не возвращает комиссию. Остатки и посещаемость отражают текущий статус. Тип билета фильтрует детальные строки. Сохранённые выплаты в профиле — отдельный тестовый снимок, это не эта сумма.", limit: "Показаны последние 200 записей истории." },
  kk: { back: "Барлық іс-шаралар", title: "Іс-шара шолуы", edit: "Өңдеу", duplicate: "Жобаға көшіру", duplicateError: "Көшіру мүмкін болмады", capacity: "Билет сыйымдылығы", sold: "Сатылды", remaining: "Қолжетімді", reserved: "Брондалды", refunded: "Қайтарылған билеттер", attendance: "Тіркеліп кірді", absent: "Кірмегендер", gross: "Жалпы сатылым", discounts: "Жеңілдіктер", fees: "Комиссиялар", refunds: "Қайтарымдар", net: "Болжамды таза табыс", finance: "Сатылым (сынақ, KZT)", days: "Күндер бойынша сатылым", types: "Билет түрлері", campaigns: "Науқан сатылымы", orders: "Тапсырыстар", attendees: "Қатысушылар", history: "Әрекет тарихы", filter: "Қолдану", from: "Бастап", to: "Дейін", type: "Билет түрі", all: "Барлығы", action: "Әрекет", none: "Жазба жоқ", date: "Күн", name: "Аты", email: "Email", status: "Күйі", total: "Сома", count: "Билеттер", order: "Тапсырыс", user: "Пайдаланушы", details: "Сипаттама", redemptions: "Аяқталған тапсырыстар", issued: "Берілген билеттер", note: "Табыс таңдалған күндерде төленген тапсырыстарды, қайтарымдар мен комиссияларды қамтиды. Қайтарым комиссияны қайтармайды. Қалдық пен қатысу ағымдағы күйді көрсетеді. Билет түрі егжей-тегжейлі жолдарды сүзеді. Профильдегі сақталған төлемдер бөлек сынақ көшірмесі және бұл сома емес.", limit: "Тарихтың соңғы 200 жазбасы көрсетілген." },
} as const;

function DataTable({ headers, rows, empty }: { headers: string[]; rows: (string | number)[][]; empty: string }) {
  return <div className="overflow-x-auto rounded-xl border border-ink-300 bg-white">
    <table className="w-full text-left text-sm">
      <thead className="bg-ink-200"><tr>{headers.map((heading, i) => <th key={i} className="px-4 py-3">{heading}</th>)}</tr></thead>
      <tbody className="divide-y divide-ink-200">{rows.length ? rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className="px-4 py-3">{cell}</td>)}</tr>) : <tr><td className="px-4 py-5 text-ink-600" colSpan={headers.length}>{empty}</td></tr>}</tbody>
    </table>
  </div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-3"><h2 className="text-xl font-bold">{title}</h2>{children}</section>;
}

export default async function EventOverview({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { user } = await requirePageRole(locale, ["ORGANIZER"]);
  const t = words[locale as keyof typeof words] ?? words.en;
  const query = await searchParams;
  const get = (name: string) => typeof query[name] === "string" ? query[name] : "";
  const from = /^\d{4}-\d{2}-\d{2}$/.test(get("from")) ? get("from") : "";
  const to = /^\d{4}-\d{2}-\d{2}$/.test(get("to")) ? get("to") : "";
  const type = get("type");
  const action = get("action");

  const event = await prisma.event.findFirst({
    where: { id, organizerId: user.id },
    select: {
      title: true, timezone: true, status: true,
      ticketTypes: { orderBy: { displayOrder: "asc" }, select: { id: true, name: true, quantity: true, sold: true, reserved: true, refunded: true } },
      orders: { orderBy: { createdAt: "desc" }, select: { id: true, reference: true, status: true, createdAt: true, paidAt: true, subtotalKzt: true, discountKzt: true, feeKzt: true, totalKzt: true, campaignId: true, user: { select: { name: true } }, items: { select: { ticketTypeId: true, quantity: true, totalKzt: true } }, refunds: { select: { status: true, amountKzt: true } } } },
      tickets: { orderBy: { issuedAt: "desc" }, select: { id: true, status: true, issuedAt: true, ticketTypeId: true, ticketType: { select: { name: true } }, attendee: { select: { fullName: true, email: true } }, order: { select: { reference: true } } } },
      campaigns: { select: { id: true, name: true, redeemed: true } },
      auditEntries: { orderBy: { createdAt: "desc" }, take: 200, select: { createdAt: true, action: true, description: true, actor: { select: { name: true } } } },
    },
  });
  if (!event) notFound();
  const inRange = (date: Date) => {
    const key = dateKey(date, event.timezone);
    return (!from || key >= from) && (!to || key <= to);
  };
  const sales = summarizeSales(event.orders.filter((order) => order.paidAt && inRange(order.paidAt)), event.timezone);
  const types = event.ticketTypes.filter((row) => !type || row.id === type);
  const activeTickets = event.tickets.filter((ticket) => ticket.status === "VALID" || ticket.status === "CHECKED_IN");
  const checkedIn = activeTickets.filter((ticket) => ticket.status === "CHECKED_IN").length;
  const sum = (key: "quantity" | "sold" | "reserved" | "refunded") => event.ticketTypes.reduce((total, row) => total + row[key], 0);
  const capacity = sum("quantity"), sold = sum("sold"), reserved = sum("reserved");
  const money = (value: number) => formatKzt(value, locale);
  const date = (value: Date) => formatEventDateTime(value, locale, event.timezone);
  const cards: [string, string | number][] = [
    [t.capacity, capacity], [t.sold, sold], [t.remaining, Math.max(0, capacity - sold - reserved)],
    [t.reserved, reserved], [t.refunded, sum("refunded")], [t.attendance, checkedIn + " / " + activeTickets.length],
    [t.absent, activeTickets.length - checkedIn], [t.issued, sales.totals.tickets],
  ];
  const financial: [string, string][] = [[t.gross, money(sales.totals.gross)], [t.discounts, money(sales.totals.discounts)], [t.fees, money(sales.totals.fees)], [t.refunds, money(sales.totals.refunds)], [t.net, money(sales.totals.net)]];
  const inputStyle = "rounded-lg border border-ink-300 bg-white px-3 py-2";
  return <main className="min-h-[70vh] bg-ink-100">
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6">
      <a className="text-brand text-sm underline" href={"/" + locale + "/organizer"}>{t.back}</a>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-brand text-sm font-bold">{t.title}</p><h1 className="font-display text-3xl font-extrabold">{event.title}</h1></div>
        <div className="flex gap-3"><a className="rounded-lg bg-brand px-4 py-2 font-semibold text-white" href={"/" + locale + "/organizer/events/" + id}>{t.edit}</a><DuplicateEvent id={id} locale={locale} label={t.duplicate} errorLabel={t.duplicateError} /></div>
      </div>
      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-ink-300 bg-white p-4">
        <label className="grid gap-1 text-sm">{t.from}<input className={inputStyle} type="date" name="from" defaultValue={from} /></label>
        <label className="grid gap-1 text-sm">{t.to}<input className={inputStyle} type="date" name="to" defaultValue={to} /></label>
        <label className="grid gap-1 text-sm">{t.type}<select className={inputStyle} name="type" defaultValue={type}><option value="">{t.all}</option>{event.ticketTypes.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
        <label className="grid gap-1 text-sm">{t.action}<select className={inputStyle} name="action" defaultValue={action}><option value="">{t.all}</option>{[...new Set(event.auditEntries.map((entry) => entry.action))].sort().map((item) => <option key={item}>{item}</option>)}</select></label>
        <button className="rounded-lg bg-ink-900 px-4 py-2 font-semibold text-white" type="submit">{t.filter}</button>
      </form>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{cards.map(([label, value]) => <div key={label} className="rounded-xl border border-ink-300 bg-white p-4"><p className="text-sm text-ink-600">{label}</p><p className="mt-2 text-xl font-bold">{value}</p></div>)}</div>
      <Section title={t.finance}>
        <p className="text-sm text-ink-600">{t.note}</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{financial.map(([label, value]) => <div key={label} className="rounded-xl border border-ink-300 bg-white p-4"><p className="text-sm text-ink-600">{label}</p><p className="mt-2 text-xl font-bold">{value}</p></div>)}</div>
      </Section>
      <Section title={t.days}><DataTable headers={[t.date, t.total]} rows={[...sales.byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, amount]) => [day, money(amount)])} empty={t.none}/></Section>
      <Section title={t.types}><DataTable headers={[t.name, t.capacity, t.sold, t.reserved, t.remaining, t.refunded, t.issued, t.total]} rows={types.map((row) => [row.name, row.quantity, row.sold, row.reserved, Math.max(0, row.quantity - row.sold - row.reserved), row.refunded, sales.byType.get(row.id)?.quantity ?? 0, money(sales.byType.get(row.id)?.total ?? 0)])} empty={t.none}/></Section>
      <Section title={t.campaigns}><DataTable headers={[t.name, t.redemptions, t.count, t.gross, t.discounts, t.total]} rows={event.campaigns.map((row) => { const info = sales.byCampaign.get(row.id); return [row.name, info?.orders ?? 0, info?.tickets ?? 0, money(info?.gross ?? 0), money(info?.discount ?? 0), money(info?.net ?? 0)]; })} empty={t.none}/></Section>
      <Section title={t.orders}><DataTable headers={[t.order, t.user, t.date, t.status, t.total]} rows={event.orders.filter((order) => inRange(order.paidAt ?? order.createdAt) && (!type || order.items.some((item) => item.ticketTypeId === type))).map((order) => [order.reference, order.user.name, date(order.createdAt), order.status, money(order.totalKzt)])} empty={t.none}/></Section>
      <Section title={t.attendees}><DataTable headers={[t.name, t.email, t.type, t.order, t.status]} rows={event.tickets.filter((ticket) => inRange(ticket.issuedAt) && (!type || ticket.ticketTypeId === type)).map((ticket) => [ticket.attendee.fullName, ticket.attendee.email, ticket.ticketType.name, ticket.order.reference, ticket.status])} empty={t.none}/></Section>
      <Section title={t.history}><p className="text-sm text-ink-600">{t.limit}</p><DataTable headers={[t.date, t.user, t.action, t.details]} rows={event.auditEntries.filter((entry) => inRange(entry.createdAt) && (!action || entry.action === action)).map((entry) => [date(entry.createdAt), entry.actor?.name ?? "System", entry.action, entry.description])} empty={t.none}/></Section>
    </div>
  </main>;
}
