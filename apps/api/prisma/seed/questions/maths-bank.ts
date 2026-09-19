import type { SeedQuestion } from "../types.js";

/**
 * The chapter-wise question bank for CBSE Class 10 Mathematics.
 *
 * ## How this differs from `maths.ts`
 *
 * That file is a *coverage* set: one genuine example of each of the ten question
 * types, written so the Phase 3 renderer had a real case for every path. It was
 * never meant to be a bank, and it shows — fourteen chapters share forty-four
 * questions, and two chapters have one each.
 *
 * This file is the bank. Every chapter of the rationalised NCERT syllabus gets
 * six questions spanning the marks a real paper spans: one-mark objectives, a
 * two- or three-mark method question, and something longer. A teacher building a
 * test on Circles now has a page to choose from rather than two questions.
 *
 * They are kept apart rather than merged because they answer to different
 * standards. A coverage set is complete when every type appears once; a bank is
 * never complete, and grows a chapter at a time. Merging them would mean nobody
 * could tell which rows were load-bearing for the renderer's tests.
 *
 * ## Provenance, and why none of this is copied
 *
 * `docs/07` R2 makes copyright a critical risk rather than a footnote: this is a
 * commercial product for paying students, and reproducing CBSE or publisher
 * questions verbatim in one is a materially different exposure from doing it in
 * a portfolio project. So every question here is original or adapted — same
 * concept and same shape as the board asks it, different numbers and different
 * context — and every row carries its provenance rather than leaving it for a
 * later audit that would arrive after two thousand rows.
 *
 * `ADAPTED` names the paper the *pattern* came from. It is not a claim that the
 * text is the board's, and the attribution says so in words.
 */

const ORIGINAL = { sourceType: "ORIGINAL", licenceStatus: "CLEARED" } as const;

const ADAPTED = (year: number, q: string) =>
  ({
    sourceType: "ADAPTED",
    year,
    examSession: "March",
    originalQuestionNumber: q,
    licenceStatus: "CLEARED",
    attributionText: `Adapted from CBSE Class 10 Mathematics ${String(year)}, Q${q}. Numbers and context changed.`,
  }) as const;

/** The four options every CBSE assertion–reason question uses, verbatim. */
const AR_OPTIONS = [
  {
    label: "A",
    body: "Both Assertion (A) and Reason (R) are true and Reason (R) is the correct explanation of Assertion (A).",
  },
  {
    label: "B",
    body: "Both Assertion (A) and Reason (R) are true but Reason (R) is not the correct explanation of Assertion (A).",
  },
  { label: "C", body: "Assertion (A) is true but Reason (R) is false." },
  { label: "D", body: "Assertion (A) is false but Reason (R) is true." },
];

function arOptions(correct: "A" | "B" | "C" | "D") {
  return AR_OPTIONS.map((option) => ({ ...option, isCorrect: option.label === correct }));
}

