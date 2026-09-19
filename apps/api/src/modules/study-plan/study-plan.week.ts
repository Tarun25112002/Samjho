import type { WeeklyFocus, WeeklyPlanDay } from "@samjho/contracts";

import { shiftDay, toDayKey } from "../../lib/study-day.js";

/**
 * Laying out a week, with no model involved.
 *
 * Every decision that matters is made here: which topics, how many questions,
 * which days are revision, which day is the mock, which day is rest. A model is
 * asked afterwards to explain the result, and it cannot change it.
 *
 * That ordering is not a stylistic preference. A plan a student follows is an
 * instruction, and the failure mode of an invented instruction — practise a
 * topic you have not been taught, sit a mock in a subject with no papers — is
 * silent, because it looks exactly like a plan. Computing it means the worst a
 * model can do is describe a real slot badly.
 *
 * It is also why this file is pure. Seven days of scheduling logic with no
 * database and no clock is logic that can be tested at every boundary, which is
 * what the tests beside it do.
 */

export interface WeakTopic {
  topicId: string;
  topicName: string;
  subjectId: string;
  subjectName: string;
  /** 0-1. Lower is weaker. */
  masteryScore: number;
  attempted: number;
}

export interface WeekInput {
  /** IST day the week starts on. */
  start: Date;
  /** Weakest first. Only topics with enough attempts to mean anything. */
  weak: WeakTopic[];
  /** What the spaced-repetition schedule says is owed today. */
  revisionDue: number;
  /** Subjects with at least one published paper, so a mock is a real option. */
  mockableSubjects: Array<{ subjectId: string; subjectName: string }>;
  /** Null when the student has not set a target exam. */
  daysToExam: number | null;
  /** What the student can realistically give on an ordinary day. */
  minutesPerDay: number;
}

/**
 * A minute a mark, which is the pace CBSE itself sets, rounded to whole
 * questions. It is the same assumption `defaultExpectedTimeSeconds` makes, and
 * having the two disagree would make a plan that says 40 minutes take 25.
 */
const MINUTES_PER_QUESTION = 2;
const MIN_QUESTIONS = 5;
const MAX_QUESTIONS = 20;

const LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Seven days, in order.
 *
 * The shape is the point, and it is the same every week so that a student
 * learns to read it: revision early while the backlog is largest, new work on
 * the weakest topics through the middle, a mock near the end, and one rest day
 * — unless the exam is close enough that a rest day is a luxury, which is the
 * one thing `daysToExam` changes.
 */
export function planWeek(input: WeekInput): Array<Omit<WeeklyPlanDay, "note">> {
  const urgent = input.daysToExam !== null && input.daysToExam <= 21;
  const restDay = urgent ? -1 : 6;
  const mockDay = input.mockableSubjects.length > 0 ? 4 : -1;

  // Backlog first. A student with sixty owed reviews and a plan that gives them
  // one revision day has been handed a plan that cannot work, so the count of
  // revision days rises with the backlog rather than being fixed.
  const revisionDays = input.revisionDue === 0 ? 0 : Math.min(3, Math.ceil(input.revisionDue / 20));

  const days: Array<Omit<WeeklyPlanDay, "note">> = [];
  let topicCursor = 0;
  let revisionPlaced = 0;

  for (let offset = 0; offset < 7; offset += 1) {
    // Negative moves forward: `shiftDay` counts backwards by design, since
    // every other caller is looking at history.
    const day = shiftDay(input.start, -offset);
    const date = toDayKey(day);
    const label = LABELS[day.getUTCDay()] ?? "Day";

    if (offset === restDay) {
      days.push({ date, label, focus: [rest()], minutes: 0 });
      continue;
    }

    const focus: WeeklyFocus[] = [];
    let minutes = 0;

    // Revision is spread rather than stacked: two separate days clear the same
    // backlog as one double day and are twice as likely to happen.
    const wantsRevision = revisionPlaced < revisionDays && offset % 2 === 0;
    if (wantsRevision) {
      const count = Math.min(20, Math.max(1, Math.ceil(input.revisionDue / revisionDays)));
      const slot = revision(count);
      focus.push(slot);
      minutes += slot.minutes;
      revisionPlaced += 1;
    }

    if (offset === mockDay) {
      const subject = input.mockableSubjects[0];
      if (subject) {
        const slot = mock(subject.subjectId, subject.subjectName);
        focus.push(slot);
        minutes += slot.minutes;
      }
    }

    const remaining = Math.max(0, input.minutesPerDay - minutes);
    // A mock already is the day. Adding topic practice after three hours of
    // paper is a plan nobody follows, and a plan nobody follows is worse than a
    // shorter one they do.
    if (remaining >= MINUTES_PER_QUESTION * MIN_QUESTIONS && offset !== mockDay) {
      const topic = input.weak[topicCursor % Math.max(1, input.weak.length)];
      if (topic) {
        const slot = topicWork(topic, remaining);
        focus.push(slot);
        minutes += slot.minutes;
        topicCursor += 1;
      }
    }

    if (focus.length === 0) focus.push(rest());

    days.push({ date, label, focus, minutes });
  }

  return days;
}

