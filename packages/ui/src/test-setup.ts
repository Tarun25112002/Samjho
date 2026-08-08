import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * Unmount between tests.
 *
 * `@testing-library/react` registers this itself only when Vitest's globals are
 * enabled, and they are not here — explicit imports beat implicit globals. The
 * symptom of forgetting is memorable: every `getByRole` starts failing with
 * "found multiple elements", because each test renders into a document still
 * holding every previous test's output.
 */
afterEach(cleanup);
