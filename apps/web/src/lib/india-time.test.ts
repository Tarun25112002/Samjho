import { describe, expect, it } from "vitest";

import { indiaDateTimeLocalToIso } from "./india-time";

describe("indiaDateTimeLocalToIso", () => {
  it("stores a classroom time as the matching IST instant, independent of browser zone", () => {
    expect(indiaDateTimeLocalToIso("2026-09-06T10:30")).toBe("2026-09-06T05:00:00.000Z");
  });

  it("refuses a malformed or impossible calendar value", () => {
    expect(indiaDateTimeLocalToIso("2026-02-30T10:30")).toBeNull();
    expect(indiaDateTimeLocalToIso("06/09/2026 10:30")).toBeNull();
  });
});
