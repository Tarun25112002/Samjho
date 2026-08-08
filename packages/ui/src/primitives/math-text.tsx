import Markdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { Components } from "react-markdown";

/**
 * Renders question content: Markdown with LaTeX.
 *
 * ## Why not `dangerouslySetInnerHTML`
 *
 * `schema.prisma` says it outright on `Question.body`, and the reason gets more
 * important with every phase. Question text is author-supplied, and by Phase 4
 * the authors are content contractors with an admin login rather than us. The
 * moment a `<script>` in a question body becomes a `<script>` in another
 * student's browser, one compromised editor account becomes an account takeover
 * for everyone who opens that chapter.
 *
 * `react-markdown` never produces raw HTML — it parses to an AST and builds
 * React elements. Raw HTML in the source is escaped, not executed. There is no
 * `rehype-raw` here and there must not be.
 *
 * ## Why these three plugins and no others
 *
 * - `remark-math` + `rehype-katex`: `$…$` and `$$…$$`. Roughly a third of the
 *   seeded Maths questions are unreadable without it.
 * - `remark-gfm`: tables. Match-the-following is *authored* as a two-column
 *   table (Column I / Column II), so GFM is not a nicety here — one of the ten
 *   question types does not exist without it.
 *
 * ## Two things this component does not do
 *
 * It does not import KaTeX's stylesheet. A `.css` import inside a package
 * compiled by `tsc` is not something `tsc` can emit, and a component that
 * silently pulls in 25KB of CSS is a component that fights the app's own
 * bundling. The app imports it once — see `@samjho/ui/styles.css`.
 *
 * It does not memoise. `react-markdown` re-parses on every render, which sounds
 * wasteful until you count: a question body is a few hundred characters, and the
 * exam runner shows one at a time. Memoising here would be optimising the wrong
 * thing before measuring anything.
 */

export interface MathTextProps {
  /** Markdown source. Rendered as a block; use `inline` for a single line. */
  children: string;
  /**
   * Render without a wrapping paragraph — for option labels and table cells,
   * where a `<p>` would break the layout it sits in.
   */
  inline?: boolean;
  className?: string;
}

/**
 * Element overrides.
 *
 * Tables get a horizontal scroll container. A four-row match-the-following table
 * with LaTeX in both columns is genuinely wider than a phone, and the audience
 * is phone-first (docs/07 Q10) — without this the *page* scrolls sideways, which
 * breaks every other question on the screen too.
 */
const blockComponents: Components = {
  table: ({ children, ...props }) => (
    <div className="samjho-prose-table-wrap">
      <table {...props}>{children}</table>
    </div>
  ),
  // Anything a question links to is outside our control.
  a: ({ children, ...props }) => (
    <a {...props} target="_blank" rel="noopener noreferrer nofollow">
      {children}
    </a>
  ),
};

/** Inline mode: unwrap the paragraph react-markdown wraps a single line in. */
const inlineComponents: Components = {
  ...blockComponents,
  p: ({ children }) => <>{children}</>,
};

/**
 * Promote single-line `$$…$$` to a fenced display block.
 *
 * remark-math only treats maths as *display* when the `$$` fences sit on their
 * own lines. Written on one line — which is what almost everyone writes, and
 * what the Phase 1 seed writes for its balanced chemical equation — it comes out
 * as inline maths: correct symbols, but crammed into the sentence instead of
 * centred on its own line. A long equation then also loses the `.katex-display`
 * scroll container, so on a phone it pushes the page sideways.
 *
 * Fixing this in the renderer rather than in the content is deliberate. From
 * Phase 4 the questions are written by content contractors, and "put the `$$` on
 * separate lines" is a rule that will be broken thousands of times. Accepting
 * both spellings costs one regex; enforcing one spelling costs a review comment
 * on every batch, forever.
 *
 * The pattern requires the delimiters to span a *whole* line, so `$$` appearing
 * mid-sentence is left alone as inline maths.
 */
function promoteDisplayMath(source: string): string {
  return source.replace(/^[ \t]*\$\$(?!\s*$)([^\n]+?)\$\$[ \t]*$/gm, (_match, body: string) =>
    ["$$", body.trim(), "$$"].join("\n"),
  );
}

export function MathText({ children, inline = false, className }: MathTextProps) {
  const Tag = inline ? "span" : "div";
  // Inline contexts (option text, table cells) have no room for a display
  // block, so the promotion is skipped there.
  const source = inline ? children : promoteDisplayMath(children);

  return (
    <Tag className={["samjho-prose", className].filter(Boolean).join(" ")}>
      <Markdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[
          [
            rehypeKatex,
            {
              // A malformed formula in one question must not blank the page.
              // KaTeX renders the offending source in red instead, which also
              // tells whoever authored it exactly what to fix.
              throwOnError: false,
              errorColor: "var(--color-danger, #cc3333)",
              // `\text{}` inside maths is everywhere in CBSE papers, and
              // trusting the input is safe precisely because it never becomes
              // HTML — KaTeX's own `trust` option governs `\href`, which we
              // leave off.
              trust: false,
              strict: false,
            },
          ],
        ]}
        components={inline ? inlineComponents : blockComponents}
      >
        {source}
      </Markdown>
    </Tag>
  );
}
