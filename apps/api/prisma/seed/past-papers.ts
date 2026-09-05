import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { seedId } from "./helpers.js";

/**
 * The previous-year backlog: every CBSE Class 10 sitting from 2001 to 2026, as
 * rows that say "this exam happened and we hold none of it".
 *
 * ## What this seed asserts, and what it deliberately does not
 *
 * It asserts one thing per row: that a sitting took place (or, for 2021, that it
 * did not). Everything that identifies a *paper* — the code, the set, the
 * region, the printed question count, the total marks — is left null, because
 * this file has no papers in front of it and a plausible-looking `30/1/1` typed
 * from memory is fabricated provenance in the exact fields that exist to prevent
 * it (docs/07 R2). Those fields get filled by the ingest pipeline, from real
 * files, one paper at a time.
 *
 * So a freshly seeded database shows a 26-year grid at zero coverage. That is
 * the honest starting state of a content project this size, and it is more
 * useful than an empty screen: it names the work.
 *
 * ## Why one row per sitting rather than one per paper
 *
 * CBSE has issued several papers for the same sitting for most of this range —
 * regional variants in the older years, numbered codes and sets in the newer
 * ones. Registering all of them would mean inventing how many there were.
 * Instead each sitting gets a single placeholder with a null code, and the
 * ingest service *claims* that placeholder for the first real paper it loads for
 * the sitting (see `past-paper.ingest.service.ts`). Subsequent papers for the
 * same sitting register themselves alongside it. The backlog therefore starts at
 * one row a year and grows into the real shape of the year as papers arrive,
 * rather than starting at a guessed shape that has to be corrected.
 *
 * ## The two holes in the range
 *
 * They are recorded rather than skipped, because a year missing from the grid
 * gets re-investigated by a different person every quarter and the answer is
 * never in the database. 2021 is `wasHeld: false`; 2020 and 2022 are held but
 * carry notes explaining what was unusual about them.
 */

interface SeedPastPaper {
  year: number;
  examSession: string;
  wasHeld?: boolean;
  notes?: string;
}

/**
 * The sitting label.
 *
 * "Annual" rather than "March" for the long middle of the range. CBSE's Class 10
 * exams drifted from a March window into a February start over these years and
 * this file cannot say for each year which it was — a label naming a month it
 * does not know is the same kind of invention as a made-up paper code. The
 * three years where the board itself named the sittings are named.
 */
const ANNUAL = "Annual";

const SITTINGS: SeedPastPaper[] = [
  ...Array.from({ length: 19 }, (_unused, offset) => ({
    year: 2001 + offset,
    examSession: ANNUAL,
  })),

  {
    year: 2020,
    examSession: ANNUAL,
    notes:
      "The 2020 sitting was suspended part-way through in March under the COVID-19 lockdown and " +
      "the remaining papers were cancelled. Whether this subject's paper was sat before the " +
      "suspension needs checking against the date sheet before this row is treated as sourceable.",
  },

  {
    year: 2021,
    examSession: ANNUAL,
    wasHeld: false,
    notes:
      "CBSE cancelled the Class 10 board examinations for 2021 during the second wave of " +
      "COVID-19; results were computed from an internal assessment policy instead. There is no " +
      "paper to source, and this row exists so that the gap in the coverage grid explains itself.",
  },

  {
    year: 2022,
    examSession: "Term 1",
    notes:
      "2022 ran as two terms. Term 1 was sat in late 2021 and was multiple-choice only, answered " +
      "on OMR sheets — so its questions are all MCQ and its marks do not compare with a normal " +
      "year's paper.",
  },
  {
    year: 2022,
    examSession: "Term 2",
    notes: "The second of the two 2022 terms. See the Term 1 note.",
  },

  { year: 2023, examSession: ANNUAL },
  { year: 2024, examSession: ANNUAL },
  { year: 2025, examSession: ANNUAL },

  {
    year: 2026,
    examSession: "February",
    notes:
      "From 2026 CBSE runs two Class 10 sittings a year. This is the first, and the one every " +
      "candidate sits.",
  },
  {
    year: 2026,
    examSession: "May",
    notes:
      "The second 2026 sitting, offered for improvement rather than as a separate syllabus. " +
      "Registered so that papers from it are not filed against the February sitting.",
  },
];

/**
 * Register the backlog for one subject.
 *
 * Idempotent like the rest of the seed, and idempotent in a specific way: the
 * `update` half writes only the fields this file is the authority on. It does
 * **not** reset `paperCode`, `printedQuestionCount`, `sourceUrl` or the licence
 * status, because by the second time this runs an editor may have claimed the
 * placeholder with a real paper — and a seed that wiped that would make re-
 * seeding a development database destructive rather than idempotent.
 */
export async function seedPastPapers(
  prisma: PrismaClient,
  subject: { id: string; code: string },
): Promise<number> {
  for (const sitting of SITTINGS) {
    const id = seedId("past-paper", subject.code, String(sitting.year), slug(sitting.examSession));

    const data = {
      subjectId: subject.id,
      year: sitting.year,
      examSession: sitting.examSession,
      wasHeld: sitting.wasHeld ?? true,
      notes: sitting.notes ?? null,
    };

    await prisma.pastPaper.upsert({
      where: { id },
      create: { id, ...data },
      update: { wasHeld: data.wasHeld, notes: data.notes },
    });
  }

  return SITTINGS.length;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
