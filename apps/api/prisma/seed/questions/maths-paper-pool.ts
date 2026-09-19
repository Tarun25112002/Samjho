import type { SeedQuestion } from "../types.js";

/**
 * The questions a full Maths paper needs and the coverage set did not have.
 *
 * ## Why this file exists separately
 *
 * `maths.ts` is a *coverage* set: one real example of each of the ten question
 * types, so the renderer has something genuine to be built against. That is a
 * different job from filling a paper, and a paper has requirements the coverage
 * set never had to meet — the generator reported them exactly:
 *
 *   Section D  5m  LONG_ANSWER | NUMERICAL   needed 6, had 5
 *   Section E  4m  CASE_BASED (1+1+2)        needed 6, had 3
 *
 * Six rather than three in Section E because every position carries an internal
 * choice, so a three-question section costs six questions. That is the sort of
 * arithmetic that is obvious in hindsight and invisible until a generator
 * refuses to write a paper.
 *
 * Keeping these apart from the coverage set means the reason each group exists
 * stays legible. Merged, this would be forty questions with no explanation of
 * why Section E has six case studies and no other chapter has any.
 *
 * ## The sub-part split is not a style choice
 *
 * `cbse-10-maths-standard.ts` specifies `{ mode: "FIXED", marks: [1, 1, 2] }`
 * for Section E. Every case study here is 1 + 1 + 2 for that reason, and a
 * four-mark case study split any other way would be rejected by the validator
 * rather than quietly producing a paper that does not match the pattern.
 */

const ORIGINAL = { sourceType: "ORIGINAL", licenceStatus: "CLEARED" } as const;

