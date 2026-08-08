import type {
  QuestionAsset,
  QuestionOption,
  StudentQuestion,
  StudentSubPart,
  SubPartInput,
  WriteQuestionInput,
} from "@samjho/contracts";

/**
 * Project a question an editor is *writing* into the shape a student would
 * *read*.
 *
 * ## Why this function is the whole preview feature
 *
 * "Preview as student" could have been built as a flag on the editor —
 * hide the answer panel, grey out the correct-option ticks, render the body a
 * bit differently. Every one of those is a thing that can be got wrong, and the
 * way it goes wrong is that an editor is shown a preview that is subtly not what
 * ships.
 *
 * Instead the draft is converted into `StudentQuestion` — the exact type the
 * student endpoint returns — and handed to the exact component the student
 * pages use. There is no preview-mode branch inside `QuestionRenderer` at all.
 * If the preview looks right, the question is right, because the same code
 * produced both.
 *
 * The answer key cannot leak into it either, and not because this function is
 * careful: `StudentQuestion` has no `answer` property and `QuestionOption` has
 * no `isCorrect`, so there is nowhere to put them. Writing the leak would be a
 * compile error, which is the same rule the API's serializer relies on.
 *
 * ## Synthetic ids
 *
 * A draft has no database ids yet, so options and sub-parts get positional ones.
 * They are stable within a render (position, not a counter), which is all React
 * keys and radio-group `name`s need — and they are never sent anywhere, because
 * the preview is a pure function of the form.
 */

export interface QuestionPreviewContext {
  /** Shown nowhere by the renderer today, but part of the shape it consumes. */
  chapter?: StudentQuestion["chapter"];
  /** Resolved names for the topic ids on the draft, when the editor has them. */
  topicNames?: string[];
}

const PLACEHOLDER_CHAPTER: StudentQuestion["chapter"] = {
  id: "preview",
  name: "Preview",
  slug: "preview",
  domain: null,
};

export function toPreviewQuestion(
  draft: WriteQuestionInput,
  context: QuestionPreviewContext = {},
): StudentQuestion {
  return {
    id: "preview",
    type: draft.type,
    body: draft.body,
    marks: draft.marks,
    difficulty: draft.difficulty,
    bloomLevel: draft.bloomLevel,
    expectedTimeSeconds: draft.expectedTimeSeconds ?? draft.marks * 60,
    // A draft is always version 1 as far as a reader is concerned; the number
    // only means something once the row exists.
    version: 1,
    options: draft.options.map(toPreviewOption),
    assets: draft.assets.map(toPreviewAsset),
    chapter: context.chapter ?? PLACEHOLDER_CHAPTER,
    topics: (context.topicNames ?? []).map((name, index) => ({
      id: `preview-topic-${String(index)}`,
      name,
      slug: `preview-topic-${String(index)}`,
      isPrimary: index === 0,
    })),
    isContainer: draft.subParts.length > 0,
    subParts: draft.subParts.map(toPreviewSubPart),
    /*
     * Provenance is shown, and deliberately so. It is the one editorial field a
     * student sees, and getting it wrong — an attribution that reads "CBSE 2024,
     * Set 1" on a question that is nothing of the sort — is a licensing problem
     * (docs/07 R2) that only a human looking at the rendered result will catch.
     * `licenceStatus` and the review notes stay out, exactly as they do on the
     * student endpoint.
     */
    provenance: {
      sourceType: draft.source.sourceType,
      year: draft.source.year,
      examSession: draft.source.examSession,
      setNumber: draft.source.setNumber,
      attributionText: draft.source.attributionText,
    },
  };
}

function toPreviewOption(
  option: WriteQuestionInput["options"][number],
  index: number,
): QuestionOption {
  return {
    id: `preview-option-${String(index)}`,
    label: option.label,
    body: option.body,
    orderIndex: index,
  };
}

function toPreviewAsset(asset: WriteQuestionInput["assets"][number], index: number): QuestionAsset {
  return {
    id: `preview-asset-${String(index)}`,
    kind: asset.kind,
    url: asset.url,
    altText: asset.altText,
    caption: asset.caption,
    orderIndex: index,
  };
}

function toPreviewSubPart(part: SubPartInput, index: number): StudentSubPart {
  return {
    id: `preview-subpart-${String(index)}`,
    type: part.type,
    body: part.body,
    marks: part.marks,
    difficulty: part.difficulty,
    bloomLevel: part.bloomLevel,
    expectedTimeSeconds: part.expectedTimeSeconds ?? part.marks * 60,
    version: 1,
    options: part.options.map(toPreviewOption),
    assets: part.assets.map(toPreviewAsset),
    subPartIndex: index,
  };
}
