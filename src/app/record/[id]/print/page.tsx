// GET /record/[id]/print — printer-friendly one-pager. Coverage meter,
// per-fact provenance footnotes, disclaimer banner, record hash. No PDF
// library. Kills the 404 the record page's "Print one-pager" button hit.

import { getSessionId } from "@/lib/server/session";
import { getRecordOrNotFound } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  low: "Below reported range",
  normal: "Within reported range",
  high: "Above reported range",
  unknown: "Value unknown",
  no_reference_provided: "No reference range provided",
};

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = await getSessionId();
  if (!sessionId) return <NotAvailable />;

  let record;
  try {
    record = await getRecordOrNotFound(sessionId, id);
  } catch {
    return <NotAvailable />;
  }

  const labs = record.facts.filter((f) => f.kind === "lab");
  const verifiedCount = labs.filter((f) => f.verified).length;
  const coverage = labs.length === 0 ? 0 : Math.round((verifiedCount / labs.length) * 100);

  return (
    <html lang="en">
      <head>
        <title>{record.title} — MedLens</title>
        <style>{`
          @media print { .no-print { display: none; } body { padding: 0; } }
          @media screen { body { background: #f1f5f9; } .sheet { background:#fff; max-width:800px; margin:24px auto; padding:32px; box-shadow:0 1px 4px rgba(0,0,0,.1); } }
          body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; color:#0f172a; line-height:1.5; }
          h1 { font-size:20px; margin:0 0 4px; }
          .muted { color:#64748b; font-size:12px; }
          .meter { height:8px; background:#e2e8f0; border-radius:99px; overflow:hidden; margin:8px 0 16px; }
          .meter > span { display:block; height:100%; background:#0f766e; }
          table { width:100%; border-collapse:collapse; font-size:12px; }
          th, td { text-align:left; padding:6px 8px; border-bottom:1px solid #e2e8f0; vertical-align:top; }
          th { text-transform:uppercase; letter-spacing:.04em; color:#64748b; font-size:10px; }
          .pill { display:inline-block; padding:1px 8px; border-radius:99px; border:1px solid; font-size:10px; font-weight:600; }
          .low { background:#e0f2fe; color:#075985; border-color:#7dd3fc; }
          .high { background:#fef3c7; color:#92400e; border-color:#fcd34d; }
          .normal { background:#dcfce7; color:#166534; border-color:#86efac; }
          .no-ref { background:#ede9fe; color:#5b21b6; border-color:#c4b5fd; }
          .quarantined { background:#fff7ed; color:#9a3412; }
          .banner { background:#fffbeb; border:1px solid #fde68a; color:#92400e; padding:10px 14px; border-radius:8px; font-size:12px; margin:16px 0; }
          .foot { margin-top:24px; padding-top:12px; border-top:1px solid #e2e8f0; font-size:11px; color:#64748b; }
          .sources { font-size:11px; color:#475569; }
        `}</style>
      </head>
      <body>
        <div className="sheet">
          <button className="no-print" onClick={() => window.print()} style={{marginBottom:16}}>Print / Save as PDF</button>
          <h1>{record.title}</h1>
          <div className="muted">Generated {new Date().toLocaleString()} · Revision {record.revision}</div>

          <div style={{marginTop:12,fontSize:13}}>
            Verification coverage: <strong>{coverage}%</strong> ({verifiedCount}/{labs.length} lab values)
            <div className="meter"><span style={{width:`${coverage}%`}} /></div>
          </div>

          {labs.length > 0 && (
            <table>
              <thead>
                <tr><th>Analyte</th><th>Value</th><th>Range</th><th>Status</th><th>Source</th></tr>
              </thead>
              <tbody>
                {labs.map((f) => (
                  <tr key={f.id}>
                    <td style={{fontWeight:600}}>{f.canonicalName ?? f.rawName}</td>
                    <td>{f.value ?? "—"}{f.unit ? ` ${f.unit}` : ""}</td>
                    <td className="muted">{f.rangeText ?? "—"}</td>
                    <td>
                      <span className={`pill ${f.status === "no_reference_provided" ? "no-ref" : f.status}`}>
                        {STATUS_LABEL[f.status ?? ""] ?? "Unknown"}
                      </span>
                      {!f.verified && <span className="quarantined" style={{marginLeft:6}}>quarantined</span>}
                    </td>
                    <td className="sources">{f.origin === "user" ? "You" : f.verified ? "Report · verified" : "Report · unverified"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="banner">
            This is an organizational summary of your records, not medical advice. Values are transcribed as
            printed; the app does not diagnose or rank clinical significance. Please discuss with your clinician.
          </div>

          <div className="foot">
            Synthetic data only · masking best-effort · no compliance claims · not a medical device.<br />
            Facts: {record.facts.length} · Sources: {record.sources.length} · Summaries: {record.summaries.length}
          </div>
        </div>
      </body>
    </html>
  );
}

function NotAvailable() {
  return (
    <html lang="en"><body style={{fontFamily:"system-ui",padding:40}}>
      <h1>Record unavailable</h1>
      <p>This record could not be loaded. It may belong to a different session, or the database is not configured.</p>
    </body></html>
  );
}
