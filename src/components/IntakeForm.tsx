"use client";

import { useState } from "react";

const DEMO_REPORT = `COMPLETE BLOOD COUNT — SYNTHETIC SAMPLE
Hemoglobin 10.2 g/dL (13.0 - 17.0)
WBC 8,400 /uL (4,000 - 11,000)
Platelets 210,000 /uL (150,000 - 450,000)`;

export default function IntakeForm() {
  const [title, setTitle] = useState("Demo record");
  const [age, setAge] = useState("34");
  const [report, setReport] = useState(DEMO_REPORT);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          ...(age !== "" ? { age: Number(age) } : {}),
          noKnownAllergies: true,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        const fields = body?.error?.fieldErrors
          ? Object.values(body.error.fieldErrors).join("; ")
          : "";
        setError(`${body?.error?.code ?? res.status}: ${body?.error?.message ?? "Request failed"} ${fields}`.trim());
      } else {
        setResult(`Created record ${body.record.id} (session started via HttpOnly cookie).`);
      }
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" aria-describedby="intake-help">
      <p id="intake-help" className="text-sm text-gray-600">
        Synthetic data only. Creating a record starts an anonymous session — this
        is access isolation, not identity verification.
      </p>
      <div>
        <label htmlFor="title" className="block text-sm font-medium">
          Record title
        </label>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          maxLength={200}
          required
        />
      </div>
      <div>
        <label htmlFor="age" className="block text-sm font-medium">
          Age (0–120)
        </label>
        <input
          id="age"
          type="number"
          min={0}
          max={120}
          value={age}
          onChange={(e) => setAge(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="report" className="block text-sm font-medium">
          Report text (extraction pipeline lands in the next build)
        </label>
        <textarea
          id="report"
          value={report}
          onChange={(e) => setReport(e.target.value)}
          rows={5}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-mono text-xs"
        />
      </div>
      <button
        type="submit"
        disabled={busy}
        className="rounded bg-black px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create record"}
      </button>
      <div aria-live="polite">
        {error && (
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
        )}
        {result && (
          <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-800">{result}</p>
        )}
      </div>
    </form>
  );
}
