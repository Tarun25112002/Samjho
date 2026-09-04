import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { ingestPastPaperInputSchema, questionStatusSchema } from "@samjho/contracts";
import { z } from "zod";

import { disconnectPrisma, prisma } from "../src/lib/prisma.js";
import { pastPaperIngestService } from "../src/modules/exams/past-paper.ingest.service.js";

/**
 * Load one previous-year paper from a file on disk.
 *
 *   pnpm --filter @samjho/api ingest:paper content/past-papers/2024-maths-30-1-1.json
 *   pnpm --filter @samjho/api ingest:paper <file> --write
 *
 * ## Why a script and not just the HTTP endpoint
 *
 * The endpoint exists and is the same code. This wrapper is for the person who
 * actually does this work: someone with a stack of PDFs and a text editor, who
 * should not have to mint an admin token and construct a curl body to find out
 * that they typed a chapter slug wrong. A file path and a dry run is the whole
 * interface.
 *
 * ## Dry run unless told otherwise
 *
 * Nothing is written without `--write`. The default run parses the file,
 * resolves the subject and every chapter and topic slug in it, reports which
 * registry row it matched and what it would write — and stops. That report is
 * the thing worth reading: it is where a mistyped slug or a duplicate question
 * number surfaces, all of them at once, before anything is in the bank.
 *
 * ## Slugs, not ids
 *
 * The file names its subject by slug, as the seed files do. An id in a
 * hand-written content file is unreadable, unverifiable and silently wrong when
 * copied between environments; a slug that does not exist fails here with the
 * slug in the message.
 */

const fileSchema = z
  .object({
    /** Subject slug, e.g. "class-10-mathematics-standard". */
    subject: z.string().min(1),
  })
  // The rest of the file is the ingest body minus the fields this script owns:
  // `subjectId` (resolved from the slug), `dryRun` and `status` (both CLI
  // decisions, because they are about *this run* rather than about the paper).
  .and(ingestPastPaperInputSchema.omit({ subjectId: true, dryRun: true, status: true }));

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      write: { type: "boolean", default: false },
      status: { type: "string" },
      author: { type: "string" },
    },
  });

  const path = positionals[0];
  if (!path) {
    throw new Error(
      "Usage: ingest:paper <file.json> [--write] [--status DRAFT|IN_REVIEW|PUBLISHED] [--author <userId>]",
    );
  }

  const raw: unknown = JSON.parse(await readFile(resolve(path), "utf8"));
  const parsedFile = fileSchema.safeParse(raw);
  if (!parsedFile.success) {
    throw new Error(
      `${path} is not a valid paper file:\n${parsedFile.error.issues
        .map((issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("\n")}`,
    );
  }

  const status = values.status ? questionStatusSchema.parse(values.status) : "DRAFT";

  const subject = await prisma.subject.findFirst({
    where: { slug: parsedFile.data.subject },
    select: { id: true, name: true },
  });
  if (!subject) {
    throw new Error(`No subject with slug "${parsedFile.data.subject}". Has the seed been run?`);
  }

  const authorId = await resolveAuthor(values.author);

  const { subject: _slug, ...body } = parsedFile.data;
  const input = ingestPastPaperInputSchema.parse({
    ...body,
    subjectId: subject.id,
    dryRun: !values.write,
    status,
  });

  const result = await pastPaperIngestService.ingest(input, authorId);

  report(`${result.paperLabel} — ${subject.name}`);
  report(
    `  registry           ${result.paperCreated ? "would be created" : "matched"}` +
      (result.pastPaperId ? ` (${result.pastPaperId})` : ""),
  );
  report(
    `  rows               ${String(result.total)} in file, ${String(result.valid)} valid, ` +
      `${String(result.errors.length)} rejected`,
  );
  report(
    `  already on paper   ${String(result.alreadyOnPaper)} of ` +
      `${result.printedQuestionCount === null ? "an uncounted paper" : String(result.printedQuestionCount)}`,
  );

  for (const error of result.errors) {
    report(`\n  row ${String(error.row)} (Q${error.ref ?? "?"})`);
    for (const issue of error.issues) report(`    ${issue.path}: ${issue.message}`);
  }

  if (result.errors.length > 0) {
    report("\nNothing was written — an ingest is all or nothing. Fix the file and run again.");
    process.exitCode = 1;
    return;
  }

  if (result.dryRun) {
    report(`\nDry run. Re-run with --write to import ${String(result.valid)} questions.`);
    return;
  }

  report(`\nWrote ${String(result.written)} questions as ${status}.`);
}

/**
 * Whose name the questions are written under.
 *
 * Falls back to the first admin rather than requiring `--author` every time: on
 * a development database there is exactly one, and making the common case need a
 * cuid pasted from Prisma Studio is how a tool stops being used. On anything
 * with more than one admin, pass `--author` and be explicit.
 */
async function resolveAuthor(authorId: string | undefined): Promise<string> {
  if (authorId) {
    const user = await prisma.user.findUnique({ where: { id: authorId }, select: { id: true } });
    if (!user) throw new Error(`No user with id "${authorId}".`);
    return user.id;
  }

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) throw new Error("No admin user to attribute the import to. Pass --author <userId>.");

  return admin.id;
}

function report(message: string): void {
  process.stdout.write(`${message}\n`);
}

try {
  await main();
} catch (error: unknown) {
  process.exitCode = 1;
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
} finally {
  await disconnectPrisma();
}
