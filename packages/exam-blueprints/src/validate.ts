import { examBlueprintSchema } from "./blueprint.schema.js";
import type { BlueprintGroup, BlueprintSection, ExamBlueprint } from "./blueprint.schema.js";

/**
 * Blueprint validation in two layers.
 *
 * Zod handles *shape* — is `count` a positive integer, is `types` non-empty.
 * That is necessary and nowhere near sufficient: a blueprint can be perfectly
 * well-typed and still describe a paper that does not exist, because the marks
 * do not add up to the number printed on the front page.
 *
 * The second layer is the arithmetic, and it is the layer that earns its keep.
 * Every check below corresponds to a mistake that is easy to make by hand and
 * invisible on inspection.
 */

export interface BlueprintIssue {
  /** Dotted path into the blueprint, e.g. "sections.4.groups.0.marks". */
  path: string;
  message: string;
}

export interface SectionSummary {
  name: string;
  orderIndex: number;
  questions: number;
  marks: number;
  /** Positions in this section that offer an internal-choice alternative. */
  choicePositions: number;
  /** Positions whose question is a container with sub-parts. */
  containerPositions: number;
}

export interface BlueprintSummary {
  totalMarks: number;
  totalQuestions: number;
  sections: SectionSummary[];
  /** Marks reachable only through container sub-parts — the CBQ-style share. */
  containerMarks: number;
}

export type BlueprintValidation =
  | { ok: true; blueprint: ExamBlueprint; summary: BlueprintSummary }
  | { ok: false; issues: BlueprintIssue[] };

/**
 * Marks for one position in a group: the group's own value, else the section
 * default. Returns null when neither is set, which is a validation error rather
 * than a reason to guess.
 */
function resolveGroupMarks(section: BlueprintSection, group: BlueprintGroup): number | null {
  return group.marks ?? section.marksPerQuestion ?? null;
}

/**
 * Can `target` marks be split into at least `minParts` sub-parts, each drawn
 * from `allowed`? This is the CONSTRAINED sub-part check — Class 10 Science says
 * "sub-parts of the values of 1/2/3 marks" without prescribing one split, so the
 * validator has to ask whether *some* legal split exists rather than compare
 * against a fixed one.
 *
 * Breadth-first over partial sums, one sub-part per round. Marks are single
 * digits, so this is far cheaper than its generality suggests.
 */
function canPartition(target: number, allowed: number[], minParts: number): boolean {
  const values = [...new Set(allowed)].filter((v) => v > 0 && v <= target);
  if (values.length === 0) return false;

  let frontier = new Set<number>([0]);
  for (let parts = 1; parts <= target; parts++) {
    const next = new Set<number>();
    for (const sum of frontier) {
      for (const v of values) {
        if (sum + v <= target) next.add(sum + v);
      }
    }
    if (next.size === 0) return false;
    if (parts >= minParts && next.has(target)) return true;
    frontier = next;
  }
  return false;
}

/**
 * Tally a blueprint. Assumes marks resolve everywhere — call only after
 * `validateBlueprint` has confirmed that, or on a blueprint from `blueprints/`.
 */
export function summariseBlueprint(blueprint: ExamBlueprint): BlueprintSummary {
  const sections = blueprint.sections.map((section): SectionSummary => {
    let questions = 0;
    let marks = 0;
    let choicePositions = 0;
    let containerPositions = 0;

    for (const group of section.groups) {
      const perQuestion = resolveGroupMarks(section, group) ?? 0;
      questions += group.count;
      marks += group.count * perQuestion;
      choicePositions += group.choiceCount;
      if (group.subParts) containerPositions += group.count;
    }

    return {
      name: section.name,
      orderIndex: section.orderIndex,
      questions,
      marks,
      choicePositions,
      containerPositions,
    };
  });

  const containerMarks = blueprint.sections.reduce(
    (sum, section) =>
      sum +
      section.groups.reduce(
        (s, group) =>
          group.subParts ? s + group.count * (resolveGroupMarks(section, group) ?? 0) : s,
        0,
      ),
    0,
  );

  return {
    totalMarks: sections.reduce((s, x) => s + x.marks, 0),
    totalQuestions: sections.reduce((s, x) => s + x.questions, 0),
    sections,
    containerMarks,
  };
}

