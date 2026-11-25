"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function OrderAction({ url, label, confirm, failure }: {
  url: string; label: string; confirm: string; failure: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function submit() {
    if (!window.confirm(confirm)) return;
    setBusy(true);
    setError(false);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw new Error(failure);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return <div>
    <button type="button" disabled={busy} onClick={() => void submit()} className="text-brand underline disabled:opacity-50">{label}</button>
    {error && <p role="alert" className="text-red-700">{failure}</p>}
  </div>;
}
