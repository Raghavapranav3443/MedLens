import { appendFileSync } from "node:fs";
const content = String.raw`

async function persistExtraction(
  recordId: string,
  rows: ExtractionRow[],
  source: { kind: string; rawText: string; reportedAt: Date | null },
) {
  const sha256 = createHash("sha256").update(source.rawText).digest("hex");

  return prisma.$transaction(async (tx) => {
    const doc = await tx.sourceDocument.create({
      data: {
        recordId,
        kind: source.kind,
        rawText: source.rawText,
        sha256,
        reportedAt: source.reportedAt,
      },
    });

    const factRows = rows.map((row) => {
      const range = parseRangeText(row.rangeText || null);
      const { status } = computeStatus(row.value, range);
      return {
        recordId,
        sourceDocId: doc.id,
        kind: "lab",
        rawName: row.rawName,
        canonicalName: resolveAlias(row.rawName), // null when unknown — never guessed
        value: row.value,
        unit: row.unit || null,
        rangeText: row.rangeText || null,
        rangeLow: range?.type === "closed" ? range.low : null,
        rangeHigh: range?.type === "closed" ? range.high : null,
        status,
        evidenceStart: null as number | null,
        evidenceEnd: null as number | null,
        origin: "ai" as const,
        verified: false,
      };
    });

    // Evidence validation fills spans + verification before insert.
    for (const fact of factRows) {
      const row = rows[factRows.indexOf(fact)];
      const ev = verifyRow(source.rawText, row);
      fact.evidenceStart = ev.start;
      fact.evidenceEnd = ev.end;
      fact.verified = ev.verified;
    }

    await tx.fact.createMany({ data: factRows });

    await tx.auditEvent.create({
      data: {
        recordId,
        action: "extract",
        target: doc.id,
        after: \`\${factRows.length} rows extracted (\${factRows.filter((f) => f.verified).length} verified)\`,
      },
    });

    const record = await tx.record.update({
      where: { id: recordId },
      data: { revision: { increment: 1 } },
      include: { facts: { where: { sourceDocId: doc.id }, orderBy: { rawName: "asc" } } },
    });
    return { facts: record.facts, sourceDocId: doc.id };
  });
}
`;
appendFileSync("src/lib/server/extract.ts", content);
console.log("extract complete");
