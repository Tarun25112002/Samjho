import type { PaperShortfall, QuestionType } from "@samjho/contracts";
import type { BlueprintGroup, BlueprintSection, ExamBlueprint } from "@samjho/exam-blueprints";

import { shuffle } from "../../lib/random.js";

/**
 * Turning a blueprint into a paper.
 *
 * ## Pure, like the grader
 *
 * No Prisma, no clock. It takes a blueprint and a pool of candidate questions
 * and returns a plan. That is what makes "does Section E of the Class 10 Science
 * pattern actually get filled by three 1+1+2 case studies" a unit test rather
 * than a fixture-heavy integration test, and it is why the awkward part — the
 * sub-part matching — can be exercised directly.
 *
 * ## A shortfall is a result, not an error
 *
 * The bank is being written from zero and content entry is the critical path
 * (docs/07 R1). For months, most generation attempts will fail to fill some
 * group, and the useful thing to return is *which* group and by how much —
 * "Section E wants three 4-mark case studies and the bank has one" is a work
 * order. Throwing would turn the most informative output this code produces
 * into a stack trace.
 *
 * So the planner always returns a plan. `complete` says whether it may be
 * written; the shortfalls say what to write next.
 *
 * ## What a position costs
 *
 * A group of seven questions with two internal choices needs **nine** distinct
 * questions, not seven. That arithmetic is the single easiest thing to get wrong
 * here and the reason `needed` is computed once, in `groupDemand`, rather than
 * inline at each use.
 */

export interface CandidateQuestion {
  id: string;
  type: QuestionType;
  marks: number;
  isContainer: boolean;
  /** Marks of each sub-part, in order. Empty for a non-container. */
  subPartMarks: number[];
}

export interface PlannedItem {
  questionId: string;
  variant: "MAIN" | "OR";
}

export interface PlannedSlot {
  questionNumber: number;
  orderIndex: number;
  marks: number;
  isOptional: boolean;
  items: PlannedItem[];
}

export interface PlannedSection {
  name: string;
  orderIndex: number;
  instructions: string | null;
  marksPerQuestion: number | null;
  slots: PlannedSlot[];
}

export interface PaperPlanResult {
  sections: PlannedSection[];
  shortfalls: PaperShortfall[];
  complete: boolean;
  totalMarks: number;
  /** Positions, which is what a paper's "38 questions" counts. */
  questionCount: number;
  /** Distinct questions consumed, alternatives included. */
  questionsUsed: number;
}

export function planPaper(
  blueprint: ExamBlueprint,
  pool: readonly CandidateQuestion[],
): PaperPlanResult {
  // Shuffled once, up front. Drawing in id order would put the same questions in
  // every paper generated from a bank that has barely enough of them — which is
  // exactly the bank this product has.
  const available = shuffle(pool);
  const used = new Set<string>();

  const sections: PlannedSection[] = [];
  const shortfalls: PaperShortfall[] = [];

  let questionNumber = 1;

  for (const section of [...blueprint.sections].sort((a, b) => a.orderIndex - b.orderIndex)) {
    const slots: PlannedSlot[] = [];

    for (const [groupIndex, group] of section.groups.entries()) {
      const marks = resolveMarks(section, group);
      if (marks === null) continue;

      const eligible = available.filter(
        (candidate) => !used.has(candidate.id) && matchesGroup(candidate, group, marks),
      );

      const demand = groupDemand(group);
      const positions = fillablePositions(group, eligible.length);

      if (positions < group.count) {
        shortfalls.push({
          sectionName: section.name,
          groupIndex,
          marks,
          types: [...group.types],
          needed: demand,
          available: eligible.length,
          needsSubParts: group.subParts !== undefined,
        });
      }

      let taken = 0;
      for (let position = 0; position < positions; position++) {
        const withChoice = position < Math.min(group.choiceCount, positions);

        const main = eligible[taken++];
        const alternative = withChoice ? eligible[taken++] : undefined;
        if (!main) break;

        const items: PlannedItem[] = [{ questionId: main.id, variant: "MAIN" }];
        used.add(main.id);

        if (alternative) {
          items.push({ questionId: alternative.id, variant: "OR" });
          used.add(alternative.id);
        }

        slots.push({
          questionNumber: questionNumber++,
          orderIndex: slots.length,
          marks,
          // Internal choice is not optionality: the student must answer the
          // position, they merely choose which alternative. `isOptional` is for
          // the rare position a paper lets you skip outright, and no MVP
          // blueprint has one.
          isOptional: false,
          items,
        });
      }
    }

    sections.push({
      name: section.name,
      orderIndex: section.orderIndex,
      instructions: section.instructions ?? null,
      marksPerQuestion: section.marksPerQuestion ?? null,
      slots,
    });
  }

  const totalMarks = sections.reduce(
    (sum, section) => sum + section.slots.reduce((inner, slot) => inner + slot.marks, 0),
    0,
  );
  const questionCount = sections.reduce((sum, section) => sum + section.slots.length, 0);

  return {
    sections,
    shortfalls,
    complete: shortfalls.length === 0,
    totalMarks,
    questionCount,
    questionsUsed: used.size,
  };
}

