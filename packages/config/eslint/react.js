import globals from "globals";

import base from "./base.js";

/**
 * React libraries — `packages/ui`.
 *
 * Browser globals only. A component package that reaches for `process` or
 * `__dirname` has picked up a server dependency it cannot honour once it is
 * rendered on the client, and leaving Node's globals out of scope turns that
 * mistake into a lint error rather than a runtime crash in someone's browser.
 */
export default [
  ...base,
  {
    languageOptions: {
      globals: globals.browser,
    },
  },
];