export function validateBlueprint(input: unknown): BlueprintValidation {
  const parsed = examBlueprintSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        message: issue.message,
      })),
    };
  }

  const blueprint = parsed.data;
  const issues: BlueprintIssue[] = [];

  // ── Section ordering ────────────────────────────────────────────────────────
  // orderIndex drives both the paper layout and the navigation palette. Gaps or
  // duplicates there produce a paper that renders in an arbitrary order, which
  // is the kind of bug a student discovers three hours into an exam.
  const orderIndexes = blueprint.sections.map((s) => s.orderIndex).sort((a, b) => a - b);
  const expected = blueprint.sections.map((_, i) => i);
  if (orderIndexes.join(",") !== expected.join(",")) {
    issues.push({
      path: "sections",
      message: `section orderIndex values must be exactly 0..${String(blueprint.sections.length - 1)} with no gaps or duplicates, got [${orderIndexes.join(", ")}]`,
    });
  }

  const seenNames = new Set<string>();
  for (const [i, section] of blueprint.sections.entries()) {
    if (seenNames.has(section.name)) {
      issues.push({
        path: `sections.${String(i)}.name`,
        message: `duplicate section name "${section.name}"`,
      });
    }
    seenNames.add(section.name);
  }

  // ── Per-group marks resolution and sub-part arithmetic ──────────────────────
  for (const [i, section] of blueprint.sections.entries()) {
    for (const [j, group] of section.groups.entries()) {
      const path = `sections.${String(i)}.groups.${String(j)}`;
      const perQuestion = resolveGroupMarks(section, group);

      if (perQuestion === null) {
        issues.push({
          path: `${path}.marks`,
          message: `neither the group nor section "${section.name}" declares marks per question`,
        });
        continue;
      }

      // A section default that a group silently contradicts is worse than no
      // default at all: two places claim authority and the reader cannot tell
      // which one the renderer will believe. Force the section to drop its
      // default when any group disagrees with it.
      if (
        section.marksPerQuestion !== undefined &&
        group.marks !== undefined &&
        group.marks !== section.marksPerQuestion
      ) {
        issues.push({
          path: `${path}.marks`,
          message: `group declares ${String(group.marks)} marks but section "${section.name}" defaults to ${String(section.marksPerQuestion)}; a section that mixes marks must omit marksPerQuestion and set it on every group`,
        });
      }

      if (group.subParts?.mode === "FIXED") {
        const subTotal = group.subParts.marks.reduce((a, b) => a + b, 0);
        if (subTotal !== perQuestion) {
          issues.push({
            path: `${path}.subParts.marks`,
            message: `sub-parts sum to ${String(subTotal)} but the question is worth ${String(perQuestion)} marks`,
          });
        }
      }

      if (group.subParts?.mode === "CONSTRAINED") {
        const { allowedMarks, minParts } = group.subParts;
        if (!canPartition(perQuestion, allowedMarks, minParts)) {
          issues.push({
            path: `${path}.subParts.allowedMarks`,
            message: `no combination of ${String(minParts)}+ sub-parts drawn from [${allowedMarks.join(", ")}] sums to ${String(perQuestion)} marks`,
          });
        }
      }
    }
  }

  // Bail before the totals: with unresolved marks the tally is meaningless and
  // would bury the real error under two spurious ones.
  if (issues.some((i) => i.message.includes("declares marks per question"))) {
    return { ok: false, issues };
  }

  // ── The cross-check that catches transcription errors ───────────────────────
  const summary = summariseBlueprint(blueprint);

  if (summary.totalMarks !== blueprint.totalMarks) {
    issues.push({
      path: "totalMarks",
      message: `declared ${String(blueprint.totalMarks)} but sections sum to ${String(summary.totalMarks)} (${summary.sections.map((s) => `${s.name}=${String(s.marks)}`).join(", ")})`,
    });
  }

  if (summary.totalQuestions !== blueprint.totalQuestions) {
    issues.push({
      path: "totalQuestions",
      message: `declared ${String(blueprint.totalQuestions)} but sections sum to ${String(summary.totalQuestions)} (${summary.sections.map((s) => `${s.name}=${String(s.questions)}`).join(", ")})`,
    });
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, blueprint, summary };
}

/** Throwing wrapper for seeds and tests, where an invalid blueprint is fatal. */
export function assertValidBlueprint(input: unknown): ExamBlueprint {
  const result = validateBlueprint(input);
  if (!result.ok) {
    const detail = result.issues.map((i) => `  • ${i.path || "(root)"}: ${i.message}`).join("\n");
    throw new Error(`Invalid exam blueprint:\n${detail}`);
  }
  return result.blueprint;
}