/** The group's own marks, else the section default. Null is a blueprint defect. */
function resolveMarks(section: BlueprintSection, group: BlueprintGroup): number | null {
  return group.marks ?? section.marksPerQuestion ?? null;
}

/** Questions a fully-filled group consumes: every position, plus its alternatives. */
export function groupDemand(group: BlueprintGroup): number {
  return group.count + Math.min(group.choiceCount, group.count);
}

/**
 * How many positions `supply` questions can actually fill.
 *
 * Not `supply / 2`. The choice-carrying positions come first and cost two
 * questions each; the rest cost one. Nine questions in a group of seven with two
 * choices fills all seven; eight fills six with both choices, or — and this is
 * the decision — six positions rather than seven-without-one-of-its-choices.
 *
 * Dropping a position is the right failure. A paper that silently omits an
 * internal choice CBSE prescribes is a paper that misrepresents the exam, and
 * the student finds out on the day. A paper one question short is caught by the
 * total-marks check before anyone sits it.
 */
export function fillablePositions(group: BlueprintGroup, supply: number): number {
  const choices = Math.min(group.choiceCount, group.count);
  let positions = 0;
  let remaining = supply;

  for (let position = 0; position < group.count; position++) {
    const cost = position < choices ? 2 : 1;
    if (remaining < cost) break;
    remaining -= cost;
    positions++;
  }

  return positions;
}

/**
 * Is this question a legal filling for this position?
 *
 * Marks and type are the obvious half. The sub-part rules are the half that
 * matters, because they are the reason `subParts` is a discriminated union
 * rather than an array (see the blueprint schema): Class 10 Maths prescribes
 * exactly 1+1+2 for its case studies, while Class 10 Science prescribes a
 * *vocabulary* of 1/2/3 and accepts any split that adds up. Treating the second
 * as the first would reject perfectly valid content.
 */
export function matchesGroup(
  candidate: CandidateQuestion,
  group: BlueprintGroup,
  marks: number,
): boolean {
  if (candidate.marks !== marks) return false;
  if (!group.types.includes(candidate.type)) return false;

  if (!group.subParts) {
    // A group that did not ask for sub-parts must not receive a container: the
    // container carries no answer of its own, so the position would be
    // unanswerable and unscoreable.
    return !candidate.isContainer;
  }

  if (!candidate.isContainer || candidate.subPartMarks.length === 0) return false;

  const parts = candidate.subPartMarks;
  if (sum(parts) !== marks) return false;

  const rule = group.subParts;
  if (rule.mode === "FIXED") return sameMultiset(parts, rule.marks);

  return parts.length >= rule.minParts && parts.every((value) => rule.allowedMarks.includes(value));
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** Order-insensitive comparison: 2+1+1 is the same split as 1+1+2. */
function sameMultiset(left: readonly number[], right: readonly number[]): boolean {
  if (left.length !== right.length) return false;

  const sortedLeft = [...left].sort((a, b) => a - b);
  const sortedRight = [...right].sort((a, b) => a - b);

  return sortedLeft.every((value, index) => value === sortedRight[index]);
}