export const class10MathsBank: SeedQuestion[] = [
  // ══ 1. Real Numbers ══════════════════════════════════════════════════════
  {
    key: "bank-math-rn-001",
    chapter: "real-numbers",
    topics: ["hcf-lcm"],
    type: "MCQ",
    body: "If $\\text{HCF}(72, 120) = 24$, then $\\text{LCM}(72, 120)$ is:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 60,
    options: [
      { label: "A", body: "$180$" },
      { label: "B", body: "$240$" },
      { label: "C", body: "$360$", isCorrect: true },
      { label: "D", body: "$720$" },
    ],
    answer: {
      correctValue: "C",
      solution:
        "For any two positive integers, $\\text{HCF} \\times \\text{LCM} = \\text{product of the numbers}$. So $24 \\times \\text{LCM} = 72 \\times 120 = 8640$, giving $\\text{LCM} = \\dfrac{8640}{24} = 360$.",
      explanation:
        "This identity holds for **two** numbers only. It is not true for three, which is the mistake this question is really testing.",
    },
    source: ADAPTED(2023, "1"),
  },
  {
    key: "bank-math-rn-002",
    chapter: "real-numbers",
    topics: ["fundamental-theorem-arithmetic"],
    type: "SHORT_ANSWER",
    body: "Find the HCF and LCM of $404$ and $96$ by prime factorisation, and verify that $\\text{HCF} \\times \\text{LCM}$ equals the product of the two numbers.",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 240,
    answer: {
      solution:
        "$404 = 2^2 \\times 101$ and $96 = 2^5 \\times 3$.\n\nThe only common prime is $2$, to the lower power: $\\text{HCF} = 2^2 = 4$.\n\nTaking every prime to its higher power: $\\text{LCM} = 2^5 \\times 3 \\times 101 = 9696$.\n\nCheck: $\\text{HCF} \\times \\text{LCM} = 4 \\times 9696 = 38784$, and $404 \\times 96 = 38784$. They agree.",
      markingScheme: [
        { step: "Correct prime factorisation of both numbers", marks: 1 },
        { step: "HCF = 4 and LCM = 9696", marks: 1 },
        { step: "Verification that the products are equal", marks: 1 },
      ],
    },
    source: ADAPTED(2019, "12"),
  },
  {
    key: "bank-math-rn-003",
    chapter: "real-numbers",
    topics: ["irrational-numbers"],
    type: "LONG_ANSWER",
    body: "Prove that $\\sqrt{5}$ is irrational.",
    marks: 5,
    difficulty: "HARD",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 420,
    answer: {
      solution:
        "Suppose, for contradiction, that $\\sqrt{5}$ is rational. Then $\\sqrt{5} = \\dfrac{a}{b}$ for integers $a, b$ with $b \\neq 0$ and $\\text{HCF}(a,b) = 1$.\n\nSquaring: $5b^2 = a^2$. So $5$ divides $a^2$, and since $5$ is prime, $5$ divides $a$. Write $a = 5c$.\n\nSubstituting: $5b^2 = 25c^2$, so $b^2 = 5c^2$. By the same argument $5$ divides $b$.\n\nSo $5$ divides both $a$ and $b$, contradicting $\\text{HCF}(a,b) = 1$. Hence $\\sqrt{5}$ cannot be rational, and is therefore irrational.",
      markingScheme: [
        { step: "Assumes the contrary and writes √5 = a/b in lowest terms", marks: 1 },
        { step: "Squares to get 5b² = a² and deduces 5 divides a", marks: 1 },
        { step: "Substitutes a = 5c correctly", marks: 1 },
        { step: "Deduces 5 divides b", marks: 1 },
        { step: "States the contradiction and concludes", marks: 1 },
      ],
      explanation:
        "The step examiners most often see missed is *why* '5 divides $a^2$' gives '5 divides $a$'. It is true because 5 is prime — the same claim with 4 in place of 5 is false.",
    },
    source: ADAPTED(2020, "27"),
  },
  {
    key: "bank-math-rn-004",
    chapter: "real-numbers",
    topics: ["hcf-lcm"],
    type: "ASSERTION_REASON",
    body: "**Assertion (A):** The number $6^n$ can never end with the digit $0$ for any natural number $n$.\n\n**Reason (R):** A number ends with $0$ only if its prime factorisation contains both $2$ and $5$.",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 90,
    options: arOptions("A"),
    answer: {
      correctValue: "A",
      solution:
        "$6^n = (2 \\times 3)^n = 2^n \\times 3^n$, whose only prime factors are $2$ and $3$. A number ending in $0$ is divisible by $10 = 2 \\times 5$, so it needs a factor of $5$. As $6^n$ has none, it never ends in $0$. Both statements are true and (R) is exactly why (A) holds.",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-rn-005",
    chapter: "real-numbers",
    topics: ["hcf-lcm"],
    type: "SHORT_ANSWER",
    body: "Two bells ring at intervals of $18$ minutes and $24$ minutes. They ring together at $9{:}00$ a.m. At what time will they next ring together?",
    marks: 2,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 150,
    answer: {
      solution:
        "They coincide again after $\\text{LCM}(18, 24)$ minutes.\n\n$18 = 2 \\times 3^2$, $24 = 2^3 \\times 3$, so $\\text{LCM} = 2^3 \\times 3^2 = 72$ minutes.\n\n$72$ minutes after $9{:}00$ a.m. is **$10{:}12$ a.m.**",
      markingScheme: [
        { step: "Identifies that the LCM is required and computes it as 72", marks: 1 },
        { step: "Converts to the clock time 10:12 a.m.", marks: 1 },
      ],
      explanation:
        "HCF and LCM word problems are distinguished by one question: are you *splitting* something into equal parts (HCF) or waiting for cycles to *coincide* (LCM)?",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-rn-006",
    chapter: "real-numbers",
    topics: ["euclids-division-lemma"],
    type: "VERY_SHORT_ANSWER",
    body: "The HCF of two numbers is $27$ and their LCM is $162$. If one number is $54$, find the other.",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 90,
    answer: {
      correctValue: "81",
      acceptedValues: ["81"],
      solution:
        "$\\text{HCF} \\times \\text{LCM} = $ product of the numbers, so $27 \\times 162 = 54 \\times x$. Then $x = \\dfrac{4374}{54} = 81$.",
    },
    source: ADAPTED(2018, "3"),
  },

  // ══ 2. Polynomials ═══════════════════════════════════════════════════════
  {
    key: "bank-math-poly-001",
    chapter: "polynomials",
    topics: ["polynomial-graphs"],
    type: "MCQ",
    body: "The graph of a polynomial $p(x)$ cuts the $x$-axis at exactly $3$ points. The number of zeroes of $p(x)$ is:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 45,
    options: [
      { label: "A", body: "$1$" },
      { label: "B", body: "$2$" },
      { label: "C", body: "$3$", isCorrect: true },
      { label: "D", body: "Cannot be determined" },
    ],
    answer: {
      correctValue: "C",
      solution:
        "A zero of $p(x)$ is a value of $x$ where $p(x) = 0$, which is exactly where the graph meets the $x$-axis. Three intersections means three zeroes.",
      explanation:
        "Note the word *cuts*. A graph that only touches the axis at a point still has a zero there, so 'cuts or touches' is the safe reading.",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-poly-002",
    chapter: "polynomials",
    topics: ["zeroes-coefficients-relation"],
    type: "SHORT_ANSWER",
    body: "Find the zeroes of the quadratic polynomial $p(x) = 6x^2 - 3 - 7x$ and verify the relationship between the zeroes and the coefficients.",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 240,
    answer: {
      solution:
        "Write it in standard form: $p(x) = 6x^2 - 7x - 3$.\n\nSplitting the middle term: $6x^2 - 9x + 2x - 3 = 3x(2x - 3) + 1(2x - 3) = (3x + 1)(2x - 3)$.\n\nSo the zeroes are $x = -\\dfrac{1}{3}$ and $x = \\dfrac{3}{2}$.\n\nSum $= -\\dfrac{1}{3} + \\dfrac{3}{2} = \\dfrac{7}{6} = -\\dfrac{b}{a} = \\dfrac{7}{6}$. ✓\n\nProduct $= -\\dfrac{1}{3} \\times \\dfrac{3}{2} = -\\dfrac{1}{2} = \\dfrac{c}{a} = \\dfrac{-3}{6}$. ✓",
      markingScheme: [
        { step: "Rearranges to standard form and factorises correctly", marks: 1 },
        { step: "States both zeroes", marks: 1 },
        { step: "Verifies both the sum and the product against the coefficients", marks: 1 },
      ],
      explanation:
        "The commonest lost mark here is not rearranging first: with the terms out of order, $b$ is read as $-3$ rather than $-7$.",
    },
    source: ADAPTED(2019, "14"),
  },
  {
    key: "bank-math-poly-003",
    chapter: "polynomials",
    topics: ["zeroes-coefficients-relation"],
    type: "SHORT_ANSWER",
    body: "If $\\alpha$ and $\\beta$ are the zeroes of $p(x) = x^2 - 6x + 8$, find the value of $\\dfrac{1}{\\alpha} + \\dfrac{1}{\\beta}$.",
    marks: 2,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 150,
    answer: {
      solution:
        "From the coefficients, $\\alpha + \\beta = 6$ and $\\alpha\\beta = 8$.\n\n$\\dfrac{1}{\\alpha} + \\dfrac{1}{\\beta} = \\dfrac{\\alpha + \\beta}{\\alpha\\beta} = \\dfrac{6}{8} = \\dfrac{3}{4}$.",
      markingScheme: [
        { step: "States the sum and product of the zeroes from the coefficients", marks: 1 },
        { step: "Combines into (α+β)/αβ and evaluates to 3/4", marks: 1 },
      ],
      explanation:
        "The zeroes here happen to be 2 and 4, so this can be done by finding them — but the intended method needs no zeroes at all, and that is the one that still works when they are irrational.",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-poly-004",
    chapter: "polynomials",
    topics: ["zeroes-of-polynomial"],
    type: "VERY_SHORT_ANSWER",
    body: "Write a quadratic polynomial whose sum of zeroes is $-3$ and product of zeroes is $2$.",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 60,
    answer: {
      correctValue: "x^2 + 3x + 2",
      acceptedValues: ["x^2+3x+2", "x² + 3x + 2", "x^2 + 3x + 2"],
      solution:
        "A quadratic with given sum $s$ and product $p$ is $x^2 - sx + p$. Here $s = -3$ and $p = 2$, giving $x^2 + 3x + 2$.",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-poly-005",
    chapter: "polynomials",
    topics: ["zeroes-coefficients-relation"],
    type: "MCQ",
    body: "If one zero of $p(x) = x^2 - kx + 9$ is the reciprocal of the other, then $k$ can be:",
    marks: 1,
    difficulty: "HARD",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 90,
    options: [
      { label: "A", body: "Any real number" },
      { label: "B", body: "No such $k$ exists", isCorrect: true },
      { label: "C", body: "$9$ only" },
      { label: "D", body: "$3$ only" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "If the zeroes are reciprocals, their product is $1$. But the product of the zeroes is $\\dfrac{c}{a} = \\dfrac{9}{1} = 9$, which is fixed and never equal to $1$ whatever $k$ is. So no such $k$ exists.",
      explanation:
        "$k$ only controls the *sum* of the zeroes. Recognising that the constraint lands on the product — which $k$ cannot touch — is the whole question.",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-poly-006",
    chapter: "polynomials",
    topics: ["polynomial-graphs"],
    type: "ASSERTION_REASON",
    body: "**Assertion (A):** The polynomial $p(x) = x^2 + 4$ has no real zeroes.\n\n**Reason (R):** The graph of $p(x) = x^2 + 4$ lies entirely above the $x$-axis.",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 90,
    options: arOptions("A"),
    answer: {
      correctValue: "A",
      solution:
        "$x^2 \\geq 0$ for every real $x$, so $x^2 + 4 \\geq 4 > 0$: the curve never meets the $x$-axis, and there is no real $x$ with $p(x) = 0$. Both statements are true, and (R) is the reason (A) holds.",
    },
    source: ORIGINAL,
  },

  // ══ 3. Pair of Linear Equations in Two Variables ═════════════════════════
  {
    key: "bank-math-le-001",
    chapter: "linear-equations-two-variables",
    topics: ["consistency-of-pairs"],
    type: "MCQ",
    body: "The pair of equations $2x + 3y = 5$ and $4x + 6y = 15$ has:",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 90,
    options: [
      { label: "A", body: "A unique solution" },
      { label: "B", body: "Exactly two solutions" },
      { label: "C", body: "Infinitely many solutions" },
      { label: "D", body: "No solution", isCorrect: true },
    ],
    answer: {
      correctValue: "D",
      solution:
        "Compare the ratios: $\\dfrac{a_1}{a_2} = \\dfrac{2}{4} = \\dfrac{1}{2}$, $\\dfrac{b_1}{b_2} = \\dfrac{3}{6} = \\dfrac{1}{2}$, $\\dfrac{c_1}{c_2} = \\dfrac{5}{15} = \\dfrac{1}{3}$.\n\nSince $\\dfrac{a_1}{a_2} = \\dfrac{b_1}{b_2} \\neq \\dfrac{c_1}{c_2}$, the lines are parallel and distinct — the pair is inconsistent and has no solution.",
      explanation:
        "All three ratios equal means infinitely many solutions; the first two equal but the third different means none. Getting these the wrong way round is the standard slip.",
    },
    source: ADAPTED(2022, "5"),
  },
  {
    key: "bank-math-le-002",
    chapter: "linear-equations-two-variables",
    topics: ["substitution-elimination"],
    type: "SHORT_ANSWER",
    body: "Solve for $x$ and $y$: $\\;3x + 4y = 10$ and $2x - 2y = 2$.",
    marks: 3,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 210,
    answer: {
      solution:
        "From the second equation, $x - y = 1$, so $x = y + 1$.\n\nSubstituting into the first: $3(y + 1) + 4y = 10 \\Rightarrow 7y + 3 = 10 \\Rightarrow y = 1$.\n\nThen $x = 2$.\n\nCheck: $3(2) + 4(1) = 10$ ✓ and $2(2) - 2(1) = 2$ ✓.",
      markingScheme: [
        { step: "Simplifies the second equation and expresses one variable", marks: 1 },
        { step: "Substitutes and solves for one variable", marks: 1 },
        { step: "Finds the second variable, x = 2 and y = 1", marks: 1 },
      ],
    },
    source: ADAPTED(2020, "16"),
  },
  {
    key: "bank-math-le-003",
    chapter: "linear-equations-two-variables",
    topics: ["linear-equation-word-problems"],
    type: "LONG_ANSWER",
    body: "The sum of the digits of a two-digit number is $9$. If $27$ is added to the number, the digits are reversed. Find the number.",
    marks: 5,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 360,
    answer: {
      solution:
        "Let the tens digit be $x$ and the units digit be $y$. The number is $10x + y$.\n\nFrom the digit sum: $x + y = 9$. &nbsp;&nbsp;…(i)\n\nReversing gives $10y + x$, so: $10x + y + 27 = 10y + x$.\n\nSimplifying: $9x - 9y = -27$, so $x - y = -3$. &nbsp;&nbsp;…(ii)\n\nAdding (i) and (ii): $2x = 6$, so $x = 3$ and $y = 6$.\n\nThe number is $\\mathbf{36}$.\n\nCheck: $3 + 6 = 9$ ✓, and $36 + 27 = 63$, which is $36$ reversed ✓.",
      markingScheme: [
        { step: "Assigns variables and writes the number as 10x + y", marks: 1 },
        { step: "Forms the digit-sum equation", marks: 1 },
        { step: "Forms the reversal equation and simplifies it", marks: 1 },
        { step: "Solves the pair correctly", marks: 1 },
        { step: "States the number and verifies", marks: 1 },
      ],
      explanation:
        "The single most common error is writing the number as $x + y$ rather than $10x + y$ — after which every subsequent step is correct and the answer is still wrong.",
    },
    source: ADAPTED(2019, "26"),
  },
  {
    key: "bank-math-le-004",
    chapter: "linear-equations-two-variables",
    topics: ["consistency-of-pairs"],
    type: "VERY_SHORT_ANSWER",
    body: "For what value of $k$ does the pair $x + 2y = 3$ and $5x + ky = 15$ have infinitely many solutions?",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 90,
    answer: {
      correctValue: "10",
      acceptedValues: ["10", "k = 10", "k=10"],
      solution:
        "Infinitely many solutions requires $\\dfrac{a_1}{a_2} = \\dfrac{b_1}{b_2} = \\dfrac{c_1}{c_2}$, i.e. $\\dfrac{1}{5} = \\dfrac{2}{k} = \\dfrac{3}{15}$.\n\n$\\dfrac{3}{15} = \\dfrac{1}{5}$ ✓, and $\\dfrac{2}{k} = \\dfrac{1}{5}$ gives $k = 10$.",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-le-005",
    chapter: "linear-equations-two-variables",
    topics: ["linear-equation-word-problems"],
    type: "SHORT_ANSWER",
    body: "$5$ pencils and $7$ pens together cost $₹250$, while $7$ pencils and $5$ pens together cost $₹230$. Find the cost of one pencil and one pen.",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 240,
    answer: {
      solution:
        "Let a pencil cost $₹x$ and a pen $₹y$.\n\n$5x + 7y = 250$ &nbsp;…(i)\n$7x + 5y = 230$ &nbsp;…(ii)\n\nAdding: $12x + 12y = 480$, so $x + y = 40$. &nbsp;…(iii)\n\nSubtracting (i) from (ii): $2x - 2y = -20$, so $x - y = -10$. &nbsp;…(iv)\n\nFrom (iii) and (iv): $2x = 30$, so $x = 15$ and $y = 25$.\n\nA pencil costs **₹15** and a pen **₹25**.",
      markingScheme: [
        { step: "Forms both equations from the given information", marks: 1 },
        { step: "Uses the add-and-subtract shortcut or a valid elimination", marks: 1 },
        { step: "Reaches x = 15 and y = 25", marks: 1 },
      ],
      explanation:
        "When the coefficients are swapped between the two equations, adding and subtracting them is far faster than ordinary elimination. Spotting that symmetry is worth minutes in an exam.",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-le-006",
    chapter: "linear-equations-two-variables",
    topics: ["graphical-solution"],
    type: "MCQ",
    body: "If a pair of linear equations is consistent, then their graphs are:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 45,
    options: [
      { label: "A", body: "Always parallel" },
      { label: "B", body: "Always intersecting at exactly one point" },
      { label: "C", body: "Intersecting or coincident", isCorrect: true },
      { label: "D", body: "Always coincident" },
    ],
    answer: {
      correctValue: "C",
      solution:
        "Consistent means the pair has at least one solution. That happens when the lines intersect at one point (a unique solution) **or** when they coincide (infinitely many). Distinct parallel lines are the inconsistent case.",
    },
    source: ORIGINAL,
  },

  // ══ 4. Quadratic Equations ═══════════════════════════════════════════════
  {
    key: "bank-math-qe-001",
    chapter: "quadratic-equations",
    topics: ["discriminant-nature-of-roots"],
    type: "MCQ",
    body: "The value of $k$ for which the equation $x^2 + kx + 16 = 0$ has equal roots is:",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 90,
    options: [
      { label: "A", body: "$\\pm 4$" },
      { label: "B", body: "$\\pm 8$", isCorrect: true },
      { label: "C", body: "$8$ only" },
      { label: "D", body: "$16$" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "Equal roots require $D = b^2 - 4ac = 0$, so $k^2 - 4(1)(16) = 0 \\Rightarrow k^2 = 64 \\Rightarrow k = \\pm 8$.",
      explanation:
        "Squaring gives two answers and both are valid. Reporting only $+8$ is the commonest way to lose this mark.",
    },
    source: ADAPTED(2023, "6"),
  },
  {
    key: "bank-math-qe-002",
    chapter: "quadratic-equations",
    topics: ["quadratic-by-factorisation"],
    type: "SHORT_ANSWER",
    body: "Solve by factorisation: $\\;2x^2 - 5x - 3 = 0$.",
    marks: 2,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 150,
    answer: {
      solution:
        "Split the middle term so the parts multiply to $2 \\times (-3) = -6$ and add to $-5$: those are $-6$ and $+1$.\n\n$2x^2 - 6x + x - 3 = 0$\n$2x(x - 3) + 1(x - 3) = 0$\n$(2x + 1)(x - 3) = 0$\n\nSo $x = -\\dfrac{1}{2}$ or $x = 3$.",
      markingScheme: [
        { step: "Splits the middle term correctly", marks: 1 },
        { step: "Factorises and states both roots", marks: 1 },
      ],
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-qe-003",
    chapter: "quadratic-equations",
    topics: ["quadratic-word-problems"],
    type: "LONG_ANSWER",
    body: "A train travels $360$ km at a uniform speed. If the speed had been $5$ km/h more, the journey would have taken $1$ hour less. Find the original speed of the train.",
    marks: 5,
    difficulty: "HARD",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 420,
    answer: {
      solution:
        "Let the original speed be $x$ km/h. The time taken is $\\dfrac{360}{x}$ hours.\n\nAt $(x + 5)$ km/h the time is $\\dfrac{360}{x + 5}$, which is one hour less:\n\n$$\\frac{360}{x} - \\frac{360}{x+5} = 1$$\n\n$$360(x + 5) - 360x = x(x+5)$$\n$$1800 = x^2 + 5x$$\n$$x^2 + 5x - 1800 = 0$$\n\nFactorising: $(x + 45)(x - 40) = 0$, so $x = 40$ or $x = -45$.\n\nSpeed cannot be negative, so the original speed is **$40$ km/h**.",
      markingScheme: [
        { step: "Assigns the variable and writes both times correctly", marks: 1 },
        { step: "Forms the equation from the one-hour difference", marks: 1 },
        { step: "Clears the fractions to a quadratic in standard form", marks: 1 },
        { step: "Solves the quadratic", marks: 1 },
        { step: "Rejects the negative root with a reason and states the speed", marks: 1 },
      ],
      explanation:
        "The final mark is for *rejecting* the negative root and saying why. An answer that lists both roots and stops has not answered the question, which asked for a speed.",
    },
    source: ADAPTED(2018, "28"),
  },
  {
    key: "bank-math-qe-004",
    chapter: "quadratic-equations",
    topics: ["quadratic-formula"],
    type: "SHORT_ANSWER",
    body: "Using the quadratic formula, solve $\\;3x^2 - 2x - 1 = 0$.",
    marks: 2,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 150,
    answer: {
      solution:
        "Here $a = 3$, $b = -2$, $c = -1$, so $D = (-2)^2 - 4(3)(-1) = 4 + 12 = 16$.\n\n$$x = \\frac{-b \\pm \\sqrt{D}}{2a} = \\frac{2 \\pm 4}{6}$$\n\nSo $x = 1$ or $x = -\\dfrac{1}{3}$.",
      markingScheme: [
        { step: "Computes the discriminant as 16", marks: 1 },
        { step: "Applies the formula and states both roots", marks: 1 },
      ],
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-qe-005",
    chapter: "quadratic-equations",
    topics: ["discriminant-nature-of-roots"],
    type: "ASSERTION_REASON",
    body: "**Assertion (A):** The equation $2x^2 + 3x + 5 = 0$ has no real roots.\n\n**Reason (R):** A quadratic equation has no real roots when its discriminant is negative.",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 90,
    options: arOptions("A"),
    answer: {
      correctValue: "A",
      solution:
        "$D = 3^2 - 4(2)(5) = 9 - 40 = -31 < 0$, so there are no real roots. (R) states the general rule and is exactly why (A) is true.",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-qe-006",
    chapter: "quadratic-equations",
    topics: ["quadratic-word-problems"],
    type: "SHORT_ANSWER",
    body: "The product of two consecutive positive integers is $306$. Form a quadratic equation for this and find the integers.",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 210,
    answer: {
      solution:
        "Let the integers be $x$ and $x + 1$.\n\n$x(x + 1) = 306 \\Rightarrow x^2 + x - 306 = 0$.\n\nFactorising: $(x + 18)(x - 17) = 0$, so $x = 17$ or $x = -18$.\n\nThe integers are positive, so $x = 17$ and the numbers are **$17$ and $18$**.",
      markingScheme: [
        { step: "Forms the equation x² + x − 306 = 0", marks: 1 },
        { step: "Solves it correctly", marks: 1 },
        { step: "Rejects the negative root and states both integers", marks: 1 },
      ],
    },
    source: ADAPTED(2021, "22"),
  },

  // ══ 5. Arithmetic Progressions ═══════════════════════════════════════════
  {
    key: "bank-math-ap-001",
    chapter: "arithmetic-progressions",
    topics: ["ap-nth-term"],
    type: "MCQ",
    body: "The $11$th term of the AP $-5, -\\dfrac{5}{2}, 0, \\dfrac{5}{2}, \\ldots$ is:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 90,
    options: [
      { label: "A", body: "$-20$" },
      { label: "B", body: "$20$", isCorrect: true },
      { label: "C", body: "$-30$" },
      { label: "D", body: "$30$" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "$a = -5$ and $d = -\\dfrac{5}{2} - (-5) = \\dfrac{5}{2}$.\n\n$a_{11} = a + 10d = -5 + 10 \\times \\dfrac{5}{2} = -5 + 25 = 20$.",
      explanation: "Using $a + 11d$ instead of $a + 10d$ is the standard off-by-one here.",
    },
    source: ADAPTED(2020, "4"),
  },
  {
    key: "bank-math-ap-002",
    chapter: "arithmetic-progressions",
    topics: ["ap-sum-of-n-terms"],
    type: "SHORT_ANSWER",
    body: "Find the sum of the first $20$ terms of the AP $\\;5, 8, 11, 14, \\ldots$",
    marks: 2,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 150,
    answer: {
      solution:
        "$a = 5$, $d = 3$, $n = 20$.\n\n$$S_n = \\frac{n}{2}\\left[2a + (n-1)d\\right] = \\frac{20}{2}\\left[10 + 19 \\times 3\\right] = 10 \\times 67 = 670$$",
      markingScheme: [
        { step: "Identifies a, d and applies the correct sum formula", marks: 1 },
        { step: "Evaluates to 670", marks: 1 },
      ],
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-ap-003",
    chapter: "arithmetic-progressions",
    topics: ["ap-applications"],
    type: "LONG_ANSWER",
    body: "A contractor is fined for delaying a project: $₹200$ for the first day, $₹250$ for the second, $₹300$ for the third, and so on. If the contractor is fined for $30$ days, find the total fine. How much is the fine on the last day?",
    marks: 5,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 360,
    answer: {
      solution:
        "The daily fines form an AP with $a = 200$ and $d = 50$.\n\n**Fine on the 30th day:**\n$$a_{30} = a + 29d = 200 + 29 \\times 50 = 200 + 1450 = ₹1650$$\n\n**Total fine over 30 days:**\n$$S_{30} = \\frac{30}{2}\\left[2(200) + 29(50)\\right] = 15\\left[400 + 1450\\right] = 15 \\times 1850 = ₹27{,}750$$",
      markingScheme: [
        { step: "Identifies the situation as an AP with a = 200, d = 50", marks: 1 },
        { step: "Applies the nth-term formula", marks: 1 },
        { step: "Finds the last day's fine as ₹1650", marks: 1 },
        { step: "Applies the sum formula correctly", marks: 1 },
        { step: "Finds the total as ₹27,750", marks: 1 },
      ],
    },
    source: ADAPTED(2019, "29"),
  },
  {
    key: "bank-math-ap-004",
    chapter: "arithmetic-progressions",
    topics: ["ap-nth-term"],
    type: "SHORT_ANSWER",
    body: "How many two-digit numbers are divisible by $7$?",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 210,
    answer: {
      solution:
        "The two-digit multiples of $7$ are $14, 21, 28, \\ldots, 98$ — an AP with $a = 14$, $d = 7$, last term $98$.\n\n$$98 = 14 + (n-1)7 \\Rightarrow 84 = 7(n-1) \\Rightarrow n - 1 = 12 \\Rightarrow n = 13$$\n\nThere are **$13$** such numbers.",
      markingScheme: [
        { step: "Identifies the first and last two-digit multiples of 7", marks: 1 },
        { step: "Sets up aₙ = a + (n−1)d = 98", marks: 1 },
        { step: "Solves to n = 13", marks: 1 },
      ],
      explanation:
        "$7$ itself is not a two-digit number, so the AP starts at $14$ rather than $7$. That is the trap.",
    },
    source: ADAPTED(2018, "18"),
  },
  {
    key: "bank-math-ap-005",
    chapter: "arithmetic-progressions",
    topics: ["ap-nth-term"],
    type: "VERY_SHORT_ANSWER",
    body: "For the AP $3, 7, 11, 15, \\ldots$, find the common difference.",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 45,
    answer: {
      correctValue: "4",
      acceptedValues: ["4", "d = 4", "d=4"],
      solution: "$d = a_2 - a_1 = 7 - 3 = 4$. Checking further terms confirms it: $11 - 7 = 4$.",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-ap-006",
    chapter: "arithmetic-progressions",
    topics: ["ap-sum-of-n-terms"],
    type: "MCQ",
    body: "If the sum of the first $n$ terms of an AP is $S_n = 3n^2 + 2n$, then its first term is:",
    marks: 1,
    difficulty: "HARD",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 90,
    options: [
      { label: "A", body: "$3$" },
      { label: "B", body: "$5$", isCorrect: true },
      { label: "C", body: "$2$" },
      { label: "D", body: "$8$" },
    ],
    answer: {
      correctValue: "B",
      solution: "The first term is simply $S_1$: $S_1 = 3(1)^2 + 2(1) = 5$.",
      explanation:
        "No formula-juggling needed. The sum of the first *one* term **is** the first term — the shortest route is often to substitute $n = 1$.",
    },
    source: ORIGINAL,
  },

  // ══ 6. Triangles ═════════════════════════════════════════════════════════
  {
    key: "bank-math-tri-001",
    chapter: "triangles",
    topics: ["basic-proportionality-theorem"],
    type: "SHORT_ANSWER",
    body: "In $\\triangle ABC$, $DE \\parallel BC$ with $D$ on $AB$ and $E$ on $AC$. If $AD = 4$ cm, $DB = 6$ cm and $AE = 5$ cm, find $EC$.",
    marks: 2,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 150,
    answer: {
      solution:
        "By the Basic Proportionality Theorem (Thales), $\\dfrac{AD}{DB} = \\dfrac{AE}{EC}$.\n\n$$\\frac{4}{6} = \\frac{5}{EC} \\Rightarrow EC = \\frac{5 \\times 6}{4} = 7.5 \\text{ cm}$$",
      markingScheme: [
        { step: "States and applies the Basic Proportionality Theorem", marks: 1 },
        { step: "Computes EC = 7.5 cm", marks: 1 },
      ],
      explanation:
        "The ratio is part-to-part ($AD:DB$), not part-to-whole ($AD:AB$). Mixing the two is the usual error.",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-tri-002",
    chapter: "triangles",
    topics: ["areas-of-similar-triangles"],
    type: "MCQ",
    body: "If $\\triangle ABC \\sim \\triangle DEF$ and $AB : DE = 3 : 5$, then $\\text{ar}(\\triangle ABC) : \\text{ar}(\\triangle DEF)$ is:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 60,
    options: [
      { label: "A", body: "$3 : 5$" },
      { label: "B", body: "$5 : 3$" },
      { label: "C", body: "$9 : 25$", isCorrect: true },
      { label: "D", body: "$25 : 9$" },
    ],
    answer: {
      correctValue: "C",
      solution:
        "The areas of similar triangles are in the ratio of the **squares** of corresponding sides: $\\left(\\dfrac{3}{5}\\right)^2 = \\dfrac{9}{25}$.",
      explanation:
        "Sides scale linearly, areas scale as the square. Answering $3:5$ is the single most common mistake in this chapter.",
    },
    source: ADAPTED(2022, "8"),
  },
  {
    key: "bank-math-tri-003",
    chapter: "triangles",
    topics: ["pythagoras-theorem"],
    type: "LONG_ANSWER",
    body: "State and prove the Pythagoras Theorem: in a right triangle, the square on the hypotenuse equals the sum of the squares on the other two sides.",
    marks: 5,
    difficulty: "HARD",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 480,
    answer: {
      solution:
        "**Statement.** In a right triangle, the square of the hypotenuse equals the sum of the squares of the other two sides.\n\n**Proof.** Let $\\triangle ABC$ be right-angled at $B$. Draw $BD \\perp AC$.\n\nIn $\\triangle ADB$ and $\\triangle ABC$: $\\angle A$ is common and $\\angle ADB = \\angle ABC = 90°$, so $\\triangle ADB \\sim \\triangle ABC$ (AA).\n\nTherefore $\\dfrac{AD}{AB} = \\dfrac{AB}{AC}$, giving $AB^2 = AD \\cdot AC$. &nbsp;…(i)\n\nSimilarly $\\triangle BDC \\sim \\triangle ABC$, so $\\dfrac{CD}{BC} = \\dfrac{BC}{AC}$, giving $BC^2 = CD \\cdot AC$. &nbsp;…(ii)\n\nAdding (i) and (ii):\n$$AB^2 + BC^2 = AC(AD + CD) = AC \\cdot AC = AC^2$$\n\nHence $AC^2 = AB^2 + BC^2$. $\\blacksquare$",
      markingScheme: [
        { step: "States the theorem correctly", marks: 1 },
        { step: "Draws the perpendicular from the right angle to the hypotenuse", marks: 1 },
        { step: "Establishes the first similarity and AB² = AD·AC", marks: 1 },
        { step: "Establishes the second similarity and BC² = CD·AC", marks: 1 },
        { step: "Adds and uses AD + CD = AC to conclude", marks: 1 },
      ],
      explanation:
        "The construction *is* the proof. Without the perpendicular from the right angle there are no similar triangles to work with, so the first mark after the statement is for drawing it.",
    },
    source: ADAPTED(2020, "34"),
  },
  {
    key: "bank-math-tri-004",
    chapter: "triangles",
    topics: ["similarity-criteria"],
    type: "VERY_SHORT_ANSWER",
    body: "In $\\triangle ABC$ and $\\triangle PQR$, $\\dfrac{AB}{PQ} = \\dfrac{BC}{QR} = \\dfrac{CA}{RP}$. Name the similarity criterion that applies.",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 45,
    answer: {
      correctValue: "SSS",
      acceptedValues: ["SSS", "SSS similarity", "SSS criterion"],
      solution:
        "All three pairs of corresponding sides are in the same ratio, which is the **SSS similarity criterion**.",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-tri-005",
    chapter: "triangles",
    topics: ["pythagoras-theorem"],
    type: "SHORT_ANSWER",
    body: "A ladder $13$ m long reaches a window $12$ m above the ground on one side of a street. How far is the foot of the ladder from the wall?",
    marks: 2,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 150,
    answer: {
      solution:
        "The wall, the ground and the ladder form a right triangle with the ladder as hypotenuse.\n\n$$x^2 + 12^2 = 13^2 \\Rightarrow x^2 = 169 - 144 = 25 \\Rightarrow x = 5 \\text{ m}$$",
      markingScheme: [
        { step: "Sets up the right triangle with 13 as the hypotenuse", marks: 1 },
        { step: "Solves to 5 m", marks: 1 },
      ],
      explanation:
        "The ladder is always the hypotenuse — it is the longest of the three. Putting 13 on the wrong side of the equation gives $\\sqrt{313}$, which should look wrong immediately.",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-tri-006",
    chapter: "triangles",
    topics: ["areas-of-similar-triangles"],
    type: "ASSERTION_REASON",
    body: "**Assertion (A):** All congruent triangles are similar.\n\n**Reason (R):** All similar triangles are congruent.",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 90,
    options: arOptions("C"),
    answer: {
      correctValue: "C",
      solution:
        "(A) is true: congruent triangles have equal corresponding angles and sides in the ratio $1:1$, which satisfies similarity.\n\n(R) is false: similar triangles need only the *same shape*. A $3\\text{–}4\\text{–}5$ triangle and a $6\\text{–}8\\text{–}10$ triangle are similar and plainly not congruent.\n\nSo (A) is true and (R) is false.",
    },
    source: ORIGINAL,
  },

  // ══ 7. Coordinate Geometry ═══════════════════════════════════════════════
  {
    key: "bank-math-cg-001",
    chapter: "coordinate-geometry",
    topics: ["distance-formula"],
    type: "SHORT_ANSWER",
    body: "Find the distance between the points $A(2, -3)$ and $B(-6, 3)$.",
    marks: 2,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 150,
    answer: {
      solution:
        "$$AB = \\sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2} = \\sqrt{(-6-2)^2 + (3-(-3))^2}$$\n$$= \\sqrt{(-8)^2 + 6^2} = \\sqrt{64 + 36} = \\sqrt{100} = 10 \\text{ units}$$",
      markingScheme: [
        { step: "Applies the distance formula with correct substitution", marks: 1 },
        { step: "Simplifies to 10 units", marks: 1 },
      ],
      explanation:
        "$3 - (-3) = 6$, not $0$. Subtracting a negative is where this question is actually lost.",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-cg-002",
    chapter: "coordinate-geometry",
    topics: ["section-formula"],
    type: "SHORT_ANSWER",
    body: "Find the coordinates of the point which divides the line segment joining $A(-1, 7)$ and $B(4, -3)$ in the ratio $2 : 3$.",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 210,
    answer: {
      solution:
        "By the section formula with $m : n = 2 : 3$:\n\n$$x = \\frac{mx_2 + nx_1}{m + n} = \\frac{2(4) + 3(-1)}{5} = \\frac{8 - 3}{5} = 1$$\n\n$$y = \\frac{my_2 + ny_1}{m + n} = \\frac{2(-3) + 3(7)}{5} = \\frac{-6 + 21}{5} = 3$$\n\nThe point is $\\mathbf{(1, 3)}$.",
      markingScheme: [
        { step: "States the section formula correctly", marks: 1 },
        { step: "Substitutes and finds x = 1", marks: 1 },
        { step: "Finds y = 3 and states the point", marks: 1 },
      ],
      explanation:
        "The numerator pairs $m$ with the *second* point and $n$ with the first. Swapping them gives the point that divides in the ratio $3:2$ instead — a plausible-looking wrong answer.",
    },
    source: ADAPTED(2019, "17"),
  },
  {
    key: "bank-math-cg-003",
    chapter: "coordinate-geometry",
    topics: ["collinearity"],
    type: "MCQ",
    body: "The midpoint of the line segment joining $P(-2, 8)$ and $Q(6, -4)$ is:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 60,
    options: [
      { label: "A", body: "$(2, 2)$", isCorrect: true },
      { label: "B", body: "$(4, 4)$" },
      { label: "C", body: "$(2, -2)$" },
      { label: "D", body: "$(-4, 6)$" },
    ],
    answer: {
      correctValue: "A",
      solution:
        "$$\\left(\\frac{-2 + 6}{2}, \\frac{8 + (-4)}{2}\\right) = \\left(\\frac{4}{2}, \\frac{4}{2}\\right) = (2, 2)$$",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-cg-004",
    chapter: "coordinate-geometry",
    topics: ["distance-formula"],
    type: "SHORT_ANSWER",
    body: "Find the value of $y$ for which the distance between $P(2, -3)$ and $Q(10, y)$ is $10$ units.",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 240,
    answer: {
      solution:
        "$$\\sqrt{(10-2)^2 + (y+3)^2} = 10$$\n$$64 + (y+3)^2 = 100$$\n$$(y+3)^2 = 36 \\Rightarrow y + 3 = \\pm 6$$\n\nSo $y = 3$ or $y = -9$.",
      markingScheme: [
        { step: "Sets up the distance equation and squares both sides", marks: 1 },
        { step: "Reduces to (y+3)² = 36", marks: 1 },
        { step: "States both values, y = 3 and y = −9", marks: 1 },
      ],
      explanation:
        "Both roots are valid here — unlike a speed or a length, a coordinate may be negative, so nothing is rejected. Giving only $y = 3$ loses the last mark.",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-cg-005",
    chapter: "coordinate-geometry",
    topics: ["collinearity"],
    type: "VERY_SHORT_ANSWER",
    body: "Find the distance of the point $(-6, 8)$ from the origin.",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 60,
    answer: {
      correctValue: "10",
      acceptedValues: ["10", "10 units"],
      unit: "units",
      solution: "$\\sqrt{(-6)^2 + 8^2} = \\sqrt{36 + 64} = \\sqrt{100} = 10$ units.",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-cg-006",
    chapter: "coordinate-geometry",
    topics: ["section-formula"],
    type: "LONG_ANSWER",
    body: "The points $A(1, -2)$, $B(3, 6)$ and $C(5, 10)$ are three vertices of a parallelogram $ABCD$ taken in order. Find the coordinates of the fourth vertex $D$.",
    marks: 5,
    difficulty: "HARD",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 360,
    answer: {
      solution:
        "In a parallelogram the diagonals bisect each other, so the midpoint of $AC$ equals the midpoint of $BD$.\n\nMidpoint of $AC$: $\\left(\\dfrac{1+5}{2}, \\dfrac{-2+10}{2}\\right) = (3, 4)$.\n\nLet $D = (x, y)$. Midpoint of $BD$: $\\left(\\dfrac{3+x}{2}, \\dfrac{6+y}{2}\\right)$.\n\nEquating:\n$$\\frac{3+x}{2} = 3 \\Rightarrow x = 3$$\n$$\\frac{6+y}{2} = 4 \\Rightarrow y = 2$$\n\nSo $D = \\mathbf{(3, 2)}$.",
      markingScheme: [
        { step: "States that the diagonals of a parallelogram bisect each other", marks: 1 },
        { step: "Identifies AC and BD as the diagonals for vertices in order ABCD", marks: 1 },
        { step: "Finds the midpoint of AC as (3, 4)", marks: 1 },
        { step: "Sets up and solves the two equations", marks: 1 },
        { step: "States D = (3, 2)", marks: 1 },
      ],
      explanation:
        "'Taken in order' is doing real work in this question: it fixes $AC$ and $BD$ as the diagonals. Pairing $AB$ against $CD$ instead gives a different — and wrong — fourth vertex.",
    },
    source: ADAPTED(2018, "30"),
  },

  // ══ 8. Introduction to Trigonometry ══════════════════════════════════════
  {
    key: "bank-math-trig-001",
    chapter: "introduction-to-trigonometry",
    topics: ["trig-ratios-specific-angles"],
    type: "SHORT_ANSWER",
    body: "Evaluate: $\\;\\dfrac{\\sin 30° + \\tan 45° - \\csc 60°}{\\sec 30° + \\cos 60° + \\cot 45°}$",
    marks: 3,
    difficulty: "HARD",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 300,
    answer: {
      solution:
        "Substituting the standard values:\n\nNumerator $= \\dfrac{1}{2} + 1 - \\dfrac{2}{\\sqrt{3}} = \\dfrac{3}{2} - \\dfrac{2}{\\sqrt{3}} = \\dfrac{3\\sqrt{3} - 4}{2\\sqrt{3}}$\n\nDenominator $= \\dfrac{2}{\\sqrt{3}} + \\dfrac{1}{2} + 1 = \\dfrac{2}{\\sqrt{3}} + \\dfrac{3}{2} = \\dfrac{4 + 3\\sqrt{3}}{2\\sqrt{3}}$\n\nThe $2\\sqrt{3}$ cancels, leaving\n\n$$\\frac{3\\sqrt{3} - 4}{3\\sqrt{3} + 4}$$",
      markingScheme: [
        { step: "Substitutes all six standard values correctly", marks: 1 },
        { step: "Simplifies the numerator and denominator over a common denominator", marks: 1 },
        { step: "Cancels and states the final value", marks: 1 },
      ],
      explanation:
        "Working the numerator and denominator over the *same* common denominator is what makes this cancel cleanly. Rationalising each separately gets to the same place through far more algebra.",
    },
    source: ADAPTED(2020, "21"),
  },
  {
    key: "bank-math-trig-002",
    chapter: "introduction-to-trigonometry",
    topics: ["trigonometric-identities"],
    type: "SHORT_ANSWER",
    body: "Prove that $\\;(1 + \\cot\\theta - \\csc\\theta)(1 + \\tan\\theta + \\sec\\theta) = 2$.",
    marks: 3,
    difficulty: "HARD",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 300,
    answer: {
      solution:
        "Write everything in terms of $\\sin\\theta$ and $\\cos\\theta$. Let $s = \\sin\\theta$, $c = \\cos\\theta$.\n\nFirst bracket $= 1 + \\dfrac{c}{s} - \\dfrac{1}{s} = \\dfrac{s + c - 1}{s}$\n\nSecond bracket $= 1 + \\dfrac{s}{c} + \\dfrac{1}{c} = \\dfrac{c + s + 1}{c}$\n\nMultiplying:\n$$\\frac{(s + c - 1)(s + c + 1)}{sc} = \\frac{(s+c)^2 - 1}{sc}$$\n\nNow $(s+c)^2 = s^2 + 2sc + c^2 = 1 + 2sc$, so the numerator is $2sc$, and\n\n$$\\frac{2sc}{sc} = 2 \\quad \\blacksquare$$",
      markingScheme: [
        { step: "Converts both brackets to sine and cosine and combines each", marks: 1 },
        { step: "Recognises the difference-of-squares form (s+c−1)(s+c+1)", marks: 1 },
        { step: "Uses s² + c² = 1 to reach 2sc/sc = 2", marks: 1 },
      ],
      explanation:
        "The whole proof turns on grouping $(s + c)$ as a single quantity so the brackets become $(X-1)(X+1)$. Expanding term by term instead is six lines of algebra that usually goes wrong.",
    },
    source: ADAPTED(2019, "27"),
  },
  {
    key: "bank-math-trig-003",
    chapter: "introduction-to-trigonometry",
    topics: ["trigonometric-ratios"],
    type: "MCQ",
    body: "If $\\sin\\theta = \\dfrac{3}{5}$, then $\\tan\\theta$ equals:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 90,
    options: [
      { label: "A", body: "$\\dfrac{3}{4}$", isCorrect: true },
      { label: "B", body: "$\\dfrac{4}{3}$" },
      { label: "C", body: "$\\dfrac{4}{5}$" },
      { label: "D", body: "$\\dfrac{5}{3}$" },
    ],
    answer: {
      correctValue: "A",
      solution:
        "$\\sin\\theta = \\dfrac{\\text{opposite}}{\\text{hypotenuse}} = \\dfrac{3}{5}$, so by Pythagoras the adjacent side is $\\sqrt{25 - 9} = 4$.\n\nThen $\\tan\\theta = \\dfrac{\\text{opposite}}{\\text{adjacent}} = \\dfrac{3}{4}$.",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-trig-004",
    chapter: "introduction-to-trigonometry",
    topics: ["trigonometric-identities"],
    type: "VERY_SHORT_ANSWER",
    body: "Find the value of $\\;\\sin^2 43° + \\sin^2 47°$.",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 90,
    answer: {
      correctValue: "1",
      acceptedValues: ["1"],
      solution:
        "Since $43° + 47° = 90°$, $\\sin 47° = \\cos 43°$. So the expression is $\\sin^2 43° + \\cos^2 43° = 1$.",
      explanation:
        "Any pair of angles adding to $90°$ lets you convert one ratio into its co-ratio. Spotting the complementary pair is the entire question.",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-trig-005",
    chapter: "introduction-to-trigonometry",
    topics: ["trig-ratios-specific-angles"],
    type: "MCQ",
    body: "The value of $\\;2\\tan^2 45° + \\cos^2 30° - \\sin^2 60°$ is:",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 90,
    options: [
      { label: "A", body: "$0$" },
      { label: "B", body: "$1$" },
      { label: "C", body: "$2$", isCorrect: true },
      { label: "D", body: "$3$" },
    ],
    answer: {
      correctValue: "C",
      solution:
        "$\\tan 45° = 1$, and $\\cos 30° = \\sin 60° = \\dfrac{\\sqrt{3}}{2}$, so the last two terms cancel.\n\n$2(1)^2 + \\dfrac{3}{4} - \\dfrac{3}{4} = 2$.",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-trig-006",
    chapter: "introduction-to-trigonometry",
    topics: ["trigonometric-identities"],
    type: "ASSERTION_REASON",
    body: "**Assertion (A):** $\\sin\\theta$ can never be greater than $1$.\n\n**Reason (R):** In a right triangle the hypotenuse is always the longest side.",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 90,
    options: arOptions("A"),
    answer: {
      correctValue: "A",
      solution:
        "$\\sin\\theta$ is the opposite side over the hypotenuse. Since the hypotenuse is the longest side, that ratio cannot exceed $1$. Both statements are true and (R) explains (A).",
    },
    source: ORIGINAL,
  },

  // ══ 9. Some Applications of Trigonometry ═════════════════════════════════
  {
    key: "bank-math-aot-001",
    chapter: "applications-of-trigonometry",
    topics: ["heights-and-distances"],
    type: "SHORT_ANSWER",
    body: "The angle of elevation of the top of a tower from a point $30$ m away on level ground is $60°$. Find the height of the tower. (Take $\\sqrt{3} = 1.73$.)",
    marks: 3,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 210,
    answer: {
      solution:
        "Let the height be $h$. The tower, the ground and the line of sight form a right triangle with the $60°$ angle at the observation point.\n\n$$\\tan 60° = \\frac{h}{30} \\Rightarrow \\sqrt{3} = \\frac{h}{30}$$\n\n$$h = 30\\sqrt{3} = 30 \\times 1.73 = 51.9 \\text{ m}$$",
      markingScheme: [
        { step: "Draws or describes the right triangle correctly", marks: 1 },
        { step: "Uses tan 60° = h/30", marks: 1 },
        { step: "Evaluates to 51.9 m", marks: 1 },
      ],
      explanation:
        "Tangent is the ratio to reach for whenever the question gives a horizontal distance and asks for a height — no hypotenuse is involved either way.",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-aot-002",
    chapter: "applications-of-trigonometry",
    topics: ["angle-of-elevation-depression"],
    type: "LONG_ANSWER",
    body: "From the top of a $60$ m high building, the angles of depression of the top and the bottom of a tower are $30°$ and $60°$ respectively. Find the height of the tower. (Take $\\sqrt{3} = 1.73$.)",
    marks: 5,
    difficulty: "HARD",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 480,
    answer: {
      solution:
        "Let the building be $AB = 60$ m and the tower $CD = h$ m, with the horizontal distance between them $= d$.\n\n**Using the bottom of the tower** (depression $60°$), the full $60$ m drop is opposite $d$:\n$$\\tan 60° = \\frac{60}{d} \\Rightarrow d = \\frac{60}{\\sqrt{3}} = 20\\sqrt{3}$$\n\n**Using the top of the tower** (depression $30°$), the vertical drop is only $60 - h$:\n$$\\tan 30° = \\frac{60 - h}{d} \\Rightarrow \\frac{1}{\\sqrt{3}} = \\frac{60 - h}{20\\sqrt{3}}$$\n\n$$60 - h = \\frac{20\\sqrt{3}}{\\sqrt{3}} = 20 \\Rightarrow h = 40 \\text{ m}$$\n\nThe tower is **$40$ m** high.",
      markingScheme: [
        { step: "Draws the figure and marks both angles of depression correctly", marks: 1 },
        { step: "Uses the 60° angle with the full height to find d", marks: 1 },
        { step: "Recognises the second vertical drop is 60 − h, not 60", marks: 1 },
        { step: "Forms and solves the second equation", marks: 1 },
        { step: "States the height as 40 m", marks: 1 },
      ],
      explanation:
        "The mark that decides this question is the third: the line of sight to the *top* of the tower drops only as far as the top of the tower, so the opposite side is $60 - h$. Using $60$ for both angles is the standard error and gives a nonsense answer.",
    },
    source: ADAPTED(2019, "30"),
  },
  {
    key: "bank-math-aot-003",
    chapter: "applications-of-trigonometry",
    topics: ["heights-and-distances"],
    type: "MCQ",
    body: "A kite is flying at a height of $60$ m with the string making an angle of $60°$ with the ground. Assuming the string is straight, its length is:",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 90,
    options: [
      { label: "A", body: "$30\\sqrt{3}$ m" },
      { label: "B", body: "$40\\sqrt{3}$ m", isCorrect: true },
      { label: "C", body: "$60\\sqrt{3}$ m" },
      { label: "D", body: "$120$ m" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "The string is the hypotenuse, so use sine:\n\n$$\\sin 60° = \\frac{60}{L} \\Rightarrow \\frac{\\sqrt{3}}{2} = \\frac{60}{L} \\Rightarrow L = \\frac{120}{\\sqrt{3}} = 40\\sqrt{3} \\text{ m}$$",
      explanation:
        "The string is the *hypotenuse*, which is why this is a sine question and not a tangent one — that is the only decision in it.",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-aot-004",
    chapter: "applications-of-trigonometry",
    topics: ["angle-of-elevation-depression"],
    type: "VERY_SHORT_ANSWER",
    body: "The length of the shadow of a vertical pole equals its height. Find the sun's angle of elevation.",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 90,
    answer: {
      correctValue: "45",
      acceptedValues: ["45", "45°", "45 degrees"],
      unit: "degrees",
      solution:
        "$\\tan\\theta = \\dfrac{\\text{height}}{\\text{shadow}} = \\dfrac{h}{h} = 1$, so $\\theta = 45°$.",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-aot-005",
    chapter: "applications-of-trigonometry",
    topics: ["heights-and-distances"],
    type: "SHORT_ANSWER",
    body: "A ladder leaning against a wall makes an angle of $60°$ with the ground. If the foot of the ladder is $2.5$ m from the wall, find the length of the ladder.",
    marks: 2,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 150,
    answer: {
      solution:
        "The distance from the wall is the side adjacent to the $60°$ angle, and the ladder is the hypotenuse, so use cosine:\n\n$$\\cos 60° = \\frac{2.5}{L} \\Rightarrow \\frac{1}{2} = \\frac{2.5}{L} \\Rightarrow L = 5 \\text{ m}$$",
      markingScheme: [
        { step: "Identifies cosine as the correct ratio for adjacent and hypotenuse", marks: 1 },
        { step: "Solves to 5 m", marks: 1 },
      ],
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-aot-006",
    chapter: "applications-of-trigonometry",
    topics: ["angle-of-elevation-depression"],
    type: "ASSERTION_REASON",
    body: "**Assertion (A):** The angle of elevation of an object from a point equals the angle of depression of that point from the object.\n\n**Reason (R):** They are alternate interior angles between two parallel horizontal lines.",
    marks: 1,
    difficulty: "HARD",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 90,
    options: arOptions("A"),
    answer: {
      correctValue: "A",
      solution:
        "The two horizontal lines — one through the observer, one through the object — are parallel, and the line of sight is a transversal cutting them. The angle of elevation and the angle of depression are alternate interior angles, hence equal. Both statements are true and (R) explains (A).",
    },
    source: ORIGINAL,
  },

  // ══ 10. Circles ══════════════════════════════════════════════════════════
  {
    key: "bank-math-cir-001",
    chapter: "circles",
    topics: ["tangent-to-circle"],
    type: "MCQ",
    body: "A tangent $PQ$ at a point $P$ of a circle of radius $5$ cm meets a line through the centre $O$ at $Q$ such that $OQ = 13$ cm. The length $PQ$ is:",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 90,
    options: [
      { label: "A", body: "$8$ cm" },
      { label: "B", body: "$12$ cm", isCorrect: true },
      { label: "C", body: "$13$ cm" },
      { label: "D", body: "$18$ cm" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "The radius is perpendicular to the tangent at the point of contact, so $\\triangle OPQ$ is right-angled at $P$.\n\n$$PQ = \\sqrt{OQ^2 - OP^2} = \\sqrt{169 - 25} = \\sqrt{144} = 12 \\text{ cm}$$",
      explanation:
        "Every tangent question begins with the same fact: the radius meets the tangent at $90°$. Without it there is no right triangle and nothing to compute.",
    },
    source: ADAPTED(2020, "9"),
  },
  {
    key: "bank-math-cir-002",
    chapter: "circles",
    topics: ["tangent-length-theorem"],
    type: "LONG_ANSWER",
    body: "Prove that the lengths of the two tangents drawn from an external point to a circle are equal.",
    marks: 5,
    difficulty: "HARD",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 420,
    answer: {
      solution:
        "**Given.** A circle with centre $O$, an external point $P$, and tangents $PA$ and $PB$ touching at $A$ and $B$.\n\n**To prove.** $PA = PB$.\n\n**Construction.** Join $OA$, $OB$ and $OP$.\n\n**Proof.** A tangent is perpendicular to the radius at the point of contact, so $\\angle OAP = \\angle OBP = 90°$.\n\nIn right triangles $\\triangle OAP$ and $\\triangle OBP$:\n- $OA = OB$ (radii of the same circle)\n- $OP = OP$ (common hypotenuse)\n\nSo $\\triangle OAP \\cong \\triangle OBP$ by the RHS congruence criterion.\n\nHence $PA = PB$ by CPCT. $\\blacksquare$",
      markingScheme: [
        { step: "States the given, to prove and construction", marks: 1 },
        { step: "Uses the tangent–radius perpendicularity", marks: 1 },
        { step: "Identifies OA = OB and OP common", marks: 1 },
        { step: "Applies the RHS congruence criterion correctly", marks: 1 },
        { step: "Concludes PA = PB by CPCT", marks: 1 },
      ],
      explanation:
        "RHS is the criterion that applies here, and it applies *because* of the right angles established in the first step. Claiming SSS without knowing $PA = PB$ would assume what is being proved.",
    },
    source: ADAPTED(2018, "33"),
  },
  {
    key: "bank-math-cir-003",
    chapter: "circles",
    topics: ["number-of-tangents"],
    type: "VERY_SHORT_ANSWER",
    body: "How many tangents can be drawn to a circle from a point lying inside it?",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 45,
    answer: {
      correctValue: "0",
      acceptedValues: ["0", "zero", "none"],
      solution:
        "None. Every line through an interior point cuts the circle at two points, making it a secant rather than a tangent. From a point *on* the circle there is exactly one tangent, and from an external point there are two.",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-cir-004",
    chapter: "circles",
    topics: ["tangent-to-circle"],
    type: "SHORT_ANSWER",
    body: "Two concentric circles have radii $5$ cm and $3$ cm. Find the length of the chord of the larger circle which touches the smaller circle.",
    marks: 3,
    difficulty: "HARD",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 270,
    answer: {
      solution:
        "Let the common centre be $O$, the chord $AB$ of the larger circle touching the smaller at $P$.\n\n$OP = 3$ cm is a radius of the smaller circle drawn to the point of contact, so $OP \\perp AB$.\n\nA perpendicular from the centre bisects the chord, so $AP = PB$.\n\nIn right $\\triangle OPA$: $AP = \\sqrt{OA^2 - OP^2} = \\sqrt{25 - 9} = 4$ cm.\n\nSo $AB = 2 \\times 4 = \\mathbf{8}$ cm.",
      markingScheme: [
        { step: "Recognises OP ⊥ AB because AB is a tangent to the smaller circle", marks: 1 },
        { step: "Uses Pythagoras to find the half-chord as 4 cm", marks: 1 },
        { step: "Doubles it to give AB = 8 cm", marks: 1 },
      ],
      explanation:
        "Two facts combine here: the tangent–radius right angle, and 'a perpendicular from the centre bisects the chord'. Forgetting to double the $4$ cm at the end is the commonest way to lose the final mark.",
    },
    source: ADAPTED(2019, "24"),
  },
  {
    key: "bank-math-cir-005",
    chapter: "circles",
    topics: ["tangent-length-theorem"],
    type: "MCQ",
    body: "If two tangents drawn from an external point $P$ to a circle with centre $O$ are inclined to each other at $80°$, then $\\angle POA$, where $A$ is a point of contact, is:",
    marks: 1,
    difficulty: "HARD",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 120,
    options: [
      { label: "A", body: "$40°$" },
      { label: "B", body: "$50°$", isCorrect: true },
      { label: "C", body: "$80°$" },
      { label: "D", body: "$100°$" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "$OP$ bisects the angle between the tangents, so $\\angle OPA = 40°$.\n\nIn $\\triangle OAP$, $\\angle OAP = 90°$ (radius ⟂ tangent), so\n\n$$\\angle POA = 180° - 90° - 40° = 50°$$",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-cir-006",
    chapter: "circles",
    topics: ["number-of-tangents"],
    type: "ASSERTION_REASON",
    body: "**Assertion (A):** A line drawn parallel to a tangent, at a distance equal to the diameter from it, is also a tangent to the same circle.\n\n**Reason (R):** A circle has exactly two parallel tangents in any given direction.",
    marks: 1,
    difficulty: "HARD",
    bloomLevel: "EVALUATE",
    expectedTimeSeconds: 120,
    options: arOptions("A"),
    answer: {
      correctValue: "A",
      solution:
        "The two tangents parallel to a given direction touch the circle at opposite ends of the diameter perpendicular to that direction, and are therefore exactly one diameter apart. So (A) is true, (R) is true, and (R) is the reason (A) holds.",
    },
    source: ORIGINAL,
  },

  // ══ 11. Areas Related to Circles ═════════════════════════════════════════
  {
    key: "bank-math-arc-001",
    chapter: "areas-related-to-circles",
    topics: ["area-of-sector"],
    type: "SHORT_ANSWER",
    body: "Find the area of a sector of a circle of radius $21$ cm with a central angle of $60°$. (Take $\\pi = \\dfrac{22}{7}$.)",
    marks: 2,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 150,
    answer: {
      solution:
        "$$\\text{Area} = \\frac{\\theta}{360°} \\times \\pi r^2 = \\frac{60}{360} \\times \\frac{22}{7} \\times 21 \\times 21$$\n\n$$= \\frac{1}{6} \\times 22 \\times 3 \\times 21 = \\frac{1386}{6} = 231 \\text{ cm}^2$$",
      markingScheme: [
        { step: "Writes the sector area formula with correct substitution", marks: 1 },
        { step: "Evaluates to 231 cm²", marks: 1 },
      ],
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-arc-002",
    chapter: "areas-related-to-circles",
    topics: ["area-of-segment"],
    type: "LONG_ANSWER",
    body: "A chord of a circle of radius $10$ cm subtends a right angle at the centre. Find the area of the corresponding minor segment. (Take $\\pi = 3.14$.)",
    marks: 5,
    difficulty: "HARD",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 420,
    answer: {
      solution:
        "**Area of the sector** ($\\theta = 90°$):\n$$\\frac{90}{360} \\times 3.14 \\times 10^2 = \\frac{1}{4} \\times 314 = 78.5 \\text{ cm}^2$$\n\n**Area of the triangle** formed by the two radii and the chord. It is right-angled at the centre with both legs equal to the radius:\n$$\\frac{1}{2} \\times 10 \\times 10 = 50 \\text{ cm}^2$$\n\n**Area of the minor segment** $=$ sector $-$ triangle:\n$$78.5 - 50 = 28.5 \\text{ cm}^2$$",
      markingScheme: [
        { step: "Computes the sector area as 78.5 cm²", marks: 1 },
        { step: "Recognises the triangle is right-angled at the centre", marks: 1 },
        { step: "Computes the triangle area as 50 cm²", marks: 1 },
        { step: "Subtracts to find the segment area", marks: 1 },
        { step: "States the answer as 28.5 cm² with the unit", marks: 1 },
      ],
      explanation:
        "Segment $=$ sector $-$ triangle for the *minor* segment. For the major segment it is the whole circle minus the minor segment, which is a different subtraction and a common mix-up.",
    },
    source: ADAPTED(2020, "31"),
  },
  {
    key: "bank-math-arc-003",
    chapter: "areas-related-to-circles",
    topics: ["area-of-sector"],
    type: "MCQ",
    body: "The area of a quadrant of a circle of radius $14$ cm is: (Take $\\pi = \\dfrac{22}{7}$.)",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 90,
    options: [
      { label: "A", body: "$77$ cm²" },
      { label: "B", body: "$154$ cm²", isCorrect: true },
      { label: "C", body: "$308$ cm²" },
      { label: "D", body: "$616$ cm²" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "A quadrant is a quarter of the circle:\n\n$$\\frac{1}{4} \\times \\frac{22}{7} \\times 14 \\times 14 = \\frac{1}{4} \\times 616 = 154 \\text{ cm}^2$$",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-arc-004",
    chapter: "areas-related-to-circles",
    topics: ["combination-of-figures"],
    type: "SHORT_ANSWER",
    body: "A circular park of radius $14$ m has a $2$ m wide path running around it on the outside. Find the area of the path. (Take $\\pi = \\dfrac{22}{7}$.)",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 240,
    answer: {
      solution:
        "The path is the region between two concentric circles of radii $14$ m and $16$ m.\n\n$$\\text{Area} = \\pi(R^2 - r^2) = \\frac{22}{7}(16^2 - 14^2) = \\frac{22}{7}(256 - 196) = \\frac{22}{7} \\times 60$$\n\n$$= \\frac{1320}{7} \\approx 188.57 \\text{ m}^2$$",
      markingScheme: [
        { step: "Identifies the outer radius as 16 m", marks: 1 },
        { step: "Uses π(R² − r²) rather than π(R − r)²", marks: 1 },
        { step: "Evaluates to about 188.57 m²", marks: 1 },
      ],
      explanation:
        "$\\pi(R^2 - r^2)$ and $\\pi(R - r)^2$ are different quantities, and the second is not the area of anything here. That substitution is the classic error in ring problems.",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-arc-005",
    chapter: "areas-related-to-circles",
    topics: ["area-of-sector"],
    type: "VERY_SHORT_ANSWER",
    body: "Find the length of the arc of a sector of a circle of radius $7$ cm with a central angle of $90°$. (Take $\\pi = \\dfrac{22}{7}$.)",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 90,
    answer: {
      correctValue: "11",
      acceptedValues: ["11", "11 cm"],
      unit: "cm",
      solution:
        "$$\\text{Arc} = \\frac{\\theta}{360°} \\times 2\\pi r = \\frac{90}{360} \\times 2 \\times \\frac{22}{7} \\times 7 = \\frac{1}{4} \\times 44 = 11 \\text{ cm}$$",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-arc-006",
    chapter: "areas-related-to-circles",
    topics: ["combination-of-figures"],
    type: "SHORT_ANSWER",
    body: "A square of side $14$ cm has a circle inscribed in it. Find the area of the region inside the square but outside the circle. (Take $\\pi = \\dfrac{22}{7}$.)",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 240,
    answer: {
      solution:
        "The inscribed circle has diameter equal to the side of the square, so its radius is $7$ cm.\n\nArea of the square $= 14^2 = 196$ cm².\n\nArea of the circle $= \\dfrac{22}{7} \\times 7^2 = 154$ cm².\n\nShaded area $= 196 - 154 = \\mathbf{42}$ cm².",
      markingScheme: [
        { step: "Deduces the radius is 7 cm from the inscribed condition", marks: 1 },
        { step: "Computes both areas correctly", marks: 1 },
        { step: "Subtracts to give 42 cm²", marks: 1 },
      ],
      explanation:
        "Inscribed means the circle touches all four sides, so its *diameter* — not its radius — equals the side. Taking $r = 14$ is the standard slip.",
    },
    source: ORIGINAL,
  },

  // ══ 12. Surface Areas and Volumes ════════════════════════════════════════
  {
    key: "bank-math-sav-001",
    chapter: "surface-areas-and-volumes",
    topics: ["conversion-of-solids"],
    type: "SHORT_ANSWER",
    body: "A solid metallic sphere of radius $6$ cm is melted and recast into small spheres of radius $2$ cm each. How many small spheres are obtained?",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 240,
    answer: {
      solution:
        "Melting conserves volume, so\n\n$$n = \\frac{\\text{volume of the large sphere}}{\\text{volume of one small sphere}} = \\frac{\\frac{4}{3}\\pi (6)^3}{\\frac{4}{3}\\pi (2)^3} = \\frac{216}{8} = 27$$\n\n**$27$ small spheres.**",
      markingScheme: [
        { step: "States that the total volume is conserved on recasting", marks: 1 },
        { step: "Sets up the ratio of the two volumes", marks: 1 },
        { step: "Simplifies to 27", marks: 1 },
      ],
      explanation:
        "The $\\frac{4}{3}\\pi$ cancels, so the answer is just the cube of the radius ratio: $(6/2)^3 = 27$. Recognising that saves the arithmetic entirely.",
    },
    source: ADAPTED(2019, "23"),
  },
  {
    key: "bank-math-sav-002",
    chapter: "surface-areas-and-volumes",
    topics: ["combination-of-solids"],
    type: "LONG_ANSWER",
    body: "A toy is in the form of a cone of radius $3.5$ cm mounted on a hemisphere of the same radius. The total height of the toy is $15.5$ cm. Find the total surface area of the toy. (Take $\\pi = \\dfrac{22}{7}$.)",
    marks: 5,
    difficulty: "HARD",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 480,
    answer: {
      solution:
        "The hemisphere contributes $r = 3.5$ cm of the total height, so the cone's height is\n$$h = 15.5 - 3.5 = 12 \\text{ cm}$$\n\n**Slant height of the cone:**\n$$l = \\sqrt{r^2 + h^2} = \\sqrt{3.5^2 + 12^2} = \\sqrt{12.25 + 144} = \\sqrt{156.25} = 12.5 \\text{ cm}$$\n\n**Curved surface of the cone:**\n$$\\pi r l = \\frac{22}{7} \\times 3.5 \\times 12.5 = 137.5 \\text{ cm}^2$$\n\n**Curved surface of the hemisphere:**\n$$2\\pi r^2 = 2 \\times \\frac{22}{7} \\times 3.5 \\times 3.5 = 77 \\text{ cm}^2$$\n\n**Total surface area** $= 137.5 + 77 = \\mathbf{214.5}$ cm².",
      markingScheme: [
        { step: "Deduces the cone's height as 12 cm by subtracting the radius", marks: 1 },
        { step: "Computes the slant height as 12.5 cm", marks: 1 },
        { step: "Computes the cone's curved surface area", marks: 1 },
        { step: "Computes the hemisphere's curved surface area as 2πr²", marks: 1 },
        { step: "Adds and states 214.5 cm²", marks: 1 },
      ],
      explanation:
        "Two traps, and both cost a mark each. The cone's height is *not* $15.5$ — the hemisphere takes up its own radius. And no flat circular base is counted anywhere: the cone's base is glued to the hemisphere and is not a surface of the toy.",
    },
    source: ADAPTED(2018, "32"),
  },
  {
    key: "bank-math-sav-003",
    chapter: "surface-areas-and-volumes",
    topics: ["volume-of-combination"],
    type: "MCQ",
    body: "The volumes of two spheres are in the ratio $64 : 27$. The ratio of their radii is:",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 90,
    options: [
      { label: "A", body: "$8 : 3$" },
      { label: "B", body: "$4 : 3$", isCorrect: true },
      { label: "C", body: "$16 : 9$" },
      { label: "D", body: "$64 : 27$" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "Volume scales as the cube of the radius, so $\\left(\\dfrac{r_1}{r_2}\\right)^3 = \\dfrac{64}{27}$, giving $\\dfrac{r_1}{r_2} = \\dfrac{4}{3}$.",
      explanation:
        "Lengths scale linearly, areas as the square, volumes as the cube. Going from a volume ratio back to a length ratio means taking a cube root — halving the exponent, as for areas, gives $16:9$ and is the trap answer.",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-sav-004",
    chapter: "surface-areas-and-volumes",
    topics: ["conversion-of-solids"],
    type: "SHORT_ANSWER",
    body: "A cylindrical vessel of radius $6$ cm contains water to a height of $10$ cm. A solid cone of radius $3$ cm and height $8$ cm is fully immersed in it. By how much does the water level rise?",
    marks: 3,
    difficulty: "HARD",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 270,
    answer: {
      solution:
        "The water rises by the volume the cone displaces.\n\nVolume of the cone $= \\dfrac{1}{3}\\pi r^2 h = \\dfrac{1}{3}\\pi (3)^2 (8) = 24\\pi$ cm³.\n\nIf the level rises by $x$ cm, the extra water occupies a cylinder of radius $6$ cm:\n$$\\pi (6)^2 x = 24\\pi \\Rightarrow 36x = 24 \\Rightarrow x = \\frac{2}{3} \\text{ cm}$$\n\nThe level rises by $\\mathbf{\\frac{2}{3}}$ cm, about $0.67$ cm.",
      markingScheme: [
        { step: "Computes the cone's volume as 24π cm³", marks: 1 },
        { step: "Equates it to the volume of the risen cylinder of water", marks: 1 },
        { step: "Solves to x = 2/3 cm", marks: 1 },
      ],
      explanation:
        "The rise happens in a cylinder of the *vessel's* radius, not the cone's. Using $r = 3$ for the risen water is the error this question is built around.",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-sav-005",
    chapter: "surface-areas-and-volumes",
    topics: ["combination-of-solids"],
    type: "VERY_SHORT_ANSWER",
    body: "Two cubes each of volume $64$ cm³ are joined end to end. Find the length of the resulting cuboid.",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 90,
    answer: {
      correctValue: "8",
      acceptedValues: ["8", "8 cm"],
      unit: "cm",
      solution:
        "Each cube has edge $\\sqrt[3]{64} = 4$ cm. Joined end to end, the length becomes $4 + 4 = 8$ cm (with breadth and height still $4$ cm).",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-sav-006",
    chapter: "surface-areas-and-volumes",
    topics: ["volume-of-combination"],
    type: "ASSERTION_REASON",
    body: "**Assertion (A):** When a solid is melted and recast into another shape, its volume stays the same but its surface area generally changes.\n\n**Reason (R):** Melting and recasting conserves the amount of material.",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 90,
    options: arOptions("A"),
    answer: {
      correctValue: "A",
      solution:
        "The material is conserved, so the volume is unchanged. Surface area depends on shape as well as amount, so it is generally different — a sphere recast as twenty-seven small spheres has three times the surface area. Both statements are true and (R) explains (A).",
    },
    source: ORIGINAL,
  },

  // ══ 13. Statistics ═══════════════════════════════════════════════════════
  {
    key: "bank-math-stat-001",
    chapter: "statistics",
    topics: ["mean-grouped-data"],
    type: "LONG_ANSWER",
    body: "Find the mean of the following distribution by the direct method.\n\n| Class interval | 0–10 | 10–20 | 20–30 | 30–40 | 40–50 |\n| --- | --- | --- | --- | --- | --- |\n| Frequency | 5 | 8 | 15 | 9 | 3 |",
    marks: 5,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 420,
    answer: {
      solution:
        "Take the class mark $x_i$ as the midpoint of each interval.\n\n| Class | $f_i$ | $x_i$ | $f_i x_i$ |\n| --- | --- | --- | --- |\n| 0–10 | 5 | 5 | 25 |\n| 10–20 | 8 | 15 | 120 |\n| 20–30 | 15 | 25 | 375 |\n| 30–40 | 9 | 35 | 315 |\n| 40–50 | 3 | 45 | 135 |\n| **Total** | **40** | | **970** |\n\n$$\\bar{x} = \\frac{\\sum f_i x_i}{\\sum f_i} = \\frac{970}{40} = 24.25$$",
      markingScheme: [
        { step: "Computes all five class marks correctly", marks: 1 },
        { step: "Computes the fᵢxᵢ column", marks: 2 },
        { step: "Finds Σfᵢ = 40 and Σfᵢxᵢ = 970", marks: 1 },
        { step: "Divides to give the mean 24.25", marks: 1 },
      ],
      explanation:
        "The class mark is the midpoint — $\\frac{0+10}{2} = 5$ — not the upper limit. Using the limits is the error that makes an otherwise perfect table wrong.",
    },
    source: ADAPTED(2020, "28"),
  },
  {
    key: "bank-math-stat-002",
    chapter: "statistics",
    topics: ["mode-grouped-data"],
    type: "SHORT_ANSWER",
    body: "Find the mode of the following data.\n\n| Class | 0–20 | 20–40 | 40–60 | 60–80 | 80–100 |\n| --- | --- | --- | --- | --- | --- |\n| Frequency | 10 | 35 | 52 | 61 | 38 |",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 270,
    answer: {
      solution:
        "The modal class is the one with the highest frequency: $60\\text{–}80$, with $f_1 = 61$.\n\nHere $l = 60$, $f_0 = 52$, $f_2 = 38$, $h = 20$.\n\n$$\\text{Mode} = l + \\left(\\frac{f_1 - f_0}{2f_1 - f_0 - f_2}\\right) \\times h = 60 + \\left(\\frac{61 - 52}{122 - 52 - 38}\\right) \\times 20$$\n\n$$= 60 + \\frac{9}{32} \\times 20 = 60 + 5.625 = 65.625$$",
      markingScheme: [
        { step: "Identifies 60–80 as the modal class", marks: 1 },
        { step: "Substitutes correctly into the mode formula", marks: 1 },
        { step: "Evaluates to about 65.63", marks: 1 },
      ],
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-stat-003",
    chapter: "statistics",
    topics: ["median-grouped-data"],
    type: "MCQ",
    body: "For a moderately skewed distribution, the empirical relationship between the three measures of central tendency is:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 60,
    options: [
      { label: "A", body: "Mode $= 3\\,$Median $- 2\\,$Mean", isCorrect: true },
      { label: "B", body: "Mode $= 2\\,$Median $- 3\\,$Mean" },
      { label: "C", body: "Mean $= 3\\,$Median $- 2\\,$Mode" },
      { label: "D", body: "Median $= 3\\,$Mode $- 2\\,$Mean" },
    ],
    answer: {
      correctValue: "A",
      solution:
        "The empirical relation is $3\\,\\text{Median} = \\text{Mode} + 2\\,\\text{Mean}$, which rearranges to $\\text{Mode} = 3\\,\\text{Median} - 2\\,\\text{Mean}$.",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-stat-004",
    chapter: "statistics",
    topics: ["median-grouped-data"],
    type: "SHORT_ANSWER",
    body: "The median of the following data is $28.5$ and the total frequency is $60$. Find the missing frequencies $x$ and $y$.\n\n| Class | 0–10 | 10–20 | 20–30 | 30–40 | 40–50 | 50–60 |\n| --- | --- | --- | --- | --- | --- | --- |\n| Frequency | 5 | $x$ | 20 | 15 | $y$ | 5 |",
    marks: 3,
    difficulty: "HARD",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 330,
    answer: {
      solution:
        "From the total: $5 + x + 20 + 15 + y + 5 = 60$, so $x + y = 15$. &nbsp;…(i)\n\nThe median $28.5$ lies in $20\\text{–}30$, so $l = 20$, $h = 10$, $f = 20$, and the cumulative frequency before it is $cf = 5 + x$.\n\n$$28.5 = 20 + \\left(\\frac{30 - (5 + x)}{20}\\right) \\times 10$$\n\n$$8.5 = \\frac{25 - x}{2} \\Rightarrow 17 = 25 - x \\Rightarrow x = 8$$\n\nFrom (i), $y = 7$.",
      markingScheme: [
        { step: "Forms x + y = 15 from the total frequency", marks: 1 },
        { step: "Substitutes into the median formula with cf = 5 + x", marks: 1 },
        { step: "Solves to x = 8 and y = 7", marks: 1 },
      ],
      explanation:
        "$cf$ is the cumulative frequency of the class *before* the median class, which here includes the unknown $x$. That is what makes the median formula yield an equation rather than a number.",
    },
    source: ADAPTED(2019, "28"),
  },
  {
    key: "bank-math-stat-005",
    chapter: "statistics",
    topics: ["mean-grouped-data"],
    type: "VERY_SHORT_ANSWER",
    body: "Find the class mark of the interval $25\\text{–}35$.",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 45,
    answer: {
      correctValue: "30",
      acceptedValues: ["30"],
      solution:
        "Class mark $= \\dfrac{\\text{lower limit} + \\text{upper limit}}{2} = \\dfrac{25 + 35}{2} = 30$.",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-stat-006",
    chapter: "statistics",
    topics: ["median-grouped-data"],
    type: "MCQ",
    body: "While computing the median of grouped data, the abscissa of the point where the 'less than' and 'more than' ogives intersect gives the:",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 60,
    options: [
      { label: "A", body: "Mean" },
      { label: "B", body: "Median", isCorrect: true },
      { label: "C", body: "Mode" },
      { label: "D", body: "Range" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "The two ogives cross where exactly half the observations lie on each side — which is the definition of the median. Its value is the $x$-coordinate of that intersection.",
    },
    source: ORIGINAL,
  },

  // ══ 14. Probability ══════════════════════════════════════════════════════
  {
    key: "bank-math-prob-001",
    chapter: "probability",
    topics: ["probability-cards-dice"],
    type: "SHORT_ANSWER",
    body: "One card is drawn at random from a well-shuffled deck of $52$ playing cards. Find the probability that the card drawn is (i) a king, (ii) a red face card.",
    marks: 2,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 180,
    answer: {
      solution:
        "**(i)** There are $4$ kings, so $P(\\text{king}) = \\dfrac{4}{52} = \\dfrac{1}{13}$.\n\n**(ii)** Face cards are the jack, queen and king. Red suits are hearts and diamonds, giving $3 \\times 2 = 6$ red face cards, so $P = \\dfrac{6}{52} = \\dfrac{3}{26}$.",
      markingScheme: [
        { step: "P(king) = 1/13", marks: 1 },
        { step: "Counts 6 red face cards and gives 3/26", marks: 1 },
      ],
      explanation:
        "The ace is not a face card in CBSE's convention — only the jack, queen and king are. Counting it gives $8$ red 'face' cards and the wrong answer.",
    },
    source: ADAPTED(2020, "13"),
  },
  {
    key: "bank-math-prob-002",
    chapter: "probability",
    topics: ["theoretical-probability"],
    type: "SHORT_ANSWER",
    body: "Two dice are thrown together. Find the probability that the sum of the numbers appearing is $8$.",
    marks: 2,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 180,
    answer: {
      solution:
        "The sample space has $6 \\times 6 = 36$ equally likely outcomes.\n\nThe pairs summing to $8$ are $(2,6), (3,5), (4,4), (5,3), (6,2)$ — five of them.\n\n$$P = \\frac{5}{36}$$",
      markingScheme: [
        { step: "States the sample space has 36 outcomes", marks: 1 },
        { step: "Lists the 5 favourable outcomes and gives 5/36", marks: 1 },
      ],
      explanation:
        "$(2,6)$ and $(6,2)$ are different outcomes — the dice are distinguishable even when they look identical. Treating them as one gives $3/21$ and is wrong.",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-prob-003",
    chapter: "probability",
    topics: ["complementary-events"],
    type: "MCQ",
    body: "If the probability that it will rain tomorrow is $0.85$, then the probability that it will not rain tomorrow is:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 45,
    options: [
      { label: "A", body: "$0.15$", isCorrect: true },
      { label: "B", body: "$0.85$" },
      { label: "C", body: "$1.85$" },
      { label: "D", body: "$0.5$" },
    ],
    answer: {
      correctValue: "A",
      solution: "For complementary events, $P(\\text{not } E) = 1 - P(E) = 1 - 0.85 = 0.15$.",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-prob-004",
    chapter: "probability",
    topics: ["theoretical-probability"],
    type: "LONG_ANSWER",
    body: "A bag contains $5$ red balls, $8$ white balls and $7$ green balls. One ball is drawn at random. Find the probability that it is (i) red, (ii) not green, (iii) either red or white, (iv) neither red nor white.",
    marks: 5,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 360,
    answer: {
      solution:
        "The total number of balls is $5 + 8 + 7 = 20$.\n\n**(i)** $P(\\text{red}) = \\dfrac{5}{20} = \\dfrac{1}{4}$\n\n**(ii)** $P(\\text{not green}) = 1 - \\dfrac{7}{20} = \\dfrac{13}{20}$\n\n**(iii)** $P(\\text{red or white}) = \\dfrac{5 + 8}{20} = \\dfrac{13}{20}$\n\n**(iv)** Neither red nor white means green: $P = \\dfrac{7}{20}$",
      markingScheme: [
        { step: "Finds the total of 20 balls", marks: 1 },
        { step: "P(red) = 1/4", marks: 1 },
        { step: "P(not green) = 13/20", marks: 1 },
        { step: "P(red or white) = 13/20", marks: 1 },
        { step: "P(neither red nor white) = 7/20", marks: 1 },
      ],
      explanation:
        "Parts (ii) and (iii) come out equal, and that is not a coincidence: with only three colours, 'not green' and 'red or white' describe exactly the same set of balls.",
    },
    source: ADAPTED(2018, "26"),
  },
  {
    key: "bank-math-prob-005",
    chapter: "probability",
    topics: ["theoretical-probability"],
    type: "VERY_SHORT_ANSWER",
    body: "What is the probability of an event that is certain to happen?",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 30,
    answer: {
      correctValue: "1",
      acceptedValues: ["1", "one"],
      solution:
        "A certain event has probability $1$. An impossible event has probability $0$, and every other probability lies between them.",
    },
    source: ORIGINAL,
  },
  {
    key: "bank-math-prob-006",
    chapter: "probability",
    topics: ["complementary-events"],
    type: "ASSERTION_REASON",
    body: "**Assertion (A):** The probability of an event can be $\\dfrac{5}{4}$.\n\n**Reason (R):** The probability of any event $E$ satisfies $0 \\leq P(E) \\leq 1$.",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 60,
    options: arOptions("D"),
    answer: {
      correctValue: "D",
      solution:
        "(A) is false: $\\dfrac{5}{4} > 1$, and no probability can exceed $1$. (R) is the true statement that rules it out. So (A) is false and (R) is true.",
    },
    source: ORIGINAL,
  },
];
