import { readFileSync, writeFileSync } from "node:fs";
const f = "package.json";
const p = JSON.parse(readFileSync(f, "utf8"));
p.name = "medlens";
Object.assign(p.scripts, {
  test: "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "prisma:generate": "prisma generate",
  "prisma:migrate": "prisma migrate dev",
});
writeFileSync(f, JSON.stringify(p, null, 2) + "\n");
console.log("package.json updated:", p.name, Object.keys(p.scripts).join(", "));