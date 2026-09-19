import { MISTAKE_REASON_LABELS, type MistakeReason } from "@medhavi/contracts";

import { prisma } from "../../lib/prisma.js";

/**
 * What the tutor knows about the student it is teaching.
 *
 * ## Why this exists
 *
 * Until now the tutor was grounded in the *question* and blind to the *person*.
 * That produces a competent stranger: every explanation pitched identically,
 * every diagnosis of a wrong answer a fresh one, and "be careful with signs"
 * offered to a student who has dropped a sign four times this fortnight as
 * though it were a new observation.
 *
 * All of the data below already exists — `TopicMastery` is maintained inside
 * the attempt transaction, `MistakeRecord` knows what keeps going wrong, and
 * `QuestionAttempt.mistakeReason` is the student's own account of why. None of
 * it was reaching the model. Three cheap indexed reads turn a competent
 * stranger into a tutor who has been watching.
 *
 * ## What is deliberately not in here
 *
 * Anything that is not about this student's work on this subject. No name, no
 * school, no email, no age, nothing about their guardian. The model is given
 * facts about answers, not a description of a child — every user of this
 * product is a minor (docs/07 R6), and a prompt is the last place a personal
 * detail should end up, because it leaves our infrastructure.
 *
 * ## Why the numbers are described rather than sent
 *
 * "You are around 40% on this topic" invites a model to quote a figure at a
 * fifteen-year-old as though it were a verdict. The bands below turn the same
 * fact into something a tutor would actually say — and a band cannot be
 * misquoted to one decimal place.
 */

export interface LearnerProfile {
  /** Empty when there is nothing worth telling the model. */
  lines: string[];
}

const EMPTY: LearnerProfile = { lines: [] };

/** Enough attempts that a mastery figure means something rather than nothing. */
const MIN_ATTEMPTS_FOR_BAND = 3;
const RECENT_MISTAKE_WINDOW = 12;

export const aiLearner = {
  /**
   * The student's standing on the topic this question belongs to.
   *
   * Returns nothing rather than guessing when the student is new to the topic.
   * A tutor told "this student is at 0%" on a topic they have never been asked
   * about will teach to a weakness that does not exist.
   */
  async profile(userId: string, topicIds: string[]): Promise<LearnerProfile> {
    if (topicIds.length === 0) return EMPTY;

    const [mastery, mistakes, reasons] = await Promise.all([
      prisma.topicMastery.findMany({
        where: { userId, topicId: { in: topicIds } },
        select: {
          attempted: true,
          correct: true,
          masteryScore: true,
          unrepairedMistakes: true,
          topic: { select: { name: true } },
        },
      }),
      prisma.mistakeRecord.count({
        where: {
          userId,
          repairedAt: null,
          question: { topics: { some: { topicId: { in: topicIds } } } },
        },
      }),
      prisma.questionAttempt.findMany({
        where: {
          userId,
          mistakeReason: { not: null },
          question: { topics: { some: { topicId: { in: topicIds } } } },
        },
        select: { mistakeReason: true },
        orderBy: { attemptedAt: "desc" },
        take: RECENT_MISTAKE_WINDOW,
      }),
    ]);

    const lines: string[] = [];

    for (const row of mastery) {
      if (row.attempted < MIN_ATTEMPTS_FOR_BAND) continue;

      lines.push(
        `On ${row.topic.name}, this student is ${band(row.masteryScore)} ` +
          `(${String(row.correct)} of ${String(row.attempted)} right so far).`,
      );
    }

    if (mistakes > 0) {
      lines.push(
        mistakes === 1
          ? "They have one question on this topic they have got wrong and not yet put right."
          : `They have ${String(mistakes)} questions on this topic they have got wrong and not yet put right.`,
      );
    }

    const pattern = dominantReason(reasons.map((row) => row.mistakeReason));
    if (pattern) {
      lines.push(
        `When they get this topic wrong, they most often say the cause was: ` +
          `${MISTAKE_REASON_LABELS[pattern.reason].toLowerCase()} ` +
          `(${String(pattern.count)} of their last ${String(reasons.length)} mistakes here).`,
      );
    }

    if (lines.length === 0) return EMPTY;

    return {
      lines: [
        "WHAT YOU KNOW ABOUT THIS STUDENT",
        ...lines,
        "Use this to pitch your answer. Refer to a pattern only when it is relevant to the mistake in front of you, and never read these figures back to them as a score.",
      ],
    };
  },
};

/**
 * Mastery as a phrase rather than a percentage.
 *
 * Four bands, worded the way a teacher would describe a student to another
 * teacher. The boundaries match the ones the preparation report uses, so a
 * student reading "weak at Probability" on /analysis and hearing the tutor
 * treat it as shaky are not being told two different things.
 */
function band(score: number): string {
  if (score >= 0.75) return "strong on this";
  if (score >= 0.5) return "reasonably solid but not secure";
  if (score >= 0.3) return "finding this difficult";
  return "struggling with this";
}

/**
 * The reason that comes up most, if one genuinely dominates.
 *
 * A student whose last six mistakes are one of each has no pattern, and telling
 * a model otherwise would have it inventing one. The threshold is a third,
 * which is where a tendency starts being worth naming out of eight categories.
 */
function dominantReason(
  reasons: (MistakeReason | null)[],
): { reason: MistakeReason; count: number } | null {
  const counts = new Map<MistakeReason, number>();

  for (const reason of reasons) {
    if (reason === null) continue;
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }

  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  if (total < 3) return null;

  const top = [...counts.entries()].sort((left, right) => right[1] - left[1])[0];
  if (!top || top[1] / total < 1 / 3) return null;

  return { reason: top[0], count: top[1] };
}
