"use client";

import { EventCover } from "@/components/event-cover";
import { formatEventDateTime, formatKzt } from "@/lib/format";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import EventCampaigns from "./event-campaigns";
import PaidSalesActivation from "./paid-sales-activation";
import { canPublish, hasEnoughInventory, validateEventDates } from "@/lib/organizer-editor-validation";

type EventData = {
  id: string; title: string; description: string | null; category: string | null;
  venueId: string | null; coverImageUrl: string | null; timezone: string; seatingMode: string; refundPolicy: string;
  startsAt: string; endsAt: string; visibility: "PUBLIC" | "UNLISTED" | "PRIVATE";
  status: string;
  ticketTypes: { id: string; name: string; description?: string | null; quantity: number; sold: number; reserved: number; available: number; priceKzt: number; maxPerOrder: number; isHidden: boolean }[];
};
const copy = {
  en: { heading: "Event editor", title: "Title", description: "Description", category: "Category", start: "Starts at", end: "Ends at", visibility: "Visibility", save: "Save draft", update: "Save changes", ticket: "Ticket type", quantity: "Quantity", price: "Price (KZT)", add: "Add ticket type", publish: "Publish event", unpublish: "Unpublish event", duplicate: "Duplicate event", cancelEvent: "Cancel event", preview: "Preview", back: "Back to events", loading: "Loading event…", error: "Request failed", published: "Event published", required: "Add at least one visible ticket type before publishing.", dates: "End date must be after the start date.", stock: "Quantity cannot be lower than sold and reserved tickets.", cancel: "Cancel", hidden: "Hidden", edit: "Edit", sold: "Sold", reserved: "Reserved", available: "Available", saved: "Changes saved.", added: "Ticket type added.", previewTitle: "Event preview", previewEmpty: "Save the event before previewing it." },
  ru: { heading: "Редактор мероприятия", title: "Название", description: "Описание", category: "Категория", start: "Начало", end: "Конец", visibility: "Видимость", save: "Сохранить черновик", update: "Сохранить изменения", ticket: "Тип билета", quantity: "Количество", price: "Цена (₸)", add: "Добавить тип билета", publish: "Опубликовать", unpublish: "Снять с публикации", duplicate: "Дублировать", cancelEvent: "Отменить мероприятие", preview: "Предпросмотр", back: "К мероприятиям", loading: "Загрузка…", error: "Ошибка запроса", published: "Мероприятие опубликовано", required: "Для публикации добавьте хотя бы один видимый тип билета.", dates: "Дата окончания должна быть позже даты начала.", stock: "Количество не может быть меньше суммы проданных и зарезервированных билетов.", cancel: "Отмена", hidden: "Скрыт", edit: "Изменить", sold: "Продано", reserved: "Забронировано", available: "Доступно", saved: "Изменения сохранены.", added: "Тип билета добавлен.", previewTitle: "Предпросмотр мероприятия", previewEmpty: "Сначала сохраните мероприятие." },
  kk: { heading: "Іс-шара редакторы", title: "Атауы", description: "Сипаттама", category: "Санат", start: "Басталуы", end: "Аяқталуы", visibility: "Көрінуі", save: "Жобаны сақтау", update: "Өзгерістерді сақтау", ticket: "Билет түрі", quantity: "Саны", price: "Бағасы (₸)", add: "Билет түрін қосу", publish: "Жариялау", unpublish: "Жариялауды тоқтату", duplicate: "Көшірмелеу", cancelEvent: "Іс-шарадан бас тарту", preview: "Алдын ала көру", back: "Іс-шараларға қайту", loading: "Жүктелуде…", error: "Сұрау қатесі", published: "Іс-шара жарияланды", required: "Жариялау үшін кемінде бір көрінетін билет түрін қосыңыз.", dates: "Аяқталу күні басталу күнінен кейін болуы тиіс.", stock: "Билет саны сатылған және брондалған билеттерден аз болмауы тиіс.", cancel: "Бас тарту", hidden: "Жасырылған", edit: "Өңдеу", sold: "Сатылды", reserved: "Брондалды", available: "Қолжетімді", saved: "Өзгерістер сақталды.", added: "Билет түрі қосылды.", previewTitle: "Іс-шараны алдын ала көру", previewEmpty: "Алдымен іс-шараны сақтаңыз." },
} as const;
type Venue = { id: string; city: string; name: string; address: string };
const locationCopy = {
  en: { city: "City", venue: "Venue", cover: "Cover image URL", all: "All cities", none: "None", public: "Public", unlisted: "Link only", private: "Private", venueError: "Venues could not be loaded." },
  ru: { city: "Город", venue: "Площадка", cover: "Ссылка на обложку", all: "Все города", none: "Не указано", public: "Открытое", unlisted: "По ссылке", private: "Закрытое", venueError: "Не удалось загрузить площадки." },
  kk: { city: "Қала", venue: "Өтетін орын", cover: "Мұқаба суретінің сілтемесі", all: "Барлық қала", none: "Көрсетілмеген", public: "Ашық", unlisted: "Сілтеме арқылы", private: "Жабық", venueError: "Өтетін орындарды жүктеу мүмкін болмады." },
};

