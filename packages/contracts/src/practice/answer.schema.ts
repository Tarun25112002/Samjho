import { z } from "zod";

/**
 * What a student's answer looks like on the wire.
 *
 * ## Why one shape rather than a discriminated union
 *
 * The union — `{ kind: "choice", optionIds } | { kind: "text", text }` — is the
 * shape a type theorist would draw, and `packages/ui` deliberately left a note
 * saying it belonged here once something actually graded an answer. Having now
 * written the grader, the union is the wrong trade:
 *
 *  - The grader switches on `question.type`, which it must read anyway to know
 *    the marks and the key. A discriminant on the *answer* would be a second
 *    source of truth for the same fact, supplied by the client, and the grader
 *    would have to reject the case where the two disagree — a whole class of
 *    error that does not exist if the answer carries no opinion about its type.
 *  - Every store that holds an in-progress answer (React state today, IndexedDB
 *    in Phase 6) becomes a map of one shape rather than a map of six.
 *
 * So: both fields always present, both usually empty, and the question's type
 * decides which one is read. `optionIds` is an array rather than a single id
 * because CBSE multi-select exists in other boards and the storage cost of the
 * extra bracket is zero — the same reason the renderer chose it in Phase 3.
 *
 * ## Blank is a real answer
 *
 * An empty answer submits and grades as wrong rather than being refused. A
 * student who does not know the answer needs to see the solution, and making
 * them type something first to get past a validator teaches them to type
 * anything.
 */
export const studentAnswerSchema = z.object({
  /** Selected option ids, for MCQ and assertion–reason. */
  optionIds: z.array(z.string().min(1).max(60)).max(10).default([]),
  /**
   * Free text: "TRUE"/"FALSE", a number, a fill-in word, match pairs, or a full
   * worked answer. The ceiling is a long-answer's worth of working — generous,
   * but a bounded write to a JSONB column rather than an unbounded one.
   */
  text: z.string().max(20_000).default(""),
});

export type StudentAnswer = z.infer<typeof studentAnswerSchema>;

/** The zero value. Exported so nothing has to spell the empty answer twice. */
export const EMPTY_ANSWER: StudentAnswer = { optionIds: [], text: "" };

/**
 * Has the student put anything in the box?
 *
 * Used for the "you have not answered this" prompt in the runner and for the
 * exam palette's answered/unanswered state in Phase 6 — one definition, so the
 * two surfaces cannot disagree about what counts as answered.
 */
export function isAnswered(answer: StudentAnswer): boolean {
  return answer.optionIds.length > 0 || answer.text.trim().length > 0;
}
