import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Tests for the web app's logic, not its pages.
 *
 * The pages are covered by the typecheck and by the API's own suite — a Server
 * Component that fetches and renders has very little of its own to get wrong.
 * What does have something to get wrong is the code between the network and the
 * screen: SSE frame parsing, and a hook that turns a stream of deltas into
 * state. Both are invisible until they are on a student's screen, which is the
 * worst place to find out.
 *
 * jsdom rather than node, because the hook under test is a React hook. The
 * `@/` alias is declared here as well as in tsconfig; Vite does not read the
 * TypeScript path mapping.
 */
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    isolate: true,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
