import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  // The Easy Read check writes every month in both languages and views, about 5 s on its own; give each test room on a busy machine.
  test: { include: ["tests/**/*.test.ts"], environment: "node", testTimeout: 30_000 },
});
