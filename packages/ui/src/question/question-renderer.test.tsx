import { questionTypeSchema, type QuestionType } from "@samjho/contracts";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { makeQuestion } from "./question-fixtures.js";
import { questionOfEveryType } from "./question-fixtures.js";
import { EMPTY_RESPONSE, QuestionRenderer } from "./question-renderer.js";

/**
 * The Phase 3 gate: every question type renders correctly from seed-shaped data.
 *
 * The parameterised test below is driven by `questionTypeSchema.options` rather
 * than a hand-written list, so adding an eleventh type to the contract fails
 * here until someone gives it a fixture and decides how it renders. A list
 * copied by hand would quietly cover ten of eleven.
 */

const fixtures = questionOfEveryType();

describe("renders every question type", () => {
  it.each(questionTypeSchema.options)("%s", (type: QuestionType) => {
    const question = fixtures[type];
    const { container } = render(<QuestionRenderer question={question} />);

    expect(container.querySelector(`[data-question-type="${type}"]`)).not.toBeNull();
    // Marks are on the paper and must be on the screen — a student budgets time
    // by them.
    expect(
      screen.getAllByText(new RegExp(`${String(question.marks)} marks?`)).length,
    ).toBeGreaterThan(0);
  });

  it("covers every type in the contract", () => {
    // Guards the fixture set itself: an eleventh question type with no fixture
    // would otherwise make the parameterised test above silently thinner.
    expect(Object.keys(fixtures).sort()).toEqual([...questionTypeSchema.options].sort());
  });
});

