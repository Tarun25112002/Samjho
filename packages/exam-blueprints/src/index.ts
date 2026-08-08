/**
 * @samjho/exam-blueprints
 *
 * Exam structures as validated configuration rather than code.
 *
 * The brief's constraint was "design the system so that the exam structure is
 * configurable rather than hard-coded", and this package is where that promise
 * is kept. A CBSE pattern change — and CBSE demonstrably changes patterns — is a
 * data edit and a seed run here, not a refactor of the exam engine.
 *
 * The package deliberately holds no database access and no HTTP. It is pure
 * data plus a validator, which is what lets the seed, the API, the admin paper
 * editor, and the test suite all agree on what a paper is allowed to look like.
 */

export * from "./blueprint.schema.js";
export * from "./validate.js";
export * from "./blueprints/index.js";
