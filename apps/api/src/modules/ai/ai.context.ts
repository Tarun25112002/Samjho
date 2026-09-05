import type { AIAction } from "@samjho/contracts";

import { HISTORY_TOKEN_BUDGET } from "./ai.models.js";
import type { GroundingRow } from "./ai.repository.js";
import type { ChatMessage } from "./provider/types.js";

/**
 * The context block: everything factual the model is told, assembled here.
 *
 * This file is the other half of the contract that `sendMessageSchema` states
 * by omission. The client sends an action and at most a sentence; every fact
 * about the question — its body, its options, which option is correct, the
 * official solution, the marking scheme, the student's own attempt — is read
 * from the database and formatted here (docs/05 §2).
 *
 * The formatting is plain labelled text rather than JSON. Models follow prose
 * structure at least as well, and a JSON blob invites the model to answer in
 * JSON, which then has to be undone. The one structural device used is the
 * `<student-message>` fence in ai.prompt.ts, and it is used because that span
 * is the only untrusted one.
 */

/** Hard ceiling on any single field that reaches a prompt. */
const MAX_FIELD_CHARS = 4_000;

function clamp(value: string, limit = MAX_FIELD_CHARS): string {
  const trimmed = value.trim();
  return trimmed.length <= limit ? trimmed : `${trimmed.slice(0, limit)}…[truncated]`;
}

/**
 * Whether this action is allowed to see the official answer.
 *
 * All six do. A hint that does not know where the student is going is not a
 * hint, it is a guess — and a tutor guessing at a board-exam answer is the one
 * failure mode this product cannot afford. Keeping the answer out of the HINT
 * prompt would trade a correctness guarantee for a leak the action instruction
 * already prevents, and of the two risks, a confidently wrong hint is worse
 * than an over-generous one.
 *
 * The function exists anyway, so that the decision is written down in one place
 * and can be revisited per action rather than rediscovered in a template.
 */
function needsAnswer(_action: AIAction): boolean {
  return true;
}

interface AttemptSummary {
  answerJson: unknown;
  isCorrect: boolean | null;
  marksAwarded: number | null;
  marksPossible: number | null;
}

export interface QuestionContextInput {
  action: AIAction;
  question: GroundingRow;
  attempt: AttemptSummary | null;
}

/**
 * Render the student's submitted answer.
 *
 * `answerJson` is shaped by question type — a string for numeric, an array of
 * option ids for MCQ, prose for subjective — so it is rendered generically
 * rather than switched on. What matters to the model is what the student wrote,
 * not which column it came out of.
 */
function renderAttemptAnswer(answerJson: unknown): string {
  if (answerJson === null || answerJson === undefined) return "(no answer recorded)";
  if (typeof answerJson === "string") return clamp(answerJson, 1_000);

  try {
    return clamp(JSON.stringify(answerJson), 1_000);
  } catch {
    return "(unreadable)";
  }
}

/**
 * Render the marking scheme as steps.
 *
 * Stored as JSON in the documented shape `[{ step, marks, keyPoints }]`, and
 * flattened here rather than passed through as JSON because STEP_BY_STEP is
 * asked to mirror this structure in prose — handing the model the shape it
 * should imitate, already in prose, is most of that instruction's work.
 *
 * Anything not in the expected shape is stringified and let through. A scheme
 * a curriculum editor entered in an older format is still better grounding than
 * no scheme, and silently dropping it would be the worse failure.
 */
function renderMarkingScheme(scheme: unknown): string | null {
  if (scheme === null || scheme === undefined) return null;

  if (Array.isArray(scheme)) {
    const steps = scheme
      .map((entry, index) => {
        if (typeof entry !== "object" || entry === null) return `  ${index + 1}. ${String(entry)}`;

        const row = entry as { step?: unknown; marks?: unknown; keyPoints?: unknown };
        const marks = typeof row.marks === "number" ? ` [${row.marks} mark(s)]` : "";
        const points = Array.isArray(row.keyPoints)
          ? ` — key points: ${row.keyPoints.join("; ")}`
          : "";

        return `  ${index + 1}. ${String(row.step ?? "")}${marks}${points}`;
      })
      .join("\n");

    return steps.length > 0 ? clamp(steps) : null;
  }

  if (typeof scheme === "string") return clamp(scheme);

  try {
    return clamp(JSON.stringify(scheme));
  } catch {
    return null;
  }
}

