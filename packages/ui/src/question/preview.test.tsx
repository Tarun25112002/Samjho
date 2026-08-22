import type { WriteQuestionInput } from "@samjho/contracts";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { toPreviewQuestion } from "./preview.js";
import { QuestionRenderer } from "./question-renderer.js";

/**
 * Preview-as-student — the half of the Phase 4 gate that is a pure function.
 *
 * The gate reads: *a non-developer can create, preview and publish a case-based
 * question with sub-parts.* The creating and publishing halves are proven by the
 * API's integration tests; this file proves the middle one, and in particular
 * the property the whole design rests on — that an answer key cannot appear in a
 * preview, because the shape it is projected into has nowhere to put one.
 */

const SOLUTION = "the worked solution an editor has just typed";

function draft(overrides: Partial<WriteQuestionInput> = {}): WriteQuestionInput {
  return {
    chapterId: "chapter",
    topicIds: ["topic"],
    type: "MCQ",
    body: "The SI unit of electrical resistance is:",
    bodyHindi: null,
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: null,
    options: [
      { label: "A", body: "volt", isCorrect: false },
      { label: "B", body: "ohm", isCorrect: true },
    ],
    assets: [],
    answer: {
      correctValue: null,
      acceptedValues: [],
      tolerance: null,
      unit: null,
      solution: SOLUTION,
      explanation: null,
      markingScheme: null,
    },
    subParts: [],
    source: {
      sourceType: "ORIGINAL",
      year: null,
      examSession: null,
      paperCode: null,
      setNumber: null,
      originalQuestionNumber: null,
      sourceUrl: null,
      licenceStatus: "CLEARED",
      attributionText: null,
      reviewNotes: null,
    },
    ...overrides,
  };
}

describe("toPreviewQuestion", () => {
  it("carries no answer key at all", () => {
    const preview = toPreviewQuestion(draft());

    // Serialised and searched rather than checked field by field: the failure
    // mode is a field nobody thought to assert on.
    expect(JSON.stringify(preview)).not.toContain(SOLUTION);
    expect(JSON.stringify(preview)).not.toContain("isCorrect");
  });

  it("keeps the licensing decision off the student's shape while keeping attribution on it", () => {
    const preview = toPreviewQuestion(
      draft({
        source: {
          ...draft().source,
          sourceType: "ADAPTED",
          licenceStatus: "FAIR_USE_CLAIMED",
          attributionText: "Adapted from CBSE 2024, Set 1, Q19",
          reviewNotes: "checked by counsel",
        },
      }),
    );

    expect(preview.provenance?.attributionText).toBe("Adapted from CBSE 2024, Set 1, Q19");
    expect(JSON.stringify(preview)).not.toContain("FAIR_USE_CLAIMED");
    expect(JSON.stringify(preview)).not.toContain("counsel");
  });

  it("fills in the expected time the API would have chosen", () => {
    expect(toPreviewQuestion(draft({ marks: 3 })).expectedTimeSeconds).toBe(180);
    expect(toPreviewQuestion(draft({ expectedTimeSeconds: 45 })).expectedTimeSeconds).toBe(45);
  });

  it("marks the first topic as the primary one, matching how the contract encodes it", () => {
    const preview = toPreviewQuestion(draft(), { topicNames: ["Ohm's law", "Resistors"] });

    expect(preview.topics.map((topic) => topic.isPrimary)).toEqual([true, false]);
  });
});

describe("previewing a case study, which is the Phase 4 gate", () => {
  const caseStudy = draft({
    type: "CASE_BASED",
    marks: 4,
    body: "A household draws the following currents over one evening.",
    answer: null,
    options: [],
    subParts: [
      {
        type: "VERY_SHORT_ANSWER",
        body: "State the peak current drawn.",
        bodyHindi: null,
        marks: 1,
        difficulty: "MEDIUM",
        bloomLevel: "UNDERSTAND",
        expectedTimeSeconds: null,
        options: [],
        assets: [],
        answer: {
          correctValue: null,
          acceptedValues: [],
          tolerance: null,
          unit: null,
          solution: "8 A — a sub-part solution that must not be previewed",
          explanation: null,
          markingScheme: null,
        },
        topicIds: null,
      },
      {
        type: "MCQ",
        body: "Which reading is the peak?",
        bodyHindi: null,
        marks: 3,
        difficulty: "MEDIUM",
        bloomLevel: "UNDERSTAND",
        expectedTimeSeconds: null,
        options: [
          { label: "A", body: "2 kW", isCorrect: false },
          { label: "B", body: "8 kW", isCorrect: true },
        ],
        assets: [],
        answer: {
          correctValue: null,
          acceptedValues: [],
          tolerance: null,
          unit: null,
          solution: "8 kW is the highest reading.",
          explanation: null,
          markingScheme: null,
        },
        topicIds: null,
      },
    ],
  });

  it("renders the stimulus and every sub-part through the student renderer", () => {
    render(<QuestionRenderer question={toPreviewQuestion(caseStudy)} displayNumber="1" />);

    expect(screen.getByText(/A household draws the following currents/)).toBeInTheDocument();
    expect(screen.getByText(/State the peak current drawn/)).toBeInTheDocument();
    expect(screen.getByText(/Which reading is the peak/)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /8 kW/ })).toBeInTheDocument();
  });

  it("leaks no sub-part solution and marks no option as correct", () => {
    const { container } = render(<QuestionRenderer question={toPreviewQuestion(caseStudy)} />);

    expect(container.textContent).not.toContain("must not be previewed");
    expect(container.textContent).not.toContain("highest reading");
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).not.toBeChecked();
    }
  });

  it("renders every control disabled, so an editor cannot answer their own question", () => {
    // No `onChange` is passed — the same thing the browse pages do.
    render(<QuestionRenderer question={toPreviewQuestion(caseStudy)} />);

    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toBeDisabled();
    }
  });
});
