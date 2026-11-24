"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DuplicateEvent({ id, locale, label, errorLabel }: { id: string; locale: string; label: string; errorLabel: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function duplicate() {
    setBusy(true);
    setError(false);
    try {
      const response = await fetch("/api/organizer/events/" + id + "/duplicate", { method: "POST" });
      if (!response.ok) throw new Error("Duplicate failed");
      const { event } = await response.json();
      router.push("/" + locale + "/organizer/events/" + event.id);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return <div>
    <button type="button" disabled={busy} onClick={() => void duplicate()} className="rounded-lg border border-ink-300 bg-white px-4 py-2 font-semibold disabled:opacity-50">{label}</button>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{errorLabel}</p>}
  </div>;
}
