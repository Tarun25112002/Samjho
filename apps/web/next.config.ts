import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,

  // Fail the production build on type errors rather than shipping them. Next's
  // default already does this; making it explicit documents the intent.
  //
  // There is no `eslint` key here: Next 16 removed the built-in `next lint`
  // integration. Linting is now a separate `eslint src` task, which is better
  // anyway — turbo runs it in parallel with the build instead of serialising it
  // inside one.
  typescript: { ignoreBuildErrors: false },

  // Applied to every response. The API sets its own via helmet; these cover the
  // pages themselves. A full CSP lands in Phase 9, once every script source is
  // known — a CSP written now would be wrong by Phase 3.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default config;