export const class10MathsPaperPool: SeedQuestion[] = [
  // ── Section D: five-mark long answers ─────────────────────────────────────
  {
    key: "math-pool-la-001",
    chapter: "surface-areas-and-volumes",
    topics: ["combination-of-solids"],
    type: "LONG_ANSWER",
    body: "A tent is in the shape of a cylinder surmounted by a cone. The cylindrical part has height $3\\ \\text{m}$ and base radius $14\\ \\text{m}$, and the conical part has slant height $15\\ \\text{m}$. Find the area of canvas required for the tent, and the cost of the canvas at $\\overline{\\text{Rs}}\\ 80$ per square metre. Take $\\pi = \\dfrac{22}{7}$.",
    marks: 5,
    difficulty: "HARD",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 420,
    answer: {
      solution:
        "Canvas covers the curved surfaces only — the tent has no floor of canvas and no lid between the two parts.\n\nCurved surface of the cylinder $= 2\\pi r h = 2 \\times \\dfrac{22}{7} \\times 14 \\times 3 = 264\\ \\text{m}^2$.\n\nCurved surface of the cone $= \\pi r l = \\dfrac{22}{7} \\times 14 \\times 15 = 660\\ \\text{m}^2$.\n\nTotal canvas $= 264 + 660 = 924\\ \\text{m}^2$.\n\nCost $= 924 \\times 80 = \\overline{\\text{Rs}}\\ 73{,}920$.",
      markingScheme: [
        { step: "Identifies that only the curved surfaces are covered", marks: 1 },
        { step: "Curved surface area of the cylinder", marks: 1.5 },
        { step: "Curved surface area of the cone", marks: 1.5 },
        { step: "Total area and cost", marks: 1 },
      ],
      hint: "Work out which surfaces the canvas actually covers before reaching for a formula. A tent has no canvas floor, and the join between the cone and the cylinder is not a surface either.",
    },
    source: ORIGINAL,
  },
  {
    key: "math-pool-la-002",
    chapter: "applications-of-trigonometry",
    topics: ["heights-and-distances"],
    type: "LONG_ANSWER",
    body: "From the top of a tower $60\\ \\text{m}$ high, the angles of depression of the top and the bottom of a building are $30^\\circ$ and $60^\\circ$ respectively. Find the height of the building and its distance from the tower.",
    marks: 5,
    difficulty: "HARD",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 480,
    answer: {
      solution:
        "Let the horizontal distance between the tower and the building be $d$, and the building's height be $h$.\n\nFrom the foot of the building, the angle of depression is $60^\\circ$, so $\\tan 60^\\circ = \\dfrac{60}{d}$, giving $\\sqrt{3} = \\dfrac{60}{d}$ and $d = \\dfrac{60}{\\sqrt{3}} = 20\\sqrt{3}\\ \\text{m} \\approx 34.64\\ \\text{m}$.\n\nFrom the top of the building, the vertical drop is $60 - h$ and the angle is $30^\\circ$, so $\\tan 30^\\circ = \\dfrac{60 - h}{d}$, giving $\\dfrac{1}{\\sqrt{3}} = \\dfrac{60-h}{20\\sqrt{3}}$.\n\nSo $60 - h = 20$, and $h = 40\\ \\text{m}$.\n\nThe building is $40\\ \\text{m}$ tall and $20\\sqrt{3} \\approx 34.64\\ \\text{m}$ from the tower.",
      markingScheme: [
        { step: "Correct figure with both angles of depression marked", marks: 1 },
        { step: "Uses the bottom-of-building angle to find $d$", marks: 1.5 },
        { step: "Uses the top-of-building angle with the drop $60 - h$", marks: 1.5 },
        { step: "States both the height and the distance", marks: 1 },
      ],
      hint: "Draw it, and label the vertical drop to the *top* of the building as $60 - h$ rather than $h$. Getting that one expression right is most of the question.",
    },
    source: ORIGINAL,
  },

  // ── Section E: four-mark case studies, split 1 + 1 + 2 ─────────────────────
  {
    key: "math-pool-case-001",
    chapter: "probability",
    topics: ["theoretical-probability"],
    type: "CASE_BASED",
    body: "**The school fete**\n\nA game stall at a school fete has a box containing $8$ red tokens, $5$ green tokens and $7$ blue tokens, identical except for colour. A player draws one token at random without looking. A red token wins a prize.\n\nBased on the above information, answer the following questions.",
    marks: 4,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 420,
    source: ORIGINAL,
    subParts: [
      {
        key: "math-pool-case-001-i",
        type: "VERY_SHORT_ANSWER",
        body: "(i) How many tokens are there in the box altogether?",
        marks: 1,
        topics: ["theoretical-probability"],
        answer: {
          correctValue: "20",
          acceptedValues: ["20"],
          solution: "$8 + 5 + 7 = 20$ tokens.",
        },
      },
      {
        key: "math-pool-case-001-ii",
        type: "VERY_SHORT_ANSWER",
        body: "(ii) What is the probability that a player wins a prize on one draw?",
        marks: 1,
        topics: ["theoretical-probability"],
        answer: {
          correctValue: "2/5",
          acceptedValues: ["2/5", "8/20", "0.4"],
          solution: "$P(\\text{red}) = \\dfrac{8}{20} = \\dfrac{2}{5}$.",
        },
      },
      {
        key: "math-pool-case-001-iii",
        type: "SHORT_ANSWER",
        body: "(iii) The stall keeper wants the probability of winning to be exactly $\\dfrac{1}{2}$. How many extra red tokens must be added, assuming no other tokens are added or removed?",
        marks: 2,
        topics: ["theoretical-probability"],
        answer: {
          solution:
            "Let $x$ red tokens be added. Then $\\dfrac{8 + x}{20 + x} = \\dfrac{1}{2}$.\n\nCross-multiplying: $16 + 2x = 20 + x$, so $x = 4$.\n\nFour extra red tokens are needed.",
          markingScheme: [
            {
              step: "Forms the equation with $x$ added to both numerator and denominator",
              marks: 1,
            },
            { step: "Solves correctly to $x = 4$", marks: 1 },
          ],
        },
      },
    ],
  },
  {
    key: "math-pool-case-002",
    chapter: "statistics",
    topics: ["mean-grouped-data"],
    type: "CASE_BASED",
    body: "**Daily wages at a workshop**\n\nThe daily wages of $50$ workers at a workshop are recorded as follows.\n\n| Daily wage (Rs) | Number of workers |\n| --- | --- |\n| $200-300$ | $12$ |\n| $300-400$ | $14$ |\n| $400-500$ | $8$ |\n| $500-600$ | $6$ |\n| $600-700$ | $10$ |\n\nBased on the above information, answer the following questions.",
    marks: 4,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 480,
    source: ORIGINAL,
    subParts: [
      {
        key: "math-pool-case-002-i",
        type: "VERY_SHORT_ANSWER",
        body: "(i) Write the modal class of this distribution.",
        marks: 1,
        topics: ["mode-grouped-data"],
        answer: {
          correctValue: "300-400",
          acceptedValues: ["300-400", "300 - 400", "300–400"],
          solution: "The highest frequency is $14$, which belongs to the class $300-400$.",
        },
      },
      {
        key: "math-pool-case-002-ii",
        type: "VERY_SHORT_ANSWER",
        body: "(ii) What is the class mark of the interval $500-600$?",
        marks: 1,
        topics: ["mean-grouped-data"],
        answer: {
          correctValue: "550",
          acceptedValues: ["550"],
          solution: "Class mark $= \\dfrac{500 + 600}{2} = 550$.",
        },
      },
      {
        key: "math-pool-case-002-iii",
        type: "SHORT_ANSWER",
        body: "(iii) Find the mean daily wage of the workers.",
        marks: 2,
        topics: ["mean-grouped-data"],
        answer: {
          solution:
            "Class marks are $250,\\ 350,\\ 450,\\ 550,\\ 650$.\n\n$\\sum f_i x_i = 12(250) + 14(350) + 8(450) + 6(550) + 10(650)$\n$= 3000 + 4900 + 3600 + 3300 + 6500 = 21{,}300$.\n\nMean $= \\dfrac{21300}{50} = \\overline{\\text{Rs}}\\ 426$.",
          markingScheme: [
            { step: "Class marks and $\\sum f_i x_i$ computed", marks: 1 },
            { step: "Mean stated as 426", marks: 1 },
          ],
        },
      },
    ],
  },
  {
    key: "math-pool-case-003",
    chapter: "circles",
    topics: ["tangent-length-theorem"],
    type: "CASE_BASED",
    body: "**A circular flower bed**\n\nA circular flower bed of radius $7\\ \\text{m}$ has its centre at $O$. A straight path touches the bed at exactly one point $P$. A bench stands at a point $Q$ on the path, $24\\ \\text{m}$ from $P$.\n\nBased on the above information, answer the following questions.",
    marks: 4,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 420,
    source: ORIGINAL,
    subParts: [
      {
        key: "math-pool-case-003-i",
        type: "VERY_SHORT_ANSWER",
        body: "(i) What is the measure of $\\angle OPQ$?",
        marks: 1,
        topics: ["tangent-to-circle"],
        answer: {
          correctValue: "90",
          acceptedValues: ["90", "90 degrees", "90°"],
          solution:
            "A tangent is perpendicular to the radius at the point of contact, so $\\angle OPQ = 90^\\circ$.",
        },
      },
      {
        key: "math-pool-case-003-ii",
        type: "VERY_SHORT_ANSWER",
        body: "(ii) Name the theorem that gives the answer to part (i).",
        marks: 1,
        topics: ["tangent-to-circle"],
        answer: {
          correctValue: "tangent perpendicular to radius",
          acceptedValues: [
            "tangent perpendicular to radius",
            "the tangent at any point of a circle is perpendicular to the radius through the point of contact",
          ],
          solution:
            "The tangent at any point of a circle is perpendicular to the radius through the point of contact.",
        },
      },
      {
        key: "math-pool-case-003-iii",
        type: "SHORT_ANSWER",
        body: "(iii) Find the distance $OQ$ from the centre of the bed to the bench.",
        marks: 2,
        topics: ["tangent-length-theorem"],
        answer: {
          solution:
            "$\\triangle OPQ$ is right-angled at $P$, so by Pythagoras:\n\n$OQ^2 = OP^2 + PQ^2 = 7^2 + 24^2 = 49 + 576 = 625$.\n\n$OQ = 25\\ \\text{m}$.",
          markingScheme: [
            { step: "Applies Pythagoras in the right triangle", marks: 1 },
            { step: "States $OQ = 25\\ \\text{m}$", marks: 1 },
          ],
        },
      },
    ],
  },
  {
    key: "math-pool-case-004",
    chapter: "surface-areas-and-volumes",
    topics: ["volume-of-combination"],
    type: "CASE_BASED",
    body: "**The village water tank**\n\nA village water tank is cylindrical, with an internal radius of $3.5\\ \\text{m}$ and a height of $4\\ \\text{m}$. It is filled to the brim each morning. Take $\\pi = \\dfrac{22}{7}$.\n\nBased on the above information, answer the following questions.",
    marks: 4,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 420,
    source: ORIGINAL,
    subParts: [
      {
        key: "math-pool-case-004-i",
        type: "VERY_SHORT_ANSWER",
        body: "(i) Write the formula for the volume of a cylinder.",
        marks: 1,
        topics: ["volume-of-combination"],
        answer: {
          correctValue: "pi r squared h",
          acceptedValues: ["pi r squared h", "πr²h", "\\pi r^2 h", "V = πr²h"],
          solution: "$V = \\pi r^2 h$.",
        },
      },
      {
        key: "math-pool-case-004-ii",
        type: "VERY_SHORT_ANSWER",
        body: "(ii) How many litres are there in one cubic metre?",
        marks: 1,
        topics: ["volume-of-combination"],
        answer: {
          correctValue: "1000",
          acceptedValues: ["1000", "1,000"],
          solution: "$1\\ \\text{m}^3 = 1000$ litres.",
        },
      },
      {
        key: "math-pool-case-004-iii",
        type: "SHORT_ANSWER",
        body: "(iii) If each household uses $140$ litres a day, how many households can the full tank supply for one day?",
        marks: 2,
        topics: ["volume-of-combination"],
        answer: {
          solution:
            "Volume $= \\dfrac{22}{7} \\times (3.5)^2 \\times 4 = \\dfrac{22}{7} \\times 12.25 \\times 4 = 154\\ \\text{m}^3$.\n\nIn litres: $154 \\times 1000 = 154{,}000$ litres.\n\nHouseholds supplied $= \\dfrac{154000}{140} = 1100$.",
          markingScheme: [
            { step: "Volume computed and converted to litres", marks: 1 },
            { step: "Divides by the daily use to get 1100", marks: 1 },
          ],
        },
      },
    ],
  },
];
