"use client";

import { useCallback, useEffect, useState } from "react";

type Status = "AVAILABLE" | "HELD" | "SOLD" | "UNAVAILABLE";
type Seat = { id: string; number: string; isAccessible: boolean; status: Status };
type Section = { id: string; name: string; rows: { id: string; label: string; seats: Seat[] }[] };
const copy = {
  en: { title: "Seat map", refresh: "Refresh", loading: "Loading seats…", empty: "No sections yet.", section: "Section name", addSection: "Add section", row: "Row label", numbers: "Seat numbers (comma separated)", addRow: "Add row and seats", addSeats: "Add seats", remove: "Delete", confirm: "Remove this seat from the shared venue map?", accessible: "Accessible seats", shared: "The map belongs to the venue. Shared venues can only be edited by a platform admin.", forbidden: "You do not have permission to edit this shared venue.", conflict: "This seat or label is already in use, or the map changed. Refresh and try again.", error: "Seat map request failed.", invalid: "Enter 1–200 unique seat numbers, each up to 20 characters.", readonly: "Map editing is disabled for this event.", AVAILABLE: "Available", HELD: "Held", SOLD: "Sold", UNAVAILABLE: "Unavailable" },
  ru: { title: "Карта мест", refresh: "Обновить", loading: "Загрузка мест…", empty: "Секций пока нет.", section: "Название секции", addSection: "Добавить секцию", row: "Название ряда", numbers: "Номера мест через запятую", addRow: "Добавить ряд и места", addSeats: "Добавить места", remove: "Удалить", confirm: "Удалить место из общей карты зала?", accessible: "Доступные для МГН места", shared: "Карта принадлежит залу. Общий зал может редактировать только администратор платформы.", forbidden: "Нет прав на изменение общей карты зала.", conflict: "Место или название уже используется либо карта изменилась. Обновите и повторите.", error: "Ошибка запроса карты мест.", invalid: "Введите от 1 до 200 уникальных номеров длиной до 20 символов.", readonly: "Редактирование карты для этого мероприятия недоступно.", AVAILABLE: "Свободно", HELD: "Забронировано", SOLD: "Продано", UNAVAILABLE: "Недоступно" },
  kk: { title: "Орындар картасы", refresh: "Жаңарту", loading: "Орындар жүктелуде…", empty: "Секторлар әлі жоқ.", section: "Сектор атауы", addSection: "Сектор қосу", row: "Қатар атауы", numbers: "Орын нөмірлері (үтір арқылы)", addRow: "Қатар мен орындарды қосу", addSeats: "Орын қосу", remove: "Жою", confirm: "Ортақ зал картасынан осы орынды жою керек пе?", accessible: "Қолжетімділікке бейімделген орындар", shared: "Карта залға тиесілі. Ортақ залды тек платформа әкімшісі өңдей алады.", forbidden: "Ортақ залды өңдеуге рұқсат жоқ.", conflict: "Орын не атау қолданыста немесе карта өзгерген. Жаңартып, қайталаңыз.", error: "Орындар картасын жүктеу қатесі.", invalid: "Ұзындығы 20 таңбаға дейінгі 1–200 бірегей нөмір енгізіңіз.", readonly: "Бұл іс-шараның картасын өңдеу мүмкін емес.", AVAILABLE: "Бос", HELD: "Брондалған", SOLD: "Сатылған", UNAVAILABLE: "Қолжетімсіз" },
} as const;
const colors: Record<Status, string> = { AVAILABLE: "bg-green-50 border-green-300 text-green-800", HELD: "bg-amber-50 border-amber-300 text-amber-800", SOLD: "bg-red-50 border-red-300 text-red-800", UNAVAILABLE: "bg-gray-100 border-gray-300 text-gray-700" };
const field = "rounded-lg border border-ink-300 bg-white px-3 py-2";
const button = "rounded-lg bg-brand px-3 py-2 font-semibold text-white disabled:opacity-50";

class SeatRequestError extends Error {
  constructor(readonly status: number) { super(String(status)); }
}

