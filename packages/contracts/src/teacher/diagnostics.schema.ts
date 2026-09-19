import { z } from "zod";

import { mistakeReasonSchema } from "../practice/practice-enums.js";
import { difficultySchema, questionTypeSchema } from "../question/question-enums.js";

/**
 * Class diagnostics — the teacher's half of the mistake loop.
 *
 * ## What was missing
 *
 * The assignment report answers "who has finished?". Every teacher who has ever
 * set homework already knows that is the least useful question available: it
 * tells them about compliance and nothing about teaching. The question they
 * actually have on Monday morning is **"what do I need to reteach, and to
 * whom?"**, and nothing in the product answered it.
 *
 * So this is the same loop the student's dashboard runs, pointed at a class:
 * find where the marks are being lost, say what kind of loss it is, and make the
 * fix one click away.
 *
 * ## Privacy: what a teacher gets and what they do not
 *
 * The classroom contract already draws this line — a teacher sees readiness, not
 * a student's working — and diagnostics does not move it. Aggregates are
 * class-wide. Per-student detail is limited to what a teacher needs in order to
 * act: who is behind on a topic, and by how much. No answer text, no per-question
 * transcript of an individual's attempt.
 *
 * The one place that gets close is `commonWrongAnswers`, and it stays on the
 * right side of the line by being a *count over the class*: "nine students chose
 * option C". A distractor nine people picked is a misconception the teacher must
 * address on the board; it is not a fact about any one of them.
 *
 * ## Why distractor analysis is the centrepiece
 *
 * "62% got Q4 wrong" tells a teacher to reteach something. **"Of the 19 who got
 * Q4 wrong, 15 chose the option where the sign of the discriminant was flipped"**
 * tells them precisely what to reteach, and that it is one error rather than
 * nineteen. That distinction is the whole reason this surface exists, and it is
 * why the shape below carries option-level counts rather than an accuracy
 * percentage per question.
 */

// ── Item analysis ────────────────────────────────────────────────────────────

/**
 * How often each option was chosen, for an objective question.
 *
 * Empty for subjective types, where there is nothing to count — the honest
 * outcome, rather than inventing a bucket. A teacher reading a long-answer item
 * gets the accuracy and the mistake reasons and has to read the room for the
 * rest, which is what they were doing anyway.
 */
export const optionTallySchema = z.object({
  optionId: z.string().min(1),
  label: z.string().min(1),
  body: z.string(),
  isCorrect: z.boolean(),
  chosenBy: z.int().nonnegative(),
});

export type OptionTally = z.infer<typeof optionTallySchema>;

export const itemAnalysisSchema = z.object({
  questionId: z.string().min(1),
  body: z.string().min(1),
  type: questionTypeSchema,
  difficulty: difficultySchema,
  marks: z.number(),
  chapterName: z.string().nullable(),
  topicName: z.string().nullable(),

  /** Students who submitted an answer to this item. The denominator. */
  attempted: z.int().nonnegative(),
  correct: z.int().nonnegative(),
  /**
   * Marks won over marks available, 0–1.
   *
   * A ratio rather than a correct-count percentage because partial credit is
   * real: a five-mark question the class half-answered is a different teaching
   * problem from one they all got wrong, and a boolean correct/incorrect count
   * flattens the two into the same number.
   */
  scoreRatio: z.number().min(0).max(1),
  /** Median, not mean. One student who left the tab open all night is normal. */
  medianTimeMs: z.int().nonnegative(),

  options: z.array(optionTallySchema),
  /**
   * Distinct free-text answers given by more than one student, most common
   * first. The subjective-question equivalent of a distractor tally, and capped
   * hard — this is a "three people all wrote 9.8 m/s²" signal, not a transcript.
   */
  commonWrongAnswers: z.array(z.object({ answer: z.string(), count: z.int().positive() })),
  /** What the students who missed it said went wrong, where they said. */
  mistakeReasons: z.array(z.object({ reason: mistakeReasonSchema, count: z.int().positive() })),
});

export type ItemAnalysis = z.infer<typeof itemAnalysisSchema>;

