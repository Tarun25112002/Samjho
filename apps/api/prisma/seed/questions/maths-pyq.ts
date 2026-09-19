import type { SeedQuestion } from "../types.js";

/**
 * Class 10 Mathematics, written to the pattern of each past sitting.
 *
 * ## What these are, and what they are emphatically not
 *
 * Every question here is **original**. None is reproduced, paraphrased or
 * reconstructed from a CBSE paper. What each one borrows is the *shape* of the
 * sitting it is filed under — the chapter mix, the mark weighting, the kind of
 * reasoning that year's paper asked for — which is public knowledge about the
 * syllabus rather than anybody's copyright.
 *
 * That is the sourcing model docs/07 Q6 settled on and R2 requires: adapted and
 * attributed by default, never verbatim. The commercial intent (Q3) is exactly
 * what makes the distinction load-bearing — reproducing board questions in a
 * paid product is a materially different risk from doing it in a portfolio.
 *
 * ## Why there is no `originalQuestionNumber`
 *
 * Because there is no original question. `ADAPTED(2023, "7")` in the sibling
 * files means "this began as question 7 of that paper"; these did not begin as
 * anything, and filling that field would be inventing provenance in the one
 * place the schema exists to keep honest. The attribution text says so in
 * words, so a student reading it is told the truth rather than implied a
 * pedigree.
 *
 * ## Why they carry a year at all
 *
 * So the previous-year filters have something real to filter. A student
 * revising "the kind of thing 2024 asked" gets a set built to that pattern, and
 * the attribution on every question tells them plainly that it is a rehearsal
 * of the pattern rather than the paper itself.
 *
 * 2021 is absent on purpose: CBSE cancelled the Class 10 boards that year, and
 * a paper written to the pattern of a sitting that never happened would be a
 * fiction about a fiction.
 */

const PATTERN = (year: number, examSession: string) =>
  ({
    sourceType: "ADAPTED",
    year,
    examSession,
    licenceStatus: "CLEARED",
    attributionText: `Original question written to the CBSE Class 10 Mathematics ${String(year)} (${examSession}) pattern. Not reproduced from any past paper.`,
  }) as const;

