"use client";

import {
  EMPTY_ANSWER,
  type QuestionAsset,
  type StudentAnswer,
  type StudentQuestion,
  type StudentSubPart,
} from "@samjho/contracts";
import { useId } from "react";

import { MathText } from "../primitives/math-text.js";
import {
  DIFFICULTY_LABELS,
  QUESTION_TYPE_LABELS,
  formatMarks,
  responseShapeFor,
  shortAnswerHint,
} from "./question-meta.js";

/**
 * Renders any of the ten question types.
 *
 * ## Why this is one component and not ten pages' worth of ad-hoc JSX
 *
 * Four different surfaces show a question: practice, the exam runner, mistake
 * review, and the admin preview that lets an editor see what they just wrote
 * (`docs/07`, Phase 3). Written per-surface, they drift — and the drift is
 * invisible until a student meets a question that renders one way in practice
 * and another way in the exam, on the day it counts.
 *
 * So it is built once, before any of those surfaces exist, and each of them
 * passes props rather than laying out its own.
 *
 * ## The controlled-value API
 *
 * `value` / `onChange` are here in Phase 3 even though nothing writes an answer
 * until Phase 5. Rendering and answering are not separable concerns: an option
 * row *is* a radio button, and building a display-only version first would mean
 * rewriting all ten type branches when inputs arrive — the exact duplication
 * this component exists to prevent.
 *
 * Omit `onChange` and every control renders disabled, which is the admin
 * preview and the browse page.
 *
 * ## Sub-parts
 *
 * A case study renders its stimulus and then its sub-parts, each with its own
 * response. It has no response of its own — the container carries the marks
 * label but is never answered, which mirrors the database exactly (no
 * `QuestionAnswer` row, and a CHECK constraint capping depth at one).
 */

/**
 * A student's in-progress answer.
 *
 * Phase 3 defined this shape locally with a note saying it belonged in
 * `packages/contracts` once something actually graded an answer. Phase 5 wrote
 * the grader, so it moved: this is now an alias for `StudentAnswer`, and the
 * reasoning for one shape rather than a discriminated union lives beside the
 * schema in `practice/answer.schema.ts`.
 *
 * Kept as an exported name because four surfaces already spell it this way, and
 * because "the thing this component is controlled by" is a genuinely different
 * concept from "the thing the API stores" even when they are the same type.
 */
export type QuestionResponse = StudentAnswer;

export const EMPTY_RESPONSE: QuestionResponse = EMPTY_ANSWER;

export interface QuestionRendererProps {
  question: StudentQuestion;
  /** Response for the question itself. Ignored for containers. */
  value?: QuestionResponse;
  /** Responses for a case study's sub-parts, keyed by sub-part id. */
  subPartValues?: Record<string, QuestionResponse>;
  onChange?: (questionId: string, value: QuestionResponse) => void;
  /** Question number as printed on a paper — "12", "31 (a)". */
  displayNumber?: string;
  /** Hide the type/difficulty chips where the surrounding UI already says it. */
  hideMeta?: boolean;
  /**
   * Which options were right, keyed by target id — the question's own id, or a
   * sub-part's.
   *
   * Absent by default, and that is the important half. A StudentQuestion has no
   * answer property, so the renderer cannot mark anything on its own; a surface
   * that legitimately holds the key — the practice runner, which has the graded
   * attempt back from the API — passes one in. The compile-time guarantee that a
   * student is never *sent* an answer key is untouched. Only a caller that
   * already has one can produce marked options.
   */
  marking?: Record<string, readonly string[]>;
  className?: string;
}

export function QuestionRenderer({
  question,
  value,
  subPartValues,
  onChange,
  displayNumber,
  hideMeta = false,
  marking,
  className,
}: QuestionRendererProps) {
  const readOnly = onChange === undefined;

  return (
    <article
      className={["samjho-question", className].filter(Boolean).join(" ")}
      data-question-type={question.type}
      data-container={question.isContainer ? "true" : undefined}
    >
      <header className="samjho-question__header">
        {displayNumber ? <span className="samjho-question__number">{displayNumber}</span> : null}

        <span className="samjho-question__marks">{formatMarks(question.marks)}</span>

        {hideMeta ? null : (
          <>
            <span className="samjho-question__chip">{QUESTION_TYPE_LABELS[question.type]}</span>
            <span className="samjho-question__chip">{DIFFICULTY_LABELS[question.difficulty]}</span>
          </>
        )}
      </header>

      <MathText className="samjho-question__body">{question.body}</MathText>

      <AssetList assets={question.assets} />

      {/* A container's marks live entirely in its sub-parts, so it gets no
          response area of its own — only the stimulus above. */}
      {question.isContainer ? null : (
        <ResponseArea
          question={question}
          value={value ?? EMPTY_RESPONSE}
          readOnly={readOnly}
          onChange={onChange}
          correctOptionIds={marking?.[question.id]}
        />
      )}

      {question.subParts.length > 0 ? (
        <ol className="samjho-question__subparts">
          {question.subParts.map((subPart) => (
            <li key={subPart.id} className="samjho-question__subpart">
              <SubPartRenderer
                subPart={subPart}
                value={subPartValues?.[subPart.id] ?? EMPTY_RESPONSE}
                readOnly={readOnly}
                onChange={onChange}
                correctOptionIds={marking?.[subPart.id]}
              />
            </li>
          ))}
        </ol>
      ) : null}

      {question.provenance ? <Provenance provenance={question.provenance} /> : null}
    </article>
  );
}

