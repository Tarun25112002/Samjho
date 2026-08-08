import next from "@samjho/config/eslint/next";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  ...next,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      // These two catch real, hard-to-debug bugs — stale closures and
      // conditionally-called hooks — rather than style preferences.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  { ignores: [".next/**", "next-env.d.ts"] },
];
