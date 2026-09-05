// Ingest limits (docs/ARCHITECTURE.md §2 resource budget). Enforced BEFORE
// parsing or any AI call.

export const MAX_SOURCE_BYTES = 5 * 1024 * 1024; // 5 MiB per report
export const MAX_SOURCE_CHARS = 40_000; // extracted characters per report
export const MAX_PDF_PAGES = 5;
export const MAX_LAB_ROWS = 100;
export const PROCESSING_DEADLINE_MS = 75_000;
export const AI_CALL_TIMEOUT_MS = 30_000;
