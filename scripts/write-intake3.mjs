import { appendFileSync } from "node:fs";
const content = String.raw`
      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
        <input id="consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
        <label htmlFor="consent" className="text-sm text-amber-900">
          I confirm this is synthetic/demo data. MedLens organizes records only — it does not diagnose, prescribe, or replace a clinician.
        </label>
      </div>
      {error && (<p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>)}
      {stage && !error && (<p aria-live="polite" className="text-sm text-gray-600">{stage}</p>)}
      <button type="submit" disabled={busy || !consent} className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow hover:bg-gray-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2">
        {busy ? "Working…" : "Create record & extract"}
      </button>
    </form>
  );
}
`;
appendFileSync("src/components/IntakeForm.tsx", content);
console.log("intake complete");
