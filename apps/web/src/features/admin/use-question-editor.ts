"use client";

import {
  adminQuestionSchema,
  defaultExpectedTimeSeconds,
  QUESTION_TYPE_RULES,
  writeQuestionInputSchema,
  type AdminQuestion,
  type QuestionType,
  type WriteQuestionInput,
} from "@samjho/contracts";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { sendJson, type ApiFailure } from "@/lib/client-api";

/**
 * The question editor's brain.
 *
 * Everything here is deliberately outside the component (`docs/01` §15: no
 * business logic in UI components). The reason is not tidiness — it is that the
 * form has to answer questions the form does not own: what fields does a
 * `NUMERICAL` question need, does this draft validate, what does the student
 * version of it look like. All three answers come from `packages/contracts`, and
 * a component that reached for them directly would end up re-deriving them a
 * second time in the preview and a third time in bulk import.
 *
 * ## The draft is the wire format, not a parallel form model
 *
 * `draft` is a `WriteQuestionInput` from the first keystroke. No mapping layer,
 * no `FormValues` type that shadows it. That means the preview, the validation
 * and the request body are all the same object, and there is no translation step
 * that can be wrong in one direction only.
 *
 * The cost is that a half-typed field is briefly invalid — `marks: 0` while
 * someone clears the box. That is fine, because validation runs on demand rather
 * than on every keystroke: an editor entering their four-hundredth question does
 * not want to be told what is missing from a question they are two seconds into
 * writing.
 *
 * ## Why the type field resets the shape
 *
 * Switching MCQ → NUMERICAL clears options and, going the other way, seeds four
 * blank ones. Left alone, a question would carry the debris of a type it no
 * longer is, and the validator would reject it for a field the form has stopped
 * showing — an error an editor cannot see, let alone fix.
 */

export interface QuestionEditorDefaults {
  chapterId: string;
  topicIds: string[];
}

export type SubmitOutcome = "saved" | "saved-and-next";

function blankOptions(count: number): WriteQuestionInput["options"] {
  return ["A", "B", "C", "D", "E", "F"]
    .slice(0, count)
    .map((label) => ({ label, body: "", isCorrect: false }));
}

function blankSubPart(): WriteQuestionInput["subParts"][number] {
  return {
    type: "VERY_SHORT_ANSWER",
    body: "",
    bodyHindi: null,
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: null,
    options: [],
    assets: [],
    answer: emptyAnswer(),
    topicIds: null,
  };
}

function emptyAnswer(): NonNullable<WriteQuestionInput["answer"]> {
  return {
    correctValue: null,
    acceptedValues: [],
    tolerance: null,
    unit: null,
    solution: "",
    explanation: null,
    markingScheme: null,
  };
}

export function emptyDraft(defaults: QuestionEditorDefaults): WriteQuestionInput {
  return {
    chapterId: defaults.chapterId,
    topicIds: defaults.topicIds,
    type: "MCQ",
    body: "",
    bodyHindi: null,
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: null,
    options: blankOptions(4),
    assets: [],
    answer: emptyAnswer(),
    subParts: [],
    source: {
      sourceType: "ORIGINAL",
      year: null,
      examSession: null,
      paperCode: null,
      setNumber: null,
      originalQuestionNumber: null,
      sourceUrl: null,
      // Deliberately not pre-set to CLEARED. It is the value that blocks
      // publication, and defaulting it to "fine" would quietly undo the whole
      // point of the gate (docs/07 R2).
      licenceStatus: "NEEDS_REVIEW",
      attributionText: null,
      reviewNotes: null,
    },
  };
}

/** Turn a saved question back into the shape the form edits. */
export function draftFromQuestion(question: AdminQuestion): WriteQuestionInput {
  return {
    chapterId: question.chapter.id,
    // Primary first, because position *is* how the contract encodes primacy.
    topicIds: [...question.topics]
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
      .map((topic) => topic.id),
    type: question.type,
    body: question.body,
    bodyHindi: question.bodyHindi,
    marks: question.marks,
    difficulty: question.difficulty,
    bloomLevel: question.bloomLevel,
    expectedTimeSeconds: question.expectedTimeSeconds,
    options: question.options.map((option) => ({
      label: option.label,
      body: option.body,
      isCorrect: option.isCorrect,
    })),
    assets: question.assets.map((asset) => ({
      kind: asset.kind,
      url: asset.url,
      altText: asset.altText,
      caption: asset.caption,
    })),
    answer: question.answer ? { ...question.answer } : null,
    subParts: question.subParts.map((part) => ({
      type: part.type,
      body: part.body,
      bodyHindi: part.bodyHindi,
      marks: part.marks,
      difficulty: part.difficulty,
      bloomLevel: part.bloomLevel,
      expectedTimeSeconds: part.expectedTimeSeconds,
      options: part.options.map((option) => ({
        label: option.label,
        body: option.body,
        isCorrect: option.isCorrect,
      })),
      assets: part.assets.map((asset) => ({
        kind: asset.kind,
        url: asset.url,
        altText: asset.altText,
        caption: asset.caption,
      })),
      answer: part.answer ? { ...part.answer } : null,
      topicIds: part.topics.length > 0 ? part.topics.map((topic) => topic.id) : null,
    })),
    source: question.source
      ? { ...question.source, reviewNotes: question.source.reviewNotes }
      : emptyDraft({ chapterId: question.chapter.id, topicIds: [] }).source,
  };
}

interface UseQuestionEditorOptions {
  /** Absent when creating. */
  questionId?: string;
  initial: WriteQuestionInput;
}

