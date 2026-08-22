/**
 * @samjho/ui
 *
 * Genuinely reusable, app-agnostic pieces: design primitives and the question
 * renderer. Anything that knows about routing or app state stays in
 * `apps/web/src/components` and graduates here only once a second consumer
 * actually exists — premature extraction into a shared package is the classic
 * monorepo mistake (docs/02 §2).
 *
 * Consumers must import `@samjho/ui/styles.css` once, and KaTeX's stylesheet
 * alongside it. Neither is imported from a component: a `.css` import inside a
 * package compiled by `tsc` is not something `tsc` can emit.
 */

export { MathText, type MathTextProps } from "./primitives/math-text.js";
export { DataState, type DataStateProps } from "./primitives/data-state.js";
export { Skeleton, type SkeletonProps } from "./primitives/skeleton.js";
export { describeError, type DisplayError } from "./primitives/display-error.js";

export {
  QuestionRenderer,
  EMPTY_RESPONSE,
  type QuestionRendererProps,
  type QuestionResponse,
} from "./question/question-renderer.js";

export { toPreviewQuestion, type QuestionPreviewContext } from "./question/preview.js";

export {
  QUESTION_TYPE_LABELS,
  DIFFICULTY_LABELS,
  RESPONSE_SHAPE,
  responseShapeFor,
  formatMarks,
  shortAnswerHint,
  type ResponseShape,
} from "./question/question-meta.js";
