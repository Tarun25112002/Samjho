import { assertValidBlueprint } from "../validate.js";
import type { ExamBlueprint } from "../blueprint.schema.js";
import { cbse10MathsStandard } from "./cbse-10-maths-standard.js";
import { cbse10Science } from "./cbse-10-science.js";
import { cbse12Physics } from "./cbse-12-physics.js";

/**
 * Every shipped blueprint, validated at module load.
 *
 * Validating here rather than in the seed means an invalid blueprint fails the
 * moment anything imports this module — the build, the test run, the API boot —
 * instead of at 2am when someone runs a migration. The blueprints are static
 * data, so there is no cost to checking them eagerly.
 */
export const ALL_BLUEPRINTS: readonly ExamBlueprint[] = [
  assertValidBlueprint(cbse10MathsStandard),
  assertValidBlueprint(cbse10Science),
  assertValidBlueprint(cbse12Physics),
];

/**
 * The subset with real content behind them. Class 12 Physics is validated and
 * shipped but has no questions — see its module comment.
 */
export const MVP_BLUEPRINT_IDS = ["cbse-10-maths-standard-2026", "cbse-10-science-2026"] as const;

export function getBlueprint(id: string): ExamBlueprint | undefined {
  return ALL_BLUEPRINTS.find((b) => b.id === id);
}

export { cbse10MathsStandard, cbse10Science, cbse12Physics };
