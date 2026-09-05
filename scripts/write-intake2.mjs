import { appendFileSync } from "node:fs";
const content = String.raw`

  return (
    <form onSubmit={submit} className="space-y-4" aria-describedby="intake-help">
      <p id="intake-help" className="text-sm text-gray-600">
        Synthetic data only. Creating a record starts an anonymous session — access isolation, not identity verification.
      </p>
      <fieldset className="space-y-3 rounded-lg border border-gray-200 p-4">
        <legend className="px-2 text-sm font-semibold text-gray-700">Record</legend>
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">Title</label>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
        </div>
        <div>
          <label htmlFor="report" className="block text-sm font-medium text-gray-700">Medical report (paste text)</label>
          <textarea id="report" value={report} onChange={(e) => setReport(e.target.value)} rows={6} aria-describedby="report-hint" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900" />
          <p id="report-hint" className="mt-1 text-xs text-gray-500">One test per line: Name Value Unit (Range)</p>
        </div>
      </fieldset>
      <button type="button" onClick={() => setAdvancedOpen(!advancedOpen)} aria-expanded={advancedOpen} className="text-sm font-medium text-gray-900 underline">
        {advancedOpen ? "Hide" : "Add"} patient details
      </button>
      {advancedOpen && (
        <fieldset className="space-y-3 rounded-lg border border-gray-200 p-4">
          <legend className="px-2 text-sm font-semibold text-gray-700">Patient details</legend>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="age" className="block text-sm font-medium text-gray-700">Age</label>
              <input id="age" type="number" min={0} max={120} value={age} onChange={(e) => setAge(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label htmlFor="sex" className="block text-sm font-medium text-gray-700">Sex</label>
              <select id="sex" value={sex} onChange={(e) => setSex(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value="">—</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
                <option value="unknown">Prefer not to say</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="symptoms" className="block text-sm font-medium text-gray-700">Symptoms (one per line)</label>
            <textarea id="symptoms" value={symptoms} onChange={(e) => setSymptoms(e.target.value)} rows={2} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div>
            <label htmlFor="conditions" className="block text-sm font-medium text-gray-700">Existing conditions (one per line)</label>
            <textarea id="conditions" value={conditions} onChange={(e) => setConditions(e.target.value)} rows={2} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div>
            <label htmlFor="medications" className="block text-sm font-medium text-gray-700">Medications (one per line)</label>
            <textarea id="medications" value={medications} onChange={(e) => setMedications(e.target.value)} rows={2} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div className="flex items-start gap-2">
            <input id="no-allergies" type="checkbox" checked={noKnownAllergies} onChange={(e) => setNoKnownAllergies(e.target.checked)} className="mt-1" />
            <label htmlFor="no-allergies" className="text-sm text-gray-700">No known allergies</label>
          </div>
          <div>
            <label htmlFor="allergies" className="block text-sm font-medium text-gray-700">Allergies (one per line)</label>
            <textarea id="allergies" value={allergies} onChange={(e) => setAllergies(e.target.value)} rows={2} disabled={noKnownAllergies} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
        </fieldset>
      )}
`;
appendFileSync("src/components/IntakeForm.tsx", content);
console.log("intake part2");
