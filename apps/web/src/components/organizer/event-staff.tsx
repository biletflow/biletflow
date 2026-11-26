"use client";

import { useEffect, useState } from "react";

type Person = { id: string; name: string; email: string };
type StaffData = { staff: Person[]; candidate: Person | null };
const labels = {
  en: { title: "Event administrators", help: "Manage scanner access for this event.", email: "Email address", find: "Find user", assign: "Assign", revoke: "Revoke access", empty: "No administrators assigned.", missing: "No eligible user found.", error: "Request failed. Please retry.", loading: "Loading…", already: "Already assigned", refresh: "Refresh" },
  ru: { title: "Администраторы мероприятия", help: "Управление доступом к сканеру этого мероприятия.", email: "Электронная почта", find: "Найти пользователя", assign: "Назначить", revoke: "Отозвать доступ", empty: "Администраторы не назначены.", missing: "Подходящий пользователь не найден.", error: "Ошибка запроса. Повторите попытку.", loading: "Загрузка…", already: "Уже назначен", refresh: "Обновить" },
  kk: { title: "Іс-шара әкімшілері", help: "Осы іс-шараның сканеріне қолжетімділікті басқару.", email: "Электрондық пошта", find: "Пайдаланушыны табу", assign: "Тағайындау", revoke: "Қолжетімділікті жою", empty: "Әкімшілер тағайындалмаған.", missing: "Сәйкес пайдаланушы табылмады.", error: "Сұрау қатесі. Қайталап көріңіз.", loading: "Жүктелуде…", already: "Тағайындалған", refresh: "Жаңарту" },
};
async function request(path: string, method = "GET", userId?: string) {
  const response = await fetch(path, { method, credentials: "same-origin", cache: "no-store", ...(userId ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) } : {}) });
  if (!response.ok) throw new Error("Request failed");
  return response.json();
}
export default function EventStaff({ eventId, locale }: { eventId: string; locale: string }) {
  const t = labels[locale as keyof typeof labels] ?? labels.en;
  const path = `/api/organizer/events/${encodeURIComponent(eventId)}/staff`;
  const [staff, setStaff] = useState<Person[]>([]);
  const [candidate, setCandidate] = useState<Person | null>(null);
  const [email, setEmail] = useState("");
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    request(path).then((data: StaffData) => { if (active) setStaff(data.staff); }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [path]);
  async function run(action: "find" | "refresh" | "POST" | "DELETE", id?: string) {
    if (busy) return;
    setBusy(true); setError(false); setSearched(false); setCandidate(null);
    try {
      if (action === "POST" || action === "DELETE") await request(path, action, id);
      const data: StaffData = await request(action === "find" ? `${path}?email=${encodeURIComponent(email.trim())}` : path);
      setStaff(data.staff); setCandidate(data.candidate); setSearched(action === "find");
      if (action === "POST") setEmail("");
    } catch { setError(true); } finally { setBusy(false); }
  }
  return <section className="space-y-4 rounded-xl border border-ink-300 bg-white p-6">
    <h2 className="text-xl font-bold">{t.title}</h2><p>{t.help}</p>
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); void run("find"); }}>
      <label className="flex-1 text-sm font-semibold">{t.email}<input className="mt-1 w-full rounded-lg border border-ink-300 p-3" type="email" required maxLength={254} disabled={busy} value={email} onChange={(e) => { setEmail(e.target.value); setCandidate(null); setSearched(false); }} /></label>
      <button disabled={busy} className="rounded-lg bg-brand px-4 py-3 font-semibold text-white disabled:opacity-50">{t.find}</button>
    </form>
    {busy && <p role="status">{t.loading}</p>}
    {error && <p role="alert" className="text-red-700">{t.error}</p>}
    {searched && !candidate && <p>{t.missing}</p>}
    {candidate && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"><span>{candidate.name} ({candidate.email})</span><button type="button" disabled={busy || staff.some((p) => p.id === candidate.id)} onClick={() => void run("POST", candidate.id)} className="rounded-lg bg-brand px-4 py-2 text-white disabled:opacity-50">{staff.some((p) => p.id === candidate.id) ? t.already : t.assign}</button></div>}
    {!busy && !error && staff.length === 0 && <p>{t.empty}</p>}
    {staff.map((person) => <div key={person.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"><span>{person.name}<br/><span className="text-sm">{person.email}</span></span><button type="button" disabled={busy} className="text-red-700 underline disabled:opacity-50" onClick={() => { if (window.confirm(`${t.revoke}: ${person.email}?`)) void run("DELETE", person.id); }}>{t.revoke}</button></div>)}
    <button type="button" disabled={busy} className="text-brand underline" onClick={() => void run("refresh")}>{t.refresh}</button>
  </section>;
}