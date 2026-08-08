import type { SeedQuestion } from "../types.js";

/**
 * Seed questions for CBSE Class 10 Science.
 *
 * Two things this set exists to prove that the Maths set cannot.
 *
 * First, domains. Science is one paper covering Physics, Chemistry and Biology,
 * so the questions here spread across all three and the browse tree gets a real
 * Subject → Domain → Chapter → Topic path to render.
 *
 * Second, sub-part splits. Maths prescribes 1+1+2 for every Section E case
 * study. Science prescribes a vocabulary — sub-parts worth 1, 2 or 3 marks —
 * and the three case studies below deliberately come out as 1+1+2, 2+2 and 1+3.
 * If the renderer, the grader or the mastery rollup has quietly assumed three
 * sub-parts, one of these breaks it, which is precisely the point.
 */

const ORIGINAL = { sourceType: "ORIGINAL", licenceStatus: "CLEARED" } as const;

const ADAPTED = (year: number, q: string) =>
  ({
    sourceType: "ADAPTED",
    year,
    examSession: "March",
    originalQuestionNumber: q,
    licenceStatus: "CLEARED",
    attributionText: `Adapted from CBSE Class 10 Science ${String(year)}, Q${q}. Numbers and context changed.`,
  }) as const;

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

export const class10ScienceQuestions: SeedQuestion[] = [
  // ── MCQ ───────────────────────────────────────────────────────────────────
  {
    key: "sci-mcq-001",
    chapter: "chemical-reactions-and-equations",
    topics: ["types-of-reactions"],
    type: "MCQ",
    body: "The reaction $2\\text{FeSO}_4 \\xrightarrow{\\Delta} \\text{Fe}_2\\text{O}_3 + \\text{SO}_2 + \\text{SO}_3$ is an example of:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 60,
    options: [
      { label: "A", body: "a combination reaction" },
      { label: "B", body: "a thermal decomposition reaction", isCorrect: true },
      { label: "C", body: "a displacement reaction" },
      { label: "D", body: "a double displacement reaction" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "A single reactant breaks down into three simpler products on heating. That is decomposition, and because heat supplies the energy it is specifically thermal decomposition.",
    },
    source: ORIGINAL,
  },
  {
    key: "sci-mcq-002",
    chapter: "acids-bases-and-salts",
    topics: ["ph-scale"],
    type: "MCQ",
    body: "At $25^\\circ$C, the pH of a neutral solution is:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 30,
    options: [
      { label: "A", body: "$0$" },
      { label: "B", body: "$7$", isCorrect: true },
      { label: "C", body: "$14$" },
      { label: "D", body: "$1$" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "A neutral solution has equal concentrations of $\\text{H}^+$ and $\\text{OH}^-$ ions, which at $25^\\circ$C corresponds to pH $7$. Below $7$ is acidic, above $7$ is basic.",
    },
    source: ORIGINAL,
  },
  {
    key: "sci-mcq-003",
    chapter: "metals-and-non-metals",
    topics: ["reactivity-series"],
    type: "MCQ",
    body: "Which metal is stored under kerosene?",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 30,
    options: [
      { label: "A", body: "Copper" },
      { label: "B", body: "Gold" },
      { label: "C", body: "Sodium", isCorrect: true },
      { label: "D", body: "Iron" },
    ],
    answer: {
      correctValue: "C",
      solution:
        "Sodium is so reactive that it catches fire on contact with the moisture and oxygen in air. Kerosene keeps air away from the metal.",
    },
    source: ORIGINAL,
  },
  {
    key: "sci-mcq-004",
    chapter: "carbon-and-its-compounds",
    topics: ["covalent-bonding"],
    type: "MCQ",
    body: "The total number of covalent bonds present in a molecule of ethane, $\\text{C}_2\\text{H}_6$, is:",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 75,
    options: [
      { label: "A", body: "$6$" },
      { label: "B", body: "$7$", isCorrect: true },
      { label: "C", body: "$8$" },
      { label: "D", body: "$5$" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "Ethane has six C–H bonds and one C–C bond, giving $6 + 1 = 7$ covalent bonds in total.",
      explanation:
        "The C–C bond is the one that gets forgotten — counting only the hydrogens gives 6.",
    },
    source: ORIGINAL,
  },
  {
    key: "sci-mcq-005",
    chapter: "life-processes",
    topics: ["respiration"],
    type: "MCQ",
    body: "In a eukaryotic cell, the complete oxidation of glucose to carbon dioxide and water takes place in the:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 45,
    options: [
      { label: "A", body: "Cytoplasm" },
      { label: "B", body: "Mitochondria", isCorrect: true },
      { label: "C", body: "Chloroplast" },
      { label: "D", body: "Nucleus" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "Glycolysis breaks glucose into pyruvate in the cytoplasm, but the pyruvate is then oxidised completely to $\\text{CO}_2$ and $\\text{H}_2\\text{O}$ inside the mitochondria — which is why they are called the powerhouse of the cell.",
    },
    source: ORIGINAL,
  },
  {
    key: "sci-mcq-006",
    chapter: "control-and-coordination",
    topics: ["endocrine-glands"],
    type: "MCQ",
    body: "The hormone secreted by the pancreas that regulates blood sugar level is:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 30,
    options: [
      { label: "A", body: "Thyroxine" },
      { label: "B", body: "Adrenaline" },
      { label: "C", body: "Insulin", isCorrect: true },
      { label: "D", body: "Testosterone" },
    ],
    answer: {
      correctValue: "C",
      solution:
        "Insulin is secreted by the pancreas and lowers blood glucose. Insufficient insulin causes diabetes mellitus.",
    },
    source: ORIGINAL,
  },
  {
    key: "sci-mcq-007",
    chapter: "light-reflection-and-refraction",
    topics: ["mirror-formula"],
    type: "MCQ",
    body: "A concave mirror produces a magnification of $-1$. The object must be placed at the:",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 75,
    options: [
      { label: "A", body: "focus" },
      { label: "B", body: "centre of curvature", isCorrect: true },
      { label: "C", body: "pole" },
      { label: "D", body: "infinity" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "$m = -1$ means the image is the same size as the object ($|m| = 1$) and inverted (negative sign), so it is real. For a concave mirror this happens only when the object sits at the centre of curvature, where the image also forms at $C$.",
    },
    source: ADAPTED(2023, "3"),
  },
  {
    key: "sci-mcq-008",
    chapter: "human-eye-and-colourful-world",
    topics: ["structure-of-eye"],
    type: "MCQ",
    body: "The change in the focal length of the eye lens to focus on objects at different distances is brought about by the:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 45,
    options: [
      { label: "A", body: "pupil" },
      { label: "B", body: "retina" },
      { label: "C", body: "ciliary muscles", isCorrect: true },
      { label: "D", body: "iris" },
    ],
    answer: {
      correctValue: "C",
      solution:
        "The ciliary muscles change the curvature, and hence the focal length, of the eye lens. This ability is called accommodation. The iris controls the pupil's size and thus the amount of light, not the focus.",
    },
    source: ORIGINAL,
  },
  {
    key: "sci-mcq-009",
    chapter: "electricity",
    topics: ["series-parallel-resistors"],
    type: "MCQ",
    body: "Two resistors of $6\\ \\Omega$ and $3\\ \\Omega$ are connected in parallel. Their equivalent resistance is:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 60,
    options: [
      { label: "A", body: "$9\\ \\Omega$" },
      { label: "B", body: "$2\\ \\Omega$", isCorrect: true },
      { label: "C", body: "$4.5\\ \\Omega$" },
      { label: "D", body: "$18\\ \\Omega$" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "$\\dfrac{1}{R} = \\dfrac{1}{6} + \\dfrac{1}{3} = \\dfrac{1}{6} + \\dfrac{2}{6} = \\dfrac{3}{6} = \\dfrac{1}{2}$, so $R = 2\\ \\Omega$.",
      explanation:
        "A useful check: the equivalent resistance of a parallel combination is always *smaller* than the smallest individual resistor. Any answer above $3\\ \\Omega$ is wrong before you calculate anything.",
    },
    source: ORIGINAL,
  },
  {
    key: "sci-mcq-010",
    chapter: "magnetic-effects-of-electric-current",
    topics: ["magnetic-field-lines"],
    type: "MCQ",
    body: "Inside a bar magnet, the direction of the magnetic field lines is:",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 60,
    options: [
      { label: "A", body: "from north pole to south pole" },
      { label: "B", body: "from south pole to north pole", isCorrect: true },
      { label: "C", body: "there are no field lines inside a magnet" },
      { label: "D", body: "randomly oriented" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "Magnetic field lines form closed loops. Outside the magnet they run from north to south; inside they continue from south to north, completing the loop. This is why magnetic monopoles do not exist.",
    },
    source: ORIGINAL,
  },
  {
    key: "sci-mcq-011",
    chapter: "heredity",
    topics: ["mendels-experiments"],
    type: "MCQ",
    body: "In Mendel's dihybrid cross, the phenotypic ratio obtained in the $\\text{F}_2$ generation is:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 45,
    options: [
      { label: "A", body: "$3 : 1$" },
      { label: "B", body: "$1 : 2 : 1$" },
      { label: "C", body: "$9 : 3 : 3 : 1$", isCorrect: true },
      { label: "D", body: "$1 : 1$" },
    ],
    answer: {
      correctValue: "C",
      solution:
        "A dihybrid cross tracks two traits. The $\\text{F}_2$ phenotypic ratio $9 : 3 : 3 : 1$ is what led Mendel to the law of independent assortment. ($3 : 1$ is the monohybrid ratio.)",
    },
    source: ORIGINAL,
  },
  {
    key: "sci-mcq-012",
    chapter: "our-environment",
    topics: ["waste-management"],
    type: "MCQ",
    body: "Which of the following is a non-biodegradable substance?",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 30,
    options: [
      { label: "A", body: "Cow dung" },
      { label: "B", body: "Paper" },
      { label: "C", body: "Wool" },
      { label: "D", body: "Polythene bags", isCorrect: true },
    ],
    answer: {
      correctValue: "D",
      solution:
        "Polythene is a synthetic polymer that decomposer micro-organisms have no enzymes to break down, so it persists in the environment for centuries. Cow dung, paper and wool are all of biological origin and are biodegradable.",
    },
    source: ORIGINAL,
  },

  // ── Assertion–Reason (all four answer paths covered) ──────────────────────
  {
    key: "sci-ar-001",
    chapter: "our-environment",
    topics: ["food-chains-webs"],
    type: "ASSERTION_REASON",
    body: "**Assertion (A):** The amount of energy available decreases at each successive trophic level in a food chain.\n\n**Reason (R):** Only about $10\\%$ of the energy at one trophic level is transferred to the next.",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 60,
    options: arOptions("A"),
    answer: {
      correctValue: "A",
      solution:
        "Both statements are true, and the ten per cent law is exactly why the available energy falls at each level — the remaining $90\\%$ is lost as heat and used in life processes. So (A) is the answer.",
    },
    source: ORIGINAL,
  },
  {
    key: "sci-ar-002",
    chapter: "metals-and-non-metals",
    topics: ["reactivity-series"],
    type: "ASSERTION_REASON",
    body: "**Assertion (A):** Copper does not liberate hydrogen gas when treated with dilute hydrochloric acid.\n\n**Reason (R):** Copper is more reactive than hydrogen.",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 75,
    options: arOptions("C"),
    answer: {
      correctValue: "C",
      solution:
        "Assertion (A) is true — copper does not displace hydrogen from dilute acids. Reason (R) is false and in fact states the opposite of the truth: copper lies *below* hydrogen in the reactivity series, which is precisely why it cannot displace it. So (C).",
      explanation:
        "The reason given is the right idea with the inequality reversed. Reading it quickly and agreeing with the general shape of the argument is how students land on (A) here.",
    },
    source: ADAPTED(2024, "17"),
  },
  {
    key: "sci-ar-003",
    chapter: "life-processes",
    topics: ["nutrition"],
    type: "ASSERTION_REASON",
    body: "**Assertion (A):** Photosynthesis in plant cells takes place in the chloroplasts.\n\n**Reason (R):** Chlorophyll is a green pigment.",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 75,
    options: arOptions("B"),
    answer: {
      correctValue: "B",
      solution:
        "Both statements are true. But the *colour* of chlorophyll is not why photosynthesis happens in chloroplasts — it happens there because that is where chlorophyll absorbs light energy and converts it to chemical energy. R is true but not the explanation, so (B).",
      explanation:
        "A true reason is not automatically the correct explanation. The test is whether R answers *why* A is so.",
    },
    source: ORIGINAL,
  },
  {
    key: "sci-ar-004",
    chapter: "electricity",
    topics: ["series-parallel-resistors"],
    type: "ASSERTION_REASON",
    body: "**Assertion (A):** In a series circuit, the current through each resistor is different.\n\n**Reason (R):** In a parallel circuit, the potential difference across each resistor is the same.",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 75,
    options: arOptions("D"),
    answer: {
      correctValue: "D",
      solution:
        "Assertion (A) is false: in a series circuit there is only one path, so the *same* current flows through every component. Reason (R) is true — components in parallel are connected across the same two points and therefore share the same potential difference. So (D).",
    },
    source: ORIGINAL,
  },

  // ── True/False ────────────────────────────────────────────────────────────
  {
    key: "sci-tf-001",
    chapter: "chemical-reactions-and-equations",
    topics: ["types-of-reactions"],
    type: "TRUE_FALSE",
    body: "State whether the following is true or false: *A chemical reaction that absorbs heat from its surroundings is called an exothermic reaction.*",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 30,
    answer: {
      correctValue: "FALSE",
      acceptedValues: ["FALSE", "F", "false"],
      solution:
        "False. A reaction that *absorbs* heat is endothermic. Exothermic reactions *release* heat — respiration and the burning of natural gas are examples.",
    },
    source: ORIGINAL,
  },
  {
    key: "sci-tf-002",
    chapter: "life-processes",
    topics: ["transportation"],
    type: "TRUE_FALSE",
    body: "State whether the following is true or false: *Arteries carry blood away from the heart.*",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 30,
    answer: {
      correctValue: "TRUE",
      acceptedValues: ["TRUE", "T", "true"],
      solution:
        "True. Arteries always carry blood *away* from the heart and veins carry it back. Note this is about direction, not oxygenation — the pulmonary artery carries deoxygenated blood, and the pulmonary vein carries oxygenated blood.",
    },
    source: ORIGINAL,
  },

  // ── Fill in the blank ─────────────────────────────────────────────────────
  {
    key: "sci-fb-001",
    chapter: "electricity",
    topics: ["ohms-law"],
    type: "FILL_BLANK",
    body: "The SI unit of electric resistance is the ________.",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 30,
    answer: {
      correctValue: "ohm",
      acceptedValues: ["ohm", "ohms", "Ω", "Ohm"],
      solution: "The ohm, symbol $\\Omega$. One ohm is one volt per ampere.",
    },
    source: ORIGINAL,
  },
  {
    key: "sci-fb-002",
    chapter: "life-processes",
    topics: ["excretion"],
    type: "FILL_BLANK",
    body: "The basic structural and functional unit of the kidney is the ________.",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 30,
    answer: {
      correctValue: "nephron",
      acceptedValues: ["nephron", "nephrons"],
      solution:
        "The nephron. Each kidney contains roughly a million of them, and each one filters blood and forms urine independently.",
    },
    source: ORIGINAL,
  },

  // ── Match the following ───────────────────────────────────────────────────
  {
    key: "sci-match-001",
    chapter: "control-and-coordination",
    topics: ["endocrine-glands"],
    type: "MATCH_FOLLOWING",
    body: "Match the hormones in Column I with the glands that secrete them in Column II.\n\n| Column I | Column II |\n| --- | --- |\n| (i) Insulin | (p) Thyroid gland |\n| (ii) Thyroxine | (q) Adrenal gland |\n| (iii) Adrenaline | (r) Pituitary gland |\n| (iv) Growth hormone | (s) Pancreas |",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 90,
    answer: {
      correctValue: "i-s, ii-p, iii-q, iv-r",
      acceptedValues: [
        "i-s, ii-p, iii-q, iv-r",
        "i-s,ii-p,iii-q,iv-r",
        "(i)-s (ii)-p (iii)-q (iv)-r",
      ],
      solution:
        "Insulin — pancreas (s); Thyroxine — thyroid gland (p); Adrenaline — adrenal gland (q); Growth hormone — pituitary gland (r).",
    },
    source: ORIGINAL,
  },

  // ── Very short answer (2 marks) ───────────────────────────────────────────
  {
    key: "sci-vsa-001",
    chapter: "chemical-reactions-and-equations",
    topics: ["writing-balancing-equations"],
    type: "VERY_SHORT_ANSWER",
    body: "Balance the following chemical equation:\n\n$$\\text{Fe} + \\text{H}_2\\text{O} \\longrightarrow \\text{Fe}_3\\text{O}_4 + \\text{H}_2$$",
    marks: 2,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 150,
    answer: {
      correctValue: "3Fe + 4H2O → Fe3O4 + 4H2",
      acceptedValues: ["3Fe + 4H2O → Fe3O4 + 4H2", "3Fe+4H2O->Fe3O4+4H2"],
      solution:
        "$$3\\text{Fe} + 4\\text{H}_2\\text{O} \\longrightarrow \\text{Fe}_3\\text{O}_4 + 4\\text{H}_2$$\n\nCheck: Fe — 3 on each side. O — 4 on each side. H — $4 \\times 2 = 8$ on each side. Balanced.",
      markingScheme: [
        { step: "Correct coefficients 3, 4, 1, 4", marks: 1 },
        { step: "Verification that Fe, O and H all balance", marks: 1 },
      ],
      explanation:
        "Balance the element appearing in the most complex formula first — here Fe, fixed at 3 by $\\text{Fe}_3\\text{O}_4$ — and hydrogen last, since it appears in two places.",
    },
    source: ADAPTED(2023, "21"),
  },
  {
    key: "sci-vsa-002",
    chapter: "life-processes",
    topics: ["respiration"],
    type: "VERY_SHORT_ANSWER",
    body: "Why is respiration considered an exothermic reaction? Explain briefly.",
    marks: 2,
    difficulty: "EASY",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 150,
    answer: {
      solution:
        "During respiration, glucose is oxidised to carbon dioxide and water:\n\n$$\\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2 \\longrightarrow 6\\text{CO}_2 + 6\\text{H}_2\\text{O} + \\text{energy}$$\n\nThe products have less stored chemical energy than the reactants, so the difference is released — as heat and as ATP. A reaction that releases energy to its surroundings is exothermic, which is why our bodies stay warm.",
      markingScheme: [
        { step: "States that glucose is oxidised, with the equation", marks: 1 },
        { step: "States that energy is released, hence exothermic", marks: 1 },
      ],
    },
    source: ORIGINAL,
  },
  {
    key: "sci-vsa-003",
    chapter: "life-processes",
    topics: ["transportation"],
    type: "VERY_SHORT_ANSWER",
    body: "State two differences between arteries and veins.",
    marks: 2,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 150,
    answer: {
      solution:
        "1. **Direction of flow.** Arteries carry blood away from the heart; veins carry blood towards the heart.\n2. **Wall structure and valves.** Arteries have thick, elastic walls to withstand high pressure and have no valves; veins have thinner walls and contain valves that prevent the backflow of blood.",
      markingScheme: [
        { step: "First valid difference", marks: 1 },
        { step: "Second valid difference", marks: 1 },
      ],
    },
    source: ORIGINAL,
  },

  // ── Short answer (3 marks) ────────────────────────────────────────────────
  {
    key: "sci-sa-001",
    chapter: "human-eye-and-colourful-world",
    topics: ["atmospheric-refraction"],
    type: "SHORT_ANSWER",
    body: "Why does the sky appear blue on a clear day? Explain with reference to the scattering of light.",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 240,
    answer: {
      solution:
        "Sunlight is white and therefore contains all colours. As it passes through the atmosphere, it is scattered by molecules of air, which are much smaller than the wavelength of visible light.\n\nThe amount of scattering depends strongly on wavelength — shorter wavelengths are scattered far more than longer ones. Blue light has a much shorter wavelength than red, so blue is scattered many times more strongly.\n\nThis scattered blue light reaches our eyes from every direction in the sky, so the sky looks blue. On the Moon, which has no atmosphere, there is nothing to scatter light and the sky appears black even in daytime.",
      markingScheme: [
        { step: "White sunlight contains all colours and is scattered by air molecules", marks: 1 },
        {
          step: "Shorter wavelengths (blue) are scattered much more than longer ones (red)",
          marks: 1,
        },
        {
          step: "Scattered blue light reaching the eye from all directions makes the sky blue",
          marks: 1,
        },
      ],
    },
    source: ADAPTED(2024, "28"),
  },
  {
    key: "sci-sa-002",
    chapter: "electricity",
    topics: ["series-parallel-resistors", "ohms-law"],
    type: "SHORT_ANSWER",
    body: "Three resistors of $5\\ \\Omega$, $10\\ \\Omega$ and $30\\ \\Omega$ are connected in parallel across a $12$ V battery. Calculate the equivalent resistance of the combination and the total current drawn from the battery.",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 240,
    answer: {
      correctValue: "R = 3 Ω, I = 4 A",
      acceptedValues: ["3 ohm, 4 A", "R=3, I=4"],
      solution:
        "$\\dfrac{1}{R} = \\dfrac{1}{5} + \\dfrac{1}{10} + \\dfrac{1}{30} = \\dfrac{6}{30} + \\dfrac{3}{30} + \\dfrac{1}{30} = \\dfrac{10}{30} = \\dfrac{1}{3}$\n\nSo $R = 3\\ \\Omega$.\n\nBy Ohm's law, $I = \\dfrac{V}{R} = \\dfrac{12}{3} = 4$ A.",
      markingScheme: [
        { step: "Correct parallel formula with a common denominator", marks: 1 },
        { step: "R = 3 Ω", marks: 1 },
        { step: "I = 4 A using Ohm's law", marks: 1 },
      ],
      explanation:
        "$3\\ \\Omega$ is less than the smallest resistor ($5\\ \\Omega$), as it must be for a parallel combination — a free sanity check on the arithmetic.",
    },
    source: ORIGINAL,
  },
  {
    key: "sci-sa-003",
    chapter: "metals-and-non-metals",
    topics: ["reactivity-series", "physical-properties-metals"],
    type: "SHORT_ANSWER",
    body: "Write a balanced chemical equation for the reaction of dilute sulphuric acid with zinc granules. Name the type of reaction and state one observation that would be made.",
    marks: 3,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 210,
    answer: {
      correctValue: "Zn + H2SO4 → ZnSO4 + H2",
      solution:
        "$$\\text{Zn} + \\text{H}_2\\text{SO}_4 \\longrightarrow \\text{ZnSO}_4 + \\text{H}_2 \\uparrow$$\n\n**Type:** a displacement reaction — zinc, being more reactive than hydrogen, displaces it from the acid.\n\n**Observation:** brisk effervescence, as colourless, odourless hydrogen gas is evolved. The gas burns with a pop sound when a lighted splint is brought near it.",
      markingScheme: [
        { step: "Correct balanced equation", marks: 1 },
        { step: "Identifies it as a displacement reaction", marks: 1 },
        { step: "Valid observation (effervescence / gas that burns with a pop)", marks: 1 },
      ],
    },
    source: ORIGINAL,
  },
  {
    key: "sci-sa-004",
    chapter: "light-reflection-and-refraction",
    topics: ["refraction-of-light"],
    type: "SHORT_ANSWER",
    body: "State the laws of refraction of light. Define the absolute refractive index of a medium.",
    marks: 3,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 210,
    answer: {
      solution:
        "**First law.** The incident ray, the refracted ray and the normal to the interface at the point of incidence all lie in the same plane.\n\n**Second law (Snell's law).** For a given pair of media and a given colour of light, the ratio of the sine of the angle of incidence to the sine of the angle of refraction is constant:\n$$\\frac{\\sin i}{\\sin r} = \\text{constant} = n_{21}$$\n\n**Absolute refractive index.** The absolute refractive index of a medium is the ratio of the speed of light in vacuum to the speed of light in that medium:\n$$n = \\frac{c}{v}$$",
      markingScheme: [
        { step: "First law of refraction", marks: 1 },
        { step: "Snell's law stated correctly", marks: 1 },
        { step: "Definition n = c/v", marks: 1 },
      ],
    },
    source: ORIGINAL,
  },

  // ── Numerical ─────────────────────────────────────────────────────────────
  {
    key: "sci-num-001",
    chapter: "light-reflection-and-refraction",
    topics: ["mirror-formula", "spherical-mirrors"],
    type: "NUMERICAL",
    body: "An object $5$ cm tall is placed $20$ cm in front of a concave mirror of focal length $15$ cm. Find the position, nature and size of the image formed.",
    marks: 3,
    difficulty: "HARD",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 300,
    answer: {
      correctValue: "v = -60 cm, real, inverted, 15 cm tall",
      solution:
        "Using the New Cartesian sign convention: $u = -20$ cm, $f = -15$ cm, $h = 5$ cm.\n\nMirror formula $\\dfrac{1}{v} + \\dfrac{1}{u} = \\dfrac{1}{f}$:\n\n$\\dfrac{1}{v} = \\dfrac{1}{f} - \\dfrac{1}{u} = \\dfrac{1}{-15} - \\dfrac{1}{-20} = -\\dfrac{4}{60} + \\dfrac{3}{60} = -\\dfrac{1}{60}$\n\nSo $v = -60$ cm — the image forms $60$ cm in front of the mirror, on the same side as the object, and is therefore **real**.\n\nMagnification $m = -\\dfrac{v}{u} = -\\dfrac{-60}{-20} = -3$. The negative sign means the image is **inverted**; $|m| = 3$ means it is magnified.\n\nImage height $= m \\times h = -3 \\times 5 = -15$ cm, i.e. $15$ cm tall and inverted.",
      markingScheme: [
        { step: "Correct signs for u and f under the New Cartesian convention", marks: 1 },
        { step: "v = −60 cm from the mirror formula", marks: 1 },
        { step: "m = −3 and image 15 cm tall, real and inverted", marks: 1 },
      ],
      explanation:
        "Almost every lost mark on this question is a sign error, not an arithmetic one. Distances measured against the incident light are negative, which makes both $u$ and $f$ negative for a concave mirror.",
    },
    source: ADAPTED(2024, "30"),
  },
  {
    key: "sci-num-002",
    chapter: "electricity",
    topics: ["heating-effect-power", "ohms-law"],
    type: "NUMERICAL",
    body: "An electric bulb is rated $220$ V and $100$ W. Calculate its resistance and the current drawn when it is operated on a $220$ V supply.",
    marks: 2,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 180,
    answer: {
      correctValue: "R = 484 Ω, I = 0.45 A",
      acceptedValues: ["484 ohm, 0.45 A", "R=484, I=0.45"],
      solution:
        "$P = \\dfrac{V^2}{R} \\Rightarrow R = \\dfrac{V^2}{P} = \\dfrac{220 \\times 220}{100} = \\dfrac{48400}{100} = 484\\ \\Omega$.\n\n$I = \\dfrac{P}{V} = \\dfrac{100}{220} \\approx 0.45$ A.",
      markingScheme: [
        { step: "R = 484 Ω", marks: 1 },
        { step: "I ≈ 0.45 A", marks: 1 },
      ],
    },
    source: ORIGINAL,
  },
  {
    key: "sci-num-003",
    chapter: "electricity",
    topics: ["series-parallel-resistors"],
    type: "NUMERICAL",
    body: "A $6\\ \\Omega$ resistor is connected in series with a parallel combination of a $4\\ \\Omega$ and a $12\\ \\Omega$ resistor. The arrangement is connected across a $12$ V battery. Find the total resistance of the circuit and the current drawn from the battery.",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 270,
    answer: {
      correctValue: "R = 9 Ω, I ≈ 1.33 A",
      acceptedValues: ["9 ohm, 1.33 A", "R=9, I=4/3"],
      solution:
        "**Parallel part:** $\\dfrac{1}{R_p} = \\dfrac{1}{4} + \\dfrac{1}{12} = \\dfrac{3}{12} + \\dfrac{1}{12} = \\dfrac{4}{12} = \\dfrac{1}{3}$, so $R_p = 3\\ \\Omega$.\n\n**Total:** the $6\\ \\Omega$ resistor is in series with this, so $R = 6 + 3 = 9\\ \\Omega$.\n\n**Current:** $I = \\dfrac{V}{R} = \\dfrac{12}{9} = \\dfrac{4}{3} \\approx 1.33$ A.",
      markingScheme: [
        { step: "Parallel combination reduced to 3 Ω", marks: 1 },
        { step: "Total resistance 9 Ω", marks: 1 },
        { step: "Current ≈ 1.33 A", marks: 1 },
      ],
      explanation:
        "Reduce the parallel block to a single equivalent resistance *first*, then treat the circuit as a simple series one. Trying to apply Ohm's law to the whole tangle at once is where this goes wrong.",
    },
    source: ORIGINAL,
  },

  // ── Long answer (5 marks) — one per domain ────────────────────────────────
  {
    key: "sci-la-001",
    chapter: "life-processes",
    topics: ["transportation"],
    type: "LONG_ANSWER",
    body: "Describe the process of double circulation of blood in human beings. Why is it necessary?",
    marks: 5,
    difficulty: "MEDIUM",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 420,
    answer: {
      solution:
        "In human beings, blood passes through the heart **twice** in one complete circuit of the body. This is called double circulation, and it consists of two loops.\n\n**Pulmonary circulation.** Deoxygenated blood from the body enters the right atrium, passes into the right ventricle, and is pumped through the pulmonary artery to the lungs. There it releases carbon dioxide and takes up oxygen, and returns through the pulmonary veins to the left atrium.\n\n**Systemic circulation.** Oxygenated blood passes from the left atrium into the left ventricle, which pumps it through the aorta to all parts of the body. Having delivered oxygen to the tissues, the deoxygenated blood returns through the venae cavae to the right atrium.\n\n**Why it is necessary.** The two loops keep oxygenated and deoxygenated blood completely separate, so the blood reaching the tissues is fully oxygenated. It also allows the systemic circuit to be maintained at a high pressure — necessary to reach the whole body — while the pulmonary circuit stays at low pressure, which the delicate lung capillaries require. This efficient oxygen supply is what supports the high energy demands of warm-blooded animals.",
      markingScheme: [
        { step: "Defines double circulation as blood passing through the heart twice", marks: 1 },
        { step: "Describes pulmonary circulation correctly", marks: 1 },
        { step: "Describes systemic circulation correctly", marks: 1 },
        { step: "Separation of oxygenated and deoxygenated blood", marks: 1 },
        { step: "Links to efficient oxygen supply / high energy needs", marks: 1 },
      ],
    },
    source: ADAPTED(2023, "34"),
  },
  {
    key: "sci-la-002",
    chapter: "magnetic-effects-of-electric-current",
    topics: ["force-on-conductor", "field-due-to-conductor"],
    type: "LONG_ANSWER",
    body: "With the help of a labelled diagram, describe the construction and working of an electric motor. State the principle on which it works and the function of the split ring.",
    marks: 5,
    difficulty: "HARD",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 480,
    answer: {
      solution:
        "**Principle.** An electric motor works on the principle that a current-carrying conductor placed in a magnetic field experiences a force, whose direction is given by Fleming's left-hand rule.\n\n**Construction.** A rectangular coil $ABCD$ of insulated copper wire is mounted between the poles of a permanent magnet so that arms $AB$ and $CD$ are perpendicular to the field. The ends of the coil are connected to the two halves of a split ring (the commutator), $P$ and $Q$, which press against carbon brushes $X$ and $Y$ connected to a battery.\n\n**Working.** Current enters through brush $X$, flows through $ABCD$ and leaves through $Y$. In arm $AB$ the current flows in one direction and in $CD$ in the opposite direction, so by Fleming's left-hand rule the two arms experience forces in opposite directions — one upward, one downward. This pair of forces forms a couple that rotates the coil.\n\n**Function of the split ring.** After each half rotation, the halves of the split ring exchange contact with the brushes, reversing the current through the coil. This reverses the direction of the force on each arm at exactly the moment the arms have swapped position, so the couple continues to turn the coil the same way. Without the commutator the coil would simply oscillate through half a turn and stop.",
      markingScheme: [
        { step: "States the principle and Fleming's left-hand rule", marks: 1 },
        { step: "Labelled diagram showing coil, magnet, split ring and brushes", marks: 1 },
        { step: "Describes construction correctly", marks: 1 },
        { step: "Explains that opposite forces on AB and CD create a rotating couple", marks: 1 },
        {
          step: "Explains that the split ring reverses current every half rotation to maintain continuous rotation",
          marks: 1,
        },
      ],
      explanation:
        "The split ring is where the marks are won or lost. 'It reverses the current' is half an answer; the mark is for saying *why* that keeps rotation going in one direction.",
    },
    source: ADAPTED(2024, "36"),
  },
  {
    key: "sci-la-003",
    chapter: "carbon-and-its-compounds",
    topics: ["soaps-and-detergents"],
    type: "LONG_ANSWER",
    body: "What are soaps? Explain the cleansing action of soap with the help of micelle formation. Why do soaps not work effectively in hard water?",
    marks: 5,
    difficulty: "MEDIUM",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 420,
    answer: {
      solution:
        "**Soaps** are sodium or potassium salts of long-chain carboxylic acids (fatty acids), for example sodium stearate, $\\text{C}_{17}\\text{H}_{35}\\text{COONa}$.\n\n**Structure of a soap molecule.** Each molecule has two ends with opposite affinities: a long hydrocarbon chain that is hydrophobic (water-repelling but oil-attracting), and an ionic $-\\text{COO}^-\\text{Na}^+$ head that is hydrophilic (water-attracting).\n\n**Cleansing action.** Most dirt clings to clothes in an oily film that water alone cannot remove, because oil and water do not mix. When soap is added, the hydrocarbon tails embed themselves in the oil droplet while the ionic heads remain in the surrounding water. The soap molecules arrange themselves in a spherical cluster called a **micelle**, with the oil trapped at the centre. Since the outside of every micelle is negatively charged, the micelles repel one another and stay dispersed in the water rather than coalescing. Agitating the cloth lifts these micelles away, and rinsing carries the dirt off with them.\n\n**Hard water.** Hard water contains dissolved calcium and magnesium salts. These ions react with soap to form insoluble calcium and magnesium stearates — an unpleasant white precipitate known as scum. Soap consumed in forming scum is no longer available to form micelles, so a great deal of soap is wasted before any lather appears and the cleansing action is poor.",
      markingScheme: [
        { step: "Defines soap as a sodium/potassium salt of a long-chain fatty acid", marks: 1 },
        { step: "Describes the hydrophobic tail and hydrophilic head", marks: 1 },
        { step: "Explains micelle formation with oil trapped at the centre", marks: 1 },
        { step: "Explains that micelles stay dispersed and are rinsed away", marks: 1 },
        { step: "Explains scum formation with Ca²⁺/Mg²⁺ ions in hard water", marks: 1 },
      ],
    },
    source: ORIGINAL,
  },

  // ── Case-based (4 marks each) ─────────────────────────────────────────────
  //
  // Three case studies, three *different* sub-part splits: 1+1+2, 2+2 and 1+3.
  // All three are legal under the Science blueprint's CONSTRAINED rule, and
  // none of them could be represented if sub-parts were hard-coded as 1+1+2.
  {
    key: "sci-case-001",
    chapter: "electricity",
    topics: ["ohms-law", "series-parallel-resistors"],
    type: "CASE_BASED",
    body: "**A circuit in the school laboratory**\n\nA student sets up a circuit consisting of a $6$ V battery, an ammeter, a plug key and three resistors of $2\\ \\Omega$, $3\\ \\Omega$ and $6\\ \\Omega$ connected in parallel with one another. A voltmeter is connected across the parallel combination.\n\nBased on the above information, answer the following questions.",
    marks: 4,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 420,
    source: ORIGINAL,
    subParts: [
      {
        key: "sci-case-001-i",
        type: "VERY_SHORT_ANSWER",
        body: "(i) Name the physical quantity measured by an ammeter, and state its SI unit.",
        marks: 1,
        answer: {
          correctValue: "electric current, ampere",
          acceptedValues: ["electric current, ampere", "current, ampere", "current (A)"],
          solution: "An ammeter measures electric current. Its SI unit is the ampere (A).",
        },
      },
      {
        key: "sci-case-001-ii",
        type: "VERY_SHORT_ANSWER",
        body: "(ii) State Ohm's law.",
        marks: 1,
        answer: {
          solution:
            "Ohm's law states that the current flowing through a conductor is directly proportional to the potential difference across its ends, provided the temperature and other physical conditions remain constant: $V = IR$.",
        },
      },
      {
        key: "sci-case-001-iii",
        type: "NUMERICAL",
        body: "(iii) Calculate the equivalent resistance of the parallel combination and the total current drawn from the battery.",
        marks: 2,
        topics: ["series-parallel-resistors"],
        answer: {
          correctValue: "R = 1 Ω, I = 6 A",
          acceptedValues: ["1 ohm, 6 A", "R=1, I=6"],
          solution:
            "$\\dfrac{1}{R} = \\dfrac{1}{2} + \\dfrac{1}{3} + \\dfrac{1}{6} = \\dfrac{3}{6} + \\dfrac{2}{6} + \\dfrac{1}{6} = 1$, so $R = 1\\ \\Omega$.\n\n$I = \\dfrac{V}{R} = \\dfrac{6}{1} = 6$ A.",
          markingScheme: [
            { step: "Equivalent resistance 1 Ω", marks: 1 },
            { step: "Total current 6 A", marks: 1 },
          ],
        },
      },
    ],
  },
  {
    key: "sci-case-002",
    chapter: "light-reflection-and-refraction",
    topics: ["spherical-mirrors", "mirror-formula"],
    type: "CASE_BASED",
    body: "**The shopkeeper's mirror**\n\nA shopkeeper fixes a mirror high on the wall at the corner of the shop so that the whole shop floor can be watched from the counter. The images seen in this mirror are always erect, virtual and smaller than the objects themselves, and the mirror shows a much wider view than a plane mirror of the same size would.\n\nBased on the above information, answer the following questions.",
    marks: 4,
    difficulty: "MEDIUM",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 420,
    source: ORIGINAL,
    // A 2 + 2 split. Perfectly legal for Science, impossible for Maths.
    subParts: [
      {
        key: "sci-case-002-i",
        type: "SHORT_ANSWER",
        body: "(i) Identify the type of mirror the shopkeeper has used, and give one reason for the choice.",
        marks: 2,
        answer: {
          correctValue: "convex mirror",
          acceptedValues: ["convex mirror", "convex"],
          solution:
            "It is a **convex mirror**.\n\nA convex mirror always forms a virtual, erect and diminished image, whatever the object's position — which matches the description. Because the image is diminished, a large area is compressed into a small mirror, giving a much wider field of view. That is exactly what is wanted for watching a whole shop from one point.",
          markingScheme: [
            { step: "Identifies the mirror as convex", marks: 1 },
            {
              step: "Valid reason: wider field of view / always erect and diminished virtual image",
              marks: 1,
            },
          ],
        },
      },
      {
        key: "sci-case-002-ii",
        type: "NUMERICAL",
        body: "(ii) An object is placed $30$ cm in front of a convex mirror of focal length $15$ cm. Find the position of the image formed.",
        marks: 2,
        topics: ["mirror-formula"],
        answer: {
          correctValue: "v = +10 cm",
          acceptedValues: ["10 cm", "+10 cm", "v = 10"],
          tolerance: 0.1,
          unit: "cm",
          solution:
            "For a convex mirror the focal length is positive: $f = +15$ cm, and $u = -30$ cm.\n\n$\\dfrac{1}{v} = \\dfrac{1}{f} - \\dfrac{1}{u} = \\dfrac{1}{15} - \\dfrac{1}{-30} = \\dfrac{2}{30} + \\dfrac{1}{30} = \\dfrac{3}{30} = \\dfrac{1}{10}$\n\nSo $v = +10$ cm. The positive sign places the image $10$ cm *behind* the mirror, confirming that it is virtual and erect.",
          markingScheme: [
            { step: "Correct signs (f positive for a convex mirror) and substitution", marks: 1 },
            { step: "v = +10 cm, image virtual and behind the mirror", marks: 1 },
          ],
        },
      },
    ],
  },
  {
    key: "sci-case-003",
    chapter: "life-processes",
    topics: ["excretion"],
    type: "CASE_BASED",
    body: "**The health camp**\n\nAt a school health camp, students are shown a model of the human excretory system. They learn that the kidneys filter waste products such as urea out of the blood and produce urine, which passes down the ureters to be stored in the urinary bladder before being expelled through the urethra. The doctor explains that a healthy adult produces about $1$ to $1.8$ litres of urine a day.\n\nBased on the above information, answer the following questions.",
    marks: 4,
    difficulty: "MEDIUM",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 420,
    source: ORIGINAL,
    // A 1 + 3 split — only two sub-parts, and the second is worth three marks.
    // Anything assuming "case study means three sub-parts" fails here.
    subParts: [
      {
        key: "sci-case-003-i",
        type: "VERY_SHORT_ANSWER",
        body: "(i) Name the basic filtration unit of the kidney.",
        marks: 1,
        answer: {
          correctValue: "nephron",
          acceptedValues: ["nephron", "nephrons"],
          solution: "The nephron. Each human kidney contains about a million of them.",
        },
      },
      {
        key: "sci-case-003-ii",
        type: "SHORT_ANSWER",
        body: "(ii) Explain the three main steps by which urine is formed in a nephron.",
        marks: 3,
        answer: {
          solution:
            "**1. Glomerular filtration.** Blood entering the glomerulus is under high pressure, which forces water, glucose, amino acids, salts and urea out through the capillary walls into Bowman's capsule. Blood cells and large proteins are too big to pass and stay in the blood.\n\n**2. Selective reabsorption.** As the filtrate travels along the tubule, substances the body still needs — all the glucose, most of the water, amino acids and some salts — are reabsorbed into the surrounding capillaries. How much water is reabsorbed depends on how much the body has to spare.\n\n**3. Tubular secretion.** Additional waste such as excess salts, potassium ions and some drugs is actively secreted from the blood into the tubule. The fluid that remains is urine, which passes into the collecting duct and on to the ureter.",
          markingScheme: [
            { step: "Glomerular filtration described correctly", marks: 1 },
            { step: "Selective reabsorption described correctly", marks: 1 },
            { step: "Tubular secretion described correctly", marks: 1 },
          ],
          explanation:
            "The word doing the work in step 2 is *selective*. Filtration is indiscriminate — it removes useful substances along with the waste — and reabsorption is what puts the useful ones back.",
        },
      },
    ],
  },
];
