import {
  isAutoGradable,
  type EvaluationMode,
  type QuestionType,
  type StudentAnswer,
} from "@samjho/contracts";

/**
 * Deciding whether an answer is right.
 *
 * ## Pure on purpose
 *
 * Nothing in this file touches Prisma, Express or the clock. It takes a question
 * and an answer and returns a grade, which means every rule in it — including
 * the awkward ones about spacing and units — is unit-testable without a database
 * and without inventing a session first. That matters more here than almost
 * anywhere else in the codebase: this is the code that tells a fifteen-year-old
 * they got it wrong, and being wrong about that is the fastest way to lose them.
 *
 * ## Three outcomes, not two
 *
 * A grade is `AUTO` (we scored it), `SELF` (the student will score it against
 * the marking scheme), or neither-yet. The third is `PENDING` with a null
 * `isCorrect`, and it is not a placeholder — it is the state a three-mark
 * derivation is genuinely in the moment it is submitted. Collapsing it to
 * "wrong until scored" would put every subjective answer into the student's
 * mistake list for as long as it sat there.
 *
 * ## Generosity is deliberate, and bounded
 *
 * Normalisation forgives everything about *presentation* — case, spacing, a
 * trailing full stop, `1,000` for `1000`, writing the unit the answer key
 * already states — and forgives nothing about *content*. A student who typed the
 * right number and lost the mark to a space would be right to stop trusting the
 * app, and a student who typed the wrong number and got the mark learns nothing.
 * Where the two pull against each other, the tie goes to accepting: the marking
 * scheme is shown immediately afterwards either way, so a generous auto-grade
 * costs a moment's confusion, while a stingy one costs credibility.
 */

export interface GradableOption {
  id: string;
  label: string;
  isCorrect: boolean;
}

/** The narrow slice of a question that grading needs. */
export interface GradableUnit {
  id: string;
  type: QuestionType;
  marks: number;
  options: GradableOption[];
  answer: {
    correctValue: string | null;
    acceptedValues: string[];
    tolerance: number | null;
    unit: string | null;
  } | null;
}

export interface Grade {
  /** Null while a subjective answer waits for the student to score it. */
  isCorrect: boolean | null;
  marksAwarded: number;
  evaluationMode: EvaluationMode;
}

const PENDING: Grade = { isCorrect: null, marksAwarded: 0, evaluationMode: "PENDING" };

export function gradeAnswer(unit: GradableUnit, answer: StudentAnswer): Grade {
  if (!isAutoGradable(unit.type)) return PENDING;

  const verdict = checkAutoGradable(unit, answer);

  // An auto-gradable question with no usable key cannot be scored. The honest
  // state for that is "not scored" — the same state a subjective answer is in —
  // rather than "wrong", which would blame the student for a content defect.
  // Unreachable for anything entered through the Phase 4 validator, which
  // refuses to save an MCQ with no correct option or a numerical with no value.
  if (verdict === null) return PENDING;

  return {
    isCorrect: verdict,
    marksAwarded: verdict ? unit.marks : 0,
    evaluationMode: "AUTO",
  };
}

/** True, false, or null meaning "this question has no key to compare against". */
function checkAutoGradable(unit: GradableUnit, answer: StudentAnswer): boolean | null {
  switch (unit.type) {
    case "MCQ":
    case "ASSERTION_REASON":
      return checkChoice(unit, answer);

    case "NUMERICAL":
      return checkNumerical(unit, answer);

    case "MATCH_FOLLOWING":
      return checkAgainstKey(unit, answer, normaliseMatchPairs);

    case "TRUE_FALSE":
    case "FILL_BLANK":
      return checkAgainstKey(unit, answer, normaliseText);

    default:
      // Every remaining type is subjective and `isAutoGradable` already
      // excluded it. Listed as a default rather than enumerated so that adding
      // a question type to the enum does not silently fall through to "correct".
      return null;
  }
}

/**
 * MCQ and assertion–reason.
 *
 * The key is the `isCorrect` flag on the option rows — the same decision
 * Phase 4's rule table encodes by *forbidding* `correctValue` on these types,
 * because storing the answer twice means two things that can disagree silently.
 *
 * The fallback to matching the option label against `correctValue` exists for
 * the seeded questions, which predate that rule and write both. It is a read of
 * legacy data, not a second supported way to author a question.
 */
function checkChoice(unit: GradableUnit, answer: StudentAnswer): boolean | null {
  let correctIds = unit.options.filter((option) => option.isCorrect).map((option) => option.id);

  if (correctIds.length === 0 && unit.answer?.correctValue) {
    const wanted = normaliseText(unit.answer.correctValue);
    correctIds = unit.options
      .filter((option) => normaliseText(option.label) === wanted)
      .map((option) => option.id);
  }

  if (correctIds.length === 0) return null;

  const selected = new Set(answer.optionIds);
  return selected.size === correctIds.length && correctIds.every((id) => selected.has(id));
}

