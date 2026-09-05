// Record workspace. Server component; DB errors surface honestly.
// Renders ALL fact kinds + review buttons + conflicts + gaps + summary + audit + sources.

import { getSessionId } from "@/lib/server/session";
import { getRecordOrNotFound } from "@/lib/server/repo";
import { detectConflicts } from "@/lib/engines/conflicts";
import { detectGaps } from "@/lib/engines/gaps";
import { compareFacts, type Comparison } from "@/lib/engines/compare";
import { lookupGlossary } from "@/lib/data/glossary";
import { listRecords } from "@/lib/server/repo";
import ReviewButtons from "@/components/ReviewButtons";
import RegenerateSummaryButton from "@/components/RegenerateSummaryButton";

export const dynamic = "force-dynamic";

type FullRecord = Awaited<ReturnType<typeof getRecordOrNotFound>>;
type Fact = FullRecord["facts"][number];

const STATUS_LABEL: Record<string, string> = {
  low: "Below reported range", normal: "Within reported range",
  high: "Above reported range", unknown: "Value unknown",
  unparseable: "Range not parseable", qualitative_mismatch: "Qualitative mismatch",
  no_reference_provided: "No reference range provided",
};

function statusClass(s: string | null) {
  return s === "low" ? "bg-sky-100 text-sky-900 border-sky-200"
    : s === "high" ? "bg-amber-100 text-amber-900 border-amber-200"
    : s === "normal" ? "bg-emerald-100 text-emerald-900 border-emerald-200"
    : s === "no_reference_provided" ? "bg-violet-100 text-violet-900 border-violet-200"
    : "bg-slate-100 text-slate-700 border-slate-200";
}