function SubPartRenderer({
  subPart,
  value,
  readOnly,
  onChange,
  correctOptionIds,
}: {
  subPart: StudentSubPart;
  value: QuestionResponse;
  readOnly: boolean;
  correctOptionIds: readonly string[] | undefined;
  // Explicitly `| undefined` rather than `?`. Under `exactOptionalPropertyTypes`
  // those are different types, and only this form accepts a value that may be
  // undefined being forwarded from the caller.
  onChange: ((questionId: string, value: QuestionResponse) => void) | undefined;
}) {
  return (
    <div className="samjho-subpart" data-question-type={subPart.type}>
      <header className="samjho-subpart__header">
        <span className="samjho-question__marks">{formatMarks(subPart.marks)}</span>
      </header>

      <MathText className="samjho-question__body">{subPart.body}</MathText>
      <AssetList assets={subPart.assets} />

      <ResponseArea
        question={subPart}
        value={value}
        readOnly={readOnly}
        onChange={onChange}
        correctOptionIds={correctOptionIds}
      />
    </div>
  );
}

// ── Response areas ───────────────────────────────────────────────────────────

/** The narrow slice of a question the response controls actually need. */
type Respondable = Pick<StudentSubPart, "id" | "type" | "options">;

function ResponseArea({
  question,
  value,
  readOnly,
  onChange,
  correctOptionIds,
}: {
  question: Respondable;
  value: QuestionResponse;
  readOnly: boolean;
  correctOptionIds: readonly string[] | undefined;
  // Explicitly `| undefined` rather than `?`. Under `exactOptionalPropertyTypes`
  // those are different types, and only this form accepts a value that may be
  // undefined being forwarded from the caller.
  onChange: ((questionId: string, value: QuestionResponse) => void) | undefined;
}) {
  const shape = responseShapeFor(question.type);

  if (shape === "NONE") return null;

  const emit = (next: QuestionResponse) => {
    onChange?.(question.id, next);
  };

  if (shape === "CHOICE") {
    return (
      <OptionList
        question={question}
        value={value}
        readOnly={readOnly}
        onSelect={emit}
        correctOptionIds={correctOptionIds}
      />
    );
  }

  if (shape === "BOOLEAN") {
    return <TrueFalse value={value} readOnly={readOnly} onSelect={emit} />;
  }

  return (
    <TextResponse
      question={question}
      value={value}
      readOnly={readOnly}
      extended={shape === "EXTENDED"}
      onInput={emit}
    />
  );
}

/**
 * MCQ and assertion–reason.
 *
 * Same control for both: an assertion–reason question is an MCQ whose four
 * options happen to always be the same four statements. Giving it its own
 * component would duplicate the radio-group semantics for no gain — the
 * difference is entirely in the authored text, which `MathText` already handles.
 */
function OptionList({
  question,
  value,
  readOnly,
  onSelect,
  correctOptionIds,
}: {
  question: Respondable;
  value: QuestionResponse;
  readOnly: boolean;
  onSelect: (next: QuestionResponse) => void;
  correctOptionIds: readonly string[] | undefined;
}) {
  const groupName = useId();

  if (question.options.length === 0) {
    // Authored wrong: a choice question with nothing to choose. Say so rather
    // than rendering an empty box a student would stare at.
    return (
      <p className="samjho-question__warning" role="alert">
        This question is missing its options.
      </p>
    );
  }

  return (
    <fieldset className="samjho-options" disabled={readOnly}>
      <legend className="samjho-visually-hidden">Choose one answer</legend>

      {question.options.map((option) => {
        const selected = value.optionIds.includes(option.id);

        /*
         * Only two options are ever marked: the right one, and the one the
         * student chose if it was not. Colouring all four turns a question into
         * an answer key — the other wrong options stay silent, because "not the
         * answer" is not something the student got wrong.
         */
        const verdict = correctOptionIds?.includes(option.id)
          ? "correct"
          : correctOptionIds !== undefined && selected
            ? "incorrect"
            : undefined;

        return (
          <label
            key={option.id}
            className="samjho-option"
            data-selected={selected || undefined}
            data-verdict={verdict}
          >
            <input
              type="radio"
              name={groupName}
              value={option.id}
              checked={selected}
              onChange={() => {
                onSelect({ optionIds: [option.id], text: "" });
              }}
            />
            <span className="samjho-option__label" aria-hidden="true">
              {option.label}
            </span>
            {/* Inline so the option text does not become its own paragraph
                block beside the radio button. */}
            <MathText inline className="samjho-option__body">
              {option.body}
            </MathText>

            {/* Shape and a word, not only a colour. docs/01 §9 requires the
                answer states to survive colour-vision deficiency, and this is
                the row where being wrong about that matters most. */}
            {verdict ? (
              <>
                <span className="samjho-visually-hidden">
                  {verdict === "correct" ? " — correct answer" : " — your answer, not right"}
                </span>
                <span className="samjho-option__verdict" aria-hidden="true">
                  {verdict === "correct" ? <TickGlyph /> : <CrossGlyph />}
                </span>
              </>
            ) : null}
          </label>
        );
      })}
    </fieldset>
  );
}