export function buildQuestionContext({ action, question, attempt }: QuestionContextInput): string {
  const lines: string[] = ["QUESTION CONTEXT"];

  lines.push(`Subject: CBSE Class ${question.subject.classLevel} ${question.subject.name}`);
  if (question.chapter) lines.push(`Chapter: ${question.chapter.name}`);

  const topics = question.topics
    .filter((link) => link.isPrimary)
    .map((link) => link.topic.name)
    .join(", ");
  if (topics) lines.push(`Topic: ${topics}`);

  lines.push(`Type: ${question.type} · Marks: ${question.marks} · Level: ${question.difficulty}`);

  // A case-study sub-part means nothing without the passage it hangs off, and
  // the student is looking at both on screen. Omitting it would have the model
  // answer a question the student did not ask.
  if (question.parent) {
    lines.push("", "Case-study stimulus (shown above the question):", clamp(question.parent.body));
  }

  lines.push("", "Question:", clamp(question.body));

  if (question.options.length > 0) {
    lines.push("", "Options:");
    for (const option of question.options) {
      // The correct option is marked. The student sees the options unmarked;
      // the model has to know which one is right to teach towards it.
      const marker = needsAnswer(action) && option.isCorrect ? "  ← correct" : "";
      lines.push(`  ${option.label}. ${clamp(option.body, 500)}${marker}`);
    }
  }

  const answer = question.answer;
  if (answer && needsAnswer(action)) {
    lines.push("", "OFFICIAL ANSWER KEY (authoritative — never contradict it)");

    if (answer.correctValue) lines.push(`Correct answer: ${clamp(answer.correctValue, 500)}`);
    if (answer.unit) lines.push(`Unit: ${answer.unit}`);
    if (answer.acceptedValues.length > 0) {
      lines.push(`Also accepted: ${answer.acceptedValues.slice(0, 10).join(", ")}`);
    }
    if (answer.solution) lines.push("", "Official solution:", clamp(answer.solution));
    const scheme = renderMarkingScheme(answer.markingScheme);
    if (scheme) lines.push("", "Marking scheme:", scheme);
    if (answer.explanation) lines.push("", "Editorial explanation:", clamp(answer.explanation));
  } else if (!answer) {
    // Said out loud rather than left as an absence. A model given a question and
    // no key will confidently produce one; told the key is missing, it hedges,
    // which is the correct behaviour when nobody has verified the answer.
    lines.push("", "No official answer is on record for this question. Do not invent one.");
  }

  if (attempt) {
    lines.push("", "THIS STUDENT'S ATTEMPT");
    lines.push(`They answered: ${renderAttemptAnswer(attempt.answerJson)}`);
    if (attempt.isCorrect !== null) {
      lines.push(`Marked: ${attempt.isCorrect ? "correct" : "incorrect"}`);
    }
    if (attempt.marksAwarded !== null && attempt.marksPossible !== null) {
      lines.push(`Score: ${attempt.marksAwarded} / ${attempt.marksPossible}`);
    }
  }

  return lines.join("\n");
}

export interface ChapterContextInput {
  name: string;
  subject: { name: string; classLevel: number };
  topics: Array<{ name: string }>;
}

/**
 * Grounding for a CHAPTER conversation, which has no question to anchor to.
 *
 * Thinner than the question block by necessity, and that thinness is the point
 * of listing the topics: without them "ask me anything about Chemical
 * Reactions" is an open-ended chatbot with a subject label, and the model has
 * nothing to tell it that redox belongs here and thermodynamics does not.
 */
export function buildChapterContext(chapter: ChapterContextInput): string {
  const lines = [
    "CHAPTER CONTEXT",
    `Subject: CBSE Class ${chapter.subject.classLevel} ${chapter.subject.name}`,
    `Chapter: ${chapter.name}`,
  ];

  if (chapter.topics.length > 0) {
    lines.push(
      "",
      "Topics in this chapter (the syllabus boundary for this conversation):",
      ...chapter.topics.slice(0, 40).map((topic) => `  - ${topic.name}`),
    );
  }

  lines.push(
    "",
    "There is no specific question in front of the student. Answer about this chapter's material only; if they ask about another chapter, point them there instead of answering.",
  );

  return lines.join("\n");
}

/** A stored turn, as `loadHistory` returns it. */
export interface HistoryRow {
  role: string;
  content: string;
}

/**
 * Trim history to the token budget, oldest first.
 *
 * Dropping from the front rather than summarising is the right trade at this
 * scale: a summarisation pass is a second model call on every turn, paid to
 * compress a conversation that is usually four messages long. The recent turns
 * are also the ones that matter — "explain that more simply" refers to the
 * message immediately before it, never to the one twelve turns back.
 *
 * The estimate is character-based (see `estimateTokens`), so this is a
 * approximate bound on an approximate budget. That is fine; it is a cost
 * control, not a context-window limit, and every model in the chain would
 * happily accept far more than we are willing to buy.
 */
export function trimHistory(
  rows: readonly HistoryRow[],
  budget = HISTORY_TOKEN_BUDGET,
): ChatMessage[] {
  const kept: ChatMessage[] = [];
  let used = 0;

  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (!row) continue;
    // SYSTEM rows are never replayed: the system prompt is rebuilt from current
    // config every turn, and a stale copy of an older one in the message list
    // would contradict it.
    if (row.role !== "USER" && row.role !== "ASSISTANT") continue;

    const cost = Math.ceil(row.content.length / 4);
    if (used + cost > budget && kept.length > 0) break;

    kept.push({
      role: row.role === "USER" ? "user" : "assistant",
      content: row.content,
    });
    used += cost;
  }

  kept.reverse();

  // A history that starts on an assistant turn reads, to the model, as though
  // it spoke unprompted. Drop the orphan.
  while (kept.length > 0 && kept[0]?.role === "assistant") kept.shift();

  return kept;
}