/**
 * Numerical answers, compared as numbers rather than as strings.
 *
 * Three things a student legitimately does that a string comparison punishes:
 * writing the unit the question already asked for ("8 A"), grouping digits
 * ("1,00,000" — Indian grouping, which `Number()` refuses outright), and writing
 * `8.0` where the key says `8`. All three are presentation.
 *
 * `tolerance` is the author's, and zero means exact — chosen deliberately in the
 * admin form rather than defaulted to something forgiving, because "within 0.5"
 * is a claim about the physics, not about typing. The epsilon added to it is not
 * a second tolerance: it is there because `0.1 + 0.2 !== 0.3` in binary floating
 * point, and a student who typed the exactly right decimal must not lose a mark
 * to that.
 */
const FLOAT_EPSILON = 1e-9;

function checkNumerical(unit: GradableUnit, answer: StudentAnswer): boolean | null {
  const key = unit.answer;
  if (!key) return null;

  const expectedValues = [key.correctValue, ...key.acceptedValues]
    .filter((value): value is string => value !== null)
    .map((value) => parseNumber(value, key.unit))
    .filter((value): value is number => value !== null);

  if (expectedValues.length === 0) {
    // The key is not a number — "3.4 × 10⁵ J" written out, say. Comparing as
    // text is still better than refusing to grade, and normalisation makes it
    // survive spacing.
    return checkAgainstKey(unit, answer, normaliseText);
  }

  const given = parseNumber(answer.text, key.unit);
  if (given === null) return false;

  const tolerance = (key.tolerance ?? 0) + FLOAT_EPSILON;
  return expectedValues.some((expected) => Math.abs(expected - given) <= tolerance);
}

/** Compare the student's text against the key and its accepted variants. */
function checkAgainstKey(
  unit: GradableUnit,
  answer: StudentAnswer,
  normalise: (value: string) => string,
): boolean | null {
  const key = unit.answer;
  if (!key) return null;

  const accepted = [key.correctValue, ...key.acceptedValues]
    .filter((value): value is string => value !== null)
    .map(normalise)
    .filter((value) => value.length > 0);

  if (accepted.length === 0) return null;

  const given = normalise(answer.text);
  if (given.length === 0) return false;

  return accepted.includes(given);
}

// ── Normalisation ────────────────────────────────────────────────────────────

/**
 * Case, spacing and terminal punctuation are not part of the answer.
 *
 * Also folds the characters a phone keyboard substitutes without being asked:
 * curly quotes, en and em dashes, and the multiplication sign a student pastes
 * out of the question itself.
 */
export function normaliseText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replaceAll(/[‘’]/g, "'")
    .replaceAll(/[“”]/g, '"')
    .replaceAll(/[‐-―−]/g, "-")
    .replaceAll(/\s+/g, " ")
    .trim()
    .replace(/[.\s]+$/, "");
}

/**
 * Match-the-following, where the order the pairs are written in is not the
 * answer.
 *
 * A student who writes "iii-s, i-q, ii-r, iv-p" has matched all four correctly
 * and would fail a string comparison against the key's ordering. Sorting the
 * pairs is what makes the grade about the matching rather than about the
 * transcription — and it is the single normalisation rule here that changes a
 * verdict rather than merely tidying a string, which is why it is a separate
 * function with its own name rather than another line inside `normaliseText`.
 */
export function normaliseMatchPairs(value: string): string {
  return normaliseText(value)
    .split(/[,;]/)
    .map((pair) => pair.replaceAll(/\s+/g, "").replaceAll(/[:=→]/g, "-"))
    .filter((pair) => pair.length > 0)
    .sort()
    .join(",");
}

/**
 * Read a number out of what a student typed.
 *
 * Returns null when there is no number in there at all, which is a wrong answer
 * rather than an unscoreable one — `checkNumerical` makes that call, not this.
 */
export function parseNumber(value: string, unit: string | null): number | null {
  let text = normaliseText(value);

  if (unit) {
    const suffix = normaliseText(unit);
    if (suffix.length > 0 && text.endsWith(suffix)) {
      text = text.slice(0, -suffix.length).trim();
    }
  }

  // Indian digit grouping ("1,00,000") and the plain international kind both
  // arrive as commas between digits. Removed only between digits, so a stray
  // comma elsewhere still breaks the parse rather than silently changing the
  // number.
  text = text.replaceAll(/(?<=\d),(?=\d)/g, "");

  const match = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/.exec(text);
  if (!match) return null;

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * The self-evaluated grade, once the student has scored themselves.
 *
 * `isCorrect` means full marks and nothing less. Partial credit is real and is
 * recorded in `marksAwarded`; calling three-out-of-five "correct" would make
 * accuracy meaningless and would keep a half-understood answer out of the
 * mistake list, which is the one place it needs to be.
 */
export function selfEvaluatedGrade(marksAwarded: number, marksPossible: number): Grade {
  const clamped = Math.min(Math.max(marksAwarded, 0), marksPossible);

  return {
    isCorrect: clamped >= marksPossible,
    marksAwarded: clamped,
    evaluationMode: "SELF",
  };
}