describe("choice questions", () => {
  it("renders four radio options for an MCQ", () => {
    render(<QuestionRenderer question={fixtures.MCQ} />);

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(4);
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("reports the chosen option id", async () => {
    const onChange = vi.fn();
    const question = fixtures.MCQ;
    render(<QuestionRenderer question={question} onChange={onChange} />);

    await userEvent.click(screen.getAllByRole("radio")[1] as HTMLElement);

    expect(onChange).toHaveBeenCalledWith(question.id, {
      optionIds: [question.options[1]?.id],
      text: "",
    });
  });

  it("treats assertion–reason as a choice question", () => {
    render(<QuestionRenderer question={fixtures.ASSERTION_REASON} />);

    expect(screen.getAllByRole("radio")).toHaveLength(4);
    // The label formatting is authored in Markdown, not hard-coded.
    expect(screen.getByText("Assertion (A):")).toBeInTheDocument();
  });

  it("gives nothing away about which option is correct", () => {
    // The student type carries no `isCorrect`, so this is a compile-time
    // guarantee — but the rendered DOM is what a curious student inspects.
    const { container } = render(<QuestionRenderer question={fixtures.MCQ} />);

    expect(container.innerHTML).not.toContain("correct");
    expect(container.querySelectorAll("[data-selected]")).toHaveLength(0);
  });

  it("says so when a choice question has no options", () => {
    // Authored wrong. An empty box is indistinguishable from a loading state.
    render(<QuestionRenderer question={makeQuestion({ type: "MCQ", options: [] })} />);

    expect(screen.getByRole("alert")).toHaveTextContent(/missing its options/i);
  });
});

describe("true or false", () => {
  it("synthesises two choices, since the database stores no options", () => {
    render(<QuestionRenderer question={fixtures.TRUE_FALSE} />);

    expect(screen.getByRole("radio", { name: "True" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "False" })).toBeInTheDocument();
  });

  it("reports the literal TRUE/FALSE the grader compares against", async () => {
    const onChange = vi.fn();
    const question = fixtures.TRUE_FALSE;
    render(<QuestionRenderer question={question} onChange={onChange} />);

    await userEvent.click(screen.getByRole("radio", { name: "False" }));

    expect(onChange).toHaveBeenCalledWith(question.id, { optionIds: [], text: "FALSE" });
  });
});

describe("written answers", () => {
  it.each(["FILL_BLANK", "NUMERICAL", "VERY_SHORT_ANSWER", "MATCH_FOLLOWING"] as const)(
    "gives %s a single-line field",
    (type) => {
      render(<QuestionRenderer question={fixtures[type]} />);
      expect(screen.getByRole("textbox").tagName).toBe("INPUT");
    },
  );

  it.each(["SHORT_ANSWER", "LONG_ANSWER"] as const)("gives %s room for working", (type) => {
    render(<QuestionRenderer question={fixtures[type]} />);
    expect(screen.getByRole("textbox").tagName).toBe("TEXTAREA");
  });

  it("shows the expected format for match-the-following", () => {
    // "i-q, ii-r" is not guessable, and it is exactly what the seeded answer
    // keys are written as.
    render(<QuestionRenderer question={fixtures.MATCH_FOLLOWING} />);
    expect(screen.getByRole("textbox")).toHaveAttribute(
      "placeholder",
      expect.stringContaining("i-q"),
    );
  });

  it("renders the match-the-following table", () => {
    render(<QuestionRenderer question={fixtures.MATCH_FOLLOWING} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("reports typed text", async () => {
    const onChange = vi.fn();
    const question = fixtures.FILL_BLANK;
    render(<QuestionRenderer question={question} value={EMPTY_RESPONSE} onChange={onChange} />);

    await userEvent.type(screen.getByRole("textbox"), "o");

    expect(onChange).toHaveBeenLastCalledWith(question.id, { optionIds: [], text: "o" });
  });
});

describe("case studies", () => {
  it("renders the stimulus and every sub-part", () => {
    render(<QuestionRenderer question={fixtures.CASE_BASED} />);

    expect(screen.getByText(/The school auditorium/)).toBeInTheDocument();
    expect(screen.getByText(/common difference/)).toBeInTheDocument();
    expect(screen.getByText(/total number of seats/)).toBeInTheDocument();
  });

  it("gives the container no answer field of its own", () => {
    // The container holds the stimulus and the marks label; the marks live
    // entirely in its sub-parts, and it is never attempted directly.
    render(<QuestionRenderer question={fixtures.CASE_BASED} />);

    // Three sub-parts, three fields — not four.
    expect(screen.getAllByRole("textbox")).toHaveLength(3);
  });

  it("reports a sub-part answer against the sub-part's own id", async () => {
    const onChange = vi.fn();
    const question = fixtures.CASE_BASED;
    render(<QuestionRenderer question={question} onChange={onChange} />);

    await userEvent.type(screen.getAllByRole("textbox")[0] as HTMLElement, "2");

    // Not the container's id. Attributing a sub-part's answer to its parent
    // would make the whole case study appear answered by one part.
    expect(onChange).toHaveBeenLastCalledWith(question.subParts[0]?.id, {
      optionIds: [],
      text: "2",
    });
  });

  it("keeps sub-part responses separate", () => {
    const question = fixtures.CASE_BASED;
    const first = question.subParts[0];
    if (!first) throw new Error("fixture is missing sub-parts");

    render(
      <QuestionRenderer
        question={question}
        subPartValues={{ [first.id]: { optionIds: [], text: "answer to (i)" } }}
        onChange={vi.fn()}
      />,
    );

    const fields = screen.getAllByRole("textbox") as HTMLInputElement[];
    expect(fields[0]?.value).toBe("answer to (i)");
    expect(fields[1]?.value).toBe("");
  });

  it("shows each sub-part's own marks", () => {
    render(<QuestionRenderer question={fixtures.CASE_BASED} />);

    // 1 + 1 + 2 — the split Class 10 Maths prescribes.
    expect(screen.getAllByText("1 mark")).toHaveLength(2);
    expect(screen.getAllByText("2 marks")).toHaveLength(1);
  });
});

describe("read-only rendering", () => {
  it("disables every control when no onChange is supplied", () => {
    // This is the browse page and the admin preview: the question is shown
    // exactly as a student will see it, but nothing can be typed into it.
    render(<QuestionRenderer question={fixtures.MCQ} />);

    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toBeDisabled();
    }
  });

  it("disables written-answer fields too", () => {
    render(<QuestionRenderer question={fixtures.LONG_ANSWER} />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });
});

describe("presentation", () => {
  it("renders maths through KaTeX in the body", () => {
    const { container } = render(<QuestionRenderer question={fixtures.MCQ} />);
    expect(container.querySelector(".samjho-question__body .katex")).not.toBeNull();
  });

  it("renders maths inside option text", () => {
    const { container } = render(<QuestionRenderer question={fixtures.MCQ} />);
    expect(container.querySelector(".samjho-option .katex")).not.toBeNull();
  });

  it("renders an asset with its alt text", () => {
    const question = makeQuestion({
      assets: [
        {
          id: "a-1",
          kind: "DIAGRAM",
          url: "https://cdn.example.test/circuit.png",
          altText: "Two resistors in parallel across a cell",
          caption: "Figure 1",
          orderIndex: 0,
        },
      ],
    });

    render(<QuestionRenderer question={question} />);

    // A diagram with no alt text is a question a blind student cannot attempt,
    // which is why the column is NOT NULL all the way from the database.
    expect(screen.getByAltText("Two resistors in parallel across a cell")).toBeInTheDocument();
    expect(screen.getByText("Figure 1")).toBeInTheDocument();
  });

  it("displays attribution when a question has provenance", () => {
    const question = makeQuestion({
      provenance: {
        sourceType: "CBSE_BOARD_PAPER",
        year: 2024,
        examSession: "Feb 2024",
        setNumber: "1",
        attributionText: "CBSE 2024, Set 1",
      },
    });

    render(<QuestionRenderer question={question} />);
    expect(screen.getByText("CBSE 2024, Set 1")).toBeInTheDocument();
  });

  it("shows a question number when the surrounding paper supplies one", () => {
    const { container } = render(
      <QuestionRenderer question={fixtures.MCQ} displayNumber="31 (a)" />,
    );

    expect(within(container).getByText("31 (a)")).toBeInTheDocument();
  });

  it("labels the radio group for screen readers", () => {
    render(<QuestionRenderer question={fixtures.MCQ} />);
    expect(screen.getByRole("group", { name: /choose one answer/i })).toBeInTheDocument();
  });
});
