import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MathText } from "./math-text.js";

/**
 * `MathText` renders author-supplied content, which makes it the product's
 * largest untrusted-input surface. By Phase 4 the authors are content
 * contractors with an admin login, so "we wrote all the questions ourselves" is
 * a defence with a shelf life.
 */

describe("MathText — untrusted input", () => {
  it("escapes raw HTML instead of executing it", () => {
    const { container } = render(
      <MathText>{'Consider <img src=x onerror="alert(1)"> and continue.'}</MathText>,
    );

    // The tag must appear as *text*, not as an element. If `rehype-raw` ever
    // gets added to the plugin list, this is the test that fails.
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<img src=x");
  });

  it("does not execute a script tag", () => {
    const { container } = render(<MathText>{"<script>window.pwned = true</script>"}</MathText>);

    expect(container.querySelector("script")).toBeNull();
  });

  it("renders a malformed formula rather than throwing", () => {
    // One bad formula in one question must not blank the page for every other
    // question on it. KaTeX is configured with throwOnError: false.
    expect(() => render(<MathText>{"Broken: $\\frac{1}{$"}</MathText>)).not.toThrow();
  });

  it("marks external links so a question cannot hijack the tab", () => {
    const { container } = render(<MathText>{"[NCERT](https://ncert.nic.in)"}</MathText>);
    const link = container.querySelector("a");

    expect(link).toHaveAttribute("target", "_blank");
    expect(link?.getAttribute("rel")).toContain("noopener");
  });
});

describe("MathText — content", () => {
  it("renders inline maths through KaTeX", () => {
    const { container } = render(<MathText>{"If $\\sin A = \\dfrac{3}{5}$ then:"}</MathText>);

    expect(container.querySelector(".katex")).not.toBeNull();
  });

  it("renders display maths written with the fences on their own lines", () => {
    const { container } = render(<MathText>{"$$\nx = \\frac{-b}{2a}\n$$"}</MathText>);

    expect(container.querySelector(".katex-display")).not.toBeNull();
  });

  it("renders display maths written on a single line", () => {
    // What the Phase 1 seed actually writes, and what a content contractor will
    // write. remark-math alone treats this as *inline* maths — correct symbols,
    // crammed into the sentence, and without the scroll container that keeps a
    // long equation from pushing the page sideways on a phone.
    const { container } = render(
      <MathText>{"Balance the equation:\n\n$$\\text{Fe} + \\text{H}_2\\text{O}$$"}</MathText>,
    );

    expect(container.querySelector(".katex-display")).not.toBeNull();
  });

  it("leaves mid-sentence $$ alone", () => {
    // Only a delimiter pair spanning a whole line is promoted; otherwise a
    // sentence containing $$ would be torn into three paragraphs.
    const { container } = render(<MathText>{"Given $$a$$ and $$b$$, find the sum."}</MathText>);

    expect(container.querySelector(".katex-display")).toBeNull();
    expect(container.querySelectorAll(".katex").length).toBe(2);
  });

  it("renders GFM tables, which match-the-following depends on", () => {
    // Not a nicety: one of the ten question types is authored as a two-column
    // table and does not exist without table support.
    render(
      <MathText>
        {"| Column I | Column II |\n| --- | --- |\n| (i) $\\sin 30^\\circ$ | (p) $\\dfrac{1}{2}$ |"}
      </MathText>,
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Column I" })).toBeInTheDocument();
  });

  it("wraps tables in a scroll container so a wide table cannot break the page", () => {
    const { container } = render(<MathText>{"| a | b |\n| --- | --- |\n| 1 | 2 |"}</MathText>);

    expect(container.querySelector(".samjho-prose-table-wrap table")).not.toBeNull();
  });

  it("renders bold, which assertion-reason questions use for their labels", () => {
    render(<MathText>{"**Assertion (A):** The number ends in zero."}</MathText>);
    expect(screen.getByText("Assertion (A):").tagName).toBe("STRONG");
  });

  it("drops the wrapping paragraph in inline mode", () => {
    // An option's text sits beside a radio button; a block-level <p> would push
    // it onto its own line.
    const { container } = render(<MathText inline>{"$2\\ \\Omega$"}</MathText>);

    expect(container.querySelector("p")).toBeNull();
    expect(container.querySelector("span.samjho-prose")).not.toBeNull();
  });
});
