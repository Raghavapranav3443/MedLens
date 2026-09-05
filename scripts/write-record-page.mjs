import { writeFileSync } from "node:fs";
const content = String.raw`// Record workspace. Server component; DB errors surface honestly.
import { getSessionId } from "@/lib/server/session";
import { getRecordOrNotFound } from "@/lib/server/repo";
import { detectConflicts } from "@/lib/engines/conflicts";
import { detectGaps } from "@/lib/engines/gaps";

export const dynamic = "force-dynamic";

const STATUS_LABEL = {
  low: "Below reported range",
  normal: "Within reported range",
  high: "Above reported range",
  unknown: "Value unknown",
  unparseable: "Range not parseable",
  qualitative_mismatch: "Qualitative mismatch",
  no_reference_provided: "No reference range provided",
};

function statusClass(s) {
  return s === "low" ? "bg-sky-100 text-sky-900 border-sky-200"
    : s === "high" ? "bg-amber-100 text-amber-900 border-amber-200"
    : s === "normal" ? "bg-emerald-100 text-emerald-900 border-emerald-200"
    : s === "no_reference_provided" ? "bg-violet-100 text-violet-900 border-violet-200"
    : "bg-slate-100 text-slate-700 border-slate-200";
}

function StatusChip({ status }) {
  const label = STATUS_LABEL[status ?? ""] ?? "Status unknown";
  return (
    <span role="status" className={"inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium " + statusClass(status)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" aria-hidden="true" />
      {label}
    </span>
  );
}
`;
writeFileSync("src/app/record/[id]/page.tsx", content);
console.log("record page part 1 written");
