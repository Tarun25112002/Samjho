import type { SeedChapter } from "../types.js";

/**
 * CBSE Class 10 English — Language and Literature.
 *
 * ## Why this subject's "chapters" are not all chapters
 *
 * Maths, Science and Social Science share a shape: a numbered list of NCERT
 * chapters, each with topics inside it. English does not. Its 80 marks split
 * across three genuinely different things — reading unseen passages, writing
 * and grammar, and two literature readers — and only the last of those is a
 * list of chapters in the ordinary sense.
 *
 * Rather than force that into a shape it does not have, the domain field does
 * the work it does for Science and Social Science: `Reading`, `Writing and
 * Grammar`, `Literature — First Flight` and `Literature — Footprints without
 * Feet`. A student weak at unseen comprehension and strong on the prose
 * chapters is a real and common pattern, and this is what lets the analysis
 * say so.
 *
 * ## Why Reading and Writing get so few "chapters"
 *
 * Because they are skills rather than content. There is no chapter to revise
 * for an unseen passage; there is a technique, and the topics below name the
 * sub-skills the paper actually tests. Mastery on those is measured the same
 * way as anywhere else — from answers — and it is arguably more useful here
 * than in a content subject, because a student cannot tell from a textbook
 * whether they are good at inference.
 *
 * The literature entries are real chapters and are numbered as their readers
 * number them.
 */
