import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
    // setupFiles: ["tests/setup.ts"], // re-enabled for component tests
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/lib/engines/**", "src/lib/validation/**", "src/lib/server/tokens.ts"],
      thresholds: { lines: 80 },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});

