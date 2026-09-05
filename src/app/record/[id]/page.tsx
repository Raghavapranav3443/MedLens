// Record workspace: structured facts + provenance + quarantine section.
// Server component; DB errors surface as an honest setup notice.

import { getSessionId } from "@/lib/server/session";
import { getRecordOrNotFound, type FullRecord } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  low: "Below reported range",
  normal: "Within reported range",
  high: "Above reported range",
  unknown: "Value unknown",
  unparseable: "Range not parseable",
  qualitative_mismatch: "Qualitative mismatch",
  no_reference_provided: "No reference range provided",
};

const STATUS_STYLE: Record<string, string> = {
  low: "bg-blue-100 text-blue-900",
  high: "bg-amber-100 text-amber-900",
  normal: "bg-green-100 text-green-900",
};

function StatusChip({ status }: { status: string | null }) {
  const label = STATUS_LABEL[status ?? ""] ?? "Status unknown";
  const style = STATUS_STYLE[status ?? ""] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}

export default async function RecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = await getSessionId();

  let record: FullRecord | null = null;
  let dbNotice: string | null = null;
  if (!sessionId) {
    dbNotice = "No session found. Create a record from the home page first.";
  } else {
    try {
      record = await getRecordOrNotFound(sessionId, id);
    } catch {
      dbNotice =
        "This record could not be loaded. It may belong to a different session, or the database is not configured on this deployment.";
    }
  }

  if (!record) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-bold">Record</h1>
        <p className="mt-4 rounded bg-yellow-50 px-3 py-2 text-sm text-yellow-900">{dbNotice}</p>
        <a href="/" className="mt-4 inline-block underline">
          Back to home
        </a>
      </main>
    );
  }

  const labs = record.facts.filter((f) => f.kind === "lab");
  const quarantined = labs.filter((f) => !f.verified);
  const coverage = labs.length === 0 ? 0 : Math.round(((labs.length - quarantined.length) / labs.length) * 100);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold">{record.title}</h1>
      <p className="mt-1 text-sm text-gray-600">
        Revision {record.revision} · {labs.length} lab rows · verification coverage {coverage}%
      </p>

      <section className="mt-6" aria-labelledby="labs-heading">
        <h2 id="labs-heading" className="text-lg font-semibold">
          Labs
        </h2>
        {labs.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">No lab rows extracted yet.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-gray-300 text-left">
                <th scope="col" className="py-2 pr-2">Analyte</th>
                <th scope="col" className="py-2 pr-2">Value</th>
                <th scope="col" className="py-2 pr-2">Reported range</th>
                <th scope="col" className="py-2 pr-2">Status</th>
                <th scope="col" className="py-2">Provenance</th>
              </tr>
            </thead>
            <tbody>
              {labs.map((f) => (
                <tr key={f.id} className="border-b border-gray-200 align-top">
                  <td className="py-2 pr-2 font-medium">{f.rawName}</td>
                  <td className="py-2 pr-2">
                    {f.value ?? "—"}
                    {f.unit ? ` ${f.unit}` : ""}
                  </td>
                  <td className="py-2 pr-2">{f.rangeText ?? "—"}</td>
                  <td className="py-2 pr-2">
                    <StatusChip status={f.status} />
                  </td>
                  <td className="py-2 text-xs text-gray-600">
                    <span className="inline-block rounded bg-gray-100 px-1.5 py-0.5">
                      {f.verified ? "📄 verified vs source" : "⚠️ quarantined"}
                    </span>
                    {f.evidenceStart !== null && (
                      <span className="ml-1">
                        chars {f.evidenceStart}–{f.evidenceEnd}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {quarantined.length > 0 && (
        <section className="mt-8 rounded border border-amber-300 bg-amber-50 p-4" aria-labelledby="quarantine-heading">
          <h2 id="quarantine-heading" className="text-sm font-semibold text-amber-900">
            Quarantined — not verified against the source ({quarantined.length})
          </h2>
          <p className="mt-1 text-xs text-amber-900">
            These rows could not be matched to the report text. They are excluded from
            summaries and comparisons until a human confirms them. Nothing is silently
            trusted; nothing is silently dropped.
          </p>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {quarantined.map((f) => (
              <li key={f.id}>
                {f.rawName}: {f.value ?? "—"} {f.unit ?? ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-10 border-t border-gray-200 pt-4 text-xs text-gray-500">
        Synthetic data only · masking best-effort · no compliance claims · not a medical device.
      </footer>
    </main>
  );
}
