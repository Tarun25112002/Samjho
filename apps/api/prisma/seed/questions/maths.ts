import type { SeedQuestion } from "../types.js";

/**
 * Seed questions for CBSE Class 10 Mathematics.
 *
 * Not a question bank — a *coverage* set. Every one of the ten question types
 * appears here with real content, because the Phase 3 renderer needs a genuine
 * example of each path from day one, and a renderer developed against three MCQs
 * and a placeholder is a renderer that breaks on the first case study.
 *
 * All of it is original or adapted, marked accordingly, and licence-cleared.
 * Nothing is copied verbatim from a CBSE paper — see docs/03-data-model.md §2.4
 * and R2. The provenance fields are populated properly on every row rather than
 * left for later, so the pattern is set before bulk entry begins.
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
  return AR_OPTIONS.map((o) => ({ ...o, isCorrect: o.label === correct }));
}

export const class10MathsQuestions: SeedQuestion[] = [
  // ── MCQ ───────────────────────────────────────────────────────────────────
  {
    key: "math-mcq-001",
    chapter: "real-numbers",
    topics: ["hcf-lcm"],
    type: "MCQ",
    body: "The LCM of the smallest prime number and the smallest odd composite number is:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 60,
    options: [
      { label: "A", body: "$2$" },
      { label: "B", body: "$9$" },
      { label: "C", body: "$18$", isCorrect: true },
      { label: "D", body: "$36$" },
    ],
    answer: {
      correctValue: "C",
      solution:
        "The smallest prime number is $2$. The smallest odd composite number is $9$ (since $1$ is neither prime nor composite, and $3,5,7$ are prime). As $2$ and $9$ are co-prime, $\\text{LCM}(2,9) = 2 \\times 9 = 18$.",
      explanation:
        "The trap here is picking $4$ as the smallest composite number — it is, but the question asks for the smallest *odd* composite, which is $9$.",
    },
    source: ORIGINAL,
  },
  {
    key: "math-mcq-002",
    chapter: "polynomials",
    topics: ["zeroes-coefficients-relation"],
    type: "MCQ",
    body: "If $\\alpha$ and $\\beta$ are the zeroes of the polynomial $p(x) = x^2 - 5x + 6$, then $\\alpha + \\beta$ equals:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 45,
    options: [
      { label: "A", body: "$-5$" },
      { label: "B", body: "$5$", isCorrect: true },
      { label: "C", body: "$6$" },
      { label: "D", body: "$-6$" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "For $ax^2 + bx + c$, the sum of zeroes is $-\\dfrac{b}{a}$. Here $a = 1$, $b = -5$, so $\\alpha + \\beta = -\\dfrac{-5}{1} = 5$.",
      explanation: "The sign is the usual slip: the formula is $-b/a$, not $b/a$.",
    },
    source: ORIGINAL,
  },
  {
    key: "math-mcq-003",
    chapter: "quadratic-equations",
    topics: ["discriminant-nature-of-roots"],
    type: "MCQ",
    body: "The value of $k$ for which the quadratic equation $kx^2 - 4x + 1 = 0$ has equal roots is:",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 75,
    options: [
      { label: "A", body: "$2$" },
      { label: "B", body: "$4$", isCorrect: true },
      { label: "C", body: "$-4$" },
      { label: "D", body: "$16$" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "Equal roots require the discriminant to vanish: $b^2 - 4ac = 0$. Here $(-4)^2 - 4(k)(1) = 0$, so $16 = 4k$ and $k = 4$.",
    },
    source: ADAPTED(2023, "7"),
  },
  {
    key: "math-mcq-004",
    chapter: "arithmetic-progressions",
    topics: ["ap-nth-term"],
    type: "MCQ",
    body: "The $11^{\\text{th}}$ term of the AP $-5,\\ -\\dfrac{5}{2},\\ 0,\\ \\dfrac{5}{2},\\ \\dots$ is:",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 75,
    options: [
      { label: "A", body: "$-20$" },
      { label: "B", body: "$20$", isCorrect: true },
      { label: "C", body: "$-30$" },
      { label: "D", body: "$30$" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "$a = -5$ and $d = -\\dfrac{5}{2} - (-5) = \\dfrac{5}{2}$. Then $a_{11} = a + 10d = -5 + 10 \\times \\dfrac{5}{2} = -5 + 25 = 20$.",
    },
    source: ORIGINAL,
  },
  {
    key: "math-mcq-005",
    chapter: "coordinate-geometry",
    topics: ["distance-formula"],
    type: "MCQ",
    body: "The distance of the point $(-6, 8)$ from the origin is:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 45,
    options: [
      { label: "A", body: "$2$ units" },
      { label: "B", body: "$14$ units" },
      { label: "C", body: "$10$ units", isCorrect: true },
      { label: "D", body: "$\\sqrt{28}$ units" },
    ],
    answer: {
      correctValue: "C",
      solution: "$\\sqrt{(-6)^2 + 8^2} = \\sqrt{36 + 64} = \\sqrt{100} = 10$ units.",
    },
    source: ORIGINAL,
  },
  {
    key: "math-mcq-006",
    chapter: "introduction-to-trigonometry",
    topics: ["trigonometric-ratios"],
    type: "MCQ",
    body: "If $\\sin A = \\dfrac{3}{5}$ where $A$ is an acute angle, then $\\cos A$ equals:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 60,
    options: [
      { label: "A", body: "$\\dfrac{4}{5}$", isCorrect: true },
      { label: "B", body: "$\\dfrac{5}{4}$" },
      { label: "C", body: "$\\dfrac{3}{4}$" },
      { label: "D", body: "$\\dfrac{5}{3}$" },
    ],
    answer: {
      correctValue: "A",
      solution:
        "Using $\\sin^2 A + \\cos^2 A = 1$: $\\cos^2 A = 1 - \\dfrac{9}{25} = \\dfrac{16}{25}$, so $\\cos A = \\dfrac{4}{5}$ (positive, since $A$ is acute).",
    },
    source: ORIGINAL,
  },
  {
    key: "math-mcq-007",
    chapter: "circles",
    topics: ["number-of-tangents"],
    type: "MCQ",
    body: "The number of tangents that can be drawn to a circle from a point lying inside it is:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 30,
    options: [
      { label: "A", body: "$0$", isCorrect: true },
      { label: "B", body: "$1$" },
      { label: "C", body: "$2$" },
      { label: "D", body: "infinitely many" },
    ],
    answer: {
      correctValue: "A",
      solution:
        "A tangent touches the circle at exactly one point and lies entirely outside it elsewhere. Any line through an interior point must cut the circle at two points, so it is a secant, never a tangent. Hence no tangent exists.",
    },
    source: ORIGINAL,
  },
  {
    key: "math-mcq-008",
    chapter: "probability",
    topics: ["theoretical-probability", "probability-cards-dice"],
    type: "MCQ",
    body: "A die is thrown once. The probability of getting a prime number is:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 45,
    options: [
      { label: "A", body: "$\\dfrac{1}{3}$" },
      { label: "B", body: "$\\dfrac{1}{2}$", isCorrect: true },
      { label: "C", body: "$\\dfrac{2}{3}$" },
      { label: "D", body: "$\\dfrac{1}{6}$" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "The primes on a die are $2, 3, 5$ — three favourable outcomes out of six. $P = \\dfrac{3}{6} = \\dfrac{1}{2}$.",
      explanation:
        "$1$ is not prime. Counting it gives $\\frac{4}{6}$, the most common wrong answer here.",
    },
    source: ORIGINAL,
  },
  {
    key: "math-mcq-009",
    chapter: "surface-areas-and-volumes",
    topics: ["volume-of-combination"],
    type: "MCQ",
    body: "A cylinder, a cone and a hemisphere have the same base radius and the same height. The ratio of their volumes is:",
    marks: 1,
    difficulty: "HARD",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 90,
    options: [
      { label: "A", body: "$1 : 2 : 3$" },
      { label: "B", body: "$3 : 1 : 2$", isCorrect: true },
      { label: "C", body: "$2 : 1 : 3$" },
      { label: "D", body: "$1 : 3 : 2$" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "For a hemisphere the height equals the radius, so $h = r$ throughout. Volumes are $\\pi r^2 h = \\pi r^3$, $\\dfrac{1}{3}\\pi r^2 h = \\dfrac{1}{3}\\pi r^3$ and $\\dfrac{2}{3}\\pi r^3$. Dividing by $\\dfrac{1}{3}\\pi r^3$ gives $3 : 1 : 2$.",
      explanation:
        "The step students miss is that 'same height' forces $h = r$, because a hemisphere's height is its radius.",
    },
    source: ADAPTED(2024, "12"),
  },
  {
    key: "math-mcq-010",
    chapter: "triangles",
    topics: ["basic-proportionality-theorem"],
    type: "MCQ",
    body: "In $\\triangle ABC$, $DE \\parallel BC$ with $D$ on $AB$ and $E$ on $AC$. If $\\dfrac{AD}{DB} = \\dfrac{3}{5}$ and $AE = 4.8$ cm, then $EC$ equals:",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 75,
    options: [
      { label: "A", body: "$2.88$ cm" },
      { label: "B", body: "$8$ cm", isCorrect: true },
      { label: "C", body: "$6$ cm" },
      { label: "D", body: "$7.5$ cm" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "By the Basic Proportionality Theorem, $\\dfrac{AD}{DB} = \\dfrac{AE}{EC}$. So $\\dfrac{3}{5} = \\dfrac{4.8}{EC}$, giving $EC = \\dfrac{5 \\times 4.8}{3} = 8$ cm.",
    },
    source: ORIGINAL,
  },
  {
    key: "math-mcq-011",
    chapter: "statistics",
    topics: ["mean-grouped-data"],
    type: "MCQ",
    body: "The mean of the first $10$ natural numbers is:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 45,
    options: [
      { label: "A", body: "$5$" },
      { label: "B", body: "$5.5$", isCorrect: true },
      { label: "C", body: "$6$" },
      { label: "D", body: "$10$" },
    ],
    answer: {
      correctValue: "B",
      solution: "Sum $= \\dfrac{10 \\times 11}{2} = 55$, so the mean is $\\dfrac{55}{10} = 5.5$.",
    },
    source: ORIGINAL,
  },

  // ── Assertion–Reason ──────────────────────────────────────────────────────
  {
    key: "math-ar-001",
    chapter: "real-numbers",
    topics: ["fundamental-theorem-arithmetic"],
    type: "ASSERTION_REASON",
    body: "**Assertion (A):** The number $6^n$, where $n$ is a natural number, can end with the digit $0$.\n\n**Reason (R):** Any number that ends with the digit $0$ has both $2$ and $5$ as prime factors.",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 90,
    options: arOptions("D"),
    answer: {
      correctValue: "D",
      solution:
        "$6^n = (2 \\times 3)^n = 2^n \\times 3^n$. By the Fundamental Theorem of Arithmetic this factorisation is unique, so $5$ never appears as a factor. A number ending in $0$ is divisible by $10 = 2 \\times 5$ and therefore must contain the factor $5$. Hence $6^n$ can never end in $0$: Assertion (A) is false. Reason (R) is a correct statement in its own right, so the answer is (D).",
      explanation:
        "R is true and is in fact the very reason A fails — but A itself is false, so (A) and (B) are both out. Read the assertion before reaching for 'R explains A'.",
    },
    source: ADAPTED(2023, "19"),
  },
  {
    key: "math-ar-002",
    chapter: "quadratic-equations",
    topics: ["discriminant-nature-of-roots"],
    type: "ASSERTION_REASON",
    body: "**Assertion (A):** The equation $x^2 - 6x + 9 = 0$ has two real and equal roots.\n\n**Reason (R):** A quadratic equation $ax^2 + bx + c = 0$ has real and equal roots when $b^2 - 4ac = 0$.",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 60,
    options: arOptions("A"),
    answer: {
      correctValue: "A",
      solution:
        "For $x^2 - 6x + 9 = 0$: $b^2 - 4ac = 36 - 36 = 0$, so the roots are real and equal (both $x = 3$). Assertion (A) is true. Reason (R) states the general condition correctly and is exactly why (A) holds, so the answer is (A).",
    },
    source: ORIGINAL,
  },

  // ── True/False ────────────────────────────────────────────────────────────
  {
    key: "math-tf-001",
    chapter: "real-numbers",
    topics: ["irrational-numbers"],
    type: "TRUE_FALSE",
    body: "State whether the following is true or false: *Every rational number is a real number.*",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 30,
    answer: {
      correctValue: "TRUE",
      acceptedValues: ["TRUE", "T", "true"],
      solution:
        "True. The real numbers are the union of the rationals and the irrationals, so every rational number is by definition real. The converse is false — $\\sqrt{2}$ is real but not rational.",
    },
    source: ORIGINAL,
  },
  {
    key: "math-tf-002",
    chapter: "polynomials",
    topics: ["polynomial-graphs"],
    type: "TRUE_FALSE",
    body: "State whether the following is true or false: *The graph of a quadratic polynomial always intersects the x-axis at two distinct points.*",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 45,
    answer: {
      correctValue: "FALSE",
      acceptedValues: ["FALSE", "F", "false"],
      solution:
        "False. The number of x-intercepts is decided by the discriminant. If $b^2 - 4ac > 0$ the parabola cuts the axis twice; if it equals $0$ it touches at exactly one point; if it is negative the parabola misses the axis entirely. So zero, one or two intersections are all possible.",
    },
    source: ORIGINAL,
  },

  // ── Fill in the blank ─────────────────────────────────────────────────────
  {
    key: "math-fb-001",
    chapter: "arithmetic-progressions",
    topics: ["ap-sum-of-n-terms"],
    type: "FILL_BLANK",
    body: "The sum of the first $n$ terms of an AP with first term $a$ and common difference $d$ is $S_n = $ ________.",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 45,
    answer: {
      correctValue: "n/2[2a+(n-1)d]",
      acceptedValues: [
        "n/2[2a+(n-1)d]",
        "n/2(2a+(n-1)d)",
        "(n/2)(2a+(n-1)d)",
        "n/2 * (2a + (n-1)d)",
      ],
      solution:
        "$S_n = \\dfrac{n}{2}\\big[2a + (n-1)d\\big]$, equivalently $\\dfrac{n}{2}(a + l)$ where $l$ is the last term.",
    },
    source: ORIGINAL,
  },
  {
    key: "math-fb-002",
    chapter: "introduction-to-trigonometry",
    topics: ["trigonometric-identities"],
    type: "FILL_BLANK",
    body: "For any acute angle $\\theta$, $\\sin^2\\theta + \\cos^2\\theta = $ ________.",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 30,
    answer: {
      correctValue: "1",
      acceptedValues: ["1", "one"],
      solution:
        "$\\sin^2\\theta + \\cos^2\\theta = 1$. This is the Pythagorean identity, and it follows directly from Pythagoras' theorem applied to a right triangle with hypotenuse $1$.",
    },
    source: ORIGINAL,
  },

  // ── Match the following ───────────────────────────────────────────────────
  {
    key: "math-match-001",
    chapter: "introduction-to-trigonometry",
    topics: ["trig-ratios-specific-angles"],
    type: "MATCH_FOLLOWING",
    body: "Match the trigonometric ratios in Column I with their values in Column II.\n\n| Column I | Column II |\n| --- | --- |\n| (i) $\\sin 30^\\circ$ | (p) $\\sqrt{2}$ |\n| (ii) $\\cos 30^\\circ$ | (q) $\\dfrac{1}{2}$ |\n| (iii) $\\tan 60^\\circ$ | (r) $\\dfrac{\\sqrt{3}}{2}$ |\n| (iv) $\\sec 45^\\circ$ | (s) $\\sqrt{3}$ |",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 90,
    answer: {
      correctValue: "i-q, ii-r, iii-s, iv-p",
      acceptedValues: [
        "i-q, ii-r, iii-s, iv-p",
        "i-q,ii-r,iii-s,iv-p",
        "(i)-q (ii)-r (iii)-s (iv)-p",
      ],
      solution:
        "$\\sin 30^\\circ = \\dfrac{1}{2}$ (q); $\\cos 30^\\circ = \\dfrac{\\sqrt{3}}{2}$ (r); $\\tan 60^\\circ = \\sqrt{3}$ (s); $\\sec 45^\\circ = \\dfrac{1}{\\cos 45^\\circ} = \\sqrt{2}$ (p).",
    },
    source: ORIGINAL,
  },

  // ── Very short answer (2 marks) ───────────────────────────────────────────
  {
    key: "math-vsa-001",
    chapter: "real-numbers",
    topics: ["hcf-lcm"],
    type: "VERY_SHORT_ANSWER",
    body: "Find the HCF and LCM of $510$ and $92$, and verify that $\\text{LCM} \\times \\text{HCF} = $ product of the two numbers.",
    marks: 2,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 180,
    answer: {
      correctValue: "HCF = 2, LCM = 23460",
      solution:
        "$510 = 2 \\times 3 \\times 5 \\times 17$ and $92 = 2^2 \\times 23$.\n\nHCF $= 2$ (the only common prime factor, to the lower power).\n\nLCM $= 2^2 \\times 3 \\times 5 \\times 17 \\times 23 = 23460$.\n\nVerification: $\\text{LCM} \\times \\text{HCF} = 23460 \\times 2 = 46920$, and $510 \\times 92 = 46920$. They agree.",
      markingScheme: [
        { step: "Correct prime factorisation of both numbers", marks: 0.5 },
        { step: "HCF = 2", marks: 0.5 },
        { step: "LCM = 23460", marks: 0.5 },
        { step: "Verification that both products equal 46920", marks: 0.5 },
      ],
    },
    source: ADAPTED(2023, "21"),
  },
  {
    key: "math-vsa-002",
    chapter: "linear-equations-two-variables",
    topics: ["consistency-of-pairs"],
    type: "VERY_SHORT_ANSWER",
    body: "Find the value of $k$ for which the pair of equations $2x + 3y = 7$ and $(k-1)x + (k+2)y = 3k$ has infinitely many solutions.",
    marks: 2,
    difficulty: "HARD",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 210,
    answer: {
      correctValue: "k = 7",
      acceptedValues: ["7", "k=7", "k = 7"],
      solution:
        "Infinitely many solutions require $\\dfrac{a_1}{a_2} = \\dfrac{b_1}{b_2} = \\dfrac{c_1}{c_2}$, that is $\\dfrac{2}{k-1} = \\dfrac{3}{k+2} = \\dfrac{7}{3k}$.\n\nFrom the first two: $2(k+2) = 3(k-1) \\Rightarrow 2k + 4 = 3k - 3 \\Rightarrow k = 7$.\n\nCheck against the third ratio: $\\dfrac{3}{9} = \\dfrac{1}{3}$ and $\\dfrac{7}{21} = \\dfrac{1}{3}$. Consistent, so $k = 7$.",
      markingScheme: [
        { step: "States the condition a₁/a₂ = b₁/b₂ = c₁/c₂", marks: 0.5 },
        { step: "Forms and solves 2(k+2) = 3(k−1)", marks: 1 },
        { step: "Verifies the third ratio also gives k = 7", marks: 0.5 },
      ],
      explanation:
        "Two of the three ratios are enough to *find* a candidate, but not to confirm it. A value satisfying only the first equality gives parallel lines — no solutions, not infinitely many.",
    },
    source: ADAPTED(2024, "22"),
  },

  // ── Short answer (3 marks) ────────────────────────────────────────────────
  {
    key: "math-sa-001",
    chapter: "real-numbers",
    topics: ["irrational-numbers"],
    type: "SHORT_ANSWER",
    body: "Prove that $\\sqrt{5}$ is an irrational number.",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 300,
    answer: {
      solution:
        "Suppose, for contradiction, that $\\sqrt{5}$ is rational. Then $\\sqrt{5} = \\dfrac{p}{q}$ for integers $p, q$ with $q \\neq 0$ and $\\gcd(p, q) = 1$.\n\nSquaring: $5q^2 = p^2$. So $5$ divides $p^2$, and since $5$ is prime, $5$ divides $p$. Write $p = 5m$.\n\nSubstituting: $5q^2 = 25m^2 \\Rightarrow q^2 = 5m^2$. By the same argument $5$ divides $q$.\n\nBut then $5$ is a common factor of $p$ and $q$, contradicting $\\gcd(p, q) = 1$. Hence no such $p, q$ exist and $\\sqrt{5}$ is irrational.",
      markingScheme: [
        { step: "Assumes √5 = p/q in lowest terms (correct set-up of contradiction)", marks: 1 },
        { step: "Deduces 5 | p from 5q² = p², citing that 5 is prime", marks: 1 },
        { step: "Deduces 5 | q and states the contradiction with gcd(p,q) = 1", marks: 1 },
      ],
      explanation:
        "The step that carries the proof is 'if $5 \\mid p^2$ then $5 \\mid p$', and it holds *because 5 is prime*. It is false for composites — $4 \\mid 6^2$ but $4 \\nmid 6$ — so the primality has to be said out loud.",
    },
    source: ADAPTED(2023, "27"),
  },
  {
    key: "math-sa-002",
    chapter: "arithmetic-progressions",
    topics: ["ap-sum-of-n-terms"],
    type: "SHORT_ANSWER",
    body: "Find the sum of the first $25$ terms of the AP $5,\\ 8,\\ 11,\\ 14,\\ \\dots$",
    marks: 3,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 210,
    answer: {
      correctValue: "1025",
      acceptedValues: ["1025"],
      solution:
        "Here $a = 5$, $d = 3$, $n = 25$.\n\n$S_{25} = \\dfrac{25}{2}\\big[2(5) + (25-1)(3)\\big] = \\dfrac{25}{2}\\big[10 + 72\\big] = \\dfrac{25}{2} \\times 82 = 25 \\times 41 = 1025$.",
      markingScheme: [
        { step: "Identifies a = 5 and d = 3", marks: 1 },
        { step: "Correct substitution into Sₙ = n/2[2a + (n−1)d]", marks: 1 },
        { step: "Arrives at 1025", marks: 1 },
      ],
    },
    source: ORIGINAL,
  },
  {
    key: "math-sa-003",
    chapter: "circles",
    topics: ["tangent-length-theorem"],
    type: "SHORT_ANSWER",
    body: "A quadrilateral $ABCD$ is drawn to circumscribe a circle. Prove that $AB + CD = AD + BC$.",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 300,
    answer: {
      solution:
        "Let the circle touch $AB$, $BC$, $CD$ and $DA$ at $P$, $Q$, $R$ and $S$ respectively.\n\nTangents drawn from an external point to a circle are equal in length, so:\n$AP = AS$, $BP = BQ$, $CR = CQ$, $DR = DS$.\n\nAdding all four: $AP + BP + CR + DR = AS + BQ + CQ + DS$.\n\nRegrouping, $(AP + PB) + (CR + RD) = (AS + SD) + (BQ + QC)$, that is $AB + CD = AD + BC$.",
      markingScheme: [
        {
          step: "Marks the four points of contact and states the equal-tangents property",
          marks: 1,
        },
        { step: "Writes all four pairs of equal tangent lengths", marks: 1 },
        { step: "Adds and regroups to obtain AB + CD = AD + BC", marks: 1 },
      ],
    },
    source: ADAPTED(2024, "29"),
  },
  {
    key: "math-sa-004",
    chapter: "areas-related-to-circles",
    topics: ["area-of-sector"],
    type: "SHORT_ANSWER",
    body: "Find the area of a sector of a circle of radius $7$ cm with a central angle of $60^\\circ$. (Use $\\pi = \\dfrac{22}{7}$)",
    marks: 3,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 180,
    answer: {
      correctValue: "77/3",
      acceptedValues: ["77/3", "25.67", "25.666", "25.67 cm^2"],
      tolerance: 0.05,
      unit: "cm²",
      solution:
        "Area of sector $= \\dfrac{\\theta}{360^\\circ} \\times \\pi r^2 = \\dfrac{60}{360} \\times \\dfrac{22}{7} \\times 7^2 = \\dfrac{1}{6} \\times \\dfrac{22}{7} \\times 49 = \\dfrac{1}{6} \\times 154 = \\dfrac{77}{3} \\approx 25.67$ cm².",
      markingScheme: [
        { step: "Correct formula (θ/360) × πr²", marks: 1 },
        { step: "Correct substitution", marks: 1 },
        { step: "Answer 77/3 ≈ 25.67 cm² with units", marks: 1 },
      ],
    },
    source: ORIGINAL,
  },

  // ── Numerical ─────────────────────────────────────────────────────────────
  {
    key: "math-num-001",
    chapter: "quadratic-equations",
    topics: ["quadratic-by-factorisation"],
    type: "NUMERICAL",
    body: "Find the roots of the quadratic equation $2x^2 - 5x + 3 = 0$ by factorisation.",
    marks: 2,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 150,
    answer: {
      correctValue: "3/2, 1",
      acceptedValues: ["3/2, 1", "1, 3/2", "1.5, 1", "x = 1, x = 3/2"],
      solution:
        "Split the middle term so the parts multiply to $2 \\times 3 = 6$ and add to $-5$: those are $-2$ and $-3$.\n\n$2x^2 - 2x - 3x + 3 = 0 \\Rightarrow 2x(x - 1) - 3(x - 1) = 0 \\Rightarrow (2x - 3)(x - 1) = 0$.\n\nSo $x = \\dfrac{3}{2}$ or $x = 1$.",
      markingScheme: [
        { step: "Correct splitting of the middle term", marks: 1 },
        { step: "Both roots stated", marks: 1 },
      ],
    },
    source: ORIGINAL,
  },
  {
    key: "math-num-002",
    chapter: "coordinate-geometry",
    topics: ["distance-formula"],
    type: "NUMERICAL",
    body: "If the point $P(x, y)$ is equidistant from $A(5, 1)$ and $B(-1, 5)$, find the relation between $x$ and $y$.",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 240,
    answer: {
      correctValue: "3x = 2y",
      acceptedValues: ["3x = 2y", "3x-2y=0", "3x − 2y = 0", "2y = 3x"],
      solution:
        "$PA = PB \\Rightarrow PA^2 = PB^2$:\n\n$(x-5)^2 + (y-1)^2 = (x+1)^2 + (y-5)^2$\n\n$x^2 - 10x + 25 + y^2 - 2y + 1 = x^2 + 2x + 1 + y^2 - 10y + 25$\n\n$-10x - 2y = 2x - 10y \\Rightarrow -12x + 8y = 0 \\Rightarrow 3x = 2y$.",
      markingScheme: [
        { step: "Sets PA² = PB² using the distance formula", marks: 1 },
        { step: "Expands both sides correctly", marks: 1 },
        { step: "Simplifies to 3x = 2y", marks: 1 },
      ],
      explanation:
        "Squaring both sides at the start avoids carrying surds through the whole calculation — and is legitimate because both distances are non-negative.",
    },
    source: ADAPTED(2023, "26"),
  },
  {
    key: "math-num-003",
    chapter: "probability",
    topics: ["probability-cards-dice"],
    type: "NUMERICAL",
    body: "Two dice are thrown together. Find the probability that the sum of the numbers appearing on them is $8$.",
    marks: 2,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 150,
    answer: {
      correctValue: "5/36",
      acceptedValues: ["5/36", "0.139", "0.1389"],
      tolerance: 0.001,
      solution:
        "Total outcomes $= 6 \\times 6 = 36$.\n\nFavourable outcomes summing to $8$: $(2,6), (3,5), (4,4), (5,3), (6,2)$ — five in all.\n\n$P = \\dfrac{5}{36}$.",
      markingScheme: [
        { step: "Total outcomes = 36", marks: 0.5 },
        { step: "Lists all five favourable ordered pairs", marks: 1 },
        { step: "Answer 5/36", marks: 0.5 },
      ],
      explanation:
        "The two dice are distinguishable, so $(3,5)$ and $(5,3)$ are different outcomes. Treating them as one gives $\\frac{3}{21}$, which is wrong.",
    },
    source: ORIGINAL,
  },
  {
    key: "math-num-004",
    chapter: "introduction-to-trigonometry",
    topics: ["trig-ratios-specific-angles"],
    type: "NUMERICAL",
    body: "If $\\tan(A + B) = \\sqrt{3}$ and $\\tan(A - B) = \\dfrac{1}{\\sqrt{3}}$, where $0^\\circ < A + B \\leq 90^\\circ$ and $A > B$, find $A$ and $B$.",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 210,
    answer: {
      correctValue: "A = 45°, B = 15°",
      acceptedValues: ["A = 45, B = 15", "A=45°, B=15°", "45 and 15"],
      solution:
        "$\\tan(A+B) = \\sqrt{3} = \\tan 60^\\circ \\Rightarrow A + B = 60^\\circ$.\n\n$\\tan(A-B) = \\dfrac{1}{\\sqrt{3}} = \\tan 30^\\circ \\Rightarrow A - B = 30^\\circ$.\n\nAdding: $2A = 90^\\circ \\Rightarrow A = 45^\\circ$. Subtracting: $2B = 30^\\circ \\Rightarrow B = 15^\\circ$.",
      markingScheme: [
        { step: "A + B = 60°", marks: 1 },
        { step: "A − B = 30°", marks: 1 },
        { step: "A = 45°, B = 15°", marks: 1 },
      ],
    },
    source: ADAPTED(2024, "25"),
  },

  // ── Long answer (5 marks) ─────────────────────────────────────────────────
  {
    key: "math-la-001",
    chapter: "applications-of-trigonometry",
    topics: ["heights-and-distances", "angle-of-elevation-depression"],
    type: "LONG_ANSWER",
    body: "The angle of elevation of the top of a tower from a point on the ground is $30^\\circ$. On walking $30$ m towards the tower along level ground, the angle of elevation becomes $60^\\circ$. Find the height of the tower and the distance of the original point from its foot.",
    marks: 5,
    difficulty: "HARD",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 420,
    answer: {
      correctValue: "height = 15√3 m ≈ 25.98 m, distance = 45 m",
      solution:
        "Let the height of the tower be $h$ m and the original distance from its foot be $d$ m.\n\nFrom the first position: $\\tan 30^\\circ = \\dfrac{h}{d} \\Rightarrow d = h\\sqrt{3}$.\n\nFrom the second position, $30$ m nearer: $\\tan 60^\\circ = \\dfrac{h}{d - 30} \\Rightarrow d - 30 = \\dfrac{h}{\\sqrt{3}}$.\n\nSubstituting: $h\\sqrt{3} - 30 = \\dfrac{h}{\\sqrt{3}}$. Multiplying through by $\\sqrt{3}$: $3h - 30\\sqrt{3} = h$, so $2h = 30\\sqrt{3}$ and $h = 15\\sqrt{3} \\approx 25.98$ m.\n\nThen $d = 15\\sqrt{3} \\times \\sqrt{3} = 45$ m.",
      markingScheme: [
        { step: "Correct labelled figure with both angles marked", marks: 1 },
        { step: "First equation from the 30° position", marks: 1 },
        { step: "Second equation from the 60° position", marks: 1 },
        { step: "Solves for h = 15√3 m", marks: 1 },
        { step: "Finds d = 45 m", marks: 1 },
      ],
      explanation:
        "The angle of elevation *increases* as you approach, so the $60^\\circ$ position is the nearer one. Assigning the angles the other way round produces a negative height, which is the usual sign this has gone wrong.",
    },
    source: ADAPTED(2023, "34"),
  },
  {
    key: "math-la-002",
    chapter: "triangles",
    topics: ["basic-proportionality-theorem", "similarity-criteria"],
    type: "LONG_ANSWER",
    body: "State and prove the Basic Proportionality Theorem (Thales' theorem): if a line is drawn parallel to one side of a triangle to intersect the other two sides at distinct points, the other two sides are divided in the same ratio.",
    marks: 5,
    difficulty: "HARD",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 480,
    answer: {
      solution:
        "**Given:** $\\triangle ABC$ with $DE \\parallel BC$, $D$ on $AB$ and $E$ on $AC$.\n**To prove:** $\\dfrac{AD}{DB} = \\dfrac{AE}{EC}$.\n**Construction:** Join $BE$ and $CD$. Draw $EM \\perp AB$ and $DN \\perp AC$.\n\n**Proof:** Area of $\\triangle ADE = \\dfrac{1}{2} \\times AD \\times EM$ and area of $\\triangle DBE = \\dfrac{1}{2} \\times DB \\times EM$, so\n$$\\frac{\\text{ar}(\\triangle ADE)}{\\text{ar}(\\triangle DBE)} = \\frac{AD}{DB}.$$\n\nSimilarly, using $DN$ as the common height,\n$$\\frac{\\text{ar}(\\triangle ADE)}{\\text{ar}(\\triangle DEC)} = \\frac{AE}{EC}.$$\n\nNow $\\triangle DBE$ and $\\triangle DEC$ stand on the same base $DE$ and lie between the same parallels $DE$ and $BC$, so they are equal in area.\n\nTherefore $\\dfrac{AD}{DB} = \\dfrac{AE}{EC}$. $\\blacksquare$",
      markingScheme: [
        { step: "Correct statement of the theorem with Given and To Prove", marks: 1 },
        { step: "Figure and construction (join BE, CD; draw EM ⊥ AB, DN ⊥ AC)", marks: 1 },
        { step: "First area ratio equals AD/DB", marks: 1 },
        { step: "Second area ratio equals AE/EC", marks: 1 },
        { step: "Uses equal areas of △DBE and △DEC to conclude", marks: 1 },
      ],
      explanation:
        "The whole proof turns on one observation: triangles on the same base and between the same parallels have equal areas. Without that step the two ratios cannot be linked.",
    },
    source: ORIGINAL,
  },
  {
    key: "math-la-003",
    chapter: "surface-areas-and-volumes",
    topics: ["volume-of-combination", "combination-of-solids"],
    type: "LONG_ANSWER",
    body: "A solid is in the shape of a cone standing on a hemisphere, both having the same radius $1$ cm, and the height of the cone equal to its radius. Find the volume of the solid in terms of $\\pi$. Also find its total surface area, leaving the answer in terms of $\\pi$ and surds where necessary.",
    marks: 5,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 420,
    answer: {
      correctValue: "Volume = π cm³",
      solution:
        "Here $r = 1$ cm and the cone's height $h = r = 1$ cm.\n\n**Volume** $=$ volume of cone $+$ volume of hemisphere\n$= \\dfrac{1}{3}\\pi r^2 h + \\dfrac{2}{3}\\pi r^3 = \\dfrac{1}{3}\\pi(1)^2(1) + \\dfrac{2}{3}\\pi(1)^3 = \\dfrac{\\pi}{3} + \\dfrac{2\\pi}{3} = \\pi$ cm³.\n\n**Surface area.** The slant height is $l = \\sqrt{r^2 + h^2} = \\sqrt{1 + 1} = \\sqrt{2}$ cm.\n\nOnly the curved surfaces are exposed — the cone's base coincides with the hemisphere's flat face and is not part of the surface.\n\nTotal surface area $= \\pi r l + 2\\pi r^2 = \\pi(1)(\\sqrt{2}) + 2\\pi(1)^2 = \\pi(\\sqrt{2} + 2)$ cm².",
      markingScheme: [
        { step: "Identifies r = 1 cm and h = 1 cm", marks: 1 },
        { step: "Volume of cone = π/3", marks: 1 },
        { step: "Volume of hemisphere = 2π/3, total π cm³", marks: 1 },
        { step: "Slant height l = √2 cm", marks: 1 },
        { step: "TSA = π(√2 + 2) cm², excluding the hidden circular face", marks: 1 },
      ],
      explanation:
        "The marks are usually lost on the surface area, not the volume: the circular face where the two solids meet is *inside* the solid and must not be counted.",
    },
    source: ADAPTED(2024, "33"),
  },
  {
    key: "math-la-004",
    chapter: "statistics",
    topics: ["mean-grouped-data"],
    type: "LONG_ANSWER",
    body: "Find the mean of the following frequency distribution.\n\n| Class interval | Frequency |\n| --- | --- |\n| 0 – 10 | 5 |\n| 10 – 20 | 8 |\n| 20 – 30 | 15 |\n| 30 – 40 | 16 |\n| 40 – 50 | 6 |",
    marks: 5,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 360,
    answer: {
      correctValue: "27",
      acceptedValues: ["27", "27.0"],
      solution:
        "Take class marks $x_i$ as the midpoints:\n\n| Class | $f_i$ | $x_i$ | $f_i x_i$ |\n| --- | --- | --- | --- |\n| 0–10 | 5 | 5 | 25 |\n| 10–20 | 8 | 15 | 120 |\n| 20–30 | 15 | 25 | 375 |\n| 30–40 | 16 | 35 | 560 |\n| 40–50 | 6 | 45 | 270 |\n| **Total** | **50** | | **1350** |\n\n$\\bar{x} = \\dfrac{\\sum f_i x_i}{\\sum f_i} = \\dfrac{1350}{50} = 27$.",
      markingScheme: [
        { step: "Computes all five class marks correctly", marks: 1 },
        { step: "Computes all five fᵢxᵢ products", marks: 2 },
        { step: "Σfᵢ = 50 and Σfᵢxᵢ = 1350", marks: 1 },
        { step: "Mean = 27", marks: 1 },
      ],
    },
    source: ORIGINAL,
  },

  // ── Case-based (4 marks, sub-parts fixed at 1 + 1 + 2) ────────────────────
  //
  // Class 10 Maths prescribes this split exactly. The container holds the
  // stimulus and is never attempted directly; each sub-part is attempted,
  // graded and tracked on its own, which is what lets a case study span two
  // topics without lying about either.
  {
    key: "math-case-001",
    chapter: "arithmetic-progressions",
    topics: ["ap-nth-term", "ap-sum-of-n-terms"],
    type: "CASE_BASED",
    body: "**The school auditorium**\n\nA school is building a new auditorium. The seats are arranged in rows so that the first row has $20$ seats, and every row after that has $2$ more seats than the row in front of it. The auditorium has $30$ rows in total.\n\nBased on the above information, answer the following questions.",
    marks: 4,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 420,
    source: ORIGINAL,
    subParts: [
      {
        key: "math-case-001-i",
        type: "VERY_SHORT_ANSWER",
        body: "(i) Write the common difference of the arithmetic progression formed by the number of seats in each row.",
        marks: 1,
        topics: ["ap-nth-term"],
        answer: {
          correctValue: "2",
          acceptedValues: ["2", "d = 2"],
          solution: "Each row has $2$ more seats than the previous one, so $d = 2$.",
        },
      },
      {
        key: "math-case-001-ii",
        type: "VERY_SHORT_ANSWER",
        body: "(ii) How many seats are there in the $10^{\\text{th}}$ row?",
        marks: 1,
        topics: ["ap-nth-term"],
        answer: {
          correctValue: "38",
          acceptedValues: ["38"],
          solution: "$a_{10} = a + 9d = 20 + 9(2) = 38$ seats.",
        },
      },
      {
        key: "math-case-001-iii",
        type: "SHORT_ANSWER",
        body: "(iii) Find the total number of seats in the auditorium.",
        marks: 2,
        topics: ["ap-sum-of-n-terms"],
        answer: {
          correctValue: "1470",
          acceptedValues: ["1470"],
          solution:
            "$S_{30} = \\dfrac{30}{2}\\big[2(20) + (30-1)(2)\\big] = 15\\big[40 + 58\\big] = 15 \\times 98 = 1470$ seats.",
          markingScheme: [
            { step: "Correct substitution into Sₙ = n/2[2a + (n−1)d]", marks: 1 },
            { step: "Answer 1470 seats", marks: 1 },
          ],
        },
      },
    ],
  },
  {
    key: "math-case-002",
    chapter: "coordinate-geometry",
    topics: ["distance-formula", "section-formula"],
    type: "CASE_BASED",
    body: "**Designing a park**\n\nA rectangular park is laid out on a survey map using a coordinate grid, where one unit represents $10$ metres. Its corners are at $A(1, 1)$, $B(9, 1)$, $C(9, 7)$ and $D(1, 7)$. A fountain is to be installed at the mid-point of the diagonal $AC$.\n\nBased on the above information, answer the following questions.",
    marks: 4,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 420,
    source: ORIGINAL,
    subParts: [
      {
        key: "math-case-002-i",
        type: "VERY_SHORT_ANSWER",
        body: "(i) Find the coordinates of the point where the fountain will be installed.",
        marks: 1,
        topics: ["section-formula"],
        answer: {
          correctValue: "(5, 4)",
          acceptedValues: ["(5, 4)", "(5,4)", "5, 4"],
          solution:
            "The mid-point of $A(1,1)$ and $C(9,7)$ is $\\left(\\dfrac{1+9}{2}, \\dfrac{1+7}{2}\\right) = (5, 4)$.",
        },
      },
      {
        key: "math-case-002-ii",
        type: "VERY_SHORT_ANSWER",
        body: "(ii) Find the length of side $AB$ in units.",
        marks: 1,
        topics: ["distance-formula"],
        answer: {
          correctValue: "8",
          acceptedValues: ["8", "8 units"],
          solution: "$A$ and $B$ share a $y$-coordinate, so $AB = |9 - 1| = 8$ units.",
        },
      },
      {
        key: "math-case-002-iii",
        type: "SHORT_ANSWER",
        body: "(iii) Find the length of the diagonal $AC$ in units, and hence its actual length in metres.",
        marks: 2,
        topics: ["distance-formula"],
        answer: {
          correctValue: "10 units = 100 m",
          acceptedValues: ["10 units, 100 m", "10, 100"],
          solution:
            "$AC = \\sqrt{(9-1)^2 + (7-1)^2} = \\sqrt{64 + 36} = \\sqrt{100} = 10$ units.\n\nSince one unit is $10$ m, the actual diagonal is $10 \\times 10 = 100$ m.",
          markingScheme: [
            { step: "Applies the distance formula to get 10 units", marks: 1 },
            { step: "Converts to 100 m using the given scale", marks: 1 },
          ],
        },
      },
    ],
  },
  {
    key: "math-case-003",
    chapter: "surface-areas-and-volumes",
    topics: ["combination-of-solids", "volume-of-combination"],
    type: "CASE_BASED",
    body: "**The rooftop water tank**\n\nA housing society installs a cylindrical water tank of diameter $1.4$ m and height $2.1$ m on a rooftop. The tank is closed with a hemispherical lid of the same diameter. (Use $\\pi = \\dfrac{22}{7}$)\n\nBased on the above information, answer the following questions.",
    marks: 4,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 420,
    source: ORIGINAL,
    subParts: [
      {
        key: "math-case-003-i",
        type: "VERY_SHORT_ANSWER",
        body: "(i) What is the radius of the tank, in metres?",
        marks: 1,
        answer: {
          correctValue: "0.7",
          acceptedValues: ["0.7", "0.7 m", "7/10"],
          solution: "The radius is half the diameter: $\\dfrac{1.4}{2} = 0.7$ m.",
        },
      },
      {
        key: "math-case-003-ii",
        type: "VERY_SHORT_ANSWER",
        body: "(ii) Write the formula for the curved surface area of a hemisphere of radius $r$.",
        marks: 1,
        answer: {
          correctValue: "2πr²",
          acceptedValues: ["2πr²", "2*pi*r^2", "2 pi r^2"],
          solution:
            "The curved surface area of a hemisphere is $2\\pi r^2$ — half of a sphere's $4\\pi r^2$. The flat circular face is not included.",
        },
      },
      {
        key: "math-case-003-iii",
        type: "NUMERICAL",
        body: "(iii) Find the volume of the cylindrical part of the tank, in cubic metres.",
        marks: 2,
        topics: ["volume-of-combination"],
        answer: {
          correctValue: "3.234",
          acceptedValues: ["3.234", "3.234 m^3"],
          tolerance: 0.005,
          unit: "m³",
          solution:
            "$V = \\pi r^2 h = \\dfrac{22}{7} \\times (0.7)^2 \\times 2.1 = \\dfrac{22}{7} \\times 0.49 \\times 2.1 = 1.54 \\times 2.1 = 3.234$ m³.",
          markingScheme: [
            { step: "Correct formula and substitution πr²h", marks: 1 },
            { step: "Answer 3.234 m³ with units", marks: 1 },
          ],
        },
      },
    ],
  },
];
