import { describe, expect, it } from "vitest";

import { deterministicNote, planWeek, type WeakTopic, type WeekInput } from "./study-plan.week.js";

/**
 * Laying out a week.
 *
 * Pure, so it is tested at the boundaries rather than through a fixture: a
 * student with no history, a student buried under a revision backlog, a student
 * three weeks from the exam, a student whose subjects have no papers. Those are
 * the four cases that produce a wrong plan, and none of them is the common one.
 */

const MONDAY = new Date("2026-09-21T00:00:00.000Z");

function topic(name: string, score: number): WeakTopic {
  return {
    topicId: `t-${name}`,
    topicName: name,
    subjectId: "s-maths",
    subjectName: "Mathematics",
    masteryScore: score,
    attempted: 10,
  };
}

function week(overrides: Partial<WeekInput> = {}) {
  return planWeek({
    start: MONDAY,
    weak: [topic("Quadratics", 0.3), topic("Trigonometry", 0.45)],
    revisionDue: 0,
    mockableSubjects: [],
    daysToExam: null,
    minutesPerDay: 45,
    ...overrides,
  });
}

function kinds(days: ReturnType<typeof week>): string[][] {
  return days.map((day) => day.focus.map((slot) => slot.kind));
}

describe("the shape of a week", () => {
  it("is always seven days, in order, starting on the day given", () => {
    const days = week();

    expect(days).toHaveLength(7);
    expect(days[0]?.date).toBe("2026-09-21");
    expect(days[6]?.date).toBe("2026-09-27");
  });

  it("labels the days correctly", () => {
    const days = week();

    expect(days[0]?.label).toBe("Monday");
    expect(days[6]?.label).toBe("Sunday");
  });

  it("gives an ordinary week one rest day, at the end", () => {
    const days = week();

    expect(days[6]?.focus[0]?.kind).toBe("REST");
    expect(days[6]?.minutes).toBe(0);
    expect(kinds(days).slice(0, 6).flat()).not.toContain("REST");
  });

  it("drops the rest day when the exam is close", () => {
    const days = week({ daysToExam: 10 });

    expect(kinds(days).flat()).not.toContain("REST");
  });

  it("keeps the rest day when the exam is still months away", () => {
    const days = week({ daysToExam: 120 });

    expect(days[6]?.focus[0]?.kind).toBe("REST");
  });
});

describe("what fills the days", () => {
  it("works through the weak topics rather than repeating the weakest", () => {
    const days = week();

    const topics = days
      .flatMap((day) => day.focus)
      .filter((slot) => slot.kind === "TOPIC")
      .map((slot) => slot.topicName);

    expect(new Set(topics).size).toBeGreaterThan(1);
  });

  it("schedules revision when the queue owes something", () => {
    const days = week({ revisionDue: 30 });

    expect(kinds(days).flat()).toContain("REVISION");
  });

  it("schedules none when the queue is clear", () => {
    const days = week({ revisionDue: 0 });

    expect(kinds(days).flat()).not.toContain("REVISION");
  });

  it("gives a bigger backlog more days, not one impossible day", () => {
    const light = week({ revisionDue: 10 }).filter((day) =>
      day.focus.some((slot) => slot.kind === "REVISION"),
    );
    const heavy = week({ revisionDue: 60 }).filter((day) =>
      day.focus.some((slot) => slot.kind === "REVISION"),
    );

    expect(heavy.length).toBeGreaterThan(light.length);
  });

  it("never asks for more than a sitting's worth of revision in one day", () => {
    const days = week({ revisionDue: 500 });

    for (const day of days) {
      for (const slot of day.focus) {
        if (slot.kind === "REVISION") expect(slot.questionCount).toBeLessThanOrEqual(20);
      }
    }
  });

  it("schedules a mock when a subject has a paper", () => {
    const days = week({ mockableSubjects: [{ subjectId: "s-maths", subjectName: "Mathematics" }] });

    const mocks = days.flatMap((day) => day.focus).filter((slot) => slot.kind === "MOCK");
    expect(mocks).toHaveLength(1);
    expect(mocks[0]?.minutes).toBe(180);
  });

  it("schedules no mock when no subject has a paper", () => {
    const days = week({ mockableSubjects: [] });

    expect(kinds(days).flat()).not.toContain("MOCK");
  });

  it("does not stack topic practice on top of a three-hour paper", () => {
    const days = week({ mockableSubjects: [{ subjectId: "s-maths", subjectName: "Mathematics" }] });

    const mockDay = days.find((day) => day.focus.some((slot) => slot.kind === "MOCK"));
    expect(mockDay?.focus.map((slot) => slot.kind)).not.toContain("TOPIC");
  });
});

describe("a student the plan knows nothing about", () => {
  it("still produces seven days rather than an empty week", () => {
    const days = week({ weak: [], revisionDue: 0, mockableSubjects: [] });

    expect(days).toHaveLength(7);
    expect(days.every((day) => day.focus.length > 0)).toBe(true);
  });

  it("does not invent a topic to practise", () => {
    const days = week({ weak: [], revisionDue: 0, mockableSubjects: [] });

    expect(kinds(days).flat()).not.toContain("TOPIC");
  });
});

describe("the minutes", () => {
  it("are the sum of the day's slots", () => {
    for (const day of week({ revisionDue: 20 })) {
      const total = day.focus.reduce((sum, slot) => sum + slot.minutes, 0);
      expect(day.minutes).toBe(total);
    }
  });

  it("keep an ordinary day near what the student said they could give", () => {
    for (const day of week()) {
      if (day.focus.some((slot) => slot.kind === "MOCK")) continue;
      expect(day.minutes).toBeLessThanOrEqual(60);
    }
  });
});

describe("the sentence a day gets without a model", () => {
  it("says what the work is, for every kind of day", () => {
    const days = week({
      revisionDue: 20,
      mockableSubjects: [{ subjectId: "s-maths", subjectName: "Mathematics" }],
    });

    for (const day of days) {
      const note = deterministicNote(day);
      expect(note.length).toBeGreaterThan(0);
      expect(note.length).toBeLessThanOrEqual(240);
    }
  });

  it("names the topic on a topic day", () => {
    const days = week();
    const topicDay = days.find((day) => day.focus[0]?.kind === "TOPIC");

    expect(deterministicNote(topicDay ?? days[0]!)).toContain("Quadratics");
  });

  it("does not apologise for the rest day", () => {
    const days = week();
    const note = deterministicNote(days[6]!).toLowerCase();

    expect(note).toContain("rest");
    expect(note).not.toContain("sorry");
  });
});
