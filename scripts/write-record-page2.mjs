import { appendFileSync } from "node:fs";
const content = String.raw`

export default async function RecordPage({ params }) {
  const { id } = await params;
  const sessionId = await getSessionId();
  if (!sessionId) return <Notice title="Record" msg="No session found. Create a record from the home page first." />;

  let record;
  try { record = await getRecordOrNotFound(sessionId, id); }
  catch { return <Notice title="Record" msg="This record could not be loaded. It may belong to a different session, or the database is not configured." />; }

  const conflicts = detectConflicts({
    facts: record.facts,
    intakeAllergies: [],
    intakeNoKnownAllergies: record.facts.some((f) => f.rawName.toLowerCase() === "no known allergies"),
    intakeMedications: record.facts.filter((f) => f.kind === "medication").map((f) => f.rawName),
  });
  const gaps = detectGaps(record.facts);
  const labs = record.facts.filter((f) => f.kind === "lab");
  const quarantined = labs.filter((f) => !f.verified);
  const coverage = labs.length === 0 ? 0 : Math.round(((labs.length - quarantined.length) / labs.length) * 100);
  const latestSummary = record.summaries[0] ?? null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{record.title}</h1>
          <p className="mt-1 text-sm text-slate-500">Revision {record.revision} · {labs.length} lab rows · verification coverage <span className="font-semibold text-slate-700">{coverage}%</span></p>
        </div>
        <a href={"/record/" + id + "/print"} target="_blank" rel="noopener" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 print:hidden">Print one-pager</a>
      </div>
`;
appendFileSync("src/app/record/[id]/page.tsx", content);
console.log("part 2a written");
