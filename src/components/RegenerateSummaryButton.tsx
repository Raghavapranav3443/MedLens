"use client";

import { useState } from "react";

export default function RegenerateSummaryButton({ recordId }: { recordId: string }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function regenerate() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/records/${recordId}/summary`, { method: "POST" });
      const body = await res.json().catch(() => null);
      setMsg(res.ok ? "Summary updated" : (body?.error?.message ?? "Failed to regenerate"));
    } catch {
      setMsg("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        onClick={regenerate}
        disabled={busy}
        className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white shadow hover:bg-slate-800 disabled:opacity-50"
      >
        {busy ? "Generating…" : "Regenerate summary"}
      </button>
      {msg && <p aria-live="polite" className="mt-1 text-xs text-slate-500">{msg}</p>}
    </div>
  );
}