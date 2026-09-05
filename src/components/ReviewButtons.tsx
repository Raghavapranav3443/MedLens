"use client";

import { useState } from "react";

export default function ReviewButtons({ factId, recordId }: { factId: string; recordId: string }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function review(action: "confirmed" | "flagged") {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/records/${recordId}/facts/${factId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review: action }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) setMsg(body?.error?.message || "Failed");
      else setMsg(action === "confirmed" ? "Confirmed" : "Flagged");
    } catch {
      setMsg("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <button onClick={() => review("confirmed")} disabled={busy} className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50" aria-label="Confirm this value">Confirm</button>
      <button onClick={() => review("flagged")} disabled={busy} className="rounded border border-red-300 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800 hover:bg-red-100 disabled:opacity-50" aria-label="Flag this value">Flag</button>
      {msg && <span aria-live="polite" className="text-xs text-slate-500">{msg}</span>}
    </div>
  );
}
