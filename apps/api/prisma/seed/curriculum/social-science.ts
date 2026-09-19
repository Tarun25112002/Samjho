import type { SeedChapter } from "../types.js";

/**
 * CBSE Class 10 Social Science — one 80-mark paper, four books.
 *
 * ## Why this subject is the one that justifies `Chapter.domain`
 *
 * Science has three domains and Social Science has four, but the difference is
 * sharper than the count. Science's domains are a convenience — the paper is
 * one continuous set of questions and the split is pedagogical. Social
 * Science's are structural: History, Geography, Political Science and Economics
 * are four separate NCERT books with separate mark allocations, and the paper
 * itself is organised along them.
 *
 * So a student who is weak here is never "weak at Social Science". They are
 * weak at Geography and fine at History, and a platform that cannot say which
 * is telling them nothing they can act on. Every rollup in this product is
 * per-topic and rolls up through chapter to subject, and `domain` is what lets
 * the analysis surface the layer in between.
 *
 * ## The mark split
 *
 * 20 marks each across the four, which is what makes the domain breakdown
 * comparable rather than merely descriptive — losing six marks in Economics is
 * the same size of problem as losing six in History, and the numbers can be put
 * side by side without a caveat.
 *
 * ## Chapter numbering
 *
 * `ncertChapterNo` restarts at 1 for each book, because that is how the books
 * are printed and how a student refers to them. It is unique within a chapter's
 * own domain rather than within the subject, which is why nothing in the schema
 * treats it as a key.
 */
