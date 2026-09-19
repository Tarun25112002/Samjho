import type { SeedQuestion } from "../types.js";

/**
 * The questions a full Science paper needs and the coverage set did not have.
 *
 * Same job as `maths-paper-pool.ts`, against the generator's own report:
 *
 *   Section B  2m  VERY_SHORT_ANSWER | SHORT_ANSWER  needed 8, had 3
 *   Section D  5m  LONG_ANSWER                       needed 6, had 3
 *   Section E  4m  CASE_BASED (2+ parts, 1/2/3 each) needed 6, had 3
 *
 * Section E's split is `{ mode: "CONSTRAINED", allowedMarks: [1,2,3],
 * minParts: 2 }` rather than Maths' fixed 1+1+2 — the blueprint's own note says
 * 1+1+2, 1+3 and 2+2 are all legal in the same paper. The four here use
 * different splits on purpose, because a generator that only ever met one shape
 * would not be exercising the constraint it was written for.
 *
 * Questions are spread across Physics, Chemistry and Biology in roughly the
 * proportion the paper uses, so a generated paper is not accidentally three
 * quarters Physics.
 */

const ORIGINAL = { sourceType: "ORIGINAL", licenceStatus: "CLEARED" } as const;

export const class10SciencePaperPool: SeedQuestion[] = [
  // ── Section B: two-mark short answers ─────────────────────────────────────
  {
    key: "sci-pool-sa-001",
    chapter: "life-processes",
    topics: ["respiration"],
    type: "SHORT_ANSWER",
    body: "Give two differences between aerobic and anaerobic respiration.",
    marks: 2,
    difficulty: "EASY",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 150,
    answer: {
      solution:
        "1. Aerobic respiration takes place in the presence of oxygen; anaerobic respiration takes place without it.\n\n2. Aerobic respiration releases far more energy per glucose molecule, and its end products are carbon dioxide and water, whereas anaerobic respiration yields less energy and produces ethanol and carbon dioxide (in yeast) or lactic acid (in muscle).",
      markingScheme: [
        { step: "Difference in oxygen requirement", marks: 1 },
        { step: "Difference in energy released or end products", marks: 1 },
      ],
      hint: "Two differences means two distinct axes of comparison, not the same one said twice. Oxygen is the obvious first; energy or end products is the second.",
    },
    source: ORIGINAL,
  },
  {
    key: "sci-pool-sa-002",
    chapter: "human-eye-and-colourful-world",
    topics: ["atmospheric-refraction"],
    type: "SHORT_ANSWER",
    body: "Why does the sun appear reddish at sunrise and sunset?",
    marks: 2,
    difficulty: "MEDIUM",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 150,
    answer: {
      solution:
        "Near the horizon, sunlight travels a much longer path through the atmosphere than it does at noon.\n\nOver that longer path most of the shorter wavelengths — the blues — are scattered away, so the light that reaches the eye is dominated by the longer red wavelengths.",
      markingScheme: [
        { step: "Longer path through the atmosphere near the horizon", marks: 1 },
        { step: "Preferential scattering of shorter wavelengths", marks: 1 },
      ],
      hint: "The answer is the same scattering that makes the sky blue, applied to a longer path. What has been removed from the light by the time it reaches you?",
    },
    source: ORIGINAL,
  },
  {
    key: "sci-pool-sa-003",
    chapter: "electricity",
    topics: ["heating-effect-power"],
    type: "SHORT_ANSWER",
    body: "Why is tungsten used for the filament of an electric bulb?",
    marks: 2,
    difficulty: "EASY",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 120,
    answer: {
      solution:
        "Tungsten has a very high melting point of about $3380^\\circ\\text{C}$, so it can be raised to the temperature at which it glows white-hot without melting.\n\nIt also has high resistivity, so it produces a large heating effect for the current passing through it, and it retains most of the heat rather than losing it quickly.",
      markingScheme: [
        { step: "Very high melting point", marks: 1 },
        { step: "High resistivity or heat retention", marks: 1 },
      ],
      hint: "Two marks means two properties. One is about what tungsten survives; the other is about what it does to the current.",
    },
    source: ORIGINAL,
  },
  {
    key: "sci-pool-sa-004",
    chapter: "magnetic-effects-of-electric-current",
    topics: ["field-due-to-conductor"],
    type: "SHORT_ANSWER",
    body: "State two differences between direct current and alternating current.",
    marks: 2,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 120,
    answer: {
      solution:
        "1. Direct current flows in one direction only; alternating current reverses its direction periodically — in India, $50$ times per second, so it changes direction every $\\frac{1}{100}$ of a second.\n\n2. Direct current cannot be transmitted over long distances without large losses, whereas alternating current can be stepped up to high voltage by a transformer and transmitted efficiently.",
      markingScheme: [
        { step: "Direction of flow", marks: 1 },
        { step: "Transmission over distance, or any other valid difference", marks: 1 },
      ],
      hint: "The first difference is in the name. For the second, think about why the electricity arriving at your house is AC rather than DC.",
    },
    source: ORIGINAL,
  },
  {
    key: "sci-pool-sa-005",
    chapter: "acids-bases-and-salts",
    topics: ["ph-scale"],
    type: "SHORT_ANSWER",
    body: "Why does tooth decay start when the pH of the mouth falls below $5.5$?",
    marks: 2,
    difficulty: "MEDIUM",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 150,
    answer: {
      solution:
        "Tooth enamel is made of calcium phosphate, the hardest substance in the body, and it does not dissolve in water — but it is corroded by acid.\n\nBacteria in the mouth break down sugar left after eating and produce acids. When enough acid is produced for the pH to fall below $5.5$, the enamel begins to be attacked, and decay starts.",
      markingScheme: [
        { step: "Enamel is calcium phosphate and is corroded by acid", marks: 1 },
        { step: "Bacteria produce acid from leftover sugar, lowering the pH", marks: 1 },
      ],
      hint: "Two things have to be said: what the enamel is made of and why acid matters to it, and where the acid in a mouth comes from.",
    },
    source: ORIGINAL,
  },
  {
    key: "sci-pool-sa-006",
    chapter: "our-environment",
    topics: ["food-chains-webs"],
    type: "SHORT_ANSWER",
    body: "What is biomagnification? Give one example.",
    marks: 2,
    difficulty: "MEDIUM",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 150,
    answer: {
      solution:
        "Biomagnification is the progressive increase in the concentration of a harmful, non-biodegradable substance at each successive trophic level of a food chain.\n\nFor example, pesticides sprayed on crops are absorbed by plants, eaten by herbivores and then by carnivores; because they are not broken down or excreted, their concentration is highest in the organisms at the top — including humans.",
      markingScheme: [
        { step: "Correct definition, naming increasing concentration up trophic levels", marks: 1 },
        { step: "A valid example", marks: 1 },
      ],
      hint: "The key word is non-biodegradable. If a substance cannot be broken down or excreted, what happens to it as it moves up a food chain?",
    },
    source: ORIGINAL,
  },

  // ── Section D: five-mark long answers ─────────────────────────────────────
  {
    key: "sci-pool-la-001",
    chapter: "human-eye-and-colourful-world",
    topics: ["defects-of-vision"],
    type: "LONG_ANSWER",
    body: "What is meant by the power of accommodation of the eye? Name two common defects of vision, and for each state its cause and how it is corrected.",
    marks: 5,
    difficulty: "HARD",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 420,
    answer: {
      solution:
        "**Accommodation.** The ability of the eye lens to adjust its focal length, by the action of the ciliary muscles changing its curvature, so that objects at different distances are focused sharply on the retina.\n\n**Myopia (short-sightedness).** The image of a distant object forms in front of the retina. Causes: excessive curvature of the eye lens, or elongation of the eyeball. Corrected with a concave lens of suitable power, which diverges the rays slightly so the image falls on the retina.\n\n**Hypermetropia (long-sightedness).** The image of a nearby object forms behind the retina. Causes: the focal length of the eye lens is too long, or the eyeball is too short. Corrected with a convex lens of suitable power, which converges the rays sooner.",
      markingScheme: [
        { step: "Defines accommodation, mentioning the ciliary muscles", marks: 1 },
        { step: "Names myopia with its cause", marks: 1 },
        { step: "Correction of myopia with a concave lens", marks: 1 },
        { step: "Names hypermetropia with its cause", marks: 1 },
        { step: "Correction of hypermetropia with a convex lens", marks: 1 },
      ],
      hint: "Five marks, five things: the definition, then a cause and a correction for each of two defects. Decide where the image forms in each defect first — the lens needed follows from that.",
    },
    source: ORIGINAL,
  },
  {
    key: "sci-pool-la-002",
    chapter: "electricity",
    topics: ["series-parallel-resistors"],
    type: "LONG_ANSWER",
    body: "Derive an expression for the equivalent resistance of three resistors connected in parallel. Hence find the equivalent resistance when resistors of $6\\ \\Omega$, $12\\ \\Omega$ and $4\\ \\Omega$ are connected in parallel across a $12\\ \\text{V}$ battery, and calculate the total current drawn.",
    marks: 5,
    difficulty: "HARD",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 480,
    answer: {
      solution:
        "**Derivation.** In parallel, the potential difference $V$ across each resistor is the same, and the main current divides:\n\n$I = I_1 + I_2 + I_3$\n\nBy Ohm's law, $I_1 = \\dfrac{V}{R_1}$, $I_2 = \\dfrac{V}{R_2}$, $I_3 = \\dfrac{V}{R_3}$, and $I = \\dfrac{V}{R_p}$.\n\nSubstituting: $\\dfrac{V}{R_p} = \\dfrac{V}{R_1} + \\dfrac{V}{R_2} + \\dfrac{V}{R_3}$.\n\nDividing through by $V$: $\\dfrac{1}{R_p} = \\dfrac{1}{R_1} + \\dfrac{1}{R_2} + \\dfrac{1}{R_3}$.\n\n**Numerical.** $\\dfrac{1}{R_p} = \\dfrac{1}{6} + \\dfrac{1}{12} + \\dfrac{1}{4} = \\dfrac{2 + 1 + 3}{12} = \\dfrac{6}{12} = \\dfrac{1}{2}$, so $R_p = 2\\ \\Omega$.\n\nTotal current $I = \\dfrac{V}{R_p} = \\dfrac{12}{2} = 6\\ \\text{A}$.",
      markingScheme: [
        { step: "States that $V$ is common and the current divides", marks: 1 },
        { step: "Writes each branch current by Ohm's law", marks: 1 },
        { step: "Reaches the reciprocal relation", marks: 1 },
        { step: "Computes $R_p = 2\\ \\Omega$", marks: 1 },
        { step: "Computes the total current as $6\\ \\text{A}$", marks: 1 },
      ],
      hint: "Start from the two facts that define a parallel connection — the voltage is shared, the current is not — and the derivation writes itself. Check your answer: $R_p$ must come out smaller than the smallest resistor.",
    },
    source: ORIGINAL,
  },
  {
    key: "sci-pool-la-003",
    chapter: "carbon-and-its-compounds",
    topics: ["homologous-series"],
    type: "LONG_ANSWER",
    body: "What is a homologous series? Explain with an example, and list three characteristics of such a series. Why do the members of a homologous series show similar chemical properties but a gradation in physical properties?",
    marks: 5,
    difficulty: "HARD",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 450,
    answer: {
      solution:
        "**Definition.** A homologous series is a family of organic compounds with the same functional group, in which each successive member differs from the previous one by a $-\\text{CH}_2-$ unit.\n\n**Example.** The alkanes: methane $\\text{CH}_4$, ethane $\\text{C}_2\\text{H}_6$, propane $\\text{C}_3\\text{H}_8$, butane $\\text{C}_4\\text{H}_{10}$ — each differing from the last by $\\text{CH}_2$.\n\n**Characteristics.**\n1. All members can be represented by a single general formula (alkanes: $\\text{C}_n\\text{H}_{2n+2}$).\n2. Successive members differ by $\\text{CH}_2$, a mass difference of $14\\ \\text{u}$.\n3. Physical properties such as melting point, boiling point and solubility vary gradually with increasing molecular mass.\n\n**Why.** Chemical properties are determined by the functional group, which every member shares — so they react in the same ways. Physical properties depend on molecular size and mass, which change steadily along the series, so those change gradually rather than not at all.",
      markingScheme: [
        {
          step: "Correct definition naming the functional group and the $\\text{CH}_2$ difference",
          marks: 1,
        },
        { step: "A valid example with formulae", marks: 1 },
        { step: "Three characteristics stated", marks: 1.5 },
        { step: "Explains why chemical properties are alike", marks: 0.75 },
        { step: "Explains why physical properties vary gradually", marks: 0.75 },
      ],
      hint: "The last part is the one that carries the reasoning: ask which part of a molecule decides how it *reacts*, and which decides how it *melts*. They are not the same part.",
    },
    source: ORIGINAL,
  },
  {
    key: "sci-pool-la-004",
    chapter: "how-do-organisms-reproduce",
    topics: ["sexual-reproduction-plants"],
    type: "LONG_ANSWER",
    body: "Describe the process of fertilisation in a flowering plant. Name the parts that develop into the fruit and the seed after fertilisation.",
    marks: 5,
    difficulty: "MEDIUM",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 420,
    answer: {
      solution:
        "**Pollination.** Pollen grains from the anther are transferred to the stigma of a flower, by wind, water or an animal.\n\n**Pollen tube.** A pollen grain that lands on a compatible stigma germinates and grows a pollen tube down through the style towards the ovary.\n\n**Fertilisation.** The pollen tube reaches an ovule inside the ovary and releases the male gamete, which fuses with the female gamete (egg) in the ovule. This fusion is fertilisation, and it produces a zygote.\n\n**After fertilisation.** The zygote divides to form the embryo. The ovule develops into the seed, and the ovary develops into the fruit. The petals, sepals, stamens and stigma usually wither and fall off.",
      markingScheme: [
        { step: "Pollination described", marks: 1 },
        { step: "Germination and growth of the pollen tube", marks: 1 },
        { step: "Fusion of gametes forming the zygote", marks: 1 },
        { step: "Ovule becomes the seed", marks: 1 },
        { step: "Ovary becomes the fruit", marks: 1 },
      ],
      hint: "Tell it in order, from the pollen landing to the fruit forming. The last two marks are two specific structures becoming two specific things — do not leave them out.",
    },
    source: ORIGINAL,
  },

  // ── Section E: four-mark case studies, varying splits ──────────────────────
  {
    key: "sci-pool-case-001",
    chapter: "electricity",
    topics: ["ohms-law"],
    type: "CASE_BASED",
    body: "**A household circuit**\n\nAn electric iron rated $1000\\ \\text{W}$ and a bulb rated $100\\ \\text{W}$ are both designed to work on the $220\\ \\text{V}$ mains supply. They are connected in parallel, as household appliances always are.\n\nBased on the above information, answer the following questions.",
    marks: 4,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 420,
    source: ORIGINAL,
    subParts: [
      {
        key: "sci-pool-case-001-i",
        type: "VERY_SHORT_ANSWER",
        body: "(i) Write the relation between power, potential difference and current.",
        marks: 1,
        topics: ["heating-effect-power"],
        answer: {
          correctValue: "P = VI",
          acceptedValues: ["P = VI", "P=VI", "power = voltage x current"],
          solution: "$P = VI$.",
        },
      },
      {
        key: "sci-pool-case-001-ii",
        type: "SHORT_ANSWER",
        body: "(ii) Calculate the current drawn by the electric iron, and its resistance.",
        marks: 3,
        topics: ["ohms-law"],
        answer: {
          solution:
            "$I = \\dfrac{P}{V} = \\dfrac{1000}{220} \\approx 4.55\\ \\text{A}$.\n\n$R = \\dfrac{V}{I} = \\dfrac{220}{4.55} \\approx 48.4\\ \\Omega$, or directly $R = \\dfrac{V^2}{P} = \\dfrac{220^2}{1000} = 48.4\\ \\Omega$.",
          markingScheme: [
            { step: "Current computed from $P = VI$", marks: 1 },
            { step: "Resistance computed correctly", marks: 1 },
            { step: "Units stated on both", marks: 1 },
          ],
        },
      },
    ],
  },
  {
    key: "sci-pool-case-002",
    chapter: "metals-and-non-metals",
    topics: ["reactivity-series"],
    type: "CASE_BASED",
    body: "**The displacement experiment**\n\nA student places an iron nail in a test tube of blue copper sulphate solution and leaves it for thirty minutes. The solution gradually turns pale green, and a reddish-brown layer forms on the nail.\n\nBased on the above information, answer the following questions.",
    marks: 4,
    difficulty: "MEDIUM",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 420,
    source: ORIGINAL,
    subParts: [
      {
        key: "sci-pool-case-002-i",
        type: "VERY_SHORT_ANSWER",
        body: "(i) Name the type of reaction taking place.",
        marks: 1,
        topics: ["types-of-reactions"],
        answer: {
          correctValue: "displacement",
          acceptedValues: ["displacement", "displacement reaction", "single displacement"],
          solution: "It is a displacement reaction — iron displaces copper from its salt.",
        },
      },
      {
        key: "sci-pool-case-002-ii",
        type: "VERY_SHORT_ANSWER",
        body: "(ii) Identify the reddish-brown substance deposited on the nail.",
        marks: 1,
        topics: ["reactivity-series"],
        answer: {
          correctValue: "copper",
          acceptedValues: ["copper", "Cu"],
          solution: "The reddish-brown deposit is copper.",
        },
      },
      {
        key: "sci-pool-case-002-iii",
        type: "SHORT_ANSWER",
        body: "(iii) Write the balanced chemical equation, and explain why this reaction happens.",
        marks: 2,
        topics: ["reactivity-series"],
        answer: {
          solution:
            "$\\text{Fe} + \\text{CuSO}_4 \\rightarrow \\text{FeSO}_4 + \\text{Cu}$\n\nIron is above copper in the reactivity series, so it is the more reactive metal and displaces copper from copper sulphate solution. The pale green colour is iron(II) sulphate.",
          markingScheme: [
            { step: "Balanced equation", marks: 1 },
            { step: "Explanation in terms of the reactivity series", marks: 1 },
          ],
        },
      },
    ],
  },
  {
    key: "sci-pool-case-003",
    chapter: "light-reflection-and-refraction",
    topics: ["mirror-formula"],
    type: "CASE_BASED",
    body: "**The dentist's mirror**\n\nA dentist uses a concave mirror of focal length $4\\ \\text{cm}$ to examine a tooth. The mirror is held $2\\ \\text{cm}$ from the tooth.\n\nBased on the above information, answer the following questions.",
    marks: 4,
    difficulty: "HARD",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 450,
    source: ORIGINAL,
    subParts: [
      {
        key: "sci-pool-case-003-i",
        type: "VERY_SHORT_ANSWER",
        body: "(i) Write the mirror formula.",
        marks: 1,
        topics: ["mirror-formula"],
        answer: {
          correctValue: "1/v + 1/u = 1/f",
          acceptedValues: ["1/v + 1/u = 1/f", "1/f = 1/v + 1/u"],
          solution: "$\\dfrac{1}{v} + \\dfrac{1}{u} = \\dfrac{1}{f}$.",
        },
      },
      {
        key: "sci-pool-case-003-ii",
        type: "VERY_SHORT_ANSWER",
        body: "(ii) Why does a dentist choose a concave mirror rather than a plane one?",
        marks: 1,
        topics: ["spherical-mirrors"],
        answer: {
          correctValue: "it magnifies",
          acceptedValues: [
            "it magnifies",
            "it gives an enlarged image",
            "an object inside the focus gives an enlarged virtual image",
          ],
          solution:
            "A concave mirror gives an enlarged, erect, virtual image when the object is between the pole and the focus, so the tooth appears larger.",
        },
      },
      {
        key: "sci-pool-case-003-iii",
        type: "SHORT_ANSWER",
        body: "(iii) Find the position of the image and state its nature.",
        marks: 2,
        topics: ["mirror-formula"],
        answer: {
          solution:
            "Using the sign convention, $u = -2\\ \\text{cm}$ and $f = -4\\ \\text{cm}$.\n\n$\\dfrac{1}{v} = \\dfrac{1}{f} - \\dfrac{1}{u} = -\\dfrac{1}{4} + \\dfrac{1}{2} = \\dfrac{1}{4}$, so $v = +4\\ \\text{cm}$.\n\nA positive $v$ for a mirror means the image is behind the mirror: it is virtual, erect and magnified — magnification $m = -\\dfrac{v}{u} = -\\dfrac{4}{-2} = +2$, so twice the size.",
          markingScheme: [
            { step: "Correct signs and substitution giving $v = +4\\ \\text{cm}$", marks: 1 },
            { step: "States the image is virtual, erect and twice the size", marks: 1 },
          ],
        },
      },
    ],
  },
  {
    key: "sci-pool-case-004",
    chapter: "our-environment",
    topics: ["food-chains-webs"],
    type: "CASE_BASED",
    body: "**Energy in a pond**\n\nA pond ecosystem contains the following food chain:\n\nphytoplankton → small fish → large fish → bird\n\nThe phytoplankton in the pond capture $10{,}000\\ \\text{J}$ of energy from sunlight.\n\nBased on the above information, answer the following questions.",
    marks: 4,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 420,
    source: ORIGINAL,
    subParts: [
      {
        key: "sci-pool-case-004-i",
        type: "VERY_SHORT_ANSWER",
        body: "(i) What trophic level do the small fish occupy?",
        marks: 1,
        topics: ["food-chains-webs"],
        answer: {
          correctValue: "second",
          acceptedValues: ["second", "2nd", "second trophic level", "primary consumer"],
          solution:
            "The small fish eat the producers, so they are primary consumers at the second trophic level.",
        },
      },
      {
        key: "sci-pool-case-004-ii",
        type: "VERY_SHORT_ANSWER",
        body: "(ii) How much energy is available to the bird?",
        marks: 1,
        topics: ["food-chains-webs"],
        answer: {
          correctValue: "10",
          acceptedValues: ["10", "10 J", "10J"],
          solution:
            "By the ten per cent law: $10000 \\rightarrow 1000 \\rightarrow 100 \\rightarrow 10\\ \\text{J}$.",
        },
      },
      {
        key: "sci-pool-case-004-iii",
        type: "SHORT_ANSWER",
        body: "(iii) Explain what happens to the rest of the energy at each step, and why this limits the length of a food chain.",
        marks: 2,
        topics: ["food-chains-webs"],
        answer: {
          solution:
            "About $90\\%$ of the energy at each level is lost — used in the organism's own respiration and life processes, released as heat, or locked in parts that are not eaten.\n\nBecause the loss compounds, the energy available falls by a factor of ten at every step. After four or five levels there is too little left to support another population, so food chains are short.",
          markingScheme: [
            { step: "Names where the lost energy goes", marks: 1 },
            { step: "Links the compounding loss to the limit on chain length", marks: 1 },
          ],
        },
      },
    ],
  },
];
