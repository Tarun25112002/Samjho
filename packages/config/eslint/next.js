import globals from "globals";

import base from "./base.js";

/**
 * Next.js apps.
 *
 * Next's own rules come from `eslint-config-next`, which the web app layers on
 * top of this. Kept separate so `packages/config` has no Next.js dependency.
 */
export default [
  ...base,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
];
