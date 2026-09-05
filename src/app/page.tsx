import { getSessionId } from "@/lib/server/session";
import { listRecords } from "@/lib/server/repo";
import IntakeForm from "@/components/IntakeForm";

export const dynamic = "force-dynamic";

export default async function Home() {
  const sessionId = await getSessionId();
  const records = sessionId ? await listRecords(sessionId) : [];

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">MedLens</h1>
      <p className="mt-2 text-gray-700">
        Turns fragmented medical information into a structured, traceable, human-reviewable record.
      </p>

      <section className="mt-8 rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold">Create a record</h2>
        <div className="mt-4">
          <IntakeForm />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-semibold text-gray-900">Your records ({records.length})</h2>
        {records.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No records yet. Create one above to get started.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {records.map((r) => {
              const labs = r.facts.filter((f) => f.kind === "lab");
              const verified = labs.filter((f) => f.verified).length;
              const coverage = labs.length === 0 ? 0 : Math.round((verified / labs.length) * 100);
              return (
                <li key={r.id} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                  <a href={"/record/" + r.id} className="block">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-900 hover:underline">{r.title}</span>
                      <span className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                      <span>{r.facts.length} facts</span>
                      <span>·</span>
                      <span>{coverage}% verified</span>
                      <span>·</span>
                      <span>rev {r.revision}</span>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-8 text-sm text-gray-600">
        <h2 className="text-base font-semibold text-gray-900">What this build has</h2>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          <li>Anonymous sessions: opaque token, HttpOnly cookie, only the SHA-256 stored</li>
          <li>Owner-scoped records API with a typed error envelope (401/404/409/413/422/429)</li>
          <li>Deterministic range engine: statuses derived only from reported ranges</li>
          <li>Conflict detection (R1-R8), clarification gaps, longitudinal comparison</li>
          <li>Human review loop: confirm / flag each extracted fact</li>
          <li>Degraded regex mode if the AI provider is unavailable</li>
          <li><a className="underline" href="/api/health">/api/health</a> &mdash; liveness + config sanity, zero PHI</li>
        </ul>
      </section>

      <footer className="mt-10 border-t border-gray-200 pt-4 text-xs text-gray-500">
        Prototype running on synthetic data. Masking best-effort; no compliance claims; not a medical device.
      </footer>
    </main>
  );
}