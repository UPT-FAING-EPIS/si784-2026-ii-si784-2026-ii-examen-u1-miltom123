import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
export default defineConfig({
  resolve: { alias: { "@": resolve(".") } },
  test: {
    setupFiles: ["tests/setup.ts"],
    coverage: {
      reporter: ["text", "lcov"],
      include: ["lib/**/*.ts", "app/api/**/*.ts"],
    },
  },
});
