import type { SeedQuestion } from "../types.js";

/**
 * Class 10 Science, written to the pattern of each past sitting.
 *
 * The same rule as `maths-pyq.ts`, and for the same reasons: every question
 * here is original, none is reproduced or reconstructed from a CBSE paper, and
 * what each borrows from the year it is filed under is the shape of that
 * sitting rather than its content. See that file's header for the sourcing
 * position (docs/07 Q6, R2) and for why none of these carries an
 * `originalQuestionNumber`.
 *
 * Science questions are spread across the three domains — Physics, Chemistry
 * and Biology — in roughly the proportion the real paper uses, because a
 * previous-year set that happens to be all Physics rehearses the pattern
 * badly even when every individual question is sound.
 */

const PATTERN = (year: number, examSession: string) =>
  ({
    sourceType: "ADAPTED",
    year,
    examSession,
    licenceStatus: "CLEARED",
    attributionText: `Original question written to the CBSE Class 10 Science ${String(year)} (${examSession}) pattern. Not reproduced from any past paper.`,
  }) as const;

export const class10SciencePastPaperQuestions: SeedQuestion[] = [
  // ── 2010 ──────────────────────────────────────────────────────────────────
  {
    key: "sci-pyq-2010-01",
    chapter: "chemical-reactions-and-equations",
    topics: ["types-of-reactions"],
    type: "MCQ",
    body: "The reaction $\\text{CaO} + \\text{H}_2\\text{O} \\rightarrow \\text{Ca(OH)}_2$ is an example of a:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 60,
    options: [
      { label: "A", body: "decomposition reaction" },
      { label: "B", body: "combination reaction", isCorrect: true },
      { label: "C", body: "displacement reaction" },
      { label: "D", body: "double displacement reaction" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "Two reactants combine to form a single product, which is the definition of a combination reaction. It is also exothermic — the mixture becomes noticeably warm.",
      hint: "Count the reactants and the products. The number of each is what separates combination from decomposition.",
    },
    source: PATTERN(2010, "Annual"),
  },
  {
    key: "sci-pyq-2010-02",
    chapter: "light-reflection-and-refraction",
    topics: ["spherical-mirrors"],
    type: "MCQ",
    body: "The focal length of a spherical mirror of radius of curvature $20\\ \\text{cm}$ is:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 45,
    options: [
      { label: "A", body: "$5\\ \\text{cm}$" },
      { label: "B", body: "$10\\ \\text{cm}$", isCorrect: true },
      { label: "C", body: "$20\\ \\text{cm}$" },
      { label: "D", body: "$40\\ \\text{cm}$" },
    ],
    answer: {
      correctValue: "B",
      solution: "For a spherical mirror, $f = \\dfrac{R}{2} = \\dfrac{20}{2} = 10\\ \\text{cm}$.",
      hint: "There is a fixed relationship between the focal length and the radius of curvature of a spherical mirror. It is a factor of two — decide which way round.",
    },
    source: PATTERN(2010, "Annual"),
  },
  {
    key: "sci-pyq-2010-03",
    chapter: "life-processes",
    topics: ["nutrition"],
    type: "SHORT_ANSWER",
    body: "Write the balanced chemical equation for photosynthesis and name the two raw materials the plant takes in.",
    marks: 3,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 180,
    answer: {
      solution:
        "$6\\text{CO}_2 + 6\\text{H}_2\\text{O} \\xrightarrow[\\text{chlorophyll}]{\\text{sunlight}} \\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2$\n\nThe two raw materials taken in are carbon dioxide (through the stomata) and water (through the roots).",
      markingScheme: [
        { step: "Correct reactants and products", marks: 1 },
        { step: "Equation balanced, with sunlight and chlorophyll shown", marks: 1 },
        { step: "Both raw materials named", marks: 1 },
      ],
      hint: "Sunlight and chlorophyll are conditions above and below the arrow, not reactants. The raw materials are the two substances actually consumed.",
    },
    source: PATTERN(2010, "Annual"),
  },

  // ── 2011 ──────────────────────────────────────────────────────────────────
  {
    key: "sci-pyq-2011-01",
    chapter: "acids-bases-and-salts",
    topics: ["ph-scale"],
    type: "MCQ",
    body: "A solution turns red litmus blue. Its pH is likely to be:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 60,
    options: [
      { label: "A", body: "$1$" },
      { label: "B", body: "$4$" },
      { label: "C", body: "$7$" },
      { label: "D", body: "$10$", isCorrect: true },
    ],
    answer: {
      correctValue: "D",
      solution:
        "Red litmus turning blue is the test for a base, and bases have a pH greater than $7$. Of the options only $10$ qualifies.",
      hint: "Work out whether the solution is acidic, basic or neutral first. Then match that to a range on the pH scale.",
    },
    source: PATTERN(2011, "Annual"),
  },
  {
    key: "sci-pyq-2011-02",
    chapter: "electricity",
    topics: ["ohms-law"],
    type: "NUMERICAL",
    body: "A potential difference of $12\\ \\text{V}$ is applied across a resistor of $4\\ \\Omega$. Calculate the current flowing through it.",
    marks: 2,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 90,
    answer: {
      correctValue: "3",
      unit: "A",
      solution: "By Ohm's law, $I = \\dfrac{V}{R} = \\dfrac{12}{4} = 3\\ \\text{A}$.",
      markingScheme: [
        { step: "Correct rearrangement of Ohm's law", marks: 1 },
        { step: "Correct value with units", marks: 1 },
      ],
      hint: "Write $V = IR$ and rearrange for the quantity you want before substituting any numbers.",
    },
    source: PATTERN(2011, "Annual"),
  },
  {
    key: "sci-pyq-2011-03",
    chapter: "control-and-coordination",
    topics: ["plant-hormones"],
    type: "MCQ",
    body: "The plant hormone responsible for the growth of a shoot towards light is:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 45,
    options: [
      { label: "A", body: "auxin", isCorrect: true },
      { label: "B", body: "abscisic acid" },
      { label: "C", body: "cytokinin" },
      { label: "D", body: "ethylene" },
    ],
    answer: {
      correctValue: "A",
      solution:
        "Auxin accumulates on the shaded side of the shoot, where it causes cells to elongate more. The uneven growth bends the shoot towards the light — phototropism.",
      explanation:
        "Abscisic acid is the one that inhibits growth and closes stomata, which is close to the opposite effect.",
      hint: "Think about which hormone makes cells elongate, and what would happen if more of it collected on one side of a stem than the other.",
    },
    source: PATTERN(2011, "Annual"),
  },

  // ── 2012 ──────────────────────────────────────────────────────────────────
  {
    key: "sci-pyq-2012-01",
    chapter: "metals-and-non-metals",
    topics: ["reactivity-series"],
    type: "MCQ",
    body: "Which of the following metals will displace copper from copper sulphate solution?",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 75,
    options: [
      { label: "A", body: "Silver" },
      { label: "B", body: "Gold" },
      { label: "C", body: "Zinc", isCorrect: true },
      { label: "D", body: "Platinum" },
    ],
    answer: {
      correctValue: "C",
      solution:
        "A metal displaces another from its salt solution only if it is more reactive. Zinc is above copper in the reactivity series; silver, gold and platinum are all below it.",
      hint: "Only a more reactive metal can push a less reactive one out of its compound. Find copper in the reactivity series and look above it.",
    },
    source: PATTERN(2012, "Annual"),
  },
  {
    key: "sci-pyq-2012-02",
    chapter: "human-eye-and-colourful-world",
    topics: ["defects-of-vision"],
    type: "MCQ",
    body: "Myopia is corrected by using a lens that is:",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 60,
    options: [
      { label: "A", body: "convex, of suitable power" },
      { label: "B", body: "concave, of suitable power", isCorrect: true },
      { label: "C", body: "cylindrical, of suitable power" },
      { label: "D", body: "bifocal" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "In myopia the image forms in front of the retina. A concave lens diverges the incoming rays slightly, pushing the image back onto the retina.",
      explanation:
        "A convex lens corrects hypermetropia, where the image forms behind the retina — the opposite defect and the opposite lens.",
      hint: "Decide first whether the image is forming in front of or behind the retina. Then ask whether you need the rays converged more or less.",
    },
    source: PATTERN(2012, "Annual"),
  },
  {
    key: "sci-pyq-2012-03",
    chapter: "our-environment",
    topics: ["food-chains-webs"],
    type: "SHORT_ANSWER",
    body: "State the ten per cent law for the transfer of energy in a food chain, and explain why food chains rarely have more than four trophic levels.",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 210,
    answer: {
      solution:
        "The ten per cent law states that only about $10\\%$ of the energy at one trophic level is passed on to the next; the rest is lost as heat, in respiration and in unconsumed parts.\n\nBecause the loss compounds, the energy available falls by a factor of ten at every step. After three or four levels there is too little energy left to support another population, so food chains are short.",
      markingScheme: [
        { step: "States the ten per cent law", marks: 1 },
        { step: "Explains where the remaining energy goes", marks: 1 },
        { step: "Links the compounding loss to the limit on trophic levels", marks: 1 },
      ],
      hint: "Work out what fraction of the producers' energy reaches the fourth level. The number itself is the explanation.",
    },
    source: PATTERN(2012, "Annual"),
  },

  // ── 2013 ──────────────────────────────────────────────────────────────────
  {
    key: "sci-pyq-2013-01",
    chapter: "carbon-and-its-compounds",
    topics: ["homologous-series"],
    type: "MCQ",
    body: "Two consecutive members of a homologous series differ by:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 60,
    options: [
      { label: "A", body: "$-\\text{CH}_3$" },
      { label: "B", body: "$-\\text{CH}_2-$", isCorrect: true },
      { label: "C", body: "$-\\text{C}_2\\text{H}_4-$" },
      { label: "D", body: "$-\\text{CH}-$" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "Successive members of a homologous series differ by a $-\\text{CH}_2-$ unit, which is a mass difference of $14\\ \\text{u}$.",
      hint: "Write out the formulae of methane, ethane and propane and see exactly what is added each time.",
    },
    source: PATTERN(2013, "Annual"),
  },
  {
    key: "sci-pyq-2013-02",
    chapter: "electricity",
    topics: ["series-parallel-resistors"],
    type: "NUMERICAL",
    body: "Three resistors of $2\\ \\Omega$, $3\\ \\Omega$ and $5\\ \\Omega$ are connected in series. Find their equivalent resistance.",
    marks: 2,
    difficulty: "EASY",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 90,
    answer: {
      correctValue: "10",
      unit: "Ω",
      solution: "In series the resistances add directly: $R = 2 + 3 + 5 = 10\\ \\Omega$.",
      markingScheme: [
        { step: "Correct series formula", marks: 1 },
        { step: "Correct value with units", marks: 1 },
      ],
      hint: "Series and parallel behave oppositely. In one the resistances add; in the other their reciprocals do. Which arrangement is this?",
    },
    source: PATTERN(2013, "Annual"),
  },
  {
    key: "sci-pyq-2013-03",
    chapter: "how-do-organisms-reproduce",
    topics: ["asexual-reproduction"],
    type: "MCQ",
    body: "Which of the following reproduces by binary fission?",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 45,
    options: [
      { label: "A", body: "Yeast" },
      { label: "B", body: "Amoeba", isCorrect: true },
      { label: "C", body: "Planaria" },
      { label: "D", body: "Spirogyra" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "Amoeba divides by binary fission — the nucleus divides and the cell splits into two roughly equal daughter cells.",
      explanation:
        "Yeast buds, Planaria regenerates, and Spirogyra fragments. All are asexual, but none is binary fission.",
      hint: "Binary fission means splitting into two roughly equal halves. Which of these organisms does that, rather than budding or fragmenting?",
    },
    source: PATTERN(2013, "Annual"),
  },

  // ── 2014 ──────────────────────────────────────────────────────────────────
  {
    key: "sci-pyq-2014-01",
    chapter: "chemical-reactions-and-equations",
    topics: ["oxidation-reduction"],
    type: "SHORT_ANSWER",
    body: "In the reaction $\\text{CuO} + \\text{H}_2 \\rightarrow \\text{Cu} + \\text{H}_2\\text{O}$, identify the substance oxidised and the substance reduced, giving a reason for each.",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 210,
    answer: {
      solution:
        "Hydrogen is oxidised: it gains oxygen to become water.\n\nCopper(II) oxide is reduced: it loses oxygen to become copper.\n\nHydrogen is therefore the reducing agent and copper(II) oxide the oxidising agent.",
      markingScheme: [
        { step: "Identifies hydrogen as oxidised, with reason", marks: 1 },
        { step: "Identifies CuO as reduced, with reason", marks: 1 },
        { step: "Names the oxidising and reducing agents", marks: 1 },
      ],
      hint: "Track the oxygen. Whichever substance ends up with more of it has been oxidised, and the one that lost it has been reduced.",
    },
    source: PATTERN(2014, "Annual"),
  },
  {
    key: "sci-pyq-2014-02",
    chapter: "magnetic-effects-of-electric-current",
    topics: ["magnetic-field-lines"],
    type: "MCQ",
    body: "Magnetic field lines outside a bar magnet are directed:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 45,
    options: [
      { label: "A", body: "from the south pole to the north pole" },
      { label: "B", body: "from the north pole to the south pole", isCorrect: true },
      { label: "C", body: "away from both poles" },
      { label: "D", body: "towards both poles" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "Outside the magnet the field lines run from north to south. Inside the magnet they run from south to north, which is what makes every field line a closed loop.",
      hint: "Field lines never start or stop — they form closed loops. If they leave one pole outside the magnet, they must return through the other.",
    },
    source: PATTERN(2014, "Annual"),
  },
  {
    key: "sci-pyq-2014-03",
    chapter: "heredity",
    topics: ["mendels-experiments"],
    type: "MCQ",
    body: "In Mendel's experiment, a cross between two tall pea plants of genotype $Tt$ produces offspring in the phenotypic ratio:",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 90,
    options: [
      { label: "A", body: "$1 : 1$" },
      { label: "B", body: "$3 : 1$", isCorrect: true },
      { label: "C", body: "$1 : 2 : 1$" },
      { label: "D", body: "$9 : 3 : 3 : 1$" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "A $Tt \\times Tt$ cross gives genotypes $TT$, $Tt$, $Tt$, $tt$. Since $T$ is dominant, three are tall and one is short — a phenotypic ratio of $3 : 1$.",
      explanation:
        "$1 : 2 : 1$ is the *genotypic* ratio of the same cross. Reading the wrong one of the two is the usual slip.",
      hint: "Draw the Punnett square, then decide whether the question is asking what the plants look like or what their genotypes are.",
    },
    source: PATTERN(2014, "Annual"),
  },

  // ── 2015 ──────────────────────────────────────────────────────────────────
  {
    key: "sci-pyq-2015-01",
    chapter: "acids-bases-and-salts",
    topics: ["water-of-crystallisation"],
    type: "MCQ",
    body: "The chemical formula of plaster of Paris is:",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 60,
    options: [
      { label: "A", body: "$\\text{CaSO}_4 \\cdot 2\\text{H}_2\\text{O}$" },
      {
        label: "B",
        body: "$\\text{CaSO}_4 \\cdot \\frac{1}{2}\\text{H}_2\\text{O}$",
        isCorrect: true,
      },
      { label: "C", body: "$\\text{CaSO}_4$" },
      { label: "D", body: "$\\text{CaOCl}_2$" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "Plaster of Paris is calcium sulphate hemihydrate, $\\text{CaSO}_4 \\cdot \\frac{1}{2}\\text{H}_2\\text{O}$. It is made by heating gypsum to about $373\\ \\text{K}$.",
      explanation:
        "Option A is gypsum, the starting material. Option D is bleaching powder, an unrelated compound.",
      hint: "Plaster of Paris comes from heating gypsum and losing most — but not all — of its water of crystallisation. How much is left?",
    },
    source: PATTERN(2015, "Annual"),
  },
  {
    key: "sci-pyq-2015-02",
    chapter: "light-reflection-and-refraction",
    topics: ["lens-formula"],
    type: "NUMERICAL",
    body: "An object is placed $30\\ \\text{cm}$ in front of a convex lens of focal length $15\\ \\text{cm}$. Find the image distance.",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 210,
    answer: {
      correctValue: "30",
      acceptedValues: ["30", "+30"],
      unit: "cm",
      solution:
        "Using the sign convention, $u = -30\\ \\text{cm}$ and $f = +15\\ \\text{cm}$.\n\n$\\dfrac{1}{v} - \\dfrac{1}{u} = \\dfrac{1}{f}$\n\n$\\dfrac{1}{v} = \\dfrac{1}{15} + \\dfrac{1}{-30} = \\dfrac{2 - 1}{30} = \\dfrac{1}{30}$\n\nSo $v = +30\\ \\text{cm}$ — a real, inverted image the same size as the object, on the other side of the lens.",
      markingScheme: [
        { step: "Correct signs for $u$ and $f$", marks: 1 },
        { step: "Correct substitution into the lens formula", marks: 1 },
        { step: "Image distance with sign and interpretation", marks: 1 },
      ],
      hint: "Get the sign convention down before anything else: distances measured against the incoming light are negative. The object distance is the one people get wrong.",
    },
    source: PATTERN(2015, "Annual"),
  },
  {
    key: "sci-pyq-2015-03",
    chapter: "life-processes",
    topics: ["excretion"],
    type: "MCQ",
    body: "The functional unit of the kidney is the:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 30,
    options: [
      { label: "A", body: "neuron" },
      { label: "B", body: "nephron", isCorrect: true },
      { label: "C", body: "alveolus" },
      { label: "D", body: "ureter" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "Each kidney contains about a million nephrons, and each nephron filters blood, reabsorbs what the body needs and produces urine.",
      explanation:
        "A neuron is the functional unit of the nervous system — the two words look similar and that is exactly why this is asked.",
      hint: "One of these options belongs to the nervous system and one to the lungs. Rule those out first.",
    },
    source: PATTERN(2015, "Annual"),
  },

  // ── 2016 ──────────────────────────────────────────────────────────────────
  {
    key: "sci-pyq-2016-01",
    chapter: "electricity",
    topics: ["heating-effect-power"],
    type: "NUMERICAL",
    body: "An electric bulb is rated $60\\ \\text{W}$ and operates at $220\\ \\text{V}$. Calculate the current drawn by the bulb.",
    marks: 2,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 120,
    answer: {
      correctValue: "0.27",
      acceptedValues: ["0.27", "0.273", "0.2727"],
      tolerance: 0.005,
      unit: "A",
      solution: "$P = VI$, so $I = \\dfrac{P}{V} = \\dfrac{60}{220} \\approx 0.27\\ \\text{A}$.",
      markingScheme: [
        { step: "Correct rearrangement of $P = VI$", marks: 1 },
        { step: "Correct value with units", marks: 1 },
      ],
      hint: "Power, voltage and current are linked by one short formula. Rearrange it for current before substituting.",
    },
    source: PATTERN(2016, "Annual"),
  },
  {
    key: "sci-pyq-2016-02",
    chapter: "carbon-and-its-compounds",
    topics: ["soaps-and-detergents"],
    type: "SHORT_ANSWER",
    body: "Explain why soap does not work effectively with hard water, and state what detergents do differently.",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 210,
    answer: {
      solution:
        "Hard water contains calcium and magnesium ions. Soap reacts with these to form an insoluble precipitate — scum — so the soap is consumed without cleaning and a curdy deposit is left on the fabric.\n\nDetergents are ammonium or sulphonate salts of long-chain carboxylic acids. Their calcium and magnesium salts remain soluble, so they lather and clean even in hard water.",
      markingScheme: [
        { step: "Names the ions responsible for hardness", marks: 1 },
        { step: "Explains scum formation", marks: 1 },
        { step: "States why detergents are unaffected", marks: 1 },
      ],
      hint: "Something in hard water reacts with soap to make an insoluble solid. Name that something, then ask what detergents do that avoids it.",
    },
    source: PATTERN(2016, "Annual"),
  },

  // ── 2017 ──────────────────────────────────────────────────────────────────
  {
    key: "sci-pyq-2017-01",
    chapter: "metals-and-non-metals",
    topics: ["ionic-compounds"],
    type: "MCQ",
    body: "Ionic compounds generally have high melting points because:",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 75,
    options: [
      { label: "A", body: "they are soluble in water" },
      {
        label: "B",
        body: "a large amount of energy is needed to break the strong electrostatic forces between ions",
        isCorrect: true,
      },
      { label: "C", body: "they conduct electricity in the molten state" },
      { label: "D", body: "they are made of molecules held by weak forces" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "Ionic compounds form a giant lattice of oppositely charged ions held by strong electrostatic attraction. Melting means overcoming those forces throughout the lattice, which takes a great deal of energy.",
      explanation:
        "Solubility and conductivity are also properties of ionic compounds — but they are consequences of the same structure, not the reason for a high melting point.",
      hint: "Melting means separating particles. Ask what is holding these particles together and how strong it is.",
    },
    source: PATTERN(2017, "Annual"),
  },
  {
    key: "sci-pyq-2017-02",
    chapter: "control-and-coordination",
    topics: ["human-brain"],
    type: "MCQ",
    body: "Which part of the human brain controls balance and posture?",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 45,
    options: [
      { label: "A", body: "Cerebrum" },
      { label: "B", body: "Cerebellum", isCorrect: true },
      { label: "C", body: "Medulla" },
      { label: "D", body: "Pons" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "The cerebellum maintains posture and balance and coordinates precise voluntary movements — walking in a straight line, picking up a pencil.",
      explanation:
        "The medulla handles involuntary actions such as heartbeat and blood pressure; the cerebrum handles thinking and voluntary decisions.",
      hint: "Three of these have well-known separate jobs: thinking, involuntary control, and balance. Match the job to the name.",
    },
    source: PATTERN(2017, "Annual"),
  },

  // ── 2018 ──────────────────────────────────────────────────────────────────
  {
    key: "sci-pyq-2018-01",
    chapter: "human-eye-and-colourful-world",
    topics: ["dispersion-of-light"],
    type: "SHORT_ANSWER",
    body: "Why does the sky appear blue on a clear day? Explain briefly.",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 180,
    answer: {
      solution:
        "Molecules in the atmosphere scatter sunlight. The amount of scattering is much greater for shorter wavelengths, so blue light is scattered far more strongly than red.\n\nThis scattered blue light reaches our eyes from every direction in the sky, which is why the sky looks blue rather than the colour of the direct sunlight.",
      markingScheme: [
        { step: "Names scattering by atmospheric molecules", marks: 1 },
        { step: "States that shorter wavelengths scatter more", marks: 1 },
        {
          step: "Concludes that scattered blue light reaches the eye from all directions",
          marks: 1,
        },
      ],
      hint: "The answer is about scattering, and about how it depends on wavelength. Which end of the visible spectrum is affected most?",
    },
    source: PATTERN(2018, "Annual"),
  },
  {
    key: "sci-pyq-2018-02",
    chapter: "our-environment",
    topics: ["ozone-depletion"],
    type: "MCQ",
    body: "The main cause of ozone depletion in the upper atmosphere is:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 45,
    options: [
      { label: "A", body: "carbon dioxide" },
      { label: "B", body: "chlorofluorocarbons", isCorrect: true },
      { label: "C", body: "methane" },
      { label: "D", body: "sulphur dioxide" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "Chlorofluorocarbons release chlorine atoms in the stratosphere, and each chlorine atom goes on to destroy a great many ozone molecules. Their manufacture has been restricted under the Montreal Protocol since 1987.",
      explanation:
        "Carbon dioxide and methane are greenhouse gases — a different environmental problem, and one worth not confusing with this one.",
      hint: "Separate the greenhouse-effect gases from the ozone problem. Only one of these options belongs to the second.",
    },
    source: PATTERN(2018, "Annual"),
  },

  // ── 2019 ──────────────────────────────────────────────────────────────────
  {
    key: "sci-pyq-2019-01",
    chapter: "chemical-reactions-and-equations",
    topics: ["corrosion-rancidity"],
    type: "MCQ",
    body: "Chips packets are flushed with nitrogen gas in order to:",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 60,
    options: [
      { label: "A", body: "keep the chips crisp" },
      { label: "B", body: "prevent oxidation of the fats and oils", isCorrect: true },
      { label: "C", body: "add flavour" },
      { label: "D", body: "reduce the weight of the packet" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "Nitrogen is unreactive and displaces the oxygen inside the packet. Without oxygen the fats and oils cannot be oxidised, so the chips do not go rancid.",
      hint: "Ask what nitrogen is displacing, and what that displaced gas would otherwise do to oily food.",
    },
    source: PATTERN(2019, "Annual"),
  },
  {
    key: "sci-pyq-2019-02",
    chapter: "magnetic-effects-of-electric-current",
    topics: ["force-on-conductor"],
    type: "MCQ",
    body: "Fleming's left-hand rule is used to find the direction of the:",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 60,
    options: [
      { label: "A", body: "induced current in a generator" },
      {
        label: "B",
        body: "force on a current-carrying conductor in a magnetic field",
        isCorrect: true,
      },
      { label: "C", body: "magnetic field around a straight conductor" },
      { label: "D", body: "induced emf in a coil" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "Fleming's left-hand rule gives the direction of the force on a current-carrying conductor placed in a magnetic field — the motor rule. The right-hand rule is the one for induced current, in a generator.",
      hint: "There are two Fleming rules and they apply to opposite situations: one to motors, one to generators. Which hand goes with which?",
    },
    source: PATTERN(2019, "Annual"),
  },

  // ── 2020 ──────────────────────────────────────────────────────────────────
  {
    key: "sci-pyq-2020-01",
    chapter: "life-processes",
    topics: ["respiration"],
    type: "SHORT_ANSWER",
    body: "Write the equation for anaerobic respiration in human muscle cells, and state why it causes cramps.",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 180,
    answer: {
      solution:
        "$\\text{C}_6\\text{H}_{12}\\text{O}_6 \\rightarrow 2\\,\\text{C}_3\\text{H}_6\\text{O}_3 + \\text{energy}$ (glucose $\\rightarrow$ lactic acid)\n\nDuring vigorous exercise the muscles do not receive oxygen fast enough, so glucose is broken down anaerobically. The lactic acid that builds up in the muscle causes the pain known as cramp.",
      markingScheme: [
        { step: "Correct equation naming lactic acid", marks: 1 },
        { step: "Explains the oxygen shortage during exercise", marks: 1 },
        { step: "Links lactic acid accumulation to cramp", marks: 1 },
      ],
      hint: "Anaerobic respiration in humans produces a different product from the one in yeast. Which acid builds up in a muscle that has been worked hard?",
    },
    source: PATTERN(2020, "Annual"),
  },

  // ── 2022, Term 1 ──────────────────────────────────────────────────────────
  {
    key: "sci-pyq-2022t1-01",
    chapter: "acids-bases-and-salts",
    topics: ["common-salts"],
    type: "MCQ",
    body: "Washing soda is produced from baking soda by:",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 75,
    options: [
      { label: "A", body: "heating, then recrystallising with water", isCorrect: true },
      { label: "B", body: "electrolysis of brine" },
      { label: "C", body: "adding hydrochloric acid" },
      { label: "D", body: "passing chlorine over it" },
    ],
    answer: {
      correctValue: "A",
      solution:
        "Heating sodium hydrogencarbonate gives sodium carbonate. Recrystallising that with water produces washing soda, $\\text{Na}_2\\text{CO}_3 \\cdot 10\\text{H}_2\\text{O}$.",
      explanation:
        "Electrolysis of brine is the chlor-alkali process, which makes sodium hydroxide — a different product from a different starting material.",
      hint: "Baking soda is a hydrogencarbonate and washing soda is a hydrated carbonate. What has to happen to get from one to the other?",
    },
    source: PATTERN(2022, "Term 1"),
  },
  {
    key: "sci-pyq-2022t1-02",
    chapter: "light-reflection-and-refraction",
    topics: ["refraction-of-light"],
    type: "MCQ",
    body: "A ray of light travelling from air into glass bends:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 60,
    options: [
      { label: "A", body: "away from the normal" },
      { label: "B", body: "towards the normal", isCorrect: true },
      { label: "C", body: "along the normal" },
      { label: "D", body: "not at all" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "Glass is optically denser than air, so light slows on entering it and bends towards the normal. Going the other way — glass to air — it would bend away.",
      hint: "Which of the two media is optically denser? Light bends towards the normal on entering the denser one.",
    },
    source: PATTERN(2022, "Term 1"),
  },

  // ── 2022, Term 2 ──────────────────────────────────────────────────────────
  {
    key: "sci-pyq-2022t2-01",
    chapter: "how-do-organisms-reproduce",
    topics: ["reproductive-health"],
    type: "SHORT_ANSWER",
    body: "State two methods of contraception and give one advantage of each.",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 210,
    answer: {
      solution:
        "Barrier methods (such as condoms) physically prevent the sperm from reaching the egg. An advantage is that they also reduce the transmission of sexually transmitted infections.\n\nHormonal methods (such as oral contraceptive pills) change the hormone balance so that eggs are not released. An advantage is that they are highly effective when taken correctly.\n\nSurgical methods (vasectomy and tubectomy) are a third category, and are permanent.",
      markingScheme: [
        { step: "First method named correctly", marks: 1 },
        { step: "Second method named correctly", marks: 1 },
        { step: "A valid advantage given for each", marks: 1 },
      ],
      hint: "The methods fall into three families — barrier, hormonal and surgical. Pick two families rather than two examples from the same one.",
    },
    source: PATTERN(2022, "Term 2"),
  },

  // ── 2023 ──────────────────────────────────────────────────────────────────
  {
    key: "sci-pyq-2023-01",
    chapter: "metals-and-non-metals",
    topics: ["extraction-of-metals"],
    type: "MCQ",
    body: "The process of heating a sulphide ore strongly in the presence of excess air is called:",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 60,
    options: [
      { label: "A", body: "calcination" },
      { label: "B", body: "roasting", isCorrect: true },
      { label: "C", body: "smelting" },
      { label: "D", body: "refining" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "Roasting converts a sulphide ore to its oxide by heating it strongly in air. Calcination is the corresponding process for carbonate ores and is done in limited air.",
      explanation:
        "The two are separated by the ore type and the air supply: sulphide with excess air is roasting, carbonate with limited air is calcination.",
      hint: "Two of these words describe heating an ore, and they differ by which ore and how much air. Which goes with sulphides?",
    },
    source: PATTERN(2023, "Annual"),
  },
  {
    key: "sci-pyq-2023-02",
    chapter: "heredity",
    topics: ["sex-determination"],
    type: "MCQ",
    body: "In humans, the sex of a child is determined by:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 60,
    options: [
      { label: "A", body: "the mother's chromosomes" },
      { label: "B", body: "the chromosome inherited from the father", isCorrect: true },
      { label: "C", body: "the mother's diet during pregnancy" },
      { label: "D", body: "the number of chromosomes in the egg" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "The mother contributes an X chromosome in every egg. The father's sperm carries either an X or a Y, so it is the father's contribution that decides whether the child is XX or XY.",
      hint: "One parent can only ever contribute one kind of sex chromosome. Which one, and what does that imply about where the variation comes from?",
    },
    source: PATTERN(2023, "Annual"),
  },

  // ── 2024 ──────────────────────────────────────────────────────────────────
  {
    key: "sci-pyq-2024-01",
    chapter: "electricity",
    topics: ["resistance-factors"],
    type: "SHORT_ANSWER",
    body: "State the factors on which the resistance of a conductor depends, and write the relationship between them.",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 210,
    answer: {
      solution:
        "The resistance of a conductor depends on its length, its area of cross-section, and the material it is made of (and it also varies with temperature).\n\n$R \\propto \\dfrac{l}{A}$, so $R = \\rho\\dfrac{l}{A}$, where $\\rho$ is the resistivity of the material.",
      markingScheme: [
        { step: "Names length and cross-sectional area", marks: 1 },
        { step: "Names the material / resistivity", marks: 1 },
        { step: "States $R = \\rho l / A$", marks: 1 },
      ],
      hint: "Two of the factors are about the wire's shape and one is about what it is made of. The formula ties all three together.",
    },
    source: PATTERN(2024, "Annual"),
  },
  {
    key: "sci-pyq-2024-02",
    chapter: "carbon-and-its-compounds",
    topics: ["covalent-bonding"],
    type: "ASSERTION_REASON",
    body: "**Assertion (A):** Carbon forms covalent bonds rather than ionic ones.\n\n**Reason (R):** Carbon has four electrons in its outermost shell and would need to gain or lose four to achieve a noble gas configuration.",
    marks: 1,
    difficulty: "HARD",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 90,
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
        "Both are true, and the reason is exactly why the assertion holds. Gaining four electrons would require enormous energy to hold an extra four negative charges, and losing four would leave a $\\text{C}^{4+}$ ion that is impossibly unstable. Sharing is the only route open, so carbon bonds covalently.",
      hint: "Work out what ion carbon would have to become to fill its shell by transfer. Then ask whether that ion is realistic.",
    },
    source: PATTERN(2024, "Annual"),
  },

  // ── 2025 ──────────────────────────────────────────────────────────────────
  {
    key: "sci-pyq-2025-01",
    chapter: "magnetic-effects-of-electric-current",
    topics: ["electromagnetic-induction"],
    type: "MCQ",
    body: "An electric generator converts:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 45,
    options: [
      { label: "A", body: "electrical energy into mechanical energy" },
      { label: "B", body: "mechanical energy into electrical energy", isCorrect: true },
      { label: "C", body: "chemical energy into electrical energy" },
      { label: "D", body: "electrical energy into heat energy" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "A generator works by electromagnetic induction: a coil is rotated in a magnetic field and the mechanical work done turning it appears as electrical energy.",
      explanation:
        "Option A describes a motor — the same apparatus run in reverse, which is why the two are so easily confused.",
      hint: "Something has to be turned to make a generator work. Which form of energy is that, and which form comes out?",
    },
    source: PATTERN(2025, "Annual"),
  },
  {
    key: "sci-pyq-2025-02",
    chapter: "our-environment",
    topics: ["waste-management"],
    type: "SHORT_ANSWER",
    body: "Distinguish between biodegradable and non-biodegradable substances, giving one example of each, and state one problem caused by non-biodegradable waste.",
    marks: 3,
    difficulty: "EASY",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 180,
    answer: {
      solution:
        "Biodegradable substances are broken down by the action of micro-organisms — for example, vegetable peels or paper.\n\nNon-biodegradable substances are not broken down by micro-organisms — for example, plastic or aluminium foil.\n\nBecause they are not broken down, non-biodegradable wastes accumulate in the environment and can enter food chains, where harmful substances become concentrated at higher trophic levels (biomagnification).",
      markingScheme: [
        { step: "Correct distinction stated", marks: 1 },
        { step: "One valid example of each", marks: 1 },
        { step: "One clearly explained problem", marks: 1 },
      ],
      hint: "The distinction is about whether micro-organisms can break the substance down. The problem follows directly from what happens when they cannot.",
    },
    source: PATTERN(2025, "Annual"),
  },

  // ── 2026, February ────────────────────────────────────────────────────────
  {
    key: "sci-pyq-2026feb-01",
    chapter: "chemical-reactions-and-equations",
    topics: ["writing-balancing-equations"],
    type: "NUMERICAL",
    body: "Balance the equation $\\text{Fe} + \\text{H}_2\\text{O} \\rightarrow \\text{Fe}_3\\text{O}_4 + \\text{H}_2$ and state the coefficient of $\\text{H}_2\\text{O}$.",
    marks: 2,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 150,
    answer: {
      correctValue: "4",
      solution:
        "The balanced equation is $3\\text{Fe} + 4\\text{H}_2\\text{O} \\rightarrow \\text{Fe}_3\\text{O}_4 + 4\\text{H}_2$.\n\nThe coefficient of $\\text{H}_2\\text{O}$ is $4$.",
      markingScheme: [
        { step: "Equation balanced correctly", marks: 1 },
        { step: "Coefficient stated as $4$", marks: 1 },
      ],
      hint: "Start with the element that appears in the most complicated formula — the oxygen in $\\text{Fe}_3\\text{O}_4$ — and balance hydrogen last.",
    },
    source: PATTERN(2026, "February"),
  },
  {
    key: "sci-pyq-2026feb-02",
    chapter: "life-processes",
    topics: ["transportation"],
    type: "MCQ",
    body: "The tissue that transports water and minerals from the roots to the leaves is:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 45,
    options: [
      { label: "A", body: "phloem" },
      { label: "B", body: "xylem", isCorrect: true },
      { label: "C", body: "cambium" },
      { label: "D", body: "epidermis" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "Xylem carries water and dissolved minerals upwards from the roots. Phloem carries the food made in the leaves to the rest of the plant, in both directions.",
      hint: "Two tissues do the transporting, and they carry different things in different directions. Which one moves water upwards?",
    },
    source: PATTERN(2026, "February"),
  },

  // ── 2026, May ─────────────────────────────────────────────────────────────
  {
    key: "sci-pyq-2026may-01",
    chapter: "human-eye-and-colourful-world",
    topics: ["atmospheric-refraction"],
    type: "MCQ",
    body: "Stars appear to twinkle but planets do not, because:",
    marks: 1,
    difficulty: "HARD",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 90,
    options: [
      { label: "A", body: "stars are much hotter than planets" },
      {
        label: "B",
        body: "planets are extended sources and the variations across them average out",
        isCorrect: true,
      },
      { label: "C", body: "planets emit their own light" },
      { label: "D", body: "stars are closer to the Earth" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "A star is so far away that it behaves as a point source, and atmospheric refraction makes that single point flicker. A planet is close enough to be a collection of many point sources; their flickers are independent and average out, so the planet shines steadily.",
      explanation:
        "Option C is simply false — planets shine by reflected sunlight — and option D is the wrong way round.",
      hint: "The difference is about apparent size rather than about brightness or temperature. What happens when many independent flickers are added together?",
    },
    source: PATTERN(2026, "May"),
  },
  {
    key: "sci-pyq-2026may-02",
    chapter: "control-and-coordination",
    topics: ["endocrine-glands"],
    type: "MCQ",
    body: "Iodine is necessary in the diet because it is required for the synthesis of:",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 60,
    options: [
      { label: "A", body: "insulin" },
      { label: "B", body: "adrenaline" },
      { label: "C", body: "thyroxine", isCorrect: true },
      { label: "D", body: "growth hormone" },
    ],
    answer: {
      correctValue: "C",
      solution:
        "The thyroid gland uses iodine to make thyroxine, which regulates carbohydrate, protein and fat metabolism. A shortage of dietary iodine causes goitre, which is why table salt is iodised.",
      hint: "Which gland is affected when someone develops goitre? The hormone it makes is the one that needs iodine.",
    },
    source: PATTERN(2026, "May"),
  },
];
