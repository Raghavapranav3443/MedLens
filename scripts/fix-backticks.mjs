import { readFileSync, writeFileSync } from "node:fs";
let s = readFileSync("src/lib/server/extract.ts", "utf8");
// The String.raw writer produced literal backslash+backtick (\`) instead of
// backtick (`) inside template literals. Replace all occurrences.
s = s.replace(/\\`/g, "`");
writeFileSync("src/lib/server/extract.ts", s);
console.log("fixed extract backticks");
