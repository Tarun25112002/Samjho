import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,

  // Fail the production build on type or lint errors rather than shipping them.
  // Next's defaults already do this; making it explicit documents the intent.
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },

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
