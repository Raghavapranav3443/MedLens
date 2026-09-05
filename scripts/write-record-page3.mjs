import { appendFileSync } from "node:fs";
const content = String.raw`
      {conflicts.length > 0 && (
        <section className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4" aria-labelledby="flags-heading">
          <h2 id="flags-heading" className="flex items-center gap-2 text-sm font-semibold text-amber-900"><span aria-hidden="true">⚑</span> Flags · {conflicts.length}</h2>
          <ul className="mt-2 space-y-2">
            {conflicts.map((c, i) => (
              <li key={i} className="rounded-lg bg-white p-3 text-sm shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-white">{c.rule}</span>
                  <span className="font-medium text-slate-900">{c.message}</span>
                </div>
                <ul className="mt-1 list-disc pl-5 text-xs text-slate-600">{c.cites.map((cite, j) => <li key={j}>{cite}</li>)}</ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="labs-heading">
          <h2 id="labs-heading" className="text-base font-semibold text-slate-900">Labs</h2>
          {labs.length === 0 ? <p className="mt-3 text-sm text-slate-500">No lab rows extracted yet.</p> : (
            <table className="mt-3 w-full text-sm">
              <thead><tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500"><th className="py-2 pr-2">Analyte</th><th className="py-2 pr-2">Value</th><th className="py-2 pr-2">Range</th><th className="py-2 pr-2">Status</th><th className="py-2">Source</th></tr></thead>
              <tbody>
                {labs.map((f) => (
                  <tr key={f.id} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-2 font-medium text-slate-900">{f.rawName}</td>
                    <td className="py-2 pr-2 text-slate-700">{f.value ?? "—"}{f.unit ? <span className="text-slate-500"> {f.unit}</span> : ""}</td>
                    <td className="py-2 pr-2 text-slate-500">{f.rangeText ?? "—"}</td>
                    <td className="py-2 pr-2"><StatusChip status={f.status} /></td>
                    <td className="py-2 text-xs text-slate-500">{f.verified ? <span className="text-emerald-700">✓ verified</span> : <span className="text-amber-700">⚠ quarantined</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {quarantined.length > 0 && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-900">Quarantined ({quarantined.length})</p>
              <p className="mt-0.5 text-xs text-amber-800">Excluded from summaries until confirmed. Nothing silently trusted; nothing silently dropped.</p>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          {gaps.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="gaps-heading">
              <h2 id="gaps-heading" className="text-sm font-semibold text-slate-900">Questions to ask</h2>
              <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">{gaps.map((g) => <li key={g.id}>{g.question}</li>)}</ul>
            </section>
          )}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="summary-heading">
            <h2 id="summary-heading" className="text-sm font-semibold text-slate-900">Summary</h2>
            {latestSummary ? <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{latestSummary.text}</div> : <p className="mt-2 text-sm text-slate-500">No summary yet.</p>}
            <button onClick={() => fetch("/api/records/" + id + "/summary", { method: "POST" })} className="mt-3 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white shadow hover:bg-slate-800">Regenerate summary</button>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="audit-heading">
            <h2 id="audit-heading" className="text-sm font-semibold text-slate-900">Audit trail</h2>
            {record.audits.length === 0 ? <p className="mt-2 text-sm text-slate-500">No audit events.</p> : (
              <ul className="mt-2 space-y-1 text-xs text-slate-600">{record.audits.slice(0, 10).map((a) => <li key={a.id}><span className="font-medium text-slate-700">{a.action}</span> · {new Date(a.createdAt).toLocaleString()}{a.after ? " — " + a.after : ""}</li>)}</ul>
            )}
          </section>
        </aside>
      </div>
      <footer className="mt-10 border-t border-slate-200 pt-4 text-xs text-slate-500">Synthetic data only · masking best-effort · no compliance claims · not a medical device.</footer>
    </main>
  );
}

function Notice({ title, msg }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{msg}</p>
      <a href="/" className="mt-4 inline-block text-sm font-medium text-slate-900 underline">Back to home</a>
    </main>
  );
}
`;
appendFileSync("src/app/record/[id]/page.tsx", content);
console.log("record page complete");