/**
 * True/false.
 *
 * No `QuestionOption` rows exist for this type — the seeded answer key is the
 * literal string "TRUE" or "FALSE" — so the two choices are synthesised here and
 * stored in `text`, matching what the grader will compare against.
 */
function TrueFalse({
  value,
  readOnly,
  onSelect,
}: {
  value: QuestionResponse;
  readOnly: boolean;
  onSelect: (next: QuestionResponse) => void;
}) {
  const groupName = useId();

  return (
    <fieldset className="samjho-options samjho-options--boolean" disabled={readOnly}>
      <legend className="samjho-visually-hidden">Choose true or false</legend>

      {(["TRUE", "FALSE"] as const).map((choice) => (
        <label
          key={choice}
          className="samjho-option"
          data-selected={value.text === choice || undefined}
        >
          <input
            type="radio"
            name={groupName}
            value={choice}
            checked={value.text === choice}
            onChange={() => {
              onSelect({ optionIds: [], text: choice });
            }}
          />
          <span className="samjho-option__body">{choice === "TRUE" ? "True" : "False"}</span>
        </label>
      ))}
    </fieldset>
  );
}

function TextResponse({
  question,
  value,
  readOnly,
  extended,
  onInput,
}: {
  question: Respondable;
  value: QuestionResponse;
  readOnly: boolean;
  extended: boolean;
  onInput: (next: QuestionResponse) => void;
}) {
  const inputId = useId();
  const hint = shortAnswerHint(question.type, null);

  return (
    <div className="samjho-response">
      <label htmlFor={inputId} className="samjho-visually-hidden">
        {extended ? "Your working and answer" : "Your answer"}
      </label>

      {extended ? (
        <textarea
          id={inputId}
          className="samjho-response__input samjho-response__input--extended"
          rows={6}
          disabled={readOnly}
          value={value.text}
          placeholder="Show your working"
          onChange={(event) => {
            onInput({ optionIds: [], text: event.target.value });
          }}
        />
      ) : (
        <input
          id={inputId}
          type="text"
          className="samjho-response__input"
          disabled={readOnly}
          value={value.text}
          placeholder={hint}
          onChange={(event) => {
            onInput({ optionIds: [], text: event.target.value });
          }}
        />
      )}
    </div>
  );
}

// ── Supporting pieces ────────────────────────────────────────────────────────

function AssetList({ assets }: { assets: QuestionAsset[] }) {
  if (assets.length === 0) return null;

  return (
    <div className="samjho-question__assets">
      {assets.map((asset) => (
        <figure key={asset.id} className="samjho-asset">
          {/*
            A plain <img>, not next/image. This package must not depend on a
            framework — the exam runner is the obvious consumer today, but the
            same renderer is meant to survive a move to a mobile app or a
            different host. `loading="lazy"` is the part that actually matters
            on a mid-range Android phone over patchy data.
          */}
          <img src={asset.url} alt={asset.altText} loading="lazy" decoding="async" />
          {asset.caption ? <figcaption>{asset.caption}</figcaption> : null}
        </figure>
      ))}
    </div>
  );
}

function Provenance({ provenance }: { provenance: NonNullable<StudentQuestion["provenance"]> }) {
  // Attribution is shown, not hidden in a tooltip. Under the adapted-and-
  // attributed sourcing position (docs/07 Q6, R2), visible attribution is the
  // obligation being discharged — one that is only discharged if it is legible.
  const label =
    provenance.attributionText ??
    [provenance.examSession ?? provenance.year?.toString(), provenance.setNumber]
      .filter(Boolean)
      .join(" · ");

  if (!label) return null;

  return <p className="samjho-question__provenance">{label}</p>;
}

/**
 * The tick and the cross.
 *
 * Drawn here rather than imported, because `@samjho/ui` deliberately has no
 * icon set and two paths is not a reason to start one. They are the same two
 * shapes the app draws elsewhere, at the same stroke weight.
 */
function TickGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
    </svg>
  );
}

function CrossGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 6 18 18" />
      <path d="M18 6 6 18" />
    </svg>
  );
}
