import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Each test file gets a clean module registry so config/singletons
    // can't leak between files.
    isolate: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
