import type { SeedQuestion } from "../types.js";

/**
 * CBSE Class 10 English — Language and Literature.
 *
 * ## The one thing this subject does that the others do not
 *
 * Every other subject in this bank has questions whose answers are facts.
 * English has questions whose answers are *judgements* — "why did the poet
 * choose this image", "was Bholi's father right" — and a marking scheme for
 * those cannot list the correct words. It lists what a good answer must
 * establish, which is what the self-evaluation flow was built for (docs/07 R3).
 *
 * So the schemes here are phrased as criteria rather than as content: "names
 * the device and quotes the line that carries it", not "says metaphor". A
 * student scoring themselves against the first can be honest; against the
 * second they can only match words.
 *
 * ## Grammar and reading are where the objective marks live
 *
 * Which is convenient, because those are also the parts a student can practise
 * in five minutes on a phone. The literature questions are longer and are the
 * ones worth sitting down for, and the expected times say so.
 */

const ORIGINAL = { sourceType: "ORIGINAL", licenceStatus: "CLEARED" } as const;

export const class10EnglishQuestions: SeedQuestion[] = [
  // ── Grammar ───────────────────────────────────────────────────────────────
  {
    key: "eng-gram-001",
    chapter: "grammar",
    topics: ["subject-verb-concord"],
    type: "MCQ",
    body: "Choose the correct option to complete the sentence:\n\n*Neither the teacher nor the students ____ aware of the change in timetable.*",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 60,
    options: [
      { label: "A", body: "was" },
      { label: "B", body: "were", isCorrect: true },
      { label: "C", body: "is" },
      { label: "D", body: "has been" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "With *neither … nor*, the verb agrees with the subject nearer to it. The nearer subject here is *the students*, which is plural, so the verb is *were*.",
      explanation:
        "Reverse the sentence to *Neither the students nor the teacher ___* and the correct verb becomes *was*. The rule depends on order, which is what makes it worth learning rather than guessing.",
      hint: "With *neither … nor*, look at the subject closest to the blank rather than the first one in the sentence.",
    },
    source: ORIGINAL,
  },
  {
    key: "eng-gram-002",
    chapter: "grammar",
    topics: ["reported-speech"],
    type: "MCQ",
    body: 'Report the following:\n\n*The coach said to us, "Practise every morning."*',
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 75,
    options: [
      { label: "A", body: "The coach said that we practise every morning." },
      { label: "B", body: "The coach advised us to practise every morning.", isCorrect: true },
      { label: "C", body: "The coach told us that practise every morning." },
      { label: "D", body: "The coach said us to practise every morning." },
    ],
    answer: {
      correctValue: "B",
      solution:
        "An imperative in direct speech becomes an infinitive in reported speech, introduced by a reporting verb such as *advised*, *told*, *ordered* or *requested* — depending on the tone. So: *The coach advised us to practise every morning.*",
      explanation:
        "Option D fails because *said* cannot take an object directly — it is *said to us* or *told us*, never *said us*.",
      hint: "The original is a command, not a statement. Commands are reported with an infinitive and a reporting verb that carries the tone — not with *that*.",
    },
    source: ORIGINAL,
  },
  {
    key: "eng-gram-003",
    chapter: "grammar",
    topics: ["modals"],
    type: "FILL_BLANK",
    body: "Fill in the blank with the most suitable modal:\n\n*You ____ wear a helmet while riding a two-wheeler; it is the law.*",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 60,
    answer: {
      correctValue: "must",
      acceptedValues: ["must", "have to"],
      solution:
        "*Must* expresses obligation, and the clause *it is the law* makes this a legal obligation rather than advice. *Have to* is also acceptable.",
      explanation:
        "*Should* would be wrong here: it advises rather than obliges, and the second clause has already told you this is compulsory.",
      hint: "The second half of the sentence tells you how strong the obligation is. Choose a modal that matches that strength rather than one that merely suggests.",
    },
    source: ORIGINAL,
  },
  {
    key: "eng-gram-004",
    chapter: "grammar",
    topics: ["tenses"],
    type: "FILL_BLANK",
    body: "Fill in the blank with the correct form of the verb:\n\n*By the time we reached the station, the train ____ (leave).*",
    marks: 1,
    difficulty: "HARD",
    bloomLevel: "APPLY",
    expectedTimeSeconds: 75,
    answer: {
      correctValue: "had left",
      acceptedValues: ["had left", "had already left"],
      solution:
        "Two past actions, one completed before the other. The earlier action takes the past perfect, so the train *had left* before we *reached*.",
      hint: "There are two past events here and they did not happen at the same time. Which came first, and which tense marks the earlier of two past actions?",
    },
    source: ORIGINAL,
  },

  // ── Reading ───────────────────────────────────────────────────────────────
  {
    key: "eng-read-001",
    chapter: "unseen-passage-comprehension",
    topics: ["vocabulary-in-context"],
    type: "MCQ",
    body: "Read the sentence and choose the meaning closest to the word in bold:\n\n*Despite the setback, her **tenacity** saw her through the final round.*",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 60,
    options: [
      { label: "A", body: "cheerfulness" },
      { label: "B", body: "persistence", isCorrect: true },
      { label: "C", body: "cleverness" },
      { label: "D", body: "impatience" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "*Tenacity* means persistence — holding on determinedly despite difficulty. The phrase *despite the setback* signals that the quality is about not giving up.",
      hint: "You do not need to know the word. Read what comes before it — the sentence tells you what kind of quality would be needed there.",
    },
    source: ORIGINAL,
  },
  {
    key: "eng-read-002",
    chapter: "unseen-passage-comprehension",
    topics: ["inference-and-interpretation"],
    type: "VERY_SHORT_ANSWER",
    body: "Read the extract and answer the question that follows:\n\n*Ravi checked the clock for the fourth time in ten minutes. His bag had been packed since dawn. He had read the same paragraph of his book three times without taking in a word.*\n\nWhat can you infer about Ravi's state of mind? Answer in one sentence.",
    marks: 2,
    difficulty: "MEDIUM",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 120,
    answer: {
      solution:
        "Ravi is anxious and impatient — he is waiting for something and cannot settle, which is shown by his repeated clock-checking, his early packing and his inability to concentrate on his book.",
      markingScheme: [
        { step: "Identifies anxiety, impatience or restless anticipation", marks: 1 },
        { step: "Supports it with at least one detail from the extract", marks: 1 },
      ],
      hint: "The passage never names an emotion. Look at what he *does* three times over, and ask what state of mind produces that behaviour.",
    },
    source: ORIGINAL,
  },

  // ── Writing ───────────────────────────────────────────────────────────────
  {
    key: "eng-write-001",
    chapter: "formal-writing",
    topics: ["letter-to-editor"],
    type: "LONG_ANSWER",
    body: "You are Anand/Ananya of 12, Nehru Road, Pune. Write a letter to the editor of a national daily drawing attention to the poor condition of pavements in your locality and the risk this poses to pedestrians. (100-120 words)",
    marks: 5,
    difficulty: "MEDIUM",
    bloomLevel: "CREATE",
    expectedTimeSeconds: 600,
    answer: {
      solution:
        "A full-mark answer contains:\n\n**Format.** Sender's address, date, receiver's address (The Editor, name of the daily, city), subject line, salutation (*Sir/Madam*), body, and a complimentary close with the sender's name.\n\n**Content.** An opening stating the purpose through the newspaper's columns; a middle paragraph describing the specific problem — broken slabs, encroachment, no lighting — and the risk to schoolchildren and elderly pedestrians; a closing appealing to the authorities concerned to act.\n\n**Expression.** Formal register throughout, no contractions, within the word limit.",
      markingScheme: [
        { step: "Correct letter format, all elements present", marks: 1 },
        { step: "Clear statement of the problem with specific detail", marks: 1 },
        { step: "Consequence or risk explained", marks: 1 },
        { step: "Appropriate appeal or suggested action", marks: 1 },
        { step: "Formal register, grammatical accuracy and word limit", marks: 1 },
      ],
      hint: "Marks here are split between format and content, so get the layout right before you worry about the wording. Decide on two or three concrete details about the pavements rather than writing generally.",
    },
    source: ORIGINAL,
  },
  {
    key: "eng-write-002",
    chapter: "formal-writing",
    topics: ["analytical-paragraph"],
    type: "LONG_ANSWER",
    body: "The table below shows how students in a class of 40 travel to school.\n\n| Mode of travel | Number of students |\n| --- | --- |\n| School bus | 18 |\n| Bicycle | 10 |\n| On foot | 8 |\n| Private car | 4 |\n\nWrite an analytical paragraph in 100-120 words.",
    marks: 5,
    difficulty: "MEDIUM",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 540,
    answer: {
      solution:
        "A full-mark answer:\n\n**Opens** by stating what the data shows and over what population — 40 students, four modes of travel.\n\n**Interprets** rather than lists: the school bus is the most used mode at 18 students, nearly half the class; bicycles and walking together account for 18 more, so almost half the class travels by non-motorised means; the private car is the least used, at only 4.\n\n**Concludes** with an observation the data supports — for instance that most students rely on shared or non-motorised transport, which suggests the school is close to where they live.\n\nNo opinion may be offered that the table does not support.",
      markingScheme: [
        { step: "Opening that identifies the data and its scope", marks: 1 },
        { step: "Accurate figures quoted from the table", marks: 1 },
        { step: "Comparison or grouping rather than a bare list", marks: 1 },
        { step: "A conclusion the data actually supports", marks: 1 },
        { step: "Coherence, formal register and word limit", marks: 1 },
      ],
      hint: "An analytical paragraph compares and concludes; it does not read the table aloud. Look for a grouping — which modes belong together? — before you start writing.",
    },
    source: ORIGINAL,
  },

  // ── Literature: First Flight ──────────────────────────────────────────────
  {
    key: "eng-lit-001",
    chapter: "poems-first-flight",
    topics: ["fire-and-ice"],
    type: "MCQ",
    body: "In Robert Frost's *Fire and Ice*, 'fire' and 'ice' stand for:",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 60,
    options: [
      { label: "A", body: "summer and winter" },
      { label: "B", body: "desire and hatred", isCorrect: true },
      { label: "C", body: "life and death" },
      { label: "D", body: "war and peace" },
    ],
    answer: {
      correctValue: "B",
      solution:
        "Frost uses fire as a symbol of desire — greed, lust, avarice — and ice as a symbol of hatred, indifference and coldness towards others. The poem argues that either would suffice to destroy the world.",
      hint: "The poem is not about weather. Ask what human emotion burns, and what human emotion is cold.",
    },
    source: ORIGINAL,
  },
  {
    key: "eng-lit-002",
    chapter: "poems-first-flight",
    topics: ["dust-of-snow"],
    type: "SHORT_ANSWER",
    body: "In *Dust of Snow*, how does a small natural incident change the poet's mood? What does this suggest about nature?",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 240,
    answer: {
      solution:
        "A crow shakes down a light dusting of snow from a hemlock tree onto the poet, who had been in a low and regretful mood. The small, cold, unexpected touch changes his frame of mind and saves part of a day he had otherwise given up on.\n\nThe suggestion is that nature has a healing power available in the most ordinary moments — and that it does not require a grand or beautiful setting. Frost deliberately chooses a crow and a hemlock, both traditionally associated with gloom and poison, to make the point that even the unlovely parts of nature can restore us.",
      markingScheme: [
        { step: "Describes the incident accurately", marks: 1 },
        { step: "States the change in the poet's mood", marks: 1 },
        { step: "Draws the inference about nature, ideally noting the crow and hemlock", marks: 1 },
      ],
      hint: "Notice which bird and which tree Frost chose. Neither is a conventionally pleasant image — ask why a poet writing about being cheered up would pick them.",
    },
    source: ORIGINAL,
  },
  {
    key: "eng-lit-003",
    chapter: "nelson-mandela-long-walk-to-freedom",
    topics: ["mandela-freedom-meaning"],
    type: "LONG_ANSWER",
    body: "How did Nelson Mandela's understanding of freedom change as he grew older? What does this tell us about his character?",
    marks: 6,
    difficulty: "HARD",
    bloomLevel: "EVALUATE",
    expectedTimeSeconds: 600,
    answer: {
      solution:
        "**As a boy**, Mandela thought he was free — free to run in the fields, to swim in the stream, to ride the broad backs of slow-moving bulls. He believed freedom was something he already had.\n\n**As a young man**, he wanted the transitory freedoms of an adult: to earn a living, to marry, to have a family, to obey the law without fear of imprisonment. He still understood it as personal.\n\n**As a student and young lawyer**, he realised these were illusions. He came to see that it was not just *his* freedom that was curtailed but the freedom of everyone who looked like him — and the hunger for his own freedom became the hunger for the freedom of his people.\n\n**Finally**, he concluded that the oppressor is as much a prisoner as the oppressed, since a man who takes away another's freedom is himself imprisoned by hatred and prejudice. He therefore said he was not truly free until both were liberated.\n\n**On his character.** The progression shows a man capable of enlarging his own idea of himself — moving from self-interest to a collective cause, and then beyond bitterness to a position that included his oppressors. That refusal of revenge is why the transition was peaceful.",
      markingScheme: [
        { step: "Childhood: the illusion of freedom", marks: 1 },
        { step: "Youth: transitory, personal freedoms", marks: 1 },
        { step: "The realisation that the freedom of his people was at stake", marks: 1 },
        { step: "The insight that the oppressor is also unfree", marks: 1.5 },
        { step: "A reasoned comment on his character", marks: 1.5 },
      ],
      hint: "This is a question about a change over time, so structure it as stages. Get to the last stage — what he says about the oppressor — because that is where most of the marks and all of the insight are.",
    },
    source: ORIGINAL,
  },
  {
    key: "eng-lit-004",
    chapter: "from-the-diary-of-anne-frank",
    topics: ["anne-frank-kitty"],
    type: "SHORT_ANSWER",
    body: "Why did Anne Frank address her diary as 'Kitty'? What does this tell us about her situation?",
    marks: 3,
    difficulty: "MEDIUM",
    bloomLevel: "ANALYSE",
    expectedTimeSeconds: 210,
    answer: {
      solution:
        "Anne felt she had no true friend — someone she could confide in completely. She had a loving family and about thirty people she could call friends, but nobody with whom she could share anything beyond everyday matters.\n\nSo she personified the diary as 'Kitty' and wrote to it as she would to a close friend. This tells us she was profoundly lonely despite being surrounded by people, and that she needed an intimacy she could not find in anyone around her — a need that became more acute once the family went into hiding.",
      markingScheme: [
        { step: "Explains the absence of a true confidante", marks: 1 },
        { step: "Notes that the diary was personified as a friend", marks: 1 },
        { step: "Draws the inference about her loneliness and need", marks: 1 },
      ],
      hint: "She had plenty of people around her. The question is what she did not have — and naming the diary is her solution to that particular absence.",
    },
    source: ORIGINAL,
  },

  // ── Literature: Footprints without Feet ───────────────────────────────────
  {
    key: "eng-lit-005",
    chapter: "bholi",
    topics: ["bholi-transformation"],
    type: "LONG_ANSWER",
    body: "Trace Bholi's transformation from a neglected child to a young woman who refuses an unjust marriage. What role did education play?",
    marks: 6,
    difficulty: "HARD",
    bloomLevel: "EVALUATE",
    expectedTimeSeconds: 600,
    answer: {
      solution:
        "**At the start**, Sulekha is called Bholi — the simpleton. A fall in infancy damaged her brain and smallpox left her face pockmarked. She stammered, was mocked by other children, and her own parents considered her a burden with no prospect of marriage.\n\n**School** was suggested only because the Tehsildar asked her father to set an example, and her mother agreed only because nothing better could be done with her. Bholi was terrified on her first day.\n\n**Her teacher** changed everything by treating her with patience and kindness — telling her that in a few months she would speak as well as anyone, and that she would be able to read and would not need to depend on anyone.\n\n**At the end**, when Bishamber demands five thousand rupees for marrying a lame and pockmarked girl, Bholi refuses the match in a clear, unstammering voice. She chooses to stay and teach at the school instead.\n\n**The role of education.** Education gave her not information but a voice and a sense of her own worth. The stammer disappearing at the decisive moment is the story's way of showing that what had held her back was never her intelligence but the absence of anyone who believed in her.",
      markingScheme: [
        { step: "Her condition and treatment at the start", marks: 1 },
        { step: "How and why she was sent to school", marks: 1 },
        { step: "The teacher's role in her change", marks: 1.5 },
        { step: "The refusal of the marriage, described accurately", marks: 1 },
        { step: "A reasoned statement of what education gave her", marks: 1.5 },
      ],
      hint: "Track what changes and what does not. Her stammer is the thing to watch — notice when it appears and when it does not, and what that tells you about its cause.",
    },
    source: ORIGINAL,
  },
  {
    key: "eng-lit-006",
    chapter: "the-thiefs-story",
    topics: ["thiefs-story-change"],
    type: "SHORT_ANSWER",
    body: "Why did Hari Singh return the stolen money? Was his decision motivated by fear or by something else?",
    marks: 3,
    difficulty: "HARD",
    bloomLevel: "EVALUATE",
    expectedTimeSeconds: 240,
    answer: {
      solution:
        "Hari Singh returned the money not out of fear of being caught — he had reached the station and could easily have boarded the train — but because he realised what he would lose. Anil was teaching him to read and write, and Hari Singh understood that this was worth more than the money: literacy would let him earn honestly, and stealing it would end the lessons.\n\nThere is also genuine feeling in it. Anil had trusted him without question, and the thought of that trust being broken troubled him more than any risk of arrest.",
      markingScheme: [
        { step: "States that fear of capture was not the motive", marks: 1 },
        { step: "Identifies the value he placed on learning to read and write", marks: 1 },
        { step: "Notes the effect of Anil's trust and kindness", marks: 1 },
      ],
      hint: "He had already got away with it — the train was there and he did not take it. So the reason cannot be fear. What did he stand to lose by leaving?",
    },
    source: ORIGINAL,
  },
  {
    key: "eng-lit-007",
    chapter: "footprints-without-feet",
    topics: ["science-without-conscience"],
    type: "ASSERTION_REASON",
    body: "**Assertion (A):** Griffin's invisibility brought him misery rather than freedom.\n\n**Reason (R):** He used his discovery for theft and revenge rather than for any constructive purpose.",
    marks: 1,
    difficulty: "HARD",
    bloomLevel: "EVALUATE",
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
        "Both are true, and the reason explains the assertion. Griffin was a brilliant scientist, but he used invisibility to rob, to set fire to a house and to terrorise people — and it was those choices that made him a hunted fugitive, cold and homeless in the snow. The misery follows directly from the misuse.",
      hint: "Ask whether the misery came from being invisible, or from what he chose to do while invisible. If the second, the reason explains the assertion.",
    },
    source: ORIGINAL,
  },
];
