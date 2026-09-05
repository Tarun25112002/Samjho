# Previous-year papers

This directory holds the CBSE papers we have actually sourced, one file per
paper, ready to be loaded into the question bank.

It starts empty. That is the point.

## What this is for

The goal is every CBSE Class 10 paper from 2001 to 2026. That is a content
project of several thousand questions, and the only way to do it honestly is one
real paper at a time.

The database already knows the shape of the work: `pnpm --filter @samjho/api
db:seed` registers every sitting in the range as a `PastPaper` row with no
questions behind it, so `/api/v1/admin/past-papers/coverage?subjectId=…` will
show a 26-year grid at zero. Each file added here fills in part of that grid.

Nothing in this pipeline invents a question, a paper code, or a year. A question
that reaches the bank through it came off a paper somebody had in front of them.

## The file format

One JSON file per paper. The header describes the paper once; the rows are the
questions, with no provenance of their own — the ingester stamps the header's
year, session, code, set and licence onto every question it writes, and **rejects
a row that carries its own `source`**. That is deliberate: thirty-eight rows each
free to claim a different origin is thirty-eight chances to record a wrong one.

```jsonc
{
  "subject": "class-10-mathematics-standard", // slug, not id
  "paper": {
    "year": 2024,
    "examSession": "Annual",
    "paperCode": "30/1/1",
    "setCode": "1",
    "region": null,
    "printedQuestionCount": 38, // questions on the printed paper
    "totalMarks": 80,
    "sourceUrl": "https://…", // where the paper came from
  },
  "reproduction": "CBSE_BOARD_PAPER", // or CBSE_SAMPLE_PAPER, or ADAPTED
  "licenceStatus": "NEEDS_REVIEW",
  "rows": [
    {
      "questionNumber": "1", // as printed on the paper
      "chapter": "real-numbers", // slug in the *current* syllabus
      "topics": ["euclids-division-lemma"],
      "type": "MCQ",
      "body": "…",
      "marks": 1,
      "difficulty": "EASY",
      "bloomLevel": "REMEMBER",
      "options": [{ "label": "A", "body": "…", "isCorrect": true }],
      "answer": { "correctValue": "A", "solution": "…" },
    },
  ],
}
```

See `TEMPLATE.json` in this directory for a fuller skeleton. Everything below
`questionNumber`, `chapter` and `topics` in a row is an ordinary question and is
validated by the same schema a question typed into the admin form faces — so
anything the admin form accepts, a row here accepts.

Three fields are worth dwelling on:

- **`chapter`** is a slug in the syllabus we teach _now_, not the one the paper
  was set on. A 2007 question on quadratic equations belongs under today's
  `quadratic-equations` chapter, because that is where a student studying today
  will meet it. Where a question's topic has left the syllabus entirely, leave it
  out of the file rather than filing it somewhere approximate.
- **`questionNumber`** is required, and is the number as printed. It is shown to
  the student, it is how an editor finds the question in the PDF again, and it is
  how a corrected re-run of a file lines up against what was written the first
  time.
- **`reproduction`** decides the `sourceType` on every question in the file. Use
  `ADAPTED` when the wording has been rewritten and `CBSE_BOARD_PAPER` when it
  has not; the distinction is the licensing position (docs/07 R2), not a
  formality.

## Loading a paper

```bash
# Dry run. Validates every row, resolves every slug, writes nothing.
pnpm --filter @samjho/api ingest:paper content/past-papers/2024-maths-30-1-1.json

# Write it, as drafts.
pnpm --filter @samjho/api ingest:paper content/past-papers/2024-maths-30-1-1.json --write
```

The dry run is not a formality either — it is where a mistyped chapter slug, a
duplicated question number, or a question already in the bank surfaces, and it
reports all of them at once rather than one per attempt. An ingest is
all-or-nothing: if any row is rejected, nothing is written.

Questions land as `DRAFT` and their licence status as `NEEDS_REVIEW`, which
together mean no student can see them yet. Clearing that is a human decision made
in the admin UI, on purpose: an unreviewed licence slipping through in bulk is
exactly the risk the review gate exists for.

## Naming files

`<year>-<subject>-<paper code>.json`, with the code slugified:

```
2024-maths-30-1-1.json
2019-science-31-2-outside-delhi.json
2022-maths-term-1.json
```

The name is for humans; the ingester identifies a paper by the header inside the
file, never by the filename.

## Where a paper goes in the registry

The ingester matches the file's `year`, `examSession`, `paperCode` and `setCode`
against the registry:

- **An exact match** is reused. This is what happens on every re-run.
- **An unclaimed placeholder for the sitting** — a seeded row naming the year
  with no paper code — is claimed and filled in, but only while no questions have
  been filed against it.
- **Otherwise** a new registry row is created. A paper nobody registered still
  loads; the backlog is there to plan the work, not to gate it.

## The two holes in the range

The seed registers them rather than skipping them, so nobody re-investigates
every quarter:

- **2021** — the Class 10 board exams were cancelled during the second wave of
  COVID-19 and results came from an internal assessment policy. There is no
  paper. The registry row is marked `wasHeld: false`.
- **2020** — the sitting was suspended part-way through and the remaining papers
  were cancelled. Check the date sheet before treating a 2020 paper as sourceable.

2022 is not a hole but is unusual: it ran as two terms, and Term 1 was
multiple-choice only, on OMR sheets. Its marks do not compare with a normal
year's paper.
