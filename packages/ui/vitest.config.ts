import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Components need a DOM. jsdom rather than happy-dom because KaTeX emits
    // MathML alongside its HTML fallback, and jsdom's namespace handling is the
    // more faithful of the two.
    environment: "jsdom",
    include: ["src/**/*.test.tsx", "src/**/*.test.ts"],
    setupFiles: ["./src/test-setup.ts"],
    isolate: true,
  },
});
