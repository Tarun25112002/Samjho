"use client";

import {
  bloomLevelSchema,
  difficultySchema,
  licenceStatusSchema,
  questionTypeSchema,
  sourceTypeSchema,
  type AdminChapter,
  type AdminQuestion,
  type WriteQuestionInput,
} from "@samjho/contracts";
import { DIFFICULTY_LABELS, QUESTION_TYPE_LABELS } from "@samjho/ui";
import { useState } from "react";

import { Field, Fieldset, inputClass } from "./fields";
import { QuestionPreview } from "./question-preview";
import { useQuestionEditor, type QuestionEditorDefaults } from "./use-question-editor";

/**
 * The question form.
 *
 * ## What makes this fast enough
 *
 * The phase gate is a *measured* median entry time under 90 seconds (docs/07,
 * Phase 4), and everything unusual about this form is in service of it:
 *
 *  - **The type picker comes first and reshapes the form.** A `NUMERICAL`
 *    question never shows an options editor; an `MCQ` never shows a tolerance
 *    box. Both facts come from `QUESTION_TYPE_RULES` in contracts, so the form
 *    and the validator cannot disagree about what a type needs.
 *  - **Everything has a defensible default.** Difficulty, Bloom level, expected
 *    time and source type are all pre-set, so a fast question is four fields:
 *    body, marks, options, solution.
 *  - **"Save and add another" keeps the chapter, topics, type and source.**
 *    Content entry works down a paper, and re-picking those four each time is
 *    most of the ninety seconds.
 *
 * ## What is deliberately *not* fast
 *
 * The licence status starts at "not reviewed" and publication refuses until
 * somebody changes it. That is one extra decision per question, and it is the
 * one docs/07 R2 exists to force.
 */

const TYPE_OPTIONS = questionTypeSchema.options;
const DIFFICULTY_OPTIONS = difficultySchema.options;
const BLOOM_OPTIONS = bloomLevelSchema.options;
const SOURCE_OPTIONS = sourceTypeSchema.options;
const LICENCE_OPTIONS = licenceStatusSchema.options;

/** How CBSE numbers the parts of a case study on the printed paper. */
const SUB_PART_LABELS = ["i", "ii", "iii", "iv", "v", "vi"];

const SOURCE_LABELS: Record<(typeof SOURCE_OPTIONS)[number], string> = {
  ORIGINAL: "Written for Samjho",
  CBSE_BOARD_PAPER: "CBSE board paper",
  CBSE_SAMPLE_PAPER: "CBSE sample paper",
  NCERT: "NCERT textbook",
  ADAPTED: "Adapted from another source",
  THIRD_PARTY: "Third-party publisher",
};

const LICENCE_LABELS: Record<(typeof LICENCE_OPTIONS)[number], string> = {
  NEEDS_REVIEW: "Not reviewed yet — cannot be published",
  CLEARED: "Cleared for use",
  FAIR_USE_CLAIMED: "Fair use claimed",
  RESTRICTED: "Restricted — keep for reference, never serve",
};

export interface QuestionEditorProps {
  chapters: AdminChapter[];
  defaults: QuestionEditorDefaults;
  initial: WriteQuestionInput;
  question?: AdminQuestion;
}

