import type { SeedChapter } from "../types.js";

/**
 * CBSE Class 10 Mathematics — the rationalised NCERT syllabus, 14 chapters.
 *
 * Every `domain` here is absent, and that is the point: Maths has no grouping
 * layer above chapters. The browse tree renders Subject → Chapter → Topic for
 * this subject and Subject → Domain → Chapter → Topic for Science, from one
 * conditional in the catalog service rather than two code paths.
 */
export const class10MathsChapters: SeedChapter[] = [
  {
    slug: "real-numbers",
    name: "Real Numbers",
    ncertChapterNo: 1,
    topics: [
      { slug: "euclids-division-lemma", name: "Euclid's Division Lemma" },
      { slug: "fundamental-theorem-arithmetic", name: "Fundamental Theorem of Arithmetic" },
      { slug: "hcf-lcm", name: "HCF and LCM by Prime Factorisation" },
      { slug: "irrational-numbers", name: "Proofs of Irrationality" },
    ],
  },
  {
    slug: "polynomials",
    name: "Polynomials",
    ncertChapterNo: 2,
    topics: [
      { slug: "zeroes-of-polynomial", name: "Zeroes of a Polynomial" },
      {
        slug: "zeroes-coefficients-relation",
        name: "Relationship between Zeroes and Coefficients",
      },
      { slug: "polynomial-graphs", name: "Geometrical Meaning of Zeroes" },
    ],
  },
  {
    slug: "linear-equations-two-variables",
    name: "Pair of Linear Equations in Two Variables",
    ncertChapterNo: 3,
    topics: [
      { slug: "graphical-solution", name: "Graphical Method of Solution" },
      { slug: "substitution-elimination", name: "Substitution and Elimination Methods" },
      { slug: "consistency-of-pairs", name: "Consistency and Nature of Solutions" },
      { slug: "linear-equation-word-problems", name: "Word Problems" },
    ],
  },
  {
    slug: "quadratic-equations",
    name: "Quadratic Equations",
    ncertChapterNo: 4,
    topics: [
      { slug: "quadratic-by-factorisation", name: "Solution by Factorisation" },
      { slug: "quadratic-formula", name: "Quadratic Formula" },
      { slug: "discriminant-nature-of-roots", name: "Discriminant and Nature of Roots" },
      { slug: "quadratic-word-problems", name: "Word Problems" },
    ],
  },
  {
    slug: "arithmetic-progressions",
    name: "Arithmetic Progressions",
    ncertChapterNo: 5,
    topics: [
      { slug: "ap-nth-term", name: "nth Term of an AP" },
      { slug: "ap-sum-of-n-terms", name: "Sum of First n Terms" },
      { slug: "ap-applications", name: "Applications of AP" },
    ],
  },
  {
    slug: "triangles",
    name: "Triangles",
    ncertChapterNo: 6,
    topics: [
      { slug: "similarity-criteria", name: "Criteria for Similarity of Triangles" },
      { slug: "basic-proportionality-theorem", name: "Basic Proportionality (Thales) Theorem" },
      { slug: "areas-of-similar-triangles", name: "Areas of Similar Triangles" },
      { slug: "pythagoras-theorem", name: "Pythagoras Theorem and its Converse" },
    ],
  },
  {
    slug: "coordinate-geometry",
    name: "Coordinate Geometry",
    ncertChapterNo: 7,
    topics: [
      { slug: "distance-formula", name: "Distance Formula" },
      { slug: "section-formula", name: "Section Formula" },
      { slug: "collinearity", name: "Collinearity of Points" },
    ],
  },
  {
    slug: "introduction-to-trigonometry",
    name: "Introduction to Trigonometry",
    ncertChapterNo: 8,
    topics: [
      { slug: "trigonometric-ratios", name: "Trigonometric Ratios" },
      { slug: "trig-ratios-specific-angles", name: "Ratios of Specific Angles" },
      { slug: "trigonometric-identities", name: "Trigonometric Identities" },
    ],
  },
  {
    slug: "applications-of-trigonometry",
    name: "Some Applications of Trigonometry",
    ncertChapterNo: 9,
    topics: [
      { slug: "heights-and-distances", name: "Heights and Distances" },
      { slug: "angle-of-elevation-depression", name: "Angles of Elevation and Depression" },
    ],
  },
  {
    slug: "circles",
    name: "Circles",
    ncertChapterNo: 10,
    topics: [
      { slug: "tangent-to-circle", name: "Tangent to a Circle" },
      { slug: "number-of-tangents", name: "Number of Tangents from a Point" },
      { slug: "tangent-length-theorem", name: "Equal Tangents Theorem" },
    ],
  },
  {
    slug: "areas-related-to-circles",
    name: "Areas Related to Circles",
    ncertChapterNo: 11,
    topics: [
      { slug: "area-of-sector", name: "Area of a Sector" },
      { slug: "area-of-segment", name: "Area of a Segment" },
      { slug: "combination-of-figures", name: "Areas of Combinations of Plane Figures" },
    ],
  },
  {
    slug: "surface-areas-and-volumes",
    name: "Surface Areas and Volumes",
    ncertChapterNo: 12,
    topics: [
      { slug: "combination-of-solids", name: "Surface Area of a Combination of Solids" },
      { slug: "volume-of-combination", name: "Volume of a Combination of Solids" },
      { slug: "conversion-of-solids", name: "Conversion of Solid from One Shape to Another" },
    ],
  },
  {
    slug: "statistics",
    name: "Statistics",
    ncertChapterNo: 13,
    topics: [
      { slug: "mean-grouped-data", name: "Mean of Grouped Data" },
      { slug: "mode-grouped-data", name: "Mode of Grouped Data" },
      { slug: "median-grouped-data", name: "Median of Grouped Data" },
    ],
  },
  {
    slug: "probability",
    name: "Probability",
    ncertChapterNo: 14,
    topics: [
      { slug: "theoretical-probability", name: "Theoretical Probability" },
      { slug: "probability-cards-dice", name: "Problems on Cards, Dice and Coins" },
      { slug: "complementary-events", name: "Complementary Events" },
    ],
  },
];