export const class10MathsPastPaperQuestions: SeedQuestion[] = [
  // ── 2010 ──────────────────────────────────────────────────────────────────
  {
    key: "math-pyq-2010-01",
    chapter: "real-numbers",
    topics: ["hcf-lcm"],
    type: "MCQ",
    body: "If $\\text{HCF}(12,\\ 30) = 6$, then $\\text{LCM}(12,\\ 30)$ is:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 60,
    options: [
      { label: "A", body: "$30$" },
      { label: "B", body: "$60$", isCorrect: true },
      { label: "C", body: "$120$" },
      { label: "D", body: "$360$" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "For any two positive integers, $\\text{HCF} \\times \\text{LCM} = $ product of the numbers. So $6 \\times \\text{LCM} = 12 \\times 30 = 360$, giving $\\text{LCM} = 60$.",
      explanation:
        "$360$ is the trap: it is the product of the two numbers, not the LCM. The product has to be divided by the HCF.",
      hint: "There is a relation between the HCF, the LCM and the product of the two numbers. Write it down before substituting.",
    },
    source: PATTERN(2010, "Annual"),
  },
  {
    key: "math-pyq-2010-02",
    chapter: "quadratic-equations",
    topics: ["quadratic-by-factorisation"],
    type: "MCQ",
    body: "The roots of the quadratic equation $x^2 - 3x - 10 = 0$ are:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 60,
    options: [
      { label: "A", body: "$2,\\ -5$" },
      { label: "B", body: "$5,\\ -2$", isCorrect: true },
      { label: "C", body: "$-5,\\ -2$" },
      { label: "D", body: "$5,\\ 2$" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "Split the middle term: $x^2 - 5x + 2x - 10 = 0$, so $x(x-5) + 2(x-5) = 0$ and $(x-5)(x+2) = 0$. Hence $x = 5$ or $x = -2$.",
      hint: "Find two numbers whose product is $-10$ and whose sum is $-3$. Check the signs against the equation before you commit to them.",
    },
    source: PATTERN(2010, "Annual"),
  },
  {
    key: "math-pyq-2010-03",
    chapter: "introduction-to-trigonometry",
    topics: ["trig-ratios-specific-angles"],
    type: "NUMERICAL",
    body: "Evaluate: $\\sin 30^\\circ + \\cos 60^\\circ$.",
    marks: 2,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 90,
    answer: {
      correctValue: "1",
      acceptedValues: ["1", "1.0"],
      solution:
        "$\\sin 30^\\circ = \\dfrac{1}{2}$ and $\\cos 60^\\circ = \\dfrac{1}{2}$, so the sum is $\\dfrac{1}{2} + \\dfrac{1}{2} = 1$.",
      markingScheme: [
        { step: "Correct values of both ratios", marks: 1 },
        { step: "Correct sum", marks: 1 },
      ],
      hint: "Both of these are standard-angle values you are expected to know. Write the table out if you are unsure rather than guessing one of them.",
    },
    source: PATTERN(2010, "Annual"),
  },

  // ── 2011 ──────────────────────────────────────────────────────────────────
  {
    key: "math-pyq-2011-01",
    chapter: "polynomials",
    topics: ["zeroes-coefficients-relation"],
    type: "MCQ",
    body: "If $\\alpha$ and $\\beta$ are the zeroes of $3x^2 - 5x + 2$, then $\\alpha\\beta$ equals:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 60,
    options: [
      { label: "A", body: "$\\dfrac{5}{3}$" },
      { label: "B", body: "$\\dfrac{2}{3}$", isCorrect: true },
      { label: "C", body: "$-\\dfrac{2}{3}$" },
      { label: "D", body: "$\\dfrac{3}{2}$" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "For $ax^2 + bx + c$, the product of the zeroes is $\\dfrac{c}{a}$. Here $a = 3$ and $c = 2$, so $\\alpha\\beta = \\dfrac{2}{3}$.",
      explanation:
        "$\\dfrac{5}{3}$ is the *sum* of the zeroes, $-\\dfrac{b}{a}$. Reading the wrong one of the two relations is the usual slip here.",
      hint: "There are two relations between zeroes and coefficients — one for the sum and one for the product. Make sure you are using the one the question asks for.",
    },
    source: PATTERN(2011, "Annual"),
  },
  {
    key: "math-pyq-2011-02",
    chapter: "arithmetic-progressions",
    topics: ["ap-nth-term"],
    type: "NUMERICAL",
    body: "Find the $10^{\\text{th}}$ term of the AP: $2,\\ 7,\\ 12,\\ 17,\\ \\dots$",
    marks: 2,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 90,
    answer: {
      correctValue: "47",
      solution:
        "Here $a = 2$ and $d = 7 - 2 = 5$. Using $a_n = a + (n-1)d$: $a_{10} = 2 + 9 \\times 5 = 2 + 45 = 47$.",
      markingScheme: [
        { step: "Correct $a$ and $d$", marks: 1 },
        { step: "Correct substitution and answer", marks: 1 },
      ],
      hint: "The formula uses $(n-1)$, not $n$. Getting $52$ means you multiplied the common difference by ten instead of nine.",
    },
    source: PATTERN(2011, "Annual"),
  },
  {
    key: "math-pyq-2011-03",
    chapter: "coordinate-geometry",
    topics: ["distance-formula"],
    type: "MCQ",
    body: "The distance of the point $(3,\\ 4)$ from the origin is:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 45,
    options: [
      { label: "A", body: "$3$ units" },
      { label: "B", body: "$4$ units" },
      { label: "C", body: "$5$ units", isCorrect: true },
      { label: "D", body: "$7$ units" },
    ],
    answer: {
      correctValue: "C",
      solution: "$\\sqrt{3^2 + 4^2} = \\sqrt{9 + 16} = \\sqrt{25} = 5$ units.",
      hint: "The origin is $(0, 0)$. Substitute both points into the distance formula rather than adding the coordinates.",
    },
    source: PATTERN(2011, "Annual"),
  },

  // ── 2012 ──────────────────────────────────────────────────────────────────
  {
    key: "math-pyq-2012-01",
    chapter: "linear-equations-two-variables",
    topics: ["consistency-of-pairs"],
    type: "MCQ",
    body: "The pair of equations $x + 2y = 5$ and $2x + 4y = 10$ has:",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 75,
    options: [
      { label: "A", body: "no solution" },
      { label: "B", body: "exactly one solution" },
      { label: "C", body: "infinitely many solutions", isCorrect: true },
      { label: "D", body: "exactly two solutions" },
    ],
    answer: {
      correctValue: "C",
      solution:
        "Compare the ratios: $\\dfrac{a_1}{a_2} = \\dfrac{1}{2}$, $\\dfrac{b_1}{b_2} = \\dfrac{2}{4} = \\dfrac{1}{2}$, $\\dfrac{c_1}{c_2} = \\dfrac{5}{10} = \\dfrac{1}{2}$. All three are equal, so the lines coincide and there are infinitely many solutions.",
      explanation:
        "The second equation is just twice the first, so it draws the same line. Two equal ratios with a *different* third would have meant no solution instead.",
      hint: "Compare the three ratios of coefficients. Whether all three agree, or only the first two, is the whole answer.",
    },
    source: PATTERN(2012, "Annual"),
  },
  {
    key: "math-pyq-2012-02",
    chapter: "circles",
    topics: ["number-of-tangents"],
    type: "MCQ",
    body: "The number of tangents that can be drawn to a circle from a point outside it is:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 30,
    options: [
      { label: "A", body: "$0$" },
      { label: "B", body: "$1$" },
      { label: "C", body: "$2$", isCorrect: true },
      { label: "D", body: "infinitely many" },
    ],
    answer: {
      correctValue: "C",
      solution:
        "From an external point exactly two tangents can be drawn, and they are equal in length. A point *on* the circle gives one, and a point inside gives none.",
      hint: "Sketch it. Try a point well outside a circle and see how many lines you can draw that touch it exactly once.",
    },
    source: PATTERN(2012, "Annual"),
  },
  {
    key: "math-pyq-2012-03",
    chapter: "statistics",
    topics: ["mean-grouped-data"],
    type: "SHORT_ANSWER",
    body: "The marks of $20$ students are grouped as follows:\n\n| Marks | Number of students |\n| --- | --- |\n| $0-10$ | $4$ |\n| $10-20$ | $6$ |\n| $20-30$ | $7$ |\n| $30-40$ | $3$ |\n\nFind the mean marks by the direct method.",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 240,
    answer: {
      solution:
        "Class marks $x_i$ are $5,\\ 15,\\ 25,\\ 35$.\n\n$\\sum f_i x_i = 4(5) + 6(15) + 7(25) + 3(35) = 20 + 90 + 175 + 105 = 390$.\n\n$\\sum f_i = 20$.\n\nMean $= \\dfrac{390}{20} = 19.5$ marks.",
      markingScheme: [
        { step: "Class marks found correctly", marks: 1 },
        { step: "$\\sum f_i x_i$ computed correctly", marks: 1 },
        { step: "Mean stated as $19.5$", marks: 1 },
      ],
      hint: "The direct method needs the class mark of each interval — the midpoint — not the interval's limits. Build that column first.",
    },
    source: PATTERN(2012, "Annual"),
  },

  // ── 2013 ──────────────────────────────────────────────────────────────────
  {
    key: "math-pyq-2013-01",
    chapter: "areas-related-to-circles",
    topics: ["area-of-sector"],
    type: "NUMERICAL",
    body: "Find the area of a sector of a circle of radius $6\\ \\text{cm}$ whose central angle is $60^\\circ$. Take $\\pi = \\dfrac{22}{7}$.",
    marks: 2,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 120,
    answer: {
      correctValue: "18.86",
      acceptedValues: ["18.86", "18.857", "132/7"],
      tolerance: 0.05,
      unit: "cm²",
      solution:
        "Area of a sector $= \\dfrac{\\theta}{360^\\circ} \\times \\pi r^2 = \\dfrac{60}{360} \\times \\dfrac{22}{7} \\times 36 = \\dfrac{1}{6} \\times \\dfrac{792}{7} = \\dfrac{132}{7} \\approx 18.86\\ \\text{cm}^2$.",
      markingScheme: [
        { step: "Correct formula with $\\theta/360$", marks: 1 },
        { step: "Correct arithmetic and units", marks: 1 },
      ],
      hint: "A sector is a fraction of the whole circle, and the fraction is the angle over $360^\\circ$. Find the whole area first if that is easier.",
    },
    source: PATTERN(2013, "Annual"),
  },
  {
    key: "math-pyq-2013-02",
    chapter: "surface-areas-and-volumes",
    topics: ["volume-of-combination"],
    type: "NUMERICAL",
    body: "Find the volume of a hemisphere of radius $3\\ \\text{cm}$. Take $\\pi = \\dfrac{22}{7}$.",
    marks: 2,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 120,
    answer: {
      correctValue: "56.57",
      acceptedValues: ["56.57", "56.571", "396/7"],
      tolerance: 0.05,
      unit: "cm³",
      solution:
        "Volume of a hemisphere $= \\dfrac{2}{3}\\pi r^3 = \\dfrac{2}{3} \\times \\dfrac{22}{7} \\times 27 = \\dfrac{396}{7} \\approx 56.57\\ \\text{cm}^3$.",
      markingScheme: [
        { step: "Correct formula", marks: 1 },
        { step: "Correct value with units", marks: 1 },
      ],
      hint: "A hemisphere is half a sphere, so its volume is half of $\\frac{4}{3}\\pi r^3$. Simplify that before substituting.",
    },
    source: PATTERN(2013, "Annual"),
  },
  {
    key: "math-pyq-2013-03",
    chapter: "probability",
    topics: ["probability-cards-dice"],
    type: "MCQ",
    body: "A die is thrown once. The probability of getting a prime number is:",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 60,
    options: [
      { label: "A", body: "$\\dfrac{1}{3}$" },
      { label: "B", body: "$\\dfrac{1}{2}$", isCorrect: true },
      { label: "C", body: "$\\dfrac{2}{3}$" },
      { label: "D", body: "$\\dfrac{1}{6}$" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "The primes on a die are $2,\\ 3$ and $5$ — three outcomes out of six. So the probability is $\\dfrac{3}{6} = \\dfrac{1}{2}$.",
      explanation:
        "$1$ is not prime, and that is where the usual mistake comes from: counting it gives four outcomes and the wrong answer $\\frac{2}{3}$.",
      hint: "List the faces and mark which are prime. Be careful about whether $1$ belongs on that list.",
    },
    source: PATTERN(2013, "Annual"),
  },

  // ── 2014 ──────────────────────────────────────────────────────────────────
  {
    key: "math-pyq-2014-01",
    chapter: "quadratic-equations",
    topics: ["discriminant-nature-of-roots"],
    type: "MCQ",
    body: "The nature of the roots of $2x^2 - 4x + 3 = 0$ is:",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 75,
    options: [
      { label: "A", body: "real and distinct" },
      { label: "B", body: "real and equal" },
      { label: "C", body: "no real roots", isCorrect: true },
      { label: "D", body: "cannot be determined" },
    ],
    answer: {
      correctValue: "C",
      solution:
        "$D = b^2 - 4ac = (-4)^2 - 4(2)(3) = 16 - 24 = -8$. Since $D < 0$, the equation has no real roots.",
      hint: "The sign of the discriminant decides this, and you do not need to solve the equation to find it.",
    },
    source: PATTERN(2014, "Annual"),
  },
  {
    key: "math-pyq-2014-02",
    chapter: "triangles",
    topics: ["areas-of-similar-triangles"],
    type: "MCQ",
    body: "Two similar triangles have corresponding sides in the ratio $3 : 4$. The ratio of their areas is:",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 60,
    options: [
      { label: "A", body: "$3 : 4$" },
      { label: "B", body: "$9 : 16$", isCorrect: true },
      { label: "C", body: "$4 : 3$" },
      { label: "D", body: "$27 : 64$" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "The ratio of the areas of two similar triangles equals the square of the ratio of any pair of corresponding sides: $\\left(\\dfrac{3}{4}\\right)^2 = \\dfrac{9}{16}$.",
      explanation:
        "$27 : 64$ is the cube — that is the ratio of *volumes* of similar solids, which is a different theorem for a different shape.",
      hint: "Area is a two-dimensional measure. What does that do to a ratio of lengths?",
    },
    source: PATTERN(2014, "Annual"),
  },
  {
    key: "math-pyq-2014-03",
    chapter: "introduction-to-trigonometry",
    topics: ["trigonometric-identities"],
    type: "SHORT_ANSWER",
    body: "Prove that $(1 + \\tan^2 A)(1 - \\sin A)(1 + \\sin A) = 1$.",
    marks: 3,
    difficulty: "HARD",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 240,
    answer: {
      solution:
        "$(1 - \\sin A)(1 + \\sin A) = 1 - \\sin^2 A = \\cos^2 A$.\n\nAlso $1 + \\tan^2 A = \\sec^2 A = \\dfrac{1}{\\cos^2 A}$.\n\nSo the product is $\\dfrac{1}{\\cos^2 A} \\times \\cos^2 A = 1$.",
      markingScheme: [
        { step: "Uses $(1-\\sin A)(1+\\sin A) = \\cos^2 A$", marks: 1 },
        { step: "Uses $1 + \\tan^2 A = \\sec^2 A$", marks: 1 },
        { step: "Combines to reach $1$", marks: 1 },
      ],
      hint: "The last two brackets multiply to something familiar. Deal with them first, before touching the $\\tan^2$ term.",
    },
    source: PATTERN(2014, "Annual"),
  },

  // ── 2015 ──────────────────────────────────────────────────────────────────
  {
    key: "math-pyq-2015-01",
    chapter: "real-numbers",
    topics: ["irrational-numbers"],
    type: "ASSERTION_REASON",
    body: "**Assertion (A):** $\\sqrt{5}$ is an irrational number.\n\n**Reason (R):** The square root of every prime number is irrational.",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 75,
    options: [
      {
        label: "A",
        body: "Both Assertion (A) and Reason (R) are true and Reason (R) is the correct explanation of Assertion (A).",
        isCorrect: true,
      },
      {
        label: "B",
        body: "Both Assertion (A) and Reason (R) are true but Reason (R) is not the correct explanation of Assertion (A).",
      },
      { label: "C", body: "Assertion (A) is true but Reason (R) is false." },
      { label: "D", body: "Assertion (A) is false but Reason (R) is true." },
    ],
    answer: {
      correctValue: "A",
      solution:
        "Both statements are true. The square root of any prime is irrational, and $5$ is prime, so $\\sqrt{5}$ is irrational — the reason is exactly why the assertion holds.",
      hint: "Decide whether each statement is true on its own first. Only then ask whether the second one explains the first.",
    },
    source: PATTERN(2015, "Annual"),
  },
  {
    key: "math-pyq-2015-02",
    chapter: "arithmetic-progressions",
    topics: ["ap-sum-of-n-terms"],
    type: "NUMERICAL",
    body: "Find the sum of the first $20$ terms of the AP: $1,\\ 4,\\ 7,\\ 10,\\ \\dots$",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 180,
    answer: {
      correctValue: "590",
      solution:
        "Here $a = 1$, $d = 3$ and $n = 20$.\n\n$S_n = \\dfrac{n}{2}\\left[2a + (n-1)d\\right] = \\dfrac{20}{2}\\left[2(1) + 19(3)\\right] = 10\\left[2 + 57\\right] = 10 \\times 59 = 590$.",
      markingScheme: [
        { step: "Correct $a$, $d$ and $n$", marks: 1 },
        { step: "Correct substitution into $S_n$", marks: 1 },
        { step: "Correct answer $590$", marks: 1 },
      ],
      hint: "Use the sum formula directly rather than finding twenty terms and adding them. Note it is $(n-1)d$ inside the bracket.",
    },
    source: PATTERN(2015, "Annual"),
  },
  {
    key: "math-pyq-2015-03",
    chapter: "applications-of-trigonometry",
    topics: ["heights-and-distances"],
    type: "SHORT_ANSWER",
    body: "A ladder leaning against a wall makes an angle of $60^\\circ$ with the ground. If the foot of the ladder is $2.5\\ \\text{m}$ from the wall, find the length of the ladder.",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 210,
    answer: {
      solution:
        "Let the ladder be $L$. The distance from the wall is adjacent to the $60^\\circ$ angle and the ladder is the hypotenuse, so $\\cos 60^\\circ = \\dfrac{2.5}{L}$.\n\nSince $\\cos 60^\\circ = \\dfrac{1}{2}$: $\\dfrac{1}{2} = \\dfrac{2.5}{L}$, so $L = 5\\ \\text{m}$.",
      markingScheme: [
        { step: "Correct figure with the angle marked", marks: 1 },
        { step: "Chooses cosine, relating adjacent to hypotenuse", marks: 1 },
        { step: "Length stated as $5\\ \\text{m}$", marks: 1 },
      ],
      hint: "Draw it and label which side you have and which you want. That decides whether you need sine, cosine or tangent — pick the ratio last, not first.",
    },
    source: PATTERN(2015, "Annual"),
  },

  // ── 2016 ──────────────────────────────────────────────────────────────────
  {
    key: "math-pyq-2016-01",
    chapter: "coordinate-geometry",
    topics: ["section-formula"],
    type: "MCQ",
    body: "The midpoint of the line segment joining $(2,\\ 3)$ and $(6,\\ 7)$ is:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 45,
    options: [
      { label: "A", body: "$(4,\\ 5)$", isCorrect: true },
      { label: "B", body: "$(8,\\ 10)$" },
      { label: "C", body: "$(2,\\ 2)$" },
      { label: "D", body: "$(3,\\ 4)$" },
    ],
    answer: {
      correctValue: "A",
      solution: "Midpoint $= \\left(\\dfrac{2+6}{2},\\ \\dfrac{3+7}{2}\\right) = (4,\\ 5)$.",
      hint: "The midpoint averages the coordinates. Option B is what you get if you add them and forget to halve.",
    },
    source: PATTERN(2016, "Annual"),
  },
  {
    key: "math-pyq-2016-02",
    chapter: "probability",
    topics: ["probability-cards-dice"],
    type: "MCQ",
    body: "One card is drawn at random from a well-shuffled deck of $52$ playing cards. The probability that it is a king is:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 60,
    options: [
      { label: "A", body: "$\\dfrac{1}{52}$" },
      { label: "B", body: "$\\dfrac{1}{13}$", isCorrect: true },
      { label: "C", body: "$\\dfrac{1}{26}$" },
      { label: "D", body: "$\\dfrac{4}{13}$" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "There are $4$ kings in a deck of $52$ cards, so the probability is $\\dfrac{4}{52} = \\dfrac{1}{13}$.",
      hint: "Count how many kings a deck holds, not how many of one particular king. Then reduce the fraction.",
    },
    source: PATTERN(2016, "Annual"),
  },
  {
    key: "math-pyq-2016-03",
    chapter: "polynomials",
    topics: ["zeroes-of-polynomial"],
    type: "SHORT_ANSWER",
    body: "Find the zeroes of the quadratic polynomial $x^2 - 7x + 12$ and verify the relationship between the zeroes and the coefficients.",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 210,
    answer: {
      solution:
        "$x^2 - 7x + 12 = (x-3)(x-4)$, so the zeroes are $3$ and $4$.\n\nSum of zeroes $= 3 + 4 = 7$, and $-\\dfrac{b}{a} = -\\dfrac{-7}{1} = 7$. ✓\n\nProduct of zeroes $= 3 \\times 4 = 12$, and $\\dfrac{c}{a} = \\dfrac{12}{1} = 12$. ✓",
      markingScheme: [
        { step: "Factorises correctly", marks: 1 },
        { step: "States both zeroes", marks: 1 },
        { step: "Verifies both the sum and the product", marks: 1 },
      ],
      hint: "Factorise first. The verification is then two short checks against $-b/a$ and $c/a$ — do not skip it, it carries a mark.",
    },
    source: PATTERN(2016, "Annual"),
  },

  // ── 2017 ──────────────────────────────────────────────────────────────────
  {
    key: "math-pyq-2017-01",
    chapter: "surface-areas-and-volumes",
    topics: ["conversion-of-solids"],
    type: "SHORT_ANSWER",
    body: "A solid metallic sphere of radius $6\\ \\text{cm}$ is melted and recast into small spheres of radius $2\\ \\text{cm}$ each. How many small spheres are obtained?",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 210,
    answer: {
      correctValue: "27",
      solution:
        "Melting preserves volume, so the number of small spheres is the ratio of the volumes.\n\n$n = \\dfrac{\\frac{4}{3}\\pi (6)^3}{\\frac{4}{3}\\pi (2)^3} = \\dfrac{216}{8} = 27$.",
      markingScheme: [
        { step: "States that the total volume is unchanged", marks: 1 },
        { step: "Sets up the ratio of volumes", marks: 1 },
        { step: "Answer $27$", marks: 1 },
      ],
      hint: "Nothing is lost when metal is melted and recast. Which quantity does that tell you is the same before and after?",
    },
    source: PATTERN(2017, "Annual"),
  },
  {
    key: "math-pyq-2017-02",
    chapter: "introduction-to-trigonometry",
    topics: ["trig-ratios-specific-angles"],
    type: "MCQ",
    body: "The value of $\\dfrac{\\tan 45^\\circ}{\\csc 30^\\circ}$ is:",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 75,
    options: [
      { label: "A", body: "$\\dfrac{1}{2}$", isCorrect: true },
      { label: "B", body: "$2$" },
      { label: "C", body: "$1$" },
      { label: "D", body: "$\\dfrac{1}{\\sqrt{2}}$" },
    ],
    answer: {
      correctValue: "A",
      solution:
        "$\\tan 45^\\circ = 1$ and $\\csc 30^\\circ = \\dfrac{1}{\\sin 30^\\circ} = 2$. So the value is $\\dfrac{1}{2}$.",
      hint: "Cosecant is the reciprocal of sine, not of cosine. Work out $\\sin 30^\\circ$ first and then flip it.",
    },
    source: PATTERN(2017, "Annual"),
  },
  {
    key: "math-pyq-2017-03",
    chapter: "linear-equations-two-variables",
    topics: ["linear-equation-word-problems"],
    type: "SHORT_ANSWER",
    body: "The sum of two numbers is $30$ and their difference is $4$. Find the numbers.",
    marks: 3,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 180,
    answer: {
      solution:
        "Let the numbers be $x$ and $y$ with $x > y$.\n\n$x + y = 30$ … (i)\n\n$x - y = 4$ … (ii)\n\nAdding: $2x = 34$, so $x = 17$. Substituting into (i): $y = 13$.\n\nThe numbers are $17$ and $13$.",
      markingScheme: [
        { step: "Forms both equations correctly", marks: 1 },
        { step: "Solves by elimination", marks: 1 },
        { step: "States both numbers", marks: 1 },
      ],
      hint: "Two unknowns need two equations. Write one for the sum and one for the difference, then add them — one variable disappears.",
    },
    source: PATTERN(2017, "Annual"),
  },

  // ── 2018 ──────────────────────────────────────────────────────────────────
  {
    key: "math-pyq-2018-01",
    chapter: "circles",
    topics: ["tangent-length-theorem"],
    type: "MCQ",
    body: "$PA$ and $PB$ are tangents drawn from an external point $P$ to a circle. If $PA = 7\\ \\text{cm}$, then $PB$ equals:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 45,
    options: [
      { label: "A", body: "$3.5\\ \\text{cm}$" },
      { label: "B", body: "$7\\ \\text{cm}$", isCorrect: true },
      { label: "C", body: "$14\\ \\text{cm}$" },
      { label: "D", body: "cannot be determined" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "The lengths of two tangents drawn from an external point to a circle are equal, so $PB = PA = 7\\ \\text{cm}$.",
      hint: "There is a theorem about the two tangents from one external point. It says something about their lengths.",
    },
    source: PATTERN(2018, "Annual"),
  },
  {
    key: "math-pyq-2018-02",
    chapter: "quadratic-equations",
    topics: ["quadratic-word-problems"],
    type: "LONG_ANSWER",
    body: "The product of two consecutive positive integers is $156$. Formulate a quadratic equation and find the integers.",
    marks: 4,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 300,
    answer: {
      solution:
        "Let the integers be $x$ and $x+1$.\n\n$x(x+1) = 156$, so $x^2 + x - 156 = 0$.\n\nFactorising: $x^2 + 13x - 12x - 156 = 0$, giving $(x+13)(x-12) = 0$, so $x = 12$ or $x = -13$.\n\nThe integers are positive, so $x = 12$ and the numbers are $12$ and $13$.",
      markingScheme: [
        { step: "Assigns variables to consecutive integers", marks: 1 },
        { step: "Forms the quadratic equation", marks: 1 },
        { step: "Solves it correctly", marks: 1 },
        { step: "Rejects the negative root and states the answer", marks: 1 },
      ],
      hint: 'Consecutive integers differ by one, so one variable is enough. Remember to check both roots against the word "positive" at the end.',
    },
    source: PATTERN(2018, "Annual"),
  },
  {
    key: "math-pyq-2018-03",
    chapter: "statistics",
    topics: ["median-grouped-data"],
    type: "MCQ",
    body: "For a grouped frequency distribution, the empirical relationship between the three measures of central tendency is:",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 60,
    options: [
      {
        label: "A",
        body: "$3\\,\\text{Median} = \\text{Mode} + 2\\,\\text{Mean}$",
        isCorrect: true,
      },
      { label: "B", body: "$3\\,\\text{Mean} = \\text{Mode} + 2\\,\\text{Median}$" },
      { label: "C", body: "$3\\,\\text{Mode} = \\text{Mean} + 2\\,\\text{Median}$" },
      { label: "D", body: "$\\text{Mean} = \\text{Median} = \\text{Mode}$" },
    ],
    answer: {
      correctValue: "A",
      solution:
        "The empirical relationship is $3\\,\\text{Median} = \\text{Mode} + 2\\,\\text{Mean}$. It is used to find any one of the three when the other two are known.",
      explanation:
        "Option D holds only for a perfectly symmetric distribution, which grouped data rarely is.",
      hint: "The median sits between the other two, and the relationship puts the multiple of three on it. That narrows it to one option.",
    },
    source: PATTERN(2018, "Annual"),
  },

  // ── 2019 ──────────────────────────────────────────────────────────────────
  {
    key: "math-pyq-2019-01",
    chapter: "triangles",
    topics: ["pythagoras-theorem"],
    type: "NUMERICAL",
    body: "In a right triangle, the two legs measure $9\\ \\text{cm}$ and $12\\ \\text{cm}$. Find the length of the hypotenuse.",
    marks: 2,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 90,
    answer: {
      correctValue: "15",
      unit: "cm",
      solution: "$h^2 = 9^2 + 12^2 = 81 + 144 = 225$, so $h = 15\\ \\text{cm}$.",
      markingScheme: [
        { step: "Applies Pythagoras correctly", marks: 1 },
        { step: "Correct value with units", marks: 1 },
      ],
      hint: "The hypotenuse is the longest side and sits alone on one side of the equation. Square, add, then take the root — in that order.",
    },
    source: PATTERN(2019, "Annual"),
  },
  {
    key: "math-pyq-2019-02",
    chapter: "probability",
    topics: ["complementary-events"],
    type: "MCQ",
    body: "If the probability that it will rain tomorrow is $0.35$, the probability that it will not rain is:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 45,
    options: [
      { label: "A", body: "$0.35$" },
      { label: "B", body: "$0.65$", isCorrect: true },
      { label: "C", body: "$1.35$" },
      { label: "D", body: "$0.5$" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "For complementary events, $P(E) + P(\\overline{E}) = 1$. So $P(\\overline{E}) = 1 - 0.35 = 0.65$.",
      hint: "Either it rains or it does not, and nothing else. What must those two probabilities add up to?",
    },
    source: PATTERN(2019, "Annual"),
  },
  {
    key: "math-pyq-2019-03",
    chapter: "areas-related-to-circles",
    topics: ["combination-of-figures"],
    type: "SHORT_ANSWER",
    body: "A square of side $14\\ \\text{cm}$ has a circle inscribed in it. Find the area of the region inside the square but outside the circle. Take $\\pi = \\dfrac{22}{7}$.",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 240,
    answer: {
      correctValue: "42",
      unit: "cm²",
      solution:
        "The inscribed circle has diameter equal to the side, so $r = 7\\ \\text{cm}$.\n\nArea of square $= 14^2 = 196\\ \\text{cm}^2$.\n\nArea of circle $= \\dfrac{22}{7} \\times 49 = 154\\ \\text{cm}^2$.\n\nShaded area $= 196 - 154 = 42\\ \\text{cm}^2$.",
      markingScheme: [
        { step: "Identifies $r = 7$ from the inscribed circle", marks: 1 },
        { step: "Both areas computed correctly", marks: 1 },
        { step: "Difference stated with units", marks: 1 },
      ],
      hint: "An inscribed circle touches all four sides, so its diameter is the side of the square — not its diagonal. Get the radius right and the rest is subtraction.",
    },
    source: PATTERN(2019, "Annual"),
  },

  // ── 2020 ──────────────────────────────────────────────────────────────────
  {
    key: "math-pyq-2020-01",
    chapter: "coordinate-geometry",
    topics: ["collinearity"],
    type: "MCQ",
    body: "The points $(1,\\ 2)$, $(2,\\ 4)$ and $(3,\\ 6)$ are:",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 90,
    options: [
      { label: "A", body: "the vertices of a right triangle" },
      { label: "B", body: "collinear", isCorrect: true },
      { label: "C", body: "the vertices of an equilateral triangle" },
      { label: "D", body: "the vertices of a scalene triangle" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "The area of the triangle formed is $\\dfrac{1}{2}\\left|1(4-6) + 2(6-2) + 3(2-4)\\right| = \\dfrac{1}{2}\\left|-2 + 8 - 6\\right| = 0$.\n\nA zero area means the three points lie on one straight line.",
      explanation:
        "Each point satisfies $y = 2x$, which is the same conclusion reached without any formula.",
      hint: "Three points that form a triangle of zero area are not really a triangle. Alternatively, look for a pattern relating each $y$ to its $x$.",
    },
    source: PATTERN(2020, "Annual"),
  },
  {
    key: "math-pyq-2020-02",
    chapter: "arithmetic-progressions",
    topics: ["ap-applications"],
    type: "SHORT_ANSWER",
    body: "How many two-digit numbers are divisible by $3$?",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 210,
    answer: {
      correctValue: "30",
      solution:
        "The two-digit multiples of $3$ form an AP: $12,\\ 15,\\ 18,\\ \\dots,\\ 99$, with $a = 12$ and $d = 3$.\n\n$a_n = 99 \\Rightarrow 12 + (n-1)3 = 99 \\Rightarrow (n-1)3 = 87 \\Rightarrow n - 1 = 29 \\Rightarrow n = 30$.\n\nThere are $30$ such numbers.",
      markingScheme: [
        { step: "Identifies the first and last terms", marks: 1 },
        { step: "Sets up $a_n = 99$", marks: 1 },
        { step: "Answer $30$", marks: 1 },
      ],
      hint: "The smallest two-digit multiple of three is not $10$. Find the first and last ones, then treat the list as an AP and solve for $n$.",
    },
    source: PATTERN(2020, "Annual"),
  },

  // ── 2022, Term 1 ──────────────────────────────────────────────────────────
  {
    key: "math-pyq-2022t1-01",
    chapter: "real-numbers",
    topics: ["fundamental-theorem-arithmetic"],
    type: "MCQ",
    body: "The prime factorisation of $140$ is:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 60,
    options: [
      { label: "A", body: "$2^2 \\times 5 \\times 7$", isCorrect: true },
      { label: "B", body: "$2 \\times 5 \\times 7^2$" },
      { label: "C", body: "$2^2 \\times 5^2 \\times 7$" },
      { label: "D", body: "$2^3 \\times 5 \\times 7$" },
    ],
    answer: {
      correctValue: "A",
      solution: "$140 = 2 \\times 70 = 2 \\times 2 \\times 35 = 2^2 \\times 5 \\times 7$.",
      hint: "Divide by the smallest prime repeatedly until you cannot. Then check your factors multiply back to $140$.",
    },
    source: PATTERN(2022, "Term 1"),
  },
  {
    key: "math-pyq-2022t1-02",
    chapter: "triangles",
    topics: ["basic-proportionality-theorem"],
    type: "MCQ",
    body: "In $\\triangle ABC$, $DE \\parallel BC$ with $D$ on $AB$ and $E$ on $AC$. If $AD = 2\\ \\text{cm}$, $DB = 3\\ \\text{cm}$ and $AE = 4\\ \\text{cm}$, then $EC$ equals:",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 90,
    options: [
      { label: "A", body: "$5\\ \\text{cm}$" },
      { label: "B", body: "$6\\ \\text{cm}$", isCorrect: true },
      { label: "C", body: "$8\\ \\text{cm}$" },
      { label: "D", body: "$2.67\\ \\text{cm}$" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "By the Basic Proportionality Theorem, $\\dfrac{AD}{DB} = \\dfrac{AE}{EC}$, so $\\dfrac{2}{3} = \\dfrac{4}{EC}$ and $EC = 6\\ \\text{cm}$.",
      hint: "A line parallel to one side divides the other two sides in the same ratio. Make sure you pair the segments the same way on both sides.",
    },
    source: PATTERN(2022, "Term 1"),
  },

  // ── 2022, Term 2 ──────────────────────────────────────────────────────────
  {
    key: "math-pyq-2022t2-01",
    chapter: "surface-areas-and-volumes",
    topics: ["combination-of-solids"],
    type: "LONG_ANSWER",
    body: "A toy is in the shape of a cone mounted on a hemisphere of the same radius $3.5\\ \\text{cm}$. The total height of the toy is $15.5\\ \\text{cm}$. Find the volume of the toy. Take $\\pi = \\dfrac{22}{7}$.",
    marks: 5,
    difficulty: "HARD",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 420,
    answer: {
      solution:
        "The hemisphere's height is its radius, $3.5\\ \\text{cm}$, so the cone's height is $15.5 - 3.5 = 12\\ \\text{cm}$.\n\nVolume of hemisphere $= \\dfrac{2}{3}\\pi r^3 = \\dfrac{2}{3} \\times \\dfrac{22}{7} \\times 42.875 \\approx 89.83\\ \\text{cm}^3$.\n\nVolume of cone $= \\dfrac{1}{3}\\pi r^2 h = \\dfrac{1}{3} \\times \\dfrac{22}{7} \\times 12.25 \\times 12 = 154\\ \\text{cm}^3$.\n\nTotal volume $\\approx 89.83 + 154 = 243.83\\ \\text{cm}^3$.",
      markingScheme: [
        { step: "Deduces the cone's height as $12\\ \\text{cm}$", marks: 1 },
        { step: "Correct hemisphere volume", marks: 1.5 },
        { step: "Correct cone volume", marks: 1.5 },
        { step: "Total stated with units", marks: 1 },
      ],
      hint: "The total height includes the hemisphere, whose height is its own radius. Take that off before you use the cone formula.",
    },
    source: PATTERN(2022, "Term 2"),
  },
  {
    key: "math-pyq-2022t2-02",
    chapter: "applications-of-trigonometry",
    topics: ["angle-of-elevation-depression"],
    type: "SHORT_ANSWER",
    body: "The angle of elevation of the top of a tower from a point $30\\ \\text{m}$ away from its foot is $45^\\circ$. Find the height of the tower.",
    marks: 3,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 180,
    answer: {
      correctValue: "30",
      unit: "m",
      solution:
        "Let the height be $h$. Then $\\tan 45^\\circ = \\dfrac{h}{30}$.\n\nSince $\\tan 45^\\circ = 1$, $h = 30\\ \\text{m}$.",
      markingScheme: [
        { step: "Correct figure and identification of the ratio", marks: 1 },
        { step: "Uses $\\tan 45^\\circ = 1$", marks: 1 },
        { step: "Height stated with units", marks: 1 },
      ],
      hint: "You have the side along the ground and you want the vertical side. Which ratio connects those two, without involving the hypotenuse?",
    },
    source: PATTERN(2022, "Term 2"),
  },

  // ── 2023 ──────────────────────────────────────────────────────────────────
  {
    key: "math-pyq-2023-01",
    chapter: "quadratic-equations",
    topics: ["quadratic-formula"],
    type: "SHORT_ANSWER",
    body: "Solve for $x$: $2x^2 + x - 6 = 0$, using the quadratic formula.",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 210,
    answer: {
      solution:
        "Here $a = 2$, $b = 1$, $c = -6$.\n\n$D = b^2 - 4ac = 1 + 48 = 49$, so $\\sqrt{D} = 7$.\n\n$x = \\dfrac{-1 \\pm 7}{4}$, giving $x = \\dfrac{6}{4} = \\dfrac{3}{2}$ or $x = \\dfrac{-8}{4} = -2$.",
      markingScheme: [
        { step: "Correct $a$, $b$, $c$ and discriminant", marks: 1 },
        { step: "Correct substitution into the formula", marks: 1 },
        { step: "Both roots stated", marks: 1 },
      ],
      hint: "Write down $a$, $b$ and $c$ with their signs before touching the formula. A sign error in $c$ is the commonest way this goes wrong.",
    },
    source: PATTERN(2023, "Annual"),
  },
  {
    key: "math-pyq-2023-02",
    chapter: "statistics",
    topics: ["mode-grouped-data"],
    type: "MCQ",
    body: "In a grouped frequency distribution, the class with the highest frequency is called the:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 45,
    options: [
      { label: "A", body: "median class" },
      { label: "B", body: "modal class", isCorrect: true },
      { label: "C", body: "mean class" },
      { label: "D", body: "cumulative class" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "The class with the greatest frequency is the modal class, and it is the interval the mode formula is applied to.",
      explanation:
        "The median class is different: it is the class in which the cumulative frequency first reaches $n/2$, which need not be the tallest one.",
      hint: "The mode is the most frequent value. That tells you which class it must live in.",
    },
    source: PATTERN(2023, "Annual"),
  },

  // ── 2024 ──────────────────────────────────────────────────────────────────
  {
    key: "math-pyq-2024-01",
    chapter: "real-numbers",
    topics: ["hcf-lcm"],
    type: "SHORT_ANSWER",
    body: "Find the HCF and LCM of $96$ and $404$ by prime factorisation, and verify that $\\text{HCF} \\times \\text{LCM} = $ the product of the two numbers.",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 240,
    answer: {
      solution:
        "$96 = 2^5 \\times 3$ and $404 = 2^2 \\times 101$.\n\nHCF $= 2^2 = 4$.\n\nLCM $= 2^5 \\times 3 \\times 101 = 9696$.\n\nCheck: $4 \\times 9696 = 38784$, and $96 \\times 404 = 38784$. ✓",
      markingScheme: [
        { step: "Both prime factorisations correct", marks: 1 },
        { step: "HCF and LCM correct", marks: 1 },
        { step: "Verification shown", marks: 1 },
      ],
      hint: "The HCF takes the lowest power of each shared prime; the LCM takes the highest power of every prime that appears in either.",
    },
    source: PATTERN(2024, "Annual"),
  },
  {
    key: "math-pyq-2024-02",
    chapter: "circles",
    topics: ["tangent-to-circle"],
    type: "ASSERTION_REASON",
    body: "**Assertion (A):** A tangent to a circle is perpendicular to the radius drawn to the point of contact.\n\n**Reason (R):** A tangent meets a circle at exactly one point.",
    marks: 1,
    difficulty: "HARD",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 90,
    options: [
      {
        label: "A",
        body: "Both Assertion (A) and Reason (R) are true and Reason (R) is the correct explanation of Assertion (A).",
      },
      {
        label: "B",
        body: "Both Assertion (A) and Reason (R) are true but Reason (R) is not the correct explanation of Assertion (A).",
        isCorrect: true,
      },
      { label: "C", body: "Assertion (A) is true but Reason (R) is false." },
      { label: "D", body: "Assertion (A) is false but Reason (R) is true." },
    ],
    answer: {
      correctValue: "B",
      solution:
        "Both statements are true. But meeting the circle at one point is the *definition* of a tangent, not the reason the perpendicularity holds — that follows from the radius being the shortest distance from the centre to the tangent line. So the reason is true without explaining the assertion.",
      explanation:
        "This is the pattern these questions test most often: two true statements where the second is a definition rather than a cause.",
      hint: "Check both statements are true first. Then ask whether the second one actually *causes* the first, or merely sits alongside it.",
    },
    source: PATTERN(2024, "Annual"),
  },

  // ── 2025 ──────────────────────────────────────────────────────────────────
  {
    key: "math-pyq-2025-01",
    chapter: "arithmetic-progressions",
    topics: ["ap-nth-term"],
    type: "MCQ",
    body: "Which term of the AP $5,\\ 11,\\ 17,\\ 23,\\ \\dots$ is $77$?",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 90,
    options: [
      { label: "A", body: "$12^{\\text{th}}$" },
      { label: "B", body: "$13^{\\text{th}}$", isCorrect: true },
      { label: "C", body: "$14^{\\text{th}}$" },
      { label: "D", body: "$11^{\\text{th}}$" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "$a = 5$, $d = 6$. Setting $a_n = 77$: $5 + (n-1)6 = 77 \\Rightarrow (n-1)6 = 72 \\Rightarrow n - 1 = 12 \\Rightarrow n = 13$.",
      hint: "You are solving for $n$ rather than for the term. Set the $n$th-term formula equal to $77$ and rearrange.",
    },
    source: PATTERN(2025, "Annual"),
  },
  {
    key: "math-pyq-2025-02",
    chapter: "probability",
    topics: ["theoretical-probability"],
    type: "SHORT_ANSWER",
    body: "A bag contains $5$ red balls, $8$ white balls and $7$ green balls. One ball is drawn at random. Find the probability that it is (i) white, (ii) not green.",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 210,
    answer: {
      solution:
        "Total balls $= 5 + 8 + 7 = 20$.\n\n(i) $P(\\text{white}) = \\dfrac{8}{20} = \\dfrac{2}{5}$.\n\n(ii) $P(\\text{green}) = \\dfrac{7}{20}$, so $P(\\text{not green}) = 1 - \\dfrac{7}{20} = \\dfrac{13}{20}$.",
      markingScheme: [
        { step: "Correct total of $20$", marks: 1 },
        { step: "Part (i) correct", marks: 1 },
        { step: "Part (ii) correct", marks: 1 },
      ],
      hint: 'Count the total first — every probability here is over the same denominator. For "not green", subtract from one rather than adding the other two colours.',
    },
    source: PATTERN(2025, "Annual"),
  },

  // ── 2026, February ────────────────────────────────────────────────────────
  {
    key: "math-pyq-2026feb-01",
    chapter: "polynomials",
    topics: ["polynomial-graphs"],
    type: "MCQ",
    body: "The graph of a quadratic polynomial $p(x)$ cuts the $x$-axis at two distinct points. The number of zeroes of $p(x)$ is:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 45,
    options: [
      { label: "A", body: "$0$" },
      { label: "B", body: "$1$" },
      { label: "C", body: "$2$", isCorrect: true },
      { label: "D", body: "$3$" },
    ],
    answer: {
      correctValue: "C",
      solution:
        "The zeroes of a polynomial are exactly the $x$-coordinates of the points where its graph meets the $x$-axis. Two distinct crossings means two zeroes.",
      hint: "A zero is a value of $x$ that makes $p(x) = 0$ — which is another way of saying the graph is at height zero there.",
    },
    source: PATTERN(2026, "February"),
  },
  {
    key: "math-pyq-2026feb-02",
    chapter: "triangles",
    topics: ["similarity-criteria"],
    type: "SHORT_ANSWER",
    body: "In $\\triangle ABC$ and $\\triangle PQR$, $\\angle A = \\angle P$ and $\\angle B = \\angle Q$. State which similarity criterion applies and what follows about the sides.",
    marks: 2,
    difficulty: "MEDIUM",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 150,
    answer: {
      solution:
        "Two pairs of equal angles make the third pair equal as well, since the angles of a triangle sum to $180^\\circ$. So the AA (angle-angle) criterion applies and $\\triangle ABC \\sim \\triangle PQR$.\n\nIt follows that the corresponding sides are in the same ratio: $\\dfrac{AB}{PQ} = \\dfrac{BC}{QR} = \\dfrac{CA}{RP}$.",
      markingScheme: [
        { step: "Names the AA criterion", marks: 1 },
        { step: "States the proportionality of corresponding sides", marks: 1 },
      ],
      hint: "You are given two angles. Ask what that forces about the third before deciding which criterion you have.",
    },
    source: PATTERN(2026, "February"),
  },

  // ── 2026, May ─────────────────────────────────────────────────────────────
  {
    key: "math-pyq-2026may-01",
    chapter: "areas-related-to-circles",
    topics: ["area-of-segment"],
    type: "MCQ",
    body: "The area of a segment of a circle is found by:",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 60,
    options: [
      {
        label: "A",
        body: "subtracting the area of the corresponding triangle from the area of the sector",
        isCorrect: true,
      },
      { label: "B", body: "adding the area of the sector to the area of the triangle" },
      { label: "C", body: "subtracting the area of the sector from the area of the circle" },
      { label: "D", body: "halving the area of the sector" },
    ],
    answer: {
      correctValue: "A",
      solution:
        "A minor segment is what is left of a sector once the triangle formed by the two radii and the chord is removed. So its area is (area of sector) $-$ (area of that triangle).",
      hint: "Draw a sector and then draw the chord across it. The segment is one of the two pieces — work out which, and what you would have to take away to get it.",
    },
    source: PATTERN(2026, "May"),
  },
  {
    key: "math-pyq-2026may-02",
    chapter: "introduction-to-trigonometry",
    topics: ["trigonometric-identities"],
    type: "NUMERICAL",
    body: "If $\\sin\\theta = \\dfrac{5}{13}$ and $\\theta$ is acute, find the value of $\\cos\\theta$.",
    marks: 2,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 120,
    answer: {
      correctValue: "12/13",
      acceptedValues: ["12/13", "0.923", "0.9231"],
      tolerance: 0.001,
      solution:
        "Using $\\sin^2\\theta + \\cos^2\\theta = 1$: $\\cos^2\\theta = 1 - \\dfrac{25}{169} = \\dfrac{144}{169}$.\n\nSince $\\theta$ is acute, $\\cos\\theta$ is positive, so $\\cos\\theta = \\dfrac{12}{13}$.",
      markingScheme: [
        { step: "Uses the Pythagorean identity", marks: 1 },
        { step: "Takes the positive root and states $12/13$", marks: 1 },
      ],
      hint: 'There is one identity linking sine and cosine. The word "acute" is there to tell you which sign to keep at the end.',
    },
    source: PATTERN(2026, "May"),
  },
];
