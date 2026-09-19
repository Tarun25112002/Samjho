import { describe, expect, it } from "vitest";

import { suggestBoardSessions } from "./board-sessions";

describe("suggestBoardSessions", () => {
  it("uses the CBSE calendar day at the May-to-June boundary", () => {
    // 00:30 on 1 June in India, while still 31 May in UTC.
    const options = suggestBoardSessions(new Date("2026-05-31T19:00:00.000Z"));

    expect(options[0]?.session).toBe("2027");
    expect(options[1]?.session).toBe("2027");
  });

  it("keeps May in the current exam session", () => {
    const options = suggestBoardSessions(new Date("2026-05-31T18:00:00.000Z"));

    expect(options[0]?.session).toBe("2026");
  });
});