function localDate(value: string | number, timeZone: string, seconds = false) {
  const options = { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" } as const;
  const formatter = new Intl.DateTimeFormat("sv-SE", options);
  const parts = Object.fromEntries(formatter.formatToParts(new Date(value)).map(({type, value}) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}${seconds ? `:${parts.second}` : ""}`;
}

function eventInstant(value: string, zone: string, original?: string) {
  if (!value) return null;
  if (original && localDate(original, zone) === value) return new Date(original);
  const wall = Date.parse(`${value}Z`);
  if (!Number.isFinite(wall)) return null;
  for (const reference of [wall - 86_400_000, wall + 86_400_000]) {
    const offset = Date.parse(`${localDate(reference, zone, true)}Z`) - reference;
    const instant = new Date(wall - offset);
    if (localDate(instant.getTime(), zone) === value) return instant;
  }
  return null;
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
  const place = locationCopy[locale as keyof typeof locationCopy] ?? locationCopy.en;
  const router = useRouter();
  const [form, setForm] = useState({
    title: "", description: "", category: "", startsAt: "", endsAt: "",
    visibility: "PUBLIC" as EventData["visibility"], venueId: "", coverImageUrl: "",
  });
  const [event, setEvent] = useState<EventData | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [city, setCity] = useState<string | null>(null);
  const [venueError, setVenueError] = useState(false);
  const zone = event?.timezone ?? "Asia/Almaty";
  const venue = venues.find((item) => item.id === form.venueId);
  const selectedCity = city ?? venue?.city ?? "";
  const [ticket, setTicket] = useState({ name: "", priceKzt: 0, quantity: 100 });
  const [busy, setBusy] = useState(false);
  const [editType, setEditType] = useState<string | null>(null);
  const [ticketDraft, setTicketDraft] = useState({ name: "", quantity: 1, priceKzt: 0, maxPerOrder: 10, isHidden: false });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [previewing, setPreviewing] = useState(false);
  useEffect(() => {
    let active = true;
    request("/api/organizer/venues", "GET")
      .then(({ venues }: { venues: Venue[] }) => { if (active) setVenues(venues); })
      .catch(() => { if (active) setVenueError(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!eventId) return;
    let active = true;
    request(`/api/organizer/events/${eventId}`, "GET")
      .then(({ event }: { event: EventData }) => {
        if (!active) return;
        setEvent(event);
        setForm({
          title: event.title, description: event.description ?? "", category: event.category ?? "",
          startsAt: localDate(event.startsAt, event.timezone), endsAt: localDate(event.endsAt, event.timezone),
          venueId: event.venueId ?? "", coverImageUrl: event.coverImageUrl ?? "",
          visibility: event.visibility,
        });
      }).catch((e: Error) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [eventId]);
  async function run(operation: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try { await operation(); } catch (e) { setError(e instanceof Error ? e.message : t.error); }
    finally { setBusy(false); }
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (validateEventDates(form.startsAt, form.endsAt)) { setError(t.dates); return; }
    const start = eventInstant(form.startsAt, zone, event?.startsAt);
    const end = eventInstant(form.endsAt, zone, event?.endsAt);
    if (!start || !end || end <= start) { setError(t.dates); return; }
    await run(async () => {
      const payload = {
        ...form, description: form.description || undefined, category: form.category || null, venueId: form.venueId || null, coverImageUrl: form.coverImageUrl || null,
        startsAt: start.toISOString(), endsAt: end.toISOString(),
        timezone: zone, seatingMode: event?.seatingMode ?? "GENERAL_ADMISSION", refundPolicy: event?.refundPolicy ?? "NO_REFUNDS",
      };
      const { event: saved } = await request(
        event ? `/api/organizer/events/${event.id}` : "/api/organizer/events",
        event ? "PUT" : "POST", payload,
      );
      setEvent(saved);
      if (!eventId) router.replace(`/${locale}/organizer/events/${saved.id}`);
      setNotice(t.saved);
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
      setNotice(t.added);
      router.refresh();
    });
  }
  async function updateTicket() {
    if (!event || !editType) return;
    const current = event.ticketTypes.find((type) => type.id === editType);
    if (!current) return;
    if (!hasEnoughInventory(ticketDraft.quantity, current.sold, current.reserved)) { setError(t.stock); return; }
    await run(async () => {
      await request(`/api/organizer/ticket-types/${editType}`, "PUT", ticketDraft);
      const { event: updated } = await request(`/api/organizer/events/${event.id}`, "GET");
      setEvent(updated); setEditType(null); setNotice(t.saved); router.refresh();
    });
  }
  async function publish() {
    if (!event) return;
    if (!canPublish(event.ticketTypes)) { setError(t.required); return; }
    await run(async () => {
      const { event: updated } = await request(`/api/organizer/events/${event.id}/publish`, "POST");
      setEvent(updated); setNotice(t.published); router.refresh();
    });
  }
  async function lifecycle(action: "unpublish" | "duplicate" | "cancel") {
    if (!event) return;
    await run(async () => {
      const body = action === "cancel" ? { reason: window.prompt(t.cancelEvent) ?? "Organizer cancellation" } : undefined;
      const { event: updated } = await request(`/api/organizer/events/${event.id}/${action}`, "POST", body);
      if (action === "duplicate") {
        router.replace(`/${locale}/organizer/events/${updated.id}`);
        return;
      }
      setEvent(updated);
      setNotice(action === "unpublish" ? t.saved : t.cancelEvent);
      router.refresh();
    });
  }
  const inputStyle = "mt-1 w-full rounded-lg border border-ink-300 bg-white p-3 text-ink-900";
  const labelStyle = "block text-sm font-semibold text-ink-700";
  return (
    <div className="bg-ink-100 min-h-[70vh] px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-7">
        <a className="text-brand text-sm underline" href={`/${locale}/organizer`}>{t.back}</a>
        <h1 className="font-display text-3xl font-extrabold">{t.heading}</h1>
        {event && <div className="flex flex-wrap gap-3">
          <button type="button" className="rounded-lg border border-brand px-4 py-2 font-semibold text-brand" onClick={() => setPreviewing(true)}>{t.preview}</button>
          {event.status === "DRAFT" && <button type="button" disabled={busy} className="bg-brand rounded-lg px-4 py-2 font-semibold text-white disabled:opacity-50" onClick={publish}>{t.publish}</button>}
          {event.status === "PUBLISHED" && <button type="button" disabled={busy} className="rounded-lg border border-ink-300 px-4 py-2 font-semibold disabled:opacity-50" onClick={() => lifecycle("unpublish")}>{t.unpublish}</button>}
          {(event.status === "DRAFT" || event.status === "PUBLISHED") && <button type="button" disabled={busy} className="rounded-lg border border-ink-300 px-4 py-2 font-semibold disabled:opacity-50" onClick={() => lifecycle("duplicate")}>{t.duplicate}</button>}
          {(event.status === "DRAFT" || event.status === "PUBLISHED") && <button type="button" disabled={busy} className="rounded-lg border border-red-300 px-4 py-2 font-semibold text-red-700 disabled:opacity-50" onClick={() => lifecycle("cancel")}>{t.cancelEvent}</button>}
        </div>}
        {previewing && event && <div role="region" aria-label={t.previewTitle} className="rounded-xl border border-brand/30 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">{t.previewTitle}</h2><button type="button" onClick={() => setPreviewing(false)}>{t.cancel}</button></div>
          <div className="relative mt-4 h-44 overflow-hidden rounded-xl"><EventCover category={form.category} image={form.coverImageUrl} /></div>
          <p className="mt-4 text-sm font-semibold text-brand">{form.category}</p>
          <h3 className="text-2xl font-extrabold">{form.title}</h3>
          <p className="mt-2 text-sm">{eventInstant(form.startsAt, zone, event.startsAt) ? formatEventDateTime(eventInstant(form.startsAt, zone, event.startsAt)!, locale, zone) : ""}</p>
          {venue && <p className="text-sm">{venue.name} · {venue.address} · {venue.city}</p>}
          <p className="mt-3 whitespace-pre-wrap text-ink-700">{form.description}</p>
          <div className="mt-4 space-y-2">{event.ticketTypes.filter((type) => !type.isHidden).map((type) => <div key={type.id} className="flex justify-between rounded-lg border border-ink-200 p-3"><span>{type.name}</span><span>{formatKzt(type.priceKzt, locale)}</span></div>)}</div>
        </div>}
        {eventId && !event && !error && <p role="status">{t.loading}</p>}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-green-50 p-3 text-green-700">{notice}</p>}
        {(!eventId || event) && <form onSubmit={save} className="space-y-4 rounded-xl border border-ink-300 bg-white p-6">
          <label className={labelStyle}>{t.title}<input required minLength={3} maxLength={200} className={inputStyle} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}/></label>
          <label className={labelStyle}>{t.description}<textarea className={inputStyle} maxLength={20000} rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}/></label>
          <label className={labelStyle}>{t.category}<select className={inputStyle} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option value="">{place.none}</option>{[...new Set(["Music", "Community", "Technology", "Film", form.category])].filter(Boolean).map((item) => <option key={item}>{item}</option>)}</select></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelStyle}>{place.city}<select className={inputStyle} value={selectedCity} onChange={(e) => setCity(e.target.value)}><option value="">{place.all}</option>{[...new Set(venues.map((item) => item.city))].map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className={labelStyle}>{place.venue}<select className={inputStyle} value={form.venueId} disabled={venueError} onChange={(e) => setForm({ ...form, venueId: e.target.value })}><option value="">{place.none}</option>{form.venueId && !venue && <option value={form.venueId}>{place.venue}</option>}{venues.filter((item) => !selectedCity || item.city === selectedCity || item.id === form.venueId).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.address}</option>)}</select></label>
          </div>
          {venueError && <p role="status">{place.venueError}</p>}
          <label className={labelStyle}>{place.cover}<input type="url" pattern={form.coverImageUrl === event?.coverImageUrl ? undefined : "https://.+"} className={inputStyle} value={form.coverImageUrl} onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })}/></label>
          <p className="text-sm text-ink-600">{zone}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelStyle}>{t.start}<input required type="datetime-local" className={inputStyle} value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })}/></label>
            <label className={labelStyle}>{t.end}<input required type="datetime-local" min={form.startsAt} className={inputStyle} value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })}/></label>
          </div>
          <label className={labelStyle}>{t.visibility}<select className={inputStyle} value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as EventData["visibility"] })}><option value="PUBLIC">{place.public}</option><option value="UNLISTED">{place.unlisted}</option><option value="PRIVATE">{place.private}</option></select></label>
          <button disabled={busy} className="bg-brand rounded-lg px-5 py-3 font-bold text-white disabled:opacity-50">{event ? t.update : t.save}</button>
        </form>}
        {event && <section className="space-y-4 rounded-xl border border-ink-300 bg-white p-6">
          <h2 className="text-xl font-bold">{t.ticket}</h2>
          <div className="space-y-3">{event.ticketTypes.map((type) => <div key={type.id} className="rounded-lg border border-ink-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><strong>{type.name}{type.isHidden ? ` (${t.hidden})` : ""}</strong>
            <button type="button" className="text-brand underline" onClick={() => { setEditType(type.id); setTicketDraft({ name: type.name, quantity: type.quantity, priceKzt: type.priceKzt, maxPerOrder: type.maxPerOrder, isHidden: type.isHidden }); }}> {t.edit}</button></div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              {(["quantity","sold","reserved","available"] as const).map((key) => <span key={key}>{key === "quantity" ? t.quantity : t[key]}: {type[key]}</span>)}
            </div>
          </div>)}</div>
          {editType && <div className="space-y-3 rounded-lg border border-ink-300 p-4">
            <label className={labelStyle}>{t.ticket}<input className={inputStyle} value={ticketDraft.name} onChange={(e) => setTicketDraft({ ...ticketDraft, name: e.target.value })}/></label>
            <label className={labelStyle}>{t.quantity}<input type="number" min={1} className={inputStyle} value={ticketDraft.quantity} onChange={(e) => setTicketDraft({ ...ticketDraft, quantity: Number(e.target.value) })}/></label>
            <label className={labelStyle}>{t.price}<input type="number" min={0} className={inputStyle} value={ticketDraft.priceKzt} onChange={(e) => setTicketDraft({ ...ticketDraft, priceKzt: Number(e.target.value) })}/></label>
            <label className="flex gap-2"><input type="checkbox" checked={ticketDraft.isHidden} onChange={(e) => setTicketDraft({ ...ticketDraft, isHidden: e.target.checked })}/>{locale === "ru" ? "Скрыть из продажи" : locale === "kk" ? "Сатылымнан жасыру" : "Hide from sale"}</label>
            <div className="flex gap-3"><button type="button" disabled={busy} onClick={updateTicket} className="bg-brand rounded-lg px-4 py-2 text-white">{t.update}</button><button type="button" onClick={() => setEditType(null)}>{t.cancel}</button></div>
          </div>}
          <form onSubmit={addTicket} className="grid gap-3 sm:grid-cols-3">
            <label className={labelStyle}>{t.ticket}<input required className={inputStyle} value={ticket.name} onChange={(e) => setTicket({ ...ticket, name: e.target.value })}/></label>
            <label className={labelStyle}>{t.quantity}<input required type="number" min={1} max={1000000} className={inputStyle} value={ticket.quantity} onChange={(e) => setTicket({ ...ticket, quantity: Number(e.target.value) })}/></label>
            <label className={labelStyle}>{t.price}<input required type="number" min={0} step={1} className={inputStyle} value={ticket.priceKzt} onChange={(e) => setTicket({ ...ticket, priceKzt: Number(e.target.value) })}/></label>
            <button disabled={busy} className="bg-ink-900 rounded-lg px-5 py-3 font-bold text-white disabled:opacity-50 sm:col-span-3">{t.add}</button>
          </form>
          {event.status === "DRAFT" && <button type="button" disabled={busy || !canPublish(event.ticketTypes)} onClick={publish} className="bg-brand rounded-lg px-5 py-3 font-bold text-white disabled:opacity-50">{t.publish}</button>}
        </section>}
        {event && <PaidSalesActivation eventId={event.id} locale={locale} />}
        {event && <EventCampaigns eventId={event.id} locale={locale} />}
      </div>
    </div>
  );
}