export const assignmentItemAnalysisSchema = z.object({
  assignmentId: z.string().min(1),
  title: z.string().min(1),
  /**
   * True when each student was given the same frozen question list.
   *
   * This is a property of the assignment's source, not of its attempt counts:
   * an unfinished curated test can have a smaller denominator on question ten
   * than question one while still being directly comparable. Inferring it from
   * those denominators would label a timed, partly-finished test as though the
   * teacher had given every student a different paper.
   */
  sameQuestionsForEveryone: z.boolean(),
  /**
   * Students who submitted anything. Item denominators can be smaller — a
   * student who ran out of time answered the first six of ten — and a teacher
   * comparing "8 of 12 got it right" across items needs to know which of those
   * two numbers moved.
   */
  studentsAttempted: z.int().nonnegative(),
  studentsInClass: z.int().nonnegative(),
  /** Hardest first: this list is read top-down and acted on from the top. */
  items: z.array(itemAnalysisSchema),
});

export type AssignmentItemAnalysis = z.infer<typeof assignmentItemAnalysisSchema>;

// ── Classroom-wide diagnostics ───────────────────────────────────────────────

export const classTopicSchema = z.object({
  topicId: z.string().min(1),
  topicName: z.string().min(1),
  chapterId: z.string().min(1),
  chapterName: z.string().min(1),
  /** Students in this class who have attempted anything on the topic. */
  studentsAttempted: z.int().nonnegative(),
  attempts: z.int().nonnegative(),
  scoreRatio: z.number().min(0).max(1),
  /**
   * Students whose own mastery on this topic is below the weak threshold.
   *
   * The number that decides whether this is a reteach-to-the-room problem or a
   * pull-four-students-aside problem, which are different lessons. A class
   * average of 55% hides both cases and distinguishes neither.
   */
  studentsStruggling: z.int().nonnegative(),
});

export type ClassTopic = z.infer<typeof classTopicSchema>;

export const strugglingStudentSchema = z.object({
  studentId: z.string().min(1),
  studentName: z.string().nullable(),
  studentEmail: z.email(),
  /** Weighted accuracy across this classroom's subject, 0–1. */
  masteryScore: z.number().min(0).max(1),
  attempted: z.int().nonnegative(),
  unrepairedMistakes: z.int().nonnegative(),
  /** Their worst topics by name, for a teacher scanning a list of names. */
  weakestTopics: z.array(z.string()),
  lastActiveAt: z.iso.datetime().nullable(),
});

export type StrugglingStudent = z.infer<typeof strugglingStudentSchema>;

export const classroomDiagnosticsSchema = z.object({
  classroomId: z.string().min(1),
  classroomName: z.string().min(1),
  subjectName: z.string().min(1),
  studentCount: z.int().nonnegative(),
  /** Students with a graded attempt in the last 7 days. */
  activeThisWeek: z.int().nonnegative(),
  attemptsThisWeek: z.int().nonnegative(),
  /** Class-wide marks won over available, all time, 0–1. Null before any work. */
  classScoreRatio: z.number().min(0).max(1).nullable(),

  /** Weakest first — the reteach list. */
  weakestTopics: z.array(classTopicSchema),
  /** Strongest first, so a teacher can also see what has landed. */
  strongestTopics: z.array(classTopicSchema),
  /**
   * Where the class is losing marks, by the student's own account.
   *
   * A class whose losses are mostly `CALCULATION_ERROR` needs drill and a slower
   * board; one whose losses are mostly `CONCEPT_NOT_KNOWN` needs the lesson
   * again. Those are opposite responses to identical-looking mark totals, which
   * is why this is on the page rather than in a report nobody opens.
   */
  mistakeReasons: z.array(z.object({ reason: mistakeReasonSchema, count: z.int().positive() })),
  strugglingStudents: z.array(strugglingStudentSchema),
  /**
   * The single hardest questions across everything this class has attempted,
   * regardless of which assignment they came from.
   */
  hardestQuestions: z.array(itemAnalysisSchema),
});

export type ClassroomDiagnostics = z.infer<typeof classroomDiagnosticsSchema>;

/**
 * Below this share of available marks, a topic is a problem worth naming.
 *
 * The same 0.5 the student-facing weak-topic rule uses, deliberately: a teacher
 * and their student looking at the same topic must not be told different things
 * about it because two thresholds drifted apart in two files.
 */
export const CLASS_WEAK_SCORE_RATIO = 0.5;

/** Enough attempts that a low score means something rather than bad luck. */
export const CLASS_MIN_ATTEMPTS = 3;
