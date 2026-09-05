import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
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
