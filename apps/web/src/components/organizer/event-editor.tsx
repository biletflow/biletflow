"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PaidSalesActivation from "./paid-sales-activation";

type EventData = {
  id: string; title: string; description: string | null; category: string | null;
  startsAt: string; endsAt: string; visibility: "PUBLIC" | "UNLISTED" | "PRIVATE";
  status: string;
  ticketTypes: { id: string; name: string; description?: string | null; quantity: number; sold: number; reserved: number; available: number; priceKzt: number; maxPerOrder: number; isHidden: boolean }[];
};
const copy = {
  en: { heading: "Event editor", title: "Title", description: "Description", category: "Category", start: "Starts at", end: "Ends at", visibility: "Visibility", save: "Save draft", update: "Save changes", ticket: "Ticket type", quantity: "Quantity", price: "Price (KZT)", add: "Add ticket type", publish: "Publish event", back: "Back to events", loading: "Loading event…", error: "Request failed", published: "Event published", required: "Add at least one ticket type before publishing." },
  ru: { heading: "Редактор мероприятия", title: "Название", description: "Описание", category: "Категория", start: "Начало", end: "Конец", visibility: "Видимость", save: "Сохранить черновик", update: "Сохранить изменения", ticket: "Тип билета", quantity: "Количество", price: "Цена (₸)", add: "Добавить тип билета", publish: "Опубликовать", back: "К мероприятиям", loading: "Загрузка…", error: "Ошибка запроса", published: "Мероприятие опубликовано", required: "Для публикации добавьте хотя бы один тип билета." },
  kk: { heading: "Іс-шара редакторы", title: "Атауы", description: "Сипаттама", category: "Санат", start: "Басталуы", end: "Аяқталуы", visibility: "Көрінуі", save: "Жобаны сақтау", update: "Өзгерістерді сақтау", ticket: "Билет түрі", quantity: "Саны", price: "Бағасы (₸)", add: "Билет түрін қосу", publish: "Жариялау", back: "Іс-шараларға қайту", loading: "Жүктелуде…", error: "Сұрау қатесі", published: "Іс-шара жарияланды", required: "Жариялау үшін кемінде бір билет түрін қосыңыз." },
} as const;
function localDate(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
async function request(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method, credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || data.error?.code || `HTTP ${response.status}`);
  return data;
}
export default function EventEditor({ locale, eventId }: { locale: string; eventId?: string }) {
  const t = copy[locale as keyof typeof copy] ?? copy.en;
  const router = useRouter();
  const [form, setForm] = useState({
    title: "", description: "", category: "", startsAt: "", endsAt: "",
    visibility: "PUBLIC" as EventData["visibility"],
  });
  const [event, setEvent] = useState<EventData | null>(null);
  const [ticket, setTicket] = useState({ name: "", priceKzt: 0, quantity: 100 });
  const [busy, setBusy] = useState(false);
  const [editType, setEditType] = useState<string | null>(null);
  const [ticketDraft, setTicketDraft] = useState({ name: "", quantity: 1, priceKzt: 0, maxPerOrder: 10, isHidden: false });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!eventId) return;
    let active = true;
    request(`/api/organizer/events/${eventId}`, "GET")
      .then(({ event }: { event: EventData }) => {
        if (!active) return;
        setEvent(event);
        setForm({
          title: event.title, description: event.description ?? "", category: event.category ?? "",
          startsAt: localDate(event.startsAt), endsAt: localDate(event.endsAt),
          visibility: event.visibility,
        });
      }).catch((e: Error) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [eventId]);
  async function run(operation: () => Promise<void>) {
    setBusy(true); setError(""); setNotice("");
    try { await operation(); } catch (e) { setError(e instanceof Error ? e.message : t.error); }
    finally { setBusy(false); }
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await run(async () => {
      const payload = {
        ...form, description: form.description || undefined, category: form.category || undefined,
        startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString(),
        timezone: "Asia/Almaty", seatingMode: "GENERAL_ADMISSION", refundPolicy: "NO_REFUNDS",
      };
      const { event: saved } = await request(
        event ? `/api/organizer/events/${event.id}` : "/api/organizer/events",
        event ? "PUT" : "POST", payload,
      );
      setEvent(saved);
      if (!eventId) router.replace(`/${locale}/organizer/events/${saved.id}`);
      router.refresh();
    });
  }
  async function addTicket(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!event) return;
    await run(async () => {
      await request(`/api/organizer/events/${event.id}/ticket-types`, "POST", ticket);
      const { event: updated } = await request(`/api/organizer/events/${event.id}`, "GET");
      setEvent(updated);
      setTicket({ name: "", priceKzt: 0, quantity: 100 });
      router.refresh();
    });
  }
  async function updateTicket() {
    if (!event || !editType) return;
    await run(async () => {
      await request(`/api/organizer/ticket-types/${editType}`, "PUT", ticketDraft);
      const { event: updated } = await request(`/api/organizer/events/${event.id}`, "GET");
      setEvent(updated); setEditType(null); router.refresh();
    });
  }
  async function publish() {
    if (!event) return;
    if (!event.ticketTypes.some((type) => type.quantity > 0)) { setError(t.required); return; }
    await run(async () => {
      const { event: updated } = await request(`/api/organizer/events/${event.id}/publish`, "POST");
      setEvent(updated); setNotice(t.published); router.refresh();
    });
  }
  const inputStyle = "mt-1 w-full rounded-lg border border-ink-300 bg-white p-3 text-ink-900";
  const labelStyle = "block text-sm font-semibold text-ink-700";
  return (
    <div className="bg-ink-100 min-h-[70vh] px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-7">
        <a className="text-brand text-sm underline" href={`/${locale}/organizer`}>{t.back}</a>
        <h1 className="font-display text-3xl font-extrabold">{t.heading}</h1>
        {eventId && !event && !error && <p role="status">{t.loading}</p>}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-green-50 p-3 text-green-700">{notice}</p>}
        {(!eventId || event) && <form onSubmit={save} className="space-y-4 rounded-xl border border-ink-300 bg-white p-6">
          <label className={labelStyle}>{t.title}<input required minLength={3} maxLength={200} className={inputStyle} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}/></label>
          <label className={labelStyle}>{t.description}<textarea className={inputStyle} maxLength={20000} rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}/></label>
          <label className={labelStyle}>{t.category}<input className={inputStyle} maxLength={60} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}/></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelStyle}>{t.start}<input required type="datetime-local" className={inputStyle} value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })}/></label>
            <label className={labelStyle}>{t.end}<input required type="datetime-local" min={form.startsAt} className={inputStyle} value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })}/></label>
          </div>
          <label className={labelStyle}>{t.visibility}<select className={inputStyle} value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as EventData["visibility"] })}><option value="PUBLIC">Public</option><option value="UNLISTED">Unlisted</option><option value="PRIVATE">Private</option></select></label>
          <button disabled={busy} className="bg-brand rounded-lg px-5 py-3 font-bold text-white disabled:opacity-50">{event ? t.update : t.save}</button>
        </form>}
        {event && <section className="space-y-4 rounded-xl border border-ink-300 bg-white p-6">
          <h2 className="text-xl font-bold">{t.ticket}</h2>
          <div className="space-y-3">{event.ticketTypes.map((type) => <div key={type.id} className="rounded-lg border border-ink-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><strong>{type.name}{type.isHidden ? " (hidden)" : ""}</strong>
            <button type="button" className="text-brand underline" onClick={() => { setEditType(type.id); setTicketDraft({ name: type.name, quantity: type.quantity, priceKzt: type.priceKzt, maxPerOrder: type.maxPerOrder, isHidden: type.isHidden }); }}> {locale === "ru" ? "Изменить" : locale === "kk" ? "Өзгерту" : "Edit"}</button></div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              {(["quantity","sold","reserved","available"] as const).map((key) => <span key={key}>{key}: {type[key]}</span>)}
            </div>
          </div>)}</div>
          {editType && <div className="space-y-3 rounded-lg border border-ink-300 p-4">
            <label className={labelStyle}>{t.ticket}<input className={inputStyle} value={ticketDraft.name} onChange={(e) => setTicketDraft({ ...ticketDraft, name: e.target.value })}/></label>
            <label className={labelStyle}>{t.quantity}<input type="number" min={1} className={inputStyle} value={ticketDraft.quantity} onChange={(e) => setTicketDraft({ ...ticketDraft, quantity: Number(e.target.value) })}/></label>
            <label className={labelStyle}>{t.price}<input type="number" min={0} className={inputStyle} value={ticketDraft.priceKzt} onChange={(e) => setTicketDraft({ ...ticketDraft, priceKzt: Number(e.target.value) })}/></label>
            <label className="flex gap-2"><input type="checkbox" checked={ticketDraft.isHidden} onChange={(e) => setTicketDraft({ ...ticketDraft, isHidden: e.target.checked })}/>{locale === "ru" ? "Скрыть из продажи" : locale === "kk" ? "Сатылымнан жасыру" : "Hide from sale"}</label>
            <div className="flex gap-3"><button type="button" disabled={busy} onClick={updateTicket} className="bg-brand rounded-lg px-4 py-2 text-white">{t.update}</button><button type="button" onClick={() => setEditType(null)}>Cancel</button></div>
          </div>}
          <form onSubmit={addTicket} className="grid gap-3 sm:grid-cols-3">
            <label className={labelStyle}>{t.ticket}<input required className={inputStyle} value={ticket.name} onChange={(e) => setTicket({ ...ticket, name: e.target.value })}/></label>
            <label className={labelStyle}>{t.quantity}<input required type="number" min={1} max={1000000} className={inputStyle} value={ticket.quantity} onChange={(e) => setTicket({ ...ticket, quantity: Number(e.target.value) })}/></label>
            <label className={labelStyle}>{t.price}<input required type="number" min={0} step={1} className={inputStyle} value={ticket.priceKzt} onChange={(e) => setTicket({ ...ticket, priceKzt: Number(e.target.value) })}/></label>
            <button disabled={busy} className="bg-ink-900 rounded-lg px-5 py-3 font-bold text-white disabled:opacity-50 sm:col-span-3">{t.add}</button>
          </form>
          {event.status === "DRAFT" && <button type="button" disabled={busy || event.ticketTypes.length === 0} onClick={publish} className="bg-brand rounded-lg px-5 py-3 font-bold text-white disabled:opacity-50">{t.publish}</button>}
        </section>}
        {event && <PaidSalesActivation eventId={event.id} locale={locale} />}
      </div>
    </div>
  );
}