function rest(): WeeklyFocus {
  return {
    kind: "REST",
    subjectId: null,
    subjectName: null,
    topicId: null,
    topicName: null,
    questionCount: 0,
    minutes: 0,
  };
}

function revision(count: number): WeeklyFocus {
  return {
    kind: "REVISION",
    subjectId: null,
    subjectName: null,
    topicId: null,
    topicName: null,
    questionCount: count,
    minutes: count * MINUTES_PER_QUESTION,
  };
}

function mock(subjectId: string, subjectName: string): WeeklyFocus {
  return {
    kind: "MOCK",
    subjectId,
    subjectName,
    topicId: null,
    topicName: null,
    questionCount: 0,
    // A CBSE theory paper is three hours. Saying so is the point: a student who
    // has never sat one to time does not know that, and a plan that hides it
    // schedules a mock into an evening that cannot hold one.
    minutes: 180,
  };
}

/**
 * New practice on one weak topic.
 *
 * The count is bounded at both ends for different reasons. The floor is that
 * three questions on a topic tell a student nothing and move mastery barely at
 * all. The ceiling is that twenty questions on one topic in one sitting is
 * where attention goes, and the twenty-first is answered rather than thought
 * about.
 */
function topicWork(topic: WeakTopic, availableMinutes: number): WeeklyFocus {
  const count = clamp(
    Math.floor(availableMinutes / MINUTES_PER_QUESTION),
    MIN_QUESTIONS,
    MAX_QUESTIONS,
  );

  return {
    kind: "TOPIC",
    subjectId: topic.subjectId,
    subjectName: topic.subjectName,
    topicId: topic.topicId,
    topicName: topic.topicName,
    questionCount: count,
    minutes: count * MINUTES_PER_QUESTION,
  };
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/**
 * The sentence a day gets when no model wrote one.
 *
 * Not a placeholder. It states the one fact that makes the slot make sense, so
 * a plan with the AI switched off reads as a terse plan rather than as a broken
 * one — the same standard `analysisInsight` holds its fallback to.
 */
export function deterministicNote(day: Omit<WeeklyPlanDay, "note">): string {
  const primary = day.focus[0];
  if (!primary) return "";

  switch (primary.kind) {
    case "REST":
      return "A day off. Rest is part of the schedule, not a gap in it.";
    case "REVISION":
      return `Clear ${String(primary.questionCount)} from your revision queue — questions you have already got wrong once.`;
    case "MOCK":
      return `A full ${primary.subjectName ?? ""} paper, to time. Three hours, in one sitting.`.trim();
    case "TOPIC":
      return `${String(primary.questionCount)} questions on ${primary.topicName ?? "your weakest topic"} — the topic your answers say is weakest.`;
  }
}