export function useQuestionEditor({ questionId, initial }: UseQuestionEditorOptions) {
  const router = useRouter();
  const [draft, setDraft] = useState<WriteQuestionInput>(initial);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const rule = QUESTION_TYPE_RULES[draft.type];

  const patch = useCallback((changes: Partial<WriteQuestionInput>) => {
    setDraft((current) => ({ ...current, ...changes }));
  }, []);

  /**
   * Changing the type rewrites the parts of the draft that only that type has.
   *
   * The alternative — keep everything and let the validator complain — produces
   * an error message about `options` on a form that no longer renders an options
   * editor, which is an error nobody can act on.
   */
  const changeType = useCallback((type: QuestionType) => {
    setDraft((current) => {
      const next = QUESTION_TYPE_RULES[type];

      return {
        ...current,
        type,
        options: next.options === "required" ? blankOptions(next.optionCount?.min ?? 4) : [],
        subParts:
          next.subParts === "required"
            ? current.subParts.length > 0
              ? current.subParts
              : [blankSubPart(), blankSubPart()]
            : [],
        answer: next.subParts === "required" ? null : (current.answer ?? emptyAnswer()),
      };
    });
  }, []);

  const patchAnswer = useCallback((changes: Partial<NonNullable<WriteQuestionInput["answer"]>>) => {
    setDraft((current) => ({
      ...current,
      answer: { ...(current.answer ?? emptyAnswer()), ...changes },
    }));
  }, []);

  const patchOption = useCallback(
    (index: number, changes: Partial<WriteQuestionInput["options"][number]>) => {
      setDraft((current) => ({
        ...current,
        options: current.options.map((option, i) =>
          i === index ? { ...option, ...changes } : option,
        ),
      }));
    },
    [],
  );

  /** Exactly one correct option, enforced by construction rather than by check. */
  const markCorrect = useCallback((index: number) => {
    setDraft((current) => ({
      ...current,
      options: current.options.map((option, i) => ({ ...option, isCorrect: i === index })),
    }));
  }, []);

  const patchSubPart = useCallback(
    (index: number, changes: Partial<WriteQuestionInput["subParts"][number]>) => {
      setDraft((current) => ({
        ...current,
        subParts: current.subParts.map((part, i) => (i === index ? { ...part, ...changes } : part)),
      }));
    },
    [],
  );

  const addSubPart = useCallback(() => {
    setDraft((current) => ({ ...current, subParts: [...current.subParts, blankSubPart()] }));
  }, []);

  const removeSubPart = useCallback((index: number) => {
    setDraft((current) => ({
      ...current,
      subParts: current.subParts.filter((_, i) => i !== index),
    }));
  }, []);

  const patchSource = useCallback((changes: Partial<WriteQuestionInput["source"]>) => {
    setDraft((current) => ({ ...current, source: { ...current.source, ...changes } }));
  }, []);

  /**
   * Local validation, run on demand.
   *
   * Not a substitute for the API's — the same schema runs there, on input the
   * browser never touched. What it buys is the round trip: an editor who forgot
   * to tick a correct option finds out instantly instead of after a save.
   */
  const validation = useMemo(() => writeQuestionInputSchema.safeParse(draft), [draft]);

  const fieldErrors = useMemo(() => {
    if (validation.success) return {};

    const errors: Record<string, string> = {};
    for (const issue of validation.error.issues) {
      const path = issue.path.join(".");
      errors[path] ??= issue.message;
    }
    return errors;
  }, [validation]);

  /** The sum a case study's container has to match, shown while it does not. */
  const subPartTotal = draft.subParts.reduce((sum, part) => sum + part.marks, 0);

  const submit = useCallback(
    async (outcome: SubmitOutcome): Promise<void> => {
      setSaving(true);
      setFailure(null);

      const result = questionId
        ? await sendJson("PUT", `/api/v1/admin/questions/${questionId}`, draft, adminQuestionSchema)
        : await sendJson("POST", "/api/v1/admin/questions", draft, adminQuestionSchema);

      setSaving(false);

      if (!result.ok) {
        setFailure(result.failure);
        return;
      }

      setSavedAt(new Date());

      if (outcome === "saved-and-next") {
        /*
         * The single biggest lever on entry speed, and the reason it is here
         * rather than in the component: after saving, keep the chapter, the
         * topics, the type and the provenance, and clear only the question.
         *
         * Someone entering a paper works down it — same chapter, same source,
         * same type for a run of ten. Re-picking all four each time is most of
         * the ninety seconds the phase gate allows for the whole question.
         */
        setDraft((current) => ({
          ...emptyDraft({ chapterId: current.chapterId, topicIds: current.topicIds }),
          type: current.type,
          marks: current.marks,
          difficulty: current.difficulty,
          options:
            QUESTION_TYPE_RULES[current.type].options === "required"
              ? blankOptions(current.options.length || 4)
              : [],
          subParts: [],
          source: { ...current.source },
        }));
        return;
      }

      // Straight to the saved question, so the status controls and the revision
      // log are there without a second navigation.
      router.push(`/admin/questions/${result.data.id}`);
      router.refresh();
    },
    [draft, questionId, router],
  );

  return {
    draft,
    rule,
    saving,
    failure,
    savedAt,
    fieldErrors,
    isValid: validation.success,
    subPartTotal,
    expectedTimeHint: defaultExpectedTimeSeconds(draft.marks),
    patch,
    patchAnswer,
    patchOption,
    patchSource,
    patchSubPart,
    markCorrect,
    changeType,
    addSubPart,
    removeSubPart,
    submit,
  };
}
