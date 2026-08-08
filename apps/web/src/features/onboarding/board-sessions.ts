import { EXAM_PHASE_LABELS, type ExamPhase } from "@samjho/contracts";

/**
 * Which board sittings a student can sensibly aim at right now.
 *
 * Pure and date-injected rather than reading the clock itself, so it can be
 * tested at any point in the year — including the awkward March–May window that
 * only exists because Class 10 gained a second attempt. A function that calls
 * `new Date()` internally is a function whose interesting cases you cannot
 * reach.
 *
 * The CBSE year: Phase 1 sits in February and is mandatory; Phase 2 sits in May,
 * is optional, and counts best-of-two. Both belong to the same session year. So
 * once May has passed, the next thing to aim at is February of the year after.
 */

/** June onwards, the current year's sittings are both behind us. */
const FIRST_MONTH_AFTER_BOTH_SITTINGS = 5; // 0-indexed: June

export interface BoardSessionOption {
  session: string;
  phase: ExamPhase;
  label: string;
  hint: string;
}

export function suggestBoardSessions(now: Date): BoardSessionOption[] {
  const year = now.getFullYear();
  const nextSession = now.getMonth() >= FIRST_MONTH_AFTER_BOTH_SITTINGS ? year + 1 : year;

  return [
    {
      session: String(nextSession),
      phase: "PHASE_1",
      label: `${EXAM_PHASE_LABELS.PHASE_1} ${String(nextSession)}`,
      hint: "The main sitting. Every candidate takes this one.",
    },
    {
      session: String(nextSession),
      phase: "PHASE_2",
      label: `${EXAM_PHASE_LABELS.PHASE_2} ${String(nextSession)}`,
      hint: "Optional second attempt. Your better score of the two counts.",
    },
    {
      session: String(nextSession + 1),
      phase: "PHASE_1",
      label: `${EXAM_PHASE_LABELS.PHASE_1} ${String(nextSession + 1)}`,
      hint: "Planning a year ahead.",
    },
  ];
}