function StatusChip({ status }: { status: string | null }) {
  const label = STATUS_LABEL[status ?? ""] ?? "Status unknown";
  return (
    <span role="status" className={"inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium " + statusClass(status)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" aria-hidden="true" />
      {label}
    </span>
  );
}

function OriginChip({ origin, verified }: { origin: string; verified: boolean }) {
  if (origin === "user") return <span className="text-xs font-medium text-blue-700">You</span>;
  return verified
    ? <span className="text-xs font-medium text-emerald-700">Report verified</span>
    : <span className="text-xs font-medium text-amber-700">Report unverified</span>;
}
function FactRow({ f, recordId }: { f: Fact; recordId: string }) {
  return (
    <tr className="border-b border-slate-100 align-top">
      <td className="py-2 pr-2 font-medium text-slate-900">
        {(() => {
          const g = lookupGlossary(f.canonicalName ?? f.rawName);
          const name = f.canonicalName ?? f.rawName;
          return g ? (
            <details className="inline">
              <summary className="cursor-pointer list-none underline decoration-dotted underline-offset-2">{name}</summary>
              <span className="mt-1 block max-w-xs rounded border border-slate-200 bg-white p-2 text-xs font-normal text-slate-600 shadow">
                <strong>{g.term}:</strong> {g.definition}
              </span>
            </details>
          ) : name;
        })()}
      </td>
      <td className="py-2 pr-2 text-slate-700">{f.value ?? "—"}{f.unit ? <span className="text-slate-500"> {f.unit}</span> : ""}</td>
      <td className="py-2 pr-2 text-slate-500">{f.rangeText ?? "—"}</td>
      <td className="py-2 pr-2">{f.status ? <StatusChip status={f.status} /> : <span className="text-xs text-slate-400">—</span>}</td>
      <td className="py-2 pr-2"><OriginChip origin={f.origin} verified={f.verified} /></td>
      <td className="py-2"><ReviewButtons factId={f.id} recordId={recordId} /></td>
    </tr>
  );
}

function FactSection({ title, facts, recordId }: { title: string; facts: Fact[]; recordId: string }) {
  if (!facts.length) return null;
  return (
    <section className="mb-4">
      <h3 className="mb-1 text-sm font-semibold text-slate-800">{title} <span className="text-xs font-normal text-slate-400">({facts.length})</span></h3>
      <table className="w-full text-sm">
        <thead><tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
          <th className="py-1 pr-2">Name</th><th className="py-1 pr-2">Value</th><th className="py-1 pr-2">Range</th><th className="py-1 pr-2">Status</th><th className="py-1 pr-2">Source</th><th className="py-1">Review</th>
        </tr></thead>
        <tbody>{facts.map((f) => <FactRow key={f.id} f={f} recordId={recordId} />)}</tbody>
      </table>
    </section>
  );
}
export default async function RecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = await getSessionId();
  if (!sessionId) return <Notice title="Record" msg="No session found. Create a record from the home page first." />;

  const record = await getRecordOrNotFound(sessionId, id).catch(() => null);
  if (!record) return <Notice title="Record" msg="This record could not be loaded. It may belong to a different session, or the database is not configured." />;

  const conflicts = detectConflicts({
    facts: record.facts,
    intakeAllergies: [],
    intakeNoKnownAllergies: record.facts.some((f) => f.rawName.toLowerCase() === "no known allergies"),
    intakeMedications: record.facts.filter((f) => f.kind === "medication").map((f) => f.rawName),
  });
  const gaps = detectGaps(record.facts);

  const labs = record.facts.filter((f) => f.kind === "lab");
  const symptoms = record.facts.filter((f) => f.kind === "symptom");
  const medications = record.facts.filter((f) => f.kind === "medication");
  const allergies = record.facts.filter((f) => f.kind === "allergy");
  const conditions = record.facts.filter((f) => f.kind === "condition");
  const notes = record.facts.filter((f) => f.kind === "note");
  const quarantined = labs.filter((f) => !f.verified);
  const coverage = labs.length === 0 ? 0 : Math.round(((labs.length - quarantined.length) / labs.length) * 100);
  const latestSummary = record.summaries[0] ?? null;

  // Longitudinal comparison vs the most recent prior record (deterministic,
  // no AI). Prior record must be owner-scoped — listRecords guarantees that.
  const allRecords = await listRecords(sessionId);
  const priorMeta = allRecords.find((r) => r.id !== id && r.createdAt < record.createdAt) ?? null;
  const prior = priorMeta ? await getRecordOrNotFound(sessionId, priorMeta.id) : null;
  const priorTitle = prior?.title ?? "";
  const comparisons: Comparison[] = prior ? compareFacts(prior.facts, record.facts) : [];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{record.title}</h1>
          <p className="mt-1 text-sm text-slate-500">Revision {record.revision} · {record.facts.length} facts · coverage <span className="font-semibold text-slate-700">{coverage}%</span></p>
        </div>
        <a href={"/record/" + id + "/print"} target="_blank" rel="noopener" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 print:hidden">Print one-pager</a>
      </div>

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
      {comparisons.length > 0 && (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="compare-heading">
          <h2 id="compare-heading" className="text-sm font-semibold text-slate-900">
            Changes vs previous report <span className="font-normal text-slate-400">(“{priorTitle}”)</span>
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {comparisons.map((c) => (
              <li key={c.analyte} className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-1">
                <span className="font-medium text-slate-900">{c.analyte}</span>
                {c.note ? (
                  <span className="text-xs text-slate-500">{c.note}</span>
                ) : c.delta === null ? (
                  <span className="text-xs text-slate-500">No prior value — could not be compared.</span>
                ) : (
                  <>
                    <span className={c.direction === "increased" ? "text-amber-700" : c.direction === "decreased" ? "text-sky-700" : "text-slate-500"}>
                      {c.direction === "increased" ? "▲" : c.direction === "decreased" ? "▼" : "•"} {c.previousValue} → {c.currentValue} {c.currentUnit ?? ""}
                    </span>
                    <span className="text-xs text-slate-500">
                      {c.delta > 0 ? "+" : ""}{c.delta}{c.deltaPct !== null ? ` (${c.deltaPct > 0 ? "+" : ""}${c.deltaPct}%)` : ""}
                    </span>
                    <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-600">{c.statusTransition}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-2">
          <FactSection title="Labs" facts={labs} recordId={id} />
          <FactSection title="Symptoms" facts={symptoms} recordId={id} />
          <FactSection title="Medications" facts={medications} recordId={id} />
          <FactSection title="Allergies" facts={allergies} recordId={id} />
          <FactSection title="Conditions" facts={conditions} recordId={id} />
          <FactSection title="Notes" facts={notes} recordId={id} />

          {quarantined.length > 0 && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-900">Quarantined — not verified against the source ({quarantined.length})</p>
              <p className="mt-0.5 text-xs text-amber-800">Excluded from summaries until confirmed. Nothing silently trusted; nothing silently dropped.</p>
            </div>
          )}

          {record.sources.length > 0 && (
            <section className="mt-4">
              <h2 className="text-base font-semibold text-slate-900">Source documents</h2>
              <div className="mt-2 space-y-2">
                {record.sources.map((s) => (
                  <details key={s.id} className="rounded-lg border border-slate-200 bg-white p-3">
                    <summary className="cursor-pointer text-sm font-medium text-slate-700">Source · {s.kind} · {s.sha256.slice(0, 8)}</summary>
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs text-slate-600">{s.rawText}</pre>
                  </details>
                ))}
              </div>
            </section>
          )}
        </div>

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
            <RegenerateSummaryButton recordId={id} />
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="audit-heading">
            <h2 id="audit-heading" className="text-sm font-semibold text-slate-900">Audit trail</h2>
            {record.audits.length === 0 ? <p className="mt-2 text-sm text-slate-500">No audit events.</p> : (
              <ul className="mt-2 space-y-1 text-xs text-slate-600">{record.audits.slice(0, 15).map((a) => <li key={a.id}><span className="font-medium text-slate-700">{a.action}</span> · {new Date(a.createdAt).toLocaleString()}{a.after ? " — " + a.after : ""}</li>)}</ul>
            )}
          </section>
        </aside>
      </div>
      <footer className="mt-10 border-t border-slate-200 pt-4 text-xs text-slate-500">Synthetic data only · masking best-effort · no compliance claims · not a medical device.</footer>
    </main>
  );
}

function Notice({ title, msg }: { title: string; msg: string }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{msg}</p>
      <a href="/" className="mt-4 inline-block text-sm font-medium text-slate-900 underline">Back to home</a>
    </main>
  );
}