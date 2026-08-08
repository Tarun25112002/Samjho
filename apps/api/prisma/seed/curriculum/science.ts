import type { SeedChapter } from "../types.js";

/**
 * CBSE Class 10 Science — the rationalised NCERT syllabus, 13 chapters.
 *
 * Every chapter carries a `domain`, because Class 10 Science is one 80-mark
 * paper covering three subjects. No student says "let me practise Science";
 * they say "I'm weak at Chemistry". The paper is set along these lines too, so
 * marks-lost analysis is far more useful per domain than per chapter.
 *
 * This is the branch of the browse tree that Maths does not exercise, which is
 * exactly why both subjects are in the MVP seed.
 */
export const class10ScienceChapters: SeedChapter[] = [
  {
    slug: "chemical-reactions-and-equations",
    name: "Chemical Reactions and Equations",
    ncertChapterNo: 1,
    domain: "Chemistry",
    topics: [
      { slug: "writing-balancing-equations", name: "Writing and Balancing Chemical Equations" },
      { slug: "types-of-reactions", name: "Types of Chemical Reactions" },
      { slug: "oxidation-reduction", name: "Oxidation and Reduction" },
      { slug: "corrosion-rancidity", name: "Corrosion and Rancidity" },
    ],
  },
  {
    slug: "acids-bases-and-salts",
    name: "Acids, Bases and Salts",
    ncertChapterNo: 2,
    domain: "Chemistry",
    topics: [
      { slug: "properties-of-acids-bases", name: "Chemical Properties of Acids and Bases" },
      { slug: "ph-scale", name: "The pH Scale and its Importance" },
      { slug: "common-salts", name: "Preparation and Uses of Common Salts" },
      { slug: "water-of-crystallisation", name: "Water of Crystallisation" },
    ],
  },
  {
    slug: "metals-and-non-metals",
    name: "Metals and Non-metals",
    ncertChapterNo: 3,
    domain: "Chemistry",
    topics: [
      { slug: "physical-properties-metals", name: "Physical Properties of Metals and Non-metals" },
      { slug: "reactivity-series", name: "Reactivity Series" },
      { slug: "ionic-compounds", name: "Ionic Compounds and their Properties" },
      { slug: "extraction-of-metals", name: "Occurrence and Extraction of Metals" },
    ],
  },
  {
    slug: "carbon-and-its-compounds",
    name: "Carbon and its Compounds",
    ncertChapterNo: 4,
    domain: "Chemistry",
    topics: [
      { slug: "covalent-bonding", name: "Covalent Bonding in Carbon Compounds" },
      { slug: "homologous-series", name: "Homologous Series and Nomenclature" },
      { slug: "chemical-properties-carbon", name: "Chemical Properties of Carbon Compounds" },
      { slug: "soaps-and-detergents", name: "Soaps and Detergents" },
    ],
  },
  {
    slug: "life-processes",
    name: "Life Processes",
    ncertChapterNo: 5,
    domain: "Biology",
    topics: [
      { slug: "nutrition", name: "Nutrition — Autotrophic and Heterotrophic" },
      { slug: "respiration", name: "Respiration" },
      { slug: "transportation", name: "Transportation in Plants and Animals" },
      { slug: "excretion", name: "Excretion" },
    ],
  },
  {
    slug: "control-and-coordination",
    name: "Control and Coordination",
    ncertChapterNo: 6,
    domain: "Biology",
    topics: [
      { slug: "nervous-system", name: "Nervous System and Reflex Action" },
      { slug: "human-brain", name: "Human Brain" },
      { slug: "plant-hormones", name: "Coordination in Plants" },
      { slug: "endocrine-glands", name: "Hormones in Animals" },
    ],
  },
  {
    slug: "how-do-organisms-reproduce",
    name: "How do Organisms Reproduce?",
    ncertChapterNo: 7,
    domain: "Biology",
    topics: [
      { slug: "asexual-reproduction", name: "Modes of Asexual Reproduction" },
      { slug: "sexual-reproduction-plants", name: "Sexual Reproduction in Flowering Plants" },
      { slug: "human-reproductive-system", name: "Human Reproductive System" },
      { slug: "reproductive-health", name: "Reproductive Health" },
    ],
  },
  {
    slug: "heredity",
    name: "Heredity",
    ncertChapterNo: 8,
    domain: "Biology",
    topics: [
      { slug: "mendels-experiments", name: "Mendel's Experiments" },
      { slug: "inherited-traits", name: "Inherited Traits and Expression" },
      { slug: "sex-determination", name: "Sex Determination" },
    ],
  },
  {
    slug: "light-reflection-and-refraction",
    name: "Light — Reflection and Refraction",
    ncertChapterNo: 9,
    domain: "Physics",
    topics: [
      { slug: "spherical-mirrors", name: "Reflection by Spherical Mirrors" },
      { slug: "mirror-formula", name: "Mirror Formula and Magnification" },
      { slug: "refraction-of-light", name: "Refraction of Light and Refractive Index" },
      { slug: "lens-formula", name: "Lens Formula, Magnification and Power" },
    ],
  },
  {
    slug: "human-eye-and-colourful-world",
    name: "The Human Eye and the Colourful World",
    ncertChapterNo: 10,
    domain: "Physics",
    topics: [
      { slug: "structure-of-eye", name: "Structure of the Human Eye and Accommodation" },
      { slug: "defects-of-vision", name: "Defects of Vision and their Correction" },
      { slug: "dispersion-of-light", name: "Dispersion of Light through a Prism" },
      { slug: "atmospheric-refraction", name: "Atmospheric Refraction and Scattering" },
    ],
  },
  {
    slug: "electricity",
    name: "Electricity",
    ncertChapterNo: 11,
    domain: "Physics",
    topics: [
      { slug: "ohms-law", name: "Ohm's Law" },
      { slug: "resistance-factors", name: "Factors Affecting Resistance" },
      { slug: "series-parallel-resistors", name: "Resistors in Series and Parallel" },
      { slug: "heating-effect-power", name: "Heating Effect of Current and Electric Power" },
    ],
  },
  {
    slug: "magnetic-effects-of-electric-current",
    name: "Magnetic Effects of Electric Current",
    ncertChapterNo: 12,
    domain: "Physics",
    topics: [
      { slug: "magnetic-field-lines", name: "Magnetic Field and Field Lines" },
      {
        slug: "field-due-to-conductor",
        name: "Magnetic Field due to a Current-carrying Conductor",
      },
      { slug: "force-on-conductor", name: "Force on a Current-carrying Conductor" },
      { slug: "electromagnetic-induction", name: "Electromagnetic Induction" },
    ],
  },
  {
    slug: "our-environment",
    name: "Our Environment",
    ncertChapterNo: 13,
    domain: "Biology",
    topics: [
      { slug: "ecosystem-components", name: "Ecosystem and its Components" },
      { slug: "food-chains-webs", name: "Food Chains, Food Webs and Trophic Levels" },
      { slug: "waste-management", name: "Waste Management and Biodegradability" },
      { slug: "ozone-depletion", name: "Ozone Layer and its Depletion" },
    ],
  },
];
