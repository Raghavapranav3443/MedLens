import IntakeForm from "@/components/IntakeForm";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold">MedLens</h1>
      <p className="mt-2 text-gray-700">
        Turns fragmented medical information into a structured, traceable,
        human-reviewable record. MedLens organizes and explains; it never
        diagnoses, prescribes, or ranks clinical significance.
      </p>

      <section className="mt-8 rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold">Create a record</h2>
        <div className="mt-4">
          <IntakeForm />
        </div>
      </section>

      <section className="mt-8 text-sm text-gray-600">
        <h2 className="text-base font-semibold text-gray-900">What this build has</h2>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          <li>Anonymous sessions: opaque token, HttpOnly cookie, only the SHA-256 stored</li>
          <li>Owner-scoped records API with a typed error envelope (401/404/409/413/422/429)</li>
          <li>Deterministic range engine: statuses derived only from reported ranges</li>
          <li>
            <a className="underline" href="/api/health">/api/health</a> — liveness + config sanity, zero PHI
          </li>
        </ul>
      </section>

      <footer className="mt-10 border-t border-gray-200 pt-4 text-xs text-gray-500">
        Hackathon prototype running on synthetic data. Identifier masking is
        best-effort; no HIPAA/GDPR compliance is claimed; do not upload real
        patient data. Not a medical device.
      </footer>
    </main>
  );
}
