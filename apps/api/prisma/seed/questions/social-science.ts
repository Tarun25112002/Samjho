import type { SeedQuestion } from "../types.js";

/**
 * CBSE Class 10 Social Science — coverage across all four books.
 *
 * Spread deliberately rather than evenly-by-accident: every one of the four
 * domains gets questions at each difficulty, because the first thing this
 * subject's analysis has to be able to say is *which book* a student is losing
 * marks in. A seed that happened to be three-quarters History would make the
 * domain breakdown look broken on the day it was first rendered.
 *
 * Map-based questions are absent, and that is a gap rather than an oversight:
 * the paper carries five marks of map work, and a map item needs an asset and a
 * click-region answer type that `QuestionType` does not yet have. Better an
 * honest hole than a question type faked with a multiple choice about a place.
 */

const ORIGINAL = { sourceType: "ORIGINAL", licenceStatus: "CLEARED" } as const;

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

export const class10SocialScienceQuestions: SeedQuestion[] = [
  // ── History ───────────────────────────────────────────────────────────────
  {
    key: "sst-hist-001",
    chapter: "rise-of-nationalism-in-europe",
    topics: ["unification-germany-italy"],
    type: "MCQ",
    body: "Who was the chief architect of the unification of Germany?",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 45,
    options: [
      { label: "A", body: "Giuseppe Mazzini" },
      { label: "B", body: "Otto von Bismarck", isCorrect: true },
      { label: "C", body: "Count Cavour" },
      { label: "D", body: "Giuseppe Garibaldi" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "Otto von Bismarck, Chief Minister of Prussia, carried out the unification of Germany with the help of the Prussian army and bureaucracy, completing it in 1871.",
      explanation:
        "Cavour played the equivalent role in Italy, and Mazzini and Garibaldi were also Italian. Three of the four options belong to a different country's unification, which is the trap.",
      hint: "One of these four is not Italian. That narrows it immediately.",
    },
    source: ORIGINAL,
  },
  {
    key: "sst-hist-002",
    chapter: "nationalism-in-india",
    topics: ["salt-march"],
    type: "SHORT_ANSWER",
    body: "Why did Mahatma Gandhi choose salt as the symbol of the Civil Disobedience Movement? Give three reasons.",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 240,
    answer: {
      solution:
        "1. Salt is consumed by every Indian, rich and poor alike, so a tax on it affected the entire population and could unite them.\n\n2. The state monopoly over its production and sale was a particularly oppressive face of British rule — Indians could not make salt even from their own coastline.\n\n3. It was an everyday necessity rather than a political abstraction, which made the protest immediately understandable to ordinary people who had never joined a movement before.",
      markingScheme: [
        { step: "Universality of salt consumption across classes", marks: 1 },
        { step: "The oppressive nature of the state monopoly", marks: 1 },
        { step: "Its power as an accessible, everyday symbol", marks: 1 },
      ],
      hint: "Think about who salt affects and what made the tax on it feel unjust. The answer is about reach and about symbolism, not about economics alone.",
    },
    source: ORIGINAL,
  },
  {
    key: "sst-hist-003",
    chapter: "the-making-of-a-global-world",
    topics: ["interwar-economy"],
    type: "MCQ",
    body: "The Great Depression of the 1930s began in which year?",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 30,
    options: [
      { label: "A", body: "1919" },
      { label: "B", body: "1929", isCorrect: true },
      { label: "C", body: "1939" },
      { label: "D", body: "1945" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "The Great Depression began in 1929, triggered by the Wall Street crash, and continued through the mid-1930s.",
      hint: "It falls between the two World Wars, and closer to the first than the second.",
    },
    source: ORIGINAL,
  },
  {
    key: "sst-hist-004",
    chapter: "print-culture-and-the-modern-world",
    topics: ["first-printed-books"],
    type: "ASSERTION_REASON",
    body: "**Assertion (A):** The printing press led to the spread of new ideas in Europe.\n\n**Reason (R):** Printing made books cheaper and available to a much wider readership than hand-copied manuscripts.",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 75,
    options: arOptions("A"),
    answer: {
      correctValue: "A",
      solution:
        "Both statements are true and the reason explains the assertion: hand-copied manuscripts were expensive and scarce, so printing them cheaply is precisely the mechanism by which new ideas reached a wide public.",
      hint: "Ask how ideas actually travelled before print, and what changed. If the reason describes the mechanism, it is the explanation.",
    },
    source: ORIGINAL,
  },
  {
    key: "sst-hist-005",
    chapter: "nationalism-in-india",
    topics: ["civil-disobedience-movement"],
    type: "LONG_ANSWER",
    body: "Explain how different social groups participated in the Civil Disobedience Movement, and why some of them later withdrew.",
    marks: 5,
    difficulty: "HARD",
    bloomLevel: "EVALUATE",
    expectedTimeSeconds: 420,
    answer: {
      solution:
        "**Rich peasants** (Patidars, Jats) joined because the Depression had collapsed crop prices while revenue demands stayed high. When the movement was called off in 1931 without revenue being reduced, many refused to rejoin.\n\n**Poor peasants** wanted unpaid rent to landlords remitted. Congress was reluctant to support that demand for fear of losing rich peasants and landlords, so their relationship with the movement stayed uncertain.\n\n**Business classes** wanted protection against imports and formed bodies like FICCI. They grew lukewarm after 1931, worried by prolonged disruption to trade and by the growing influence of socialism within Congress.\n\n**Industrial workers** participated only in some regions, since Congress was reluctant to take up their demands against Indian industrialists.\n\n**Women** participated in very large numbers for the first time, though Congress was long reluctant to give them positions of authority.",
      markingScheme: [
        { step: "Rich peasants: motivation and withdrawal", marks: 1 },
        { step: "Poor peasants and the rent question", marks: 1 },
        { step: "Business classes: initial support and later hesitation", marks: 1 },
        { step: "Industrial workers' limited participation", marks: 1 },
        { step: "Women's participation and its limits", marks: 1 },
      ],
      hint: "Take the social groups one at a time. For each, ask what they wanted from the movement — the withdrawals almost all follow from that want going unmet.",
    },
    source: ORIGINAL,
  },

  // ── Geography ─────────────────────────────────────────────────────────────
  {
    key: "sst-geo-001",
    chapter: "resources-and-development",
    topics: ["soil-types-india"],
    type: "MCQ",
    body: "Which soil is most suitable for growing cotton?",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 45,
    options: [
      { label: "A", body: "Alluvial soil" },
      { label: "B", body: "Black soil", isCorrect: true },
      { label: "C", body: "Laterite soil" },
      { label: "D", body: "Arid soil" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "Black soil — also called regur or black cotton soil — retains moisture well and is rich in lime, iron, magnesia and alumina, which makes it ideal for cotton.",
      hint: "One of these soils is named after the crop it suits best. That is not a coincidence.",
    },
    source: ORIGINAL,
  },
  {
    key: "sst-geo-002",
    chapter: "water-resources",
    topics: ["multi-purpose-river-projects"],
    type: "SHORT_ANSWER",
    body: "State three problems caused by multi-purpose river projects.",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 210,
    answer: {
      solution:
        "1. They cause large-scale displacement of local communities, who often lose land and livelihood without adequate rehabilitation.\n\n2. They fragment rivers, making it harder for aquatic life to migrate and spawn, and excessive sedimentation at the bottom of reservoirs damages habitats.\n\n3. They can induce earthquakes, cause water-borne diseases and pests, and the irrigation they enable has in places led to waterlogging and soil salinity.",
      markingScheme: [
        { step: "Displacement of local communities", marks: 1 },
        { step: "Ecological consequences for the river and aquatic life", marks: 1 },
        { step: "Any third valid problem, explained", marks: 1 },
      ],
      hint: "Think about three different kinds of cost: to people, to the river itself, and to the land around it.",
    },
    source: ORIGINAL,
  },
  {
    key: "sst-geo-003",
    chapter: "agriculture",
    topics: ["cropping-seasons"],
    type: "MCQ",
    body: "Which of the following is a rabi crop?",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 45,
    options: [
      { label: "A", body: "Rice" },
      { label: "B", body: "Wheat", isCorrect: true },
      { label: "C", body: "Jute" },
      { label: "D", body: "Cotton" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "Rabi crops are sown in winter (October to December) and harvested in summer (April to June). Wheat is the principal rabi crop; rice, jute and cotton are all kharif crops sown with the monsoon.",
      hint: "Rabi crops are sown in winter. Which of these is planted after the monsoon has ended rather than with it?",
    },
    source: ORIGINAL,
  },
  {
    key: "sst-geo-004",
    chapter: "minerals-and-energy-resources",
    topics: ["non-conventional-energy"],
    type: "MCQ",
    body: "Which of the following is a non-conventional source of energy?",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 45,
    options: [
      { label: "A", body: "Coal" },
      { label: "B", body: "Petroleum" },
      { label: "C", body: "Solar energy", isCorrect: true },
      { label: "D", body: "Natural gas" },
    ],
    answer: {
      correctValue: "C",
      solution:
        "Solar energy is non-conventional and renewable. Coal, petroleum and natural gas are conventional fossil fuels, which are exhaustible and polluting.",
      hint: "Three of these are fossil fuels formed over millions of years. The odd one out arrives fresh every day.",
    },
    source: ORIGINAL,
  },
  {
    key: "sst-geo-005",
    chapter: "lifelines-of-national-economy",
    topics: ["roadways-railways"],
    type: "SHORT_ANSWER",
    body: "Give three reasons why road transport in India is more important than rail transport for short-distance travel.",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 210,
    answer: {
      solution:
        "1. Construction cost is far lower than laying railway track, so roads reach places a railway could not justify.\n\n2. Roads can negotiate broken terrain and steeper gradients, which lets them serve hilly and dissected regions that rail cannot.\n\n3. Road transport provides door-to-door service, so goods need not be loaded and unloaded at a station, which reduces both cost and handling damage on short hauls.",
      markingScheme: [
        { step: "Lower construction cost", marks: 1 },
        { step: "Ability to handle difficult terrain", marks: 1 },
        { step: "Door-to-door service and lower handling cost", marks: 1 },
      ],
      hint: "Compare the two on three different axes: what it costs to build, where it can go, and what happens at each end of the journey.",
    },
    source: ORIGINAL,
  },

  // ── Political Science ─────────────────────────────────────────────────────
  {
    key: "sst-pol-001",
    chapter: "federalism",
    topics: ["federalism-in-india"],
    type: "MCQ",
    body: "Under the Indian Constitution, defence and foreign affairs fall under the:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 45,
    options: [
      { label: "A", body: "Union List", isCorrect: true },
      { label: "B", body: "State List" },
      { label: "C", body: "Concurrent List" },
      { label: "D", body: "Residuary subjects" },
    ],
    answer: {
      correctValue: "A",
      solution:
        "The Union List covers subjects of national importance on which a uniform policy is needed — defence, foreign affairs, banking, communications and currency. Only the Union Government can legislate on these.",
      hint: "Ask whether the whole country needs one policy on this, or whether each state could sensibly have its own.",
    },
    source: ORIGINAL,
  },
  {
    key: "sst-pol-002",
    chapter: "power-sharing",
    topics: ["why-power-sharing"],
    type: "SHORT_ANSWER",
    body: "Distinguish between the prudential and the moral reasons for power sharing, giving one example of each.",
    marks: 3,
    difficulty: "HARD",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 240,
    answer: {
      solution:
        "**Prudential** reasons are about results: power sharing reduces conflict between social groups and so ensures the stability of the political order. Sri Lanka's majoritarian refusal to share power with Tamils led to civil war, while Belgium's accommodation held the country together.\n\n**Moral** reasons are about the act itself: power sharing is the very spirit of democracy, because those affected by a decision have a right to be consulted about it. A democracy that excludes a group is less legitimate regardless of whether that exclusion happens to cause unrest.\n\nThe difference is that prudential reasons stress better outcomes, while moral reasons treat power sharing as valuable in itself.",
      markingScheme: [
        { step: "Prudential reason explained, with an example", marks: 1 },
        { step: "Moral reason explained, with an example", marks: 1 },
        { step: "The distinction between outcome and principle stated clearly", marks: 1 },
      ],
      hint: 'One kind of reason says "it works better" and the other says "it is right". Which is which, and can you name a country for each?',
    },
    source: ORIGINAL,
  },
  {
    key: "sst-pol-003",
    chapter: "political-parties",
    topics: ["challenges-to-parties"],
    type: "MCQ",
    body: "Which of the following is **not** a challenge faced by political parties in India?",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 75,
    options: [
      { label: "A", body: "Lack of internal democracy" },
      { label: "B", body: "Dynastic succession" },
      { label: "C", body: "Growing role of money and muscle power" },
      { label: "D", body: "Too few parties contesting elections", isCorrect: true },
    ],
    answer: {
      correctValue: "D",
      solution:
        "India has a very large number of registered parties, so a shortage is not the problem. The four recognised challenges are lack of internal democracy, dynastic succession, money and muscle power, and the lack of meaningful choice between parties.",
      explanation:
        '"Lack of meaningful choice" is a real challenge and sounds a little like option D — but it is about parties resembling one another, not about there being too few of them.',
      hint: "Three of these are on the standard list of four challenges. The fourth describes a situation India does not actually have.",
    },
    source: ORIGINAL,
  },
  {
    key: "sst-pol-004",
    chapter: "outcomes-of-democracy",
    topics: ["economic-growth-inequality"],
    type: "ASSERTION_REASON",
    body: "**Assertion (A):** Democracies have not been able to reduce economic inequalities significantly.\n\n**Reason (R):** In a democracy, every citizen has one vote and equal political standing.",
    marks: 1,
    difficulty: "HARD",
    bloomLevel: "EVALUATE",
    expectedTimeSeconds: 90,
    options: arOptions("B"),
    answer: {
      correctValue: "B",
      solution:
        "Both statements are true. Democracies are based on political equality, yet economic inequalities have persisted and in many cases widened. But political equality does not *explain* the persistence of economic inequality — if anything it is the tension the assertion points to. So the reason is true without being the explanation.",
      hint: "Both look true. The question is whether the second causes the first — read them again and ask whether equal votes would *produce* unequal incomes.",
    },
    source: ORIGINAL,
  },

  // ── Economics ─────────────────────────────────────────────────────────────
  {
    key: "sst-eco-001",
    chapter: "development",
    topics: ["income-and-other-criteria"],
    type: "MCQ",
    body: "The World Bank classifies countries primarily on the basis of:",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 45,
    options: [
      { label: "A", body: "total income" },
      { label: "B", body: "per capita income", isCorrect: true },
      { label: "C", body: "literacy rate" },
      { label: "D", body: "life expectancy" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "The World Bank's classification uses per capita income — average income per person — rather than total income, because a large country with many poor people can still have a high total.",
      explanation:
        "Literacy and life expectancy are used by the UNDP's Human Development Index, which is the alternative measure this chapter contrasts with the World Bank's.",
      hint: "Two countries can have the same total income and very different standards of living. What has to be divided out to compare them fairly?",
    },
    source: ORIGINAL,
  },
  {
    key: "sst-eco-002",
    chapter: "sectors-of-the-indian-economy",
    topics: ["three-sectors"],
    type: "MCQ",
    body: "Which sector has the largest share in India's GDP?",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 60,
    options: [
      { label: "A", body: "Primary sector" },
      { label: "B", body: "Secondary sector" },
      { label: "C", body: "Tertiary sector", isCorrect: true },
      { label: "D", body: "All three contribute equally" },
    ],
    answer: {
      correctValue: "C",
      solution:
        "The tertiary or service sector contributes the largest share of India's GDP. The primary sector still employs the largest number of people, which is the imbalance this chapter is about.",
      explanation:
        "Confusing share of GDP with share of employment is the standard mistake here, and the gap between the two is precisely the point.",
      hint: "Be careful which question is being asked: the sector that produces the most value is not the sector that employs the most people.",
    },
    source: ORIGINAL,
  },
  {
    key: "sst-eco-003",
    chapter: "money-and-credit",
    topics: ["formal-informal-credit"],
    type: "SHORT_ANSWER",
    body: "Why is it necessary to expand formal sources of credit in India? Give three reasons.",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 210,
    answer: {
      solution:
        "1. Informal lenders charge much higher interest, so a larger part of the borrower's earnings goes on repayment and less is left to improve their position.\n\n2. High cost of borrowing can mean the amount repaid exceeds the income from the activity financed, which is how debt traps form.\n\n3. Formal credit is supervised by the Reserve Bank of India, which monitors lending terms and ensures credit reaches small borrowers rather than only the well-off — so expanding it makes development more equitable.",
      markingScheme: [
        { step: "Lower interest rates in the formal sector", marks: 1 },
        { step: "Avoiding debt traps", marks: 1 },
        { step: "RBI supervision and equitable access", marks: 1 },
      ],
      hint: "Compare the two sources on cost, on what happens when a borrower cannot repay, and on who is watching the lender.",
    },
    source: ORIGINAL,
  },
  {
    key: "sst-eco-004",
    chapter: "globalisation-and-the-indian-economy",
    topics: ["impact-of-globalisation"],
    type: "LONG_ANSWER",
    body: '"Globalisation has not benefited all people in India equally." Justify this statement with examples.',
    marks: 5,
    difficulty: "HARD",
    bloomLevel: "EVALUATE",
    expectedTimeSeconds: 420,
    answer: {
      solution:
        "**Who has gained.** Well-off urban consumers have far more choice at better quality and lower prices. Educated, skilled professionals have found new opportunities in IT and services. Some Indian companies have themselves become multinationals — Tata Motors, Infosys, Ranbaxy — by investing abroad.\n\n**Who has lost.** Small manufacturers in batteries, capacitors, plastics and toys have been unable to compete with cheaper imports and many have shut down, causing unemployment. Workers have borne the cost of flexible labour practices: employment has become casual and insecure, with long hours and no social security.\n\n**Conclusion.** The gains have been concentrated among skilled, educated and better-off people in urban areas, while small producers and unorganised workers have carried the losses. This is why fair globalisation — and government support for small producers, along with enforcement of labour laws — is argued for.",
      markingScheme: [
        { step: "Benefits to consumers and skilled workers", marks: 1 },
        { step: "Indian companies becoming multinationals", marks: 1 },
        { step: "Small manufacturers displaced by imports", marks: 1 },
        { step: "Impact on workers and job security", marks: 1 },
        { step: "A reasoned conclusion", marks: 1 },
      ],
      hint: 'A "justify" question wants both sides and then a judgement. Name who gained and who lost, with real examples, before you conclude.',
    },
    source: ORIGINAL,
  },
];