async function api(url: string, method = "GET", body?: unknown) {
  const response = await fetch(url, { method, credentials: "same-origin", cache: "no-store", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) throw new SeatRequestError(response.status);
  return response.json();
}

function SeatForm({ label, rowLabel, disabled, onSubmit, t }: { label: string; rowLabel?: boolean; disabled: boolean; onSubmit: (seats: { number: string; isAccessible: boolean }[], row: string) => Promise<boolean>; t: typeof copy[keyof typeof copy] }) {
  const [row, setRow] = useState("");
  const [numbers, setNumbers] = useState("");
  const [accessible, setAccessible] = useState(false);
  const [invalid, setInvalid] = useState(false);
  return <form className="flex flex-wrap items-end gap-2" onSubmit={async (e) => {
    e.preventDefault();
    const values = numbers.split(",").map((value) => value.trim());
    if (values.length > 200 || values.some((value) => !value || value.length > 20) || new Set(values).size !== values.length) { setInvalid(true); return; }
    setInvalid(false);
    if (await onSubmit(values.map((number) => ({ number, isAccessible: accessible })), row.trim())) { setNumbers(""); setRow(""); }
  }}>
    {rowLabel && <label className="grid gap-1 text-sm">{t.row}<input required maxLength={20} className={field} value={row} onChange={(e) => setRow(e.target.value)} disabled={disabled} /></label>}
    <label className="grid flex-1 gap-1 text-sm">{t.numbers}<input required maxLength={4200} className={field} value={numbers} onChange={(e) => setNumbers(e.target.value)} disabled={disabled} /></label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={accessible} onChange={(e) => setAccessible(e.target.checked)} disabled={disabled} />{t.accessible}</label>
    <button className={button} disabled={disabled}>{label}</button>
    {invalid && <p role="alert" className="w-full text-sm text-red-700">{t.invalid}</p>}
  </form>;
}

export default function OrganizerSeatMap({ eventId, locale, editable }: { eventId: string; locale: string; editable: boolean }) {
  const t = copy[locale as keyof typeof copy] ?? copy.en;
  const base = "/api/organizer/events/" + eventId;
  const [sections, setSections] = useState<Section[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);
  const reload = useCallback(async () => {
    const result = await api(base + "/seats") as { sections: Section[] };
    setSections(result.sections);
  }, [base]);
  useEffect(() => {
    let active = true;
    api(base + "/seats").then((result: { sections: Section[] }) => { if (active) setSections(result.sections); })
      .catch(() => { if (active) setError(t.error); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [base, t.error]);
  async function run(path: string, method = "GET", body?: unknown) {
    if (busy) return false;
    setBusy(true); setError("");
    try {
      if (method !== "GET") await api(base + path, method, body);
      await reload();
      if (method === "GET") setDenied(false);
      return true;
    } catch (e) {
      if (e instanceof SeatRequestError && e.status === 403) { setDenied(true); setError(t.forbidden); }
      else if (e instanceof SeatRequestError && [404, 409].includes(e.status)) { setError(t.conflict); await reload().catch(() => {}); }
      else setError(t.error);
      return false;
    } finally { setBusy(false); }
  }
  const disabled = busy || loading || denied || !editable;
  return <section className="space-y-4 rounded-xl border border-ink-300 bg-white p-6">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">{t.title}</h2><button type="button" disabled={busy || loading} className={button} onClick={() => void run("/seats")}>{t.refresh}</button></div>
    <p className="text-sm text-ink-600">{t.shared}</p>
    {!editable && <p className="text-sm">{t.readonly}</p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
    {loading ? <p role="status">{t.loading}</p> : <>
      <div className="flex flex-wrap gap-2 text-xs">{(Object.keys(colors) as Status[]).map((status) => <span key={status} className={"rounded border px-2 py-1 " + colors[status]}>{t[status]}: {sections.flatMap((s) => s.rows.flatMap((r) => r.seats)).filter((seat) => seat.status === status).length}</span>)}</div>
      {sections.length === 0 && <p>{t.empty}</p>}
      {sections.map((section) => <div key={section.id} className="space-y-4 rounded-lg border border-ink-300 p-4">
        <h3 className="font-bold">{section.name}</h3>
        {section.rows.map((row) => <div key={row.id} className="space-y-2 border-b border-ink-200 pb-3">
          <p className="font-semibold">{t.row}: {row.label}</p>
          <div className="flex flex-wrap gap-2">{row.seats.map((seat) => <div key={seat.id} className={"rounded-lg border px-3 py-2 text-sm " + colors[seat.status]}>
            <p className="font-bold">{seat.number}{seat.isAccessible ? " *" : ""}</p><p>{t[seat.status]}</p>
            {seat.status === "AVAILABLE" && editable && !denied && <button type="button" className="text-xs underline" disabled={disabled} onClick={() => { if (window.confirm(t.confirm)) void run("/seats/" + seat.id, "DELETE"); }}>{t.remove}</button>}
          </div>)}</div>
          {editable && !denied && <SeatForm label={t.addSeats} disabled={disabled} t={t} onSubmit={(seats) => run("/rows/" + row.id + "/seats", "POST", { seats })} />}
        </div>)}
        {editable && !denied && <SeatForm rowLabel label={t.addRow} disabled={disabled} t={t} onSubmit={(seats, label) => run("/sections/" + section.id + "/rows", "POST", { label, seats })} />}
      </div>)}
      {editable && !denied && <form className="flex flex-wrap items-end gap-2" onSubmit={async (e) => { e.preventDefault(); if (await run("/sections", "POST", { name: name.trim() })) setName(""); }}>
        <label className="grid flex-1 gap-1 text-sm">{t.section}<input required maxLength={80} className={field} value={name} onChange={(e) => setName(e.target.value)} disabled={disabled} /></label><button className={button} disabled={disabled}>{t.addSection}</button>
      </form>}
    </>}
  </section>;
}