export function QuestionEditor({ chapters, initial, question }: QuestionEditorProps) {
  const editor = useQuestionEditor(question ? { questionId: question.id, initial } : { initial });
  const [showPreview, setShowPreview] = useState(true);

  const { draft, rule, fieldErrors } = editor;
  const chapter = chapters.find((row) => row.id === draft.chapterId);
  const topics = chapter?.topics ?? [];

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          void editor.submit("saved");
        }}
      >
        <Fieldset legend="Where it belongs">
          <Field label="Chapter" error={fieldErrors["chapterId"]}>
            {({ id, describedBy }) => (
              <select
                id={id}
                aria-describedby={describedBy}
                className={inputClass}
                value={draft.chapterId}
                onChange={(event) => {
                  // Topics belong to a chapter, and the API refuses a mismatch.
                  // Clearing them here means the editor never gets to submit a
                  // combination that will be rejected.
                  editor.patch({ chapterId: event.target.value, topicIds: [] });
                }}
              >
                {chapters.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.domain ? `${row.domain} · ` : ""}
                    {row.name}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field
            label="Topics"
            hint="The first one selected is the primary topic — mastery is attributed to it."
            error={fieldErrors["topicIds"]}
          >
            {({ id, describedBy }) => (
              <div id={id} aria-describedby={describedBy} className="flex flex-wrap gap-2">
                {topics.map((topic) => {
                  const position = draft.topicIds.indexOf(topic.id);
                  const selected = position >= 0;

                  return (
                    <button
                      key={topic.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        editor.patch({
                          topicIds: selected
                            ? draft.topicIds.filter((value) => value !== topic.id)
                            : [...draft.topicIds, topic.id],
                        });
                      }}
                      className={`min-h-11 rounded-full border px-3 text-sm ${
                        selected
                          ? "border-brand-500 text-text"
                          : "border-line-strong text-text-soft"
                      }`}
                    >
                      {position === 0 ? "★ " : ""}
                      {topic.name}
                    </button>
                  );
                })}
                {topics.length === 0 ? (
                  <p className="text-text-soft text-sm">This chapter has no topics yet.</p>
                ) : null}
              </div>
            )}
          </Field>
        </Fieldset>

        <Fieldset legend="The question">
          <Field label="Type" error={fieldErrors["type"]}>
            {({ id, describedBy }) => (
              <select
                id={id}
                aria-describedby={describedBy}
                className={inputClass}
                value={draft.type}
                onChange={(event) => {
                  editor.changeType(event.target.value as typeof draft.type);
                }}
              >
                {TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {QUESTION_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field
            label="Question"
            hint="Markdown, with maths in $…$. Tables render — that is how match-the-following is written."
            error={fieldErrors["body"]}
          >
            {({ id, describedBy }) => (
              <textarea
                id={id}
                aria-describedby={describedBy}
                rows={5}
                className={inputClass}
                value={draft.body}
                onChange={(event) => {
                  editor.patch({ body: event.target.value });
                }}
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Marks" error={fieldErrors["marks"]}>
              {({ id, describedBy }) => (
                <input
                  id={id}
                  aria-describedby={describedBy}
                  type="number"
                  min={1}
                  max={20}
                  className={inputClass}
                  value={draft.marks}
                  onChange={(event) => {
                    editor.patch({ marks: Number(event.target.value) });
                  }}
                />
              )}
            </Field>

            <Field label="Difficulty">
              {({ id }) => (
                <select
                  id={id}
                  className={inputClass}
                  value={draft.difficulty}
                  onChange={(event) => {
                    editor.patch({ difficulty: event.target.value as typeof draft.difficulty });
                  }}
                >
                  {DIFFICULTY_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {DIFFICULTY_LABELS[value]}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field label="Bloom level">
              {({ id }) => (
                <select
                  id={id}
                  className={inputClass}
                  value={draft.bloomLevel}
                  onChange={(event) => {
                    editor.patch({ bloomLevel: event.target.value as typeof draft.bloomLevel });
                  }}
                >
                  {BLOOM_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {value.charAt(0) + value.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>

          <Field
            label="Expected time (seconds)"
            hint={`Leave blank for ${String(editor.expectedTimeHint)}s — a minute a mark.`}
          >
            {({ id, describedBy }) => (
              <input
                id={id}
                aria-describedby={describedBy}
                type="number"
                min={5}
                className={inputClass}
                value={draft.expectedTimeSeconds ?? ""}
                placeholder={String(editor.expectedTimeHint)}
                onChange={(event) => {
                  editor.patch({
                    expectedTimeSeconds:
                      event.target.value === "" ? null : Number(event.target.value),
                  });
                }}
              />
            )}
          </Field>
        </Fieldset>

        {rule.options === "required" ? (
          <Fieldset
            legend="Options"
            description="Tick the correct one. There is exactly one, and the tick is the answer key — there is no separate field for it."
          >
            {draft.options.map((option, index) => (
              <div key={option.label} className="flex items-start gap-3">
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="correct-option"
                    checked={option.isCorrect}
                    onChange={() => {
                      editor.markCorrect(index);
                    }}
                  />
                  <span className="text-text-soft w-4 font-semibold">{option.label}</span>
                </label>

                <input
                  className={inputClass}
                  aria-label={`Option ${option.label}`}
                  value={option.body}
                  onChange={(event) => {
                    editor.patchOption(index, { body: event.target.value });
                  }}
                />
              </div>
            ))}

            {fieldErrors["options"] ? (
              <p role="alert" className="text-marker-700 text-xs">
                {fieldErrors["options"]}
              </p>
            ) : null}
          </Fieldset>
        ) : null}

        {rule.subParts === "required" ? (
          <Fieldset
            legend="Sub-parts"
            description={`A case study is one question worth the sum of its parts. Parts currently total ${String(editor.subPartTotal)} of ${String(draft.marks)}.`}
          >
            {draft.subParts.map((part, index) => (
              <div key={index} className="border-line space-y-3 border-l-2 pl-4">
                <div className="flex items-center justify-between">
                  <span className="text-text-soft text-xs font-semibold">
                    ({SUB_PART_LABELS[index] ?? String(index + 1)}) Part {index + 1}
                  </span>
                  <button
                    type="button"
                    className="text-text-soft hover:text-marker-700 min-h-11 text-xs"
                    onClick={() => {
                      editor.removeSubPart(index);
                    }}
                  >
                    Remove
                  </button>
                </div>

                <Field label="Type">
                  {({ id }) => (
                    <select
                      id={id}
                      className={inputClass}
                      value={part.type}
                      onChange={(event) => {
                        editor.patchSubPart(index, {
                          type: event.target.value as typeof part.type,
                        });
                      }}
                    >
                      {TYPE_OPTIONS.filter((type) => type !== "CASE_BASED").map((type) => (
                        <option key={type} value={type}>
                          {QUESTION_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>

                <Field label="Question" error={fieldErrors[`subParts.${String(index)}.body`]}>
                  {({ id, describedBy }) => (
                    <textarea
                      id={id}
                      aria-describedby={describedBy}
                      rows={2}
                      className={inputClass}
                      value={part.body}
                      onChange={(event) => {
                        editor.patchSubPart(index, { body: event.target.value });
                      }}
                    />
                  )}
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Marks">
                    {({ id }) => (
                      <input
                        id={id}
                        type="number"
                        min={1}
                        className={inputClass}
                        value={part.marks}
                        onChange={(event) => {
                          editor.patchSubPart(index, { marks: Number(event.target.value) });
                        }}
                      />
                    )}
                  </Field>

                  <Field
                    label="Solution"
                    error={fieldErrors[`subParts.${String(index)}.answer.solution`]}
                  >
                    {({ id, describedBy }) => (
                      <textarea
                        id={id}
                        aria-describedby={describedBy}
                        rows={2}
                        className={inputClass}
                        value={part.answer?.solution ?? ""}
                        onChange={(event) => {
                          editor.patchSubPart(index, {
                            answer: {
                              correctValue: part.answer?.correctValue ?? null,
                              acceptedValues: part.answer?.acceptedValues ?? [],
                              tolerance: part.answer?.tolerance ?? null,
                              unit: part.answer?.unit ?? null,
                              explanation: part.answer?.explanation ?? null,
                              markingScheme: part.answer?.markingScheme ?? null,
                              solution: event.target.value,
                            },
                          });
                        }}
                      />
                    )}
                  </Field>
                </div>
              </div>
            ))}

            <button
              type="button"
              className="border-line-strong min-h-11 rounded-lg border px-4 text-sm"
              onClick={editor.addSubPart}
            >
              Add a sub-part
            </button>

            {fieldErrors["subParts"] || fieldErrors["marks"] ? (
              <p role="alert" className="text-marker-700 text-xs">
                {fieldErrors["subParts"] ?? fieldErrors["marks"]}
              </p>
            ) : null}
          </Fieldset>
        ) : (
          <Fieldset legend="The answer">
            {rule.correctValue !== "forbidden" ? (
              <Field
                label={draft.type === "TRUE_FALSE" ? "TRUE or FALSE" : "Correct answer"}
                hint={
                  rule.correctValue === "optional"
                    ? "Optional for a written answer — the marking scheme is what it is graded against."
                    : undefined
                }
                error={fieldErrors["answer.correctValue"]}
              >
                {({ id, describedBy }) => (
                  <input
                    id={id}
                    aria-describedby={describedBy}
                    className={inputClass}
                    value={draft.answer?.correctValue ?? ""}
                    onChange={(event) => {
                      editor.patchAnswer({
                        correctValue: event.target.value === "" ? null : event.target.value,
                      });
                    }}
                  />
                )}
              </Field>
            ) : null}

            {draft.type === "NUMERICAL" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Tolerance"
                  hint="0 for an exact match. Without one, 9.80 is marked wrong against 9.8."
                  error={fieldErrors["answer.tolerance"]}
                >
                  {({ id, describedBy }) => (
                    <input
                      id={id}
                      aria-describedby={describedBy}
                      type="number"
                      step="any"
                      min={0}
                      className={inputClass}
                      value={draft.answer?.tolerance ?? ""}
                      onChange={(event) => {
                        editor.patchAnswer({
                          tolerance: event.target.value === "" ? null : Number(event.target.value),
                        });
                      }}
                    />
                  )}
                </Field>

                <Field label="Unit" hint="Kept out of the answer so the number can be compared.">
                  {({ id, describedBy }) => (
                    <input
                      id={id}
                      aria-describedby={describedBy}
                      className={inputClass}
                      value={draft.answer?.unit ?? ""}
                      onChange={(event) => {
                        editor.patchAnswer({
                          unit: event.target.value === "" ? null : event.target.value,
                        });
                      }}
                    />
                  )}
                </Field>
              </div>
            ) : null}

            <Field
              label="Worked solution"
              hint="What the student reads after answering. This is the product, not a footnote."
              error={fieldErrors["answer.solution"]}
            >
              {({ id, describedBy }) => (
                <textarea
                  id={id}
                  aria-describedby={describedBy}
                  rows={4}
                  className={inputClass}
                  value={draft.answer?.solution ?? ""}
                  onChange={(event) => {
                    editor.patchAnswer({ solution: event.target.value });
                  }}
                />
              )}
            </Field>

            <MarkingSchemeEditor editor={editor} error={fieldErrors["answer.markingScheme"]} />
          </Fieldset>
        )}

        <Fieldset
          legend="Where it came from"
          description="Required on every question. If you wrote it, that is “Written for Samjho”."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Source" error={fieldErrors["source.sourceType"]}>
              {({ id }) => (
                <select
                  id={id}
                  className={inputClass}
                  value={draft.source.sourceType}
                  onChange={(event) => {
                    editor.patchSource({
                      sourceType: event.target.value as typeof draft.source.sourceType,
                    });
                  }}
                >
                  {SOURCE_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {SOURCE_LABELS[value]}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field label="Year" error={fieldErrors["source.year"]}>
              {({ id, describedBy }) => (
                <input
                  id={id}
                  aria-describedby={describedBy}
                  type="number"
                  min={1990}
                  max={2100}
                  className={inputClass}
                  value={draft.source.year ?? ""}
                  onChange={(event) => {
                    editor.patchSource({
                      year: event.target.value === "" ? null : Number(event.target.value),
                    });
                  }}
                />
              )}
            </Field>
          </div>

          {draft.source.sourceType !== "ORIGINAL" ? (
            <Field
              label="Attribution shown to students"
              hint="For example: Adapted from CBSE 2024, Set 1, Q19."
              error={fieldErrors["source.attributionText"]}
            >
              {({ id, describedBy }) => (
                <input
                  id={id}
                  aria-describedby={describedBy}
                  className={inputClass}
                  value={draft.source.attributionText ?? ""}
                  onChange={(event) => {
                    editor.patchSource({
                      attributionText: event.target.value === "" ? null : event.target.value,
                    });
                  }}
                />
              )}
            </Field>
          ) : null}

          <Field
            label="Licensing"
            hint="A question whose licensing nobody has decided cannot be published."
          >
            {({ id, describedBy }) => (
              <select
                id={id}
                aria-describedby={describedBy}
                className={inputClass}
                value={draft.source.licenceStatus}
                onChange={(event) => {
                  editor.patchSource({
                    licenceStatus: event.target.value as typeof draft.source.licenceStatus,
                  });
                }}
              >
                {LICENCE_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {LICENCE_LABELS[value]}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </Fieldset>

        {editor.failure ? (
          <div role="alert" className="border-marker-500 space-y-1 rounded-xl border p-4 text-sm">
            <p className="text-text">{editor.failure.message}</p>
            {editor.failure.requestId ? (
              <p className="text-text-soft text-xs">
                Reference: <code>{editor.failure.requestId}</code>
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={editor.saving}
            className="bg-brand-500 min-h-11 rounded-lg px-5 text-sm font-medium text-white disabled:opacity-60"
          >
            {editor.saving ? "Saving…" : question ? "Save changes" : "Save draft"}
          </button>

          {question ? null : (
            <button
              type="button"
              disabled={editor.saving}
              onClick={() => {
                void editor.submit("saved-and-next");
              }}
              className="border-line-strong min-h-11 rounded-lg border px-5 text-sm disabled:opacity-60"
            >
              Save and add another
            </button>
          )}

          {editor.savedAt ? (
            <span aria-live="polite" className="text-text-soft text-xs">
              Saved {editor.savedAt.toLocaleTimeString()}
            </span>
          ) : null}

          {!editor.isValid ? (
            <span className="text-text-soft text-xs">
              Not complete yet — the fields above say what is missing.
            </span>
          ) : null}
        </div>
      </form>

      <aside className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-text text-sm font-semibold">Preview, as a student sees it</h2>
          <button
            type="button"
            className="text-text-soft min-h-11 text-xs"
            onClick={() => {
              setShowPreview((value) => !value);
            }}
          >
            {showPreview ? "Hide" : "Show"}
          </button>
        </div>

        {showPreview ? (
          <QuestionPreview
            draft={draft}
            chapter={chapter ?? null}
            topicNames={topics
              .filter((topic) => draft.topicIds.includes(topic.id))
              .map((topic) => topic.name)}
          />
        ) : null}
      </aside>
    </div>
  );
}

/**
 * The marking scheme, which is the grading instrument for anything subjective.
 *
 * Edited as a list of `marks: step` lines rather than a repeating field group,
 * because a marking scheme is transcribed from a printed CBSE scheme that
 * already looks like this — and typing four lines is faster than clicking "add
 * step" four times. The running total is shown because the schema requires it to
 * match the question's marks, and finding that out on save is one round trip too
 * many.
 */
function MarkingSchemeEditor({
  editor,
  error,
}: {
  editor: ReturnType<typeof useQuestionEditor>;
  error: string | undefined;
}) {
  const scheme = editor.draft.answer?.markingScheme ?? [];
  const total = scheme.reduce((sum, step) => sum + step.marks, 0);

  const text = scheme.map((step) => `${String(step.marks)}: ${step.step}`).join("\n");

  return (
    <Field
      label="Marking scheme"
      hint={
        <>
          One step per line, as <code>marks: what earns them</code>. Required from 3 marks up.
          {scheme.length > 0 ? ` Currently totals ${String(total)}.` : ""}
        </>
      }
      error={error}
    >
      {({ id, describedBy }) => (
        <textarea
          id={id}
          aria-describedby={describedBy}
          rows={4}
          className={inputClass}
          defaultValue={text}
          placeholder={"1: Correct formula stated\n2: Substitution and final answer"}
          onBlur={(event) => {
            editor.patchAnswer({ markingScheme: parseMarkingScheme(event.target.value) });
          }}
        />
      )}
    </Field>
  );
}

/**
 * Parse the `marks: step` shorthand.
 *
 * Lines that do not match are kept as a zero-mark step rather than dropped. A
 * silently discarded line is the worst possible outcome here — the editor sees
 * their text vanish and cannot tell whether it saved — whereas a step worth zero
 * marks makes the total wrong, which the validator then explains in words.
 */
function parseMarkingScheme(
  value: string,
): NonNullable<NonNullable<WriteQuestionInput["answer"]>["markingScheme"]> | null {
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  return lines.map((line) => {
    const match = /^(?<marks>\d+(?:\.\d+)?)\s*[:.-]\s*(?<step>.+)$/.exec(line);

    return {
      marks: Number(match?.groups?.["marks"] ?? 0),
      step: match?.groups?.["step"] ?? line,
      keyPoints: [],
    };
  });
}