export const class10EnglishChapters: SeedChapter[] = [
  // ── Reading ───────────────────────────────────────────────────────────────
  {
    slug: "unseen-passage-comprehension",
    name: "Unseen Passage: Comprehension",
    ncertChapterNo: 1,
    domain: "Reading",
    topics: [
      { slug: "factual-retrieval", name: "Factual Retrieval from the Passage" },
      { slug: "inference-and-interpretation", name: "Inference and Interpretation" },
      { slug: "vocabulary-in-context", name: "Vocabulary in Context" },
      { slug: "tone-and-purpose", name: "Identifying Tone and Purpose" },
    ],
  },
  {
    slug: "unseen-passage-discursive",
    name: "Unseen Passage: Case-based and Discursive",
    ncertChapterNo: 2,
    domain: "Reading",
    topics: [
      { slug: "reading-charts-and-data", name: "Reading Charts, Tables and Data" },
      { slug: "summarising", name: "Summarising and Note-making" },
    ],
  },

  // ── Writing and Grammar ───────────────────────────────────────────────────
  {
    slug: "formal-writing",
    name: "Formal Writing",
    ncertChapterNo: 1,
    domain: "Writing and Grammar",
    topics: [
      { slug: "formal-letter-order", name: "Formal Letter: Placing an Order" },
      { slug: "formal-letter-complaint", name: "Formal Letter: Letter of Complaint" },
      { slug: "letter-to-editor", name: "Letter to the Editor" },
      { slug: "analytical-paragraph", name: "Analytical Paragraph" },
    ],
  },
  {
    slug: "grammar",
    name: "Grammar",
    ncertChapterNo: 2,
    domain: "Writing and Grammar",
    topics: [
      { slug: "tenses", name: "Tenses" },
      { slug: "modals", name: "Modals" },
      { slug: "subject-verb-concord", name: "Subject-Verb Concord" },
      { slug: "reported-speech", name: "Reported Speech" },
      { slug: "determiners", name: "Determiners" },
    ],
  },

  // ── Literature: First Flight ──────────────────────────────────────────────
  {
    slug: "a-letter-to-god",
    name: "A Letter to God",
    ncertChapterNo: 1,
    domain: "Literature — First Flight",
    topics: [
      { slug: "lencho-faith", name: "Lencho's Faith and Irony" },
      { slug: "letter-to-god-theme", name: "Theme: Faith and Human Kindness" },
    ],
  },
  {
    slug: "nelson-mandela-long-walk-to-freedom",
    name: "Nelson Mandela: Long Walk to Freedom",
    ncertChapterNo: 2,
    domain: "Literature — First Flight",
    topics: [
      { slug: "mandela-inauguration", name: "The Inauguration and its Significance" },
      { slug: "mandela-freedom-meaning", name: "Mandela's Changing Idea of Freedom" },
    ],
  },
  {
    slug: "two-stories-about-flying",
    name: "Two Stories about Flying",
    ncertChapterNo: 3,
    domain: "Literature — First Flight",
    topics: [
      { slug: "his-first-flight", name: "His First Flight: Overcoming Fear" },
      { slug: "black-aeroplane", name: "The Black Aeroplane: The Mysterious Pilot" },
    ],
  },
  {
    slug: "from-the-diary-of-anne-frank",
    name: "From the Diary of Anne Frank",
    ncertChapterNo: 4,
    domain: "Literature — First Flight",
    topics: [
      { slug: "anne-frank-kitty", name: "Why Anne Wrote to Kitty" },
      { slug: "anne-frank-mr-keesing", name: "Anne and Mr Keesing" },
    ],
  },
  {
    slug: "glimpses-of-india",
    name: "Glimpses of India",
    ncertChapterNo: 5,
    domain: "Literature — First Flight",
    topics: [
      { slug: "baker-from-goa", name: "A Baker from Goa" },
      { slug: "coorg", name: "Coorg" },
      { slug: "tea-from-assam", name: "Tea from Assam" },
    ],
  },
  {
    slug: "the-sermon-at-benares",
    name: "The Sermon at Benares",
    ncertChapterNo: 6,
    domain: "Literature — First Flight",
    topics: [
      { slug: "kisa-gotami", name: "Kisa Gotami and the Mustard Seed" },
      { slug: "buddha-teaching-grief", name: "The Buddha's Teaching on Grief" },
    ],
  },
  {
    slug: "poems-first-flight",
    name: "Poems: First Flight",
    ncertChapterNo: 7,
    domain: "Literature — First Flight",
    topics: [
      { slug: "dust-of-snow", name: "Dust of Snow" },
      { slug: "fire-and-ice", name: "Fire and Ice" },
      { slug: "a-tiger-in-the-zoo", name: "A Tiger in the Zoo" },
      { slug: "the-ball-poem", name: "The Ball Poem" },
      { slug: "amanda", name: "Amanda!" },
    ],
  },

  // ── Literature: Footprints without Feet ───────────────────────────────────
  {
    slug: "a-triumph-of-surgery",
    name: "A Triumph of Surgery",
    ncertChapterNo: 1,
    domain: "Literature — Footprints without Feet",
    topics: [
      { slug: "tricki-overfeeding", name: "Tricki's Illness and Mrs Pumphrey" },
      { slug: "herriot-method", name: "Dr Herriot's Method of Treatment" },
    ],
  },
  {
    slug: "the-thiefs-story",
    name: "The Thief's Story",
    ncertChapterNo: 2,
    domain: "Literature — Footprints without Feet",
    topics: [
      { slug: "hari-singh-anil", name: "Hari Singh and Anil" },
      { slug: "thiefs-story-change", name: "Theme: Trust and the Possibility of Change" },
    ],
  },
  {
    slug: "footprints-without-feet",
    name: "Footprints without Feet",
    ncertChapterNo: 3,
    domain: "Literature — Footprints without Feet",
    topics: [
      { slug: "griffin-invisible", name: "Griffin: The Invisible Scientist" },
      { slug: "science-without-conscience", name: "Theme: Science Without Conscience" },
    ],
  },
  {
    slug: "the-making-of-a-scientist",
    name: "The Making of a Scientist",
    ncertChapterNo: 4,
    domain: "Literature — Footprints without Feet",
    topics: [
      { slug: "richard-ebright-curiosity", name: "Richard Ebright's Curiosity" },
      { slug: "ingredients-of-a-scientist", name: "The Ingredients that Make a Scientist" },
    ],
  },
  {
    slug: "bholi",
    name: "Bholi",
    ncertChapterNo: 5,
    domain: "Literature — Footprints without Feet",
    topics: [
      { slug: "bholi-transformation", name: "Bholi's Transformation" },
      { slug: "bholi-education-theme", name: "Theme: Education and Self-Worth" },
    ],
  },
];