export const class10SocialScienceChapters: SeedChapter[] = [
  // ── History: India and the Contemporary World II ───────────────────────────
  {
    slug: "rise-of-nationalism-in-europe",
    name: "The Rise of Nationalism in Europe",
    ncertChapterNo: 1,
    domain: "History",
    topics: [
      {
        slug: "french-revolution-nationalism",
        name: "The French Revolution and the Idea of the Nation",
      },
      { slug: "making-of-nationalism-europe", name: "The Making of Nationalism in Europe" },
      { slug: "unification-germany-italy", name: "The Unification of Germany and Italy" },
      { slug: "nationalism-imperialism", name: "Nationalism and Imperialism" },
    ],
  },
  {
    slug: "nationalism-in-india",
    name: "Nationalism in India",
    ncertChapterNo: 2,
    domain: "History",
    topics: [
      {
        slug: "first-world-war-khilafat",
        name: "The First World War, Khilafat and Non-Cooperation",
      },
      { slug: "civil-disobedience-movement", name: "The Civil Disobedience Movement" },
      { slug: "salt-march", name: "The Salt March and its Significance" },
      { slug: "sense-of-collective-belonging", name: "The Sense of Collective Belonging" },
    ],
  },
  {
    slug: "the-making-of-a-global-world",
    name: "The Making of a Global World",
    ncertChapterNo: 3,
    domain: "History",
    topics: [
      { slug: "pre-modern-globalisation", name: "The Pre-modern World and the Silk Routes" },
      { slug: "nineteenth-century-economy", name: "The Nineteenth-Century Global Economy" },
      { slug: "interwar-economy", name: "The Inter-war Economy and the Great Depression" },
      { slug: "bretton-woods", name: "Rebuilding a World Economy: Bretton Woods" },
    ],
  },
  {
    slug: "print-culture-and-the-modern-world",
    name: "Print Culture and the Modern World",
    ncertChapterNo: 4,
    domain: "History",
    topics: [
      { slug: "first-printed-books", name: "The First Printed Books and the Print Revolution" },
      { slug: "print-and-reform-india", name: "Print, Religion and Reform in India" },
      { slug: "print-and-censorship", name: "Print, Censorship and Nationalism" },
    ],
  },

  // ── Geography: Contemporary India II ───────────────────────────────────────
  {
    slug: "resources-and-development",
    name: "Resources and Development",
    ncertChapterNo: 1,
    domain: "Geography",
    topics: [
      { slug: "types-of-resources", name: "Classification of Resources" },
      { slug: "land-resources-use", name: "Land Resources and Land Use" },
      { slug: "soil-types-india", name: "Soil Types of India" },
      { slug: "soil-erosion-conservation", name: "Soil Erosion and Conservation" },
    ],
  },
  {
    slug: "water-resources",
    name: "Water Resources",
    ncertChapterNo: 2,
    domain: "Geography",
    topics: [
      { slug: "water-scarcity", name: "Water Scarcity and the Need for Conservation" },
      { slug: "multi-purpose-river-projects", name: "Multi-purpose River Projects" },
      { slug: "rainwater-harvesting", name: "Rainwater Harvesting" },
    ],
  },
  {
    slug: "agriculture",
    name: "Agriculture",
    ncertChapterNo: 3,
    domain: "Geography",
    topics: [
      { slug: "types-of-farming", name: "Types of Farming in India" },
      { slug: "cropping-seasons", name: "Cropping Seasons and Major Crops" },
      { slug: "agricultural-reforms", name: "Technological and Institutional Reforms" },
    ],
  },
  {
    slug: "minerals-and-energy-resources",
    name: "Minerals and Energy Resources",
    ncertChapterNo: 4,
    domain: "Geography",
    topics: [
      { slug: "types-of-minerals", name: "Classification and Occurrence of Minerals" },
      { slug: "conventional-energy", name: "Conventional Sources of Energy" },
      { slug: "non-conventional-energy", name: "Non-conventional Sources of Energy" },
    ],
  },
  {
    slug: "manufacturing-industries",
    name: "Manufacturing Industries",
    ncertChapterNo: 5,
    domain: "Geography",
    topics: [
      { slug: "importance-of-manufacturing", name: "Importance of Manufacturing" },
      { slug: "classification-of-industries", name: "Classification of Industries" },
      { slug: "industrial-pollution", name: "Industrial Pollution and its Control" },
    ],
  },
  {
    slug: "lifelines-of-national-economy",
    name: "Lifelines of National Economy",
    ncertChapterNo: 6,
    domain: "Geography",
    topics: [
      { slug: "roadways-railways", name: "Roadways and Railways" },
      { slug: "pipelines-waterways-airways", name: "Pipelines, Waterways and Airways" },
      { slug: "international-trade", name: "International Trade" },
    ],
  },

  // ── Political Science: Democratic Politics II ──────────────────────────────
  {
    slug: "power-sharing",
    name: "Power Sharing",
    ncertChapterNo: 1,
    domain: "Political Science",
    topics: [
      { slug: "belgium-sri-lanka", name: "The Cases of Belgium and Sri Lanka" },
      { slug: "why-power-sharing", name: "Why Power Sharing is Desirable" },
      { slug: "forms-of-power-sharing", name: "Forms of Power Sharing" },
    ],
  },
  {
    slug: "federalism",
    name: "Federalism",
    ncertChapterNo: 2,
    domain: "Political Science",
    topics: [
      { slug: "what-is-federalism", name: "What is Federalism" },
      { slug: "federalism-in-india", name: "Federalism in India: The Three Lists" },
      { slug: "decentralisation-india", name: "Decentralisation and Local Government" },
    ],
  },
  {
    slug: "gender-religion-and-caste",
    name: "Gender, Religion and Caste",
    ncertChapterNo: 3,
    domain: "Political Science",
    topics: [
      { slug: "gender-and-politics", name: "Gender and Politics" },
      { slug: "religion-communalism-secularism", name: "Religion, Communalism and Secularism" },
      { slug: "caste-and-politics", name: "Caste and Politics" },
    ],
  },
  {
    slug: "political-parties",
    name: "Political Parties",
    ncertChapterNo: 4,
    domain: "Political Science",
    topics: [
      { slug: "why-parties-are-needed", name: "Why We Need Political Parties" },
      { slug: "national-and-state-parties", name: "National and State Parties" },
      { slug: "challenges-to-parties", name: "Challenges to Political Parties" },
    ],
  },
  {
    slug: "outcomes-of-democracy",
    name: "Outcomes of Democracy",
    ncertChapterNo: 5,
    domain: "Political Science",
    topics: [
      { slug: "accountable-government", name: "Accountable and Responsive Government" },
      { slug: "economic-growth-inequality", name: "Economic Growth and Inequality" },
      { slug: "dignity-and-freedom", name: "Dignity and Freedom of Citizens" },
    ],
  },

  // ── Economics: Understanding Economic Development ──────────────────────────
  {
    slug: "development",
    name: "Development",
    ncertChapterNo: 1,
    domain: "Economics",
    topics: [
      { slug: "development-goals", name: "Different People, Different Development Goals" },
      { slug: "income-and-other-criteria", name: "Income and Other Criteria" },
      { slug: "human-development-index", name: "Human Development and the HDI" },
      { slug: "sustainability-of-development", name: "Sustainability of Development" },
    ],
  },
  {
    slug: "sectors-of-the-indian-economy",
    name: "Sectors of the Indian Economy",
    ncertChapterNo: 2,
    domain: "Economics",
    topics: [
      { slug: "three-sectors", name: "Primary, Secondary and Tertiary Sectors" },
      { slug: "gdp-and-employment", name: "GDP, Employment and Underemployment" },
      { slug: "organised-unorganised", name: "Organised and Unorganised Sectors" },
    ],
  },
  {
    slug: "money-and-credit",
    name: "Money and Credit",
    ncertChapterNo: 3,
    domain: "Economics",
    topics: [
      { slug: "money-as-medium-of-exchange", name: "Money as a Medium of Exchange" },
      { slug: "loans-and-terms-of-credit", name: "Loans and the Terms of Credit" },
      { slug: "formal-informal-credit", name: "Formal and Informal Sources of Credit" },
      { slug: "self-help-groups", name: "Self-Help Groups and the Poor" },
    ],
  },
  {
    slug: "globalisation-and-the-indian-economy",
    name: "Globalisation and the Indian Economy",
    ncertChapterNo: 4,
    domain: "Economics",
    topics: [
      { slug: "multinational-corporations", name: "Production Across Countries and MNCs" },
      { slug: "foreign-trade-integration", name: "Foreign Trade and Market Integration" },
      { slug: "impact-of-globalisation", name: "The Impact of Globalisation on India" },
    ],
  },
];
