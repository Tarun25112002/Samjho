import { ALL_BLUEPRINTS } from "@medhavi/exam-blueprints";

import { paperService } from "../../src/modules/exams/paper.service.js";
import type { PrismaClient } from "../../src/generated/prisma/client.js";

/**
 * One published paper per blueprint, so the exam engine has something to run.
 *
 * ## Why this uses the real generator rather than writing rows
 *
 * A hand-written paper in the seed would be a paper that never passed the
 * blueprint validator, never consumed real questions, and never proved the
 * generator works. Every demo would then be running on a fixture that the
 * production path could not have produced — which is the specific way a seeded
 * feature looks finished and is not.
 *
 * So this calls `paperService.generate` exactly as the admin UI does, and
 * publishes the result. If the bank cannot fill the blueprint, the paper is not
 * written and the seed says which groups fell short, because that shortfall is
 * a work order for whoever writes questions next (docs/07 R1) and hiding it
 * would waste their time.
 *
 * ## Idempotence
 *
 * The generator creates a new paper every time it is called, so a seed that
 * called it unconditionally would add one more on every run — and the seed's
 * whole contract is that running it twice produces the same database as running
 * it once. Hence the check for an existing published paper first.
 */

export interface SeededPapers {
  published: number;
  shortfalls: string[];
}

export async function seedExamPapers(prisma: PrismaClient): Promise<SeededPapers> {
  const result: SeededPapers = { published: 0, shortfalls: [] };

  for (const blueprint of ALL_BLUEPRINTS) {
    const row = await prisma.examBlueprint.findFirst({
      where: { key: blueprint.id },
      select: { id: true, subjectId: true },
    });

    // Class 12 Physics is a validator fixture with no Subject row. It is
    // skipped for the same reason `seedBlueprints` skips it, and that is
    // deliberate rather than a gap.
    if (!row) continue;

    const existing = await prisma.examPaper.findFirst({
      where: { blueprintId: row.id, status: "PUBLISHED" },
      select: { id: true },
    });

    if (existing) {
      result.published += 1;
      continue;
    }

    const generated = await paperService.generate({
      blueprintKey: blueprint.id,
      dryRun: false,
      chapterIds: [],
      title: `${blueprint.name} — practice paper 1`,
    });

    if (!generated.plan.complete || generated.paper === null) {
      for (const shortfall of generated.plan.shortfalls) {
        result.shortfalls.push(
          `${blueprint.subject.code} ${shortfall.sectionName}: needs ${String(shortfall.needed)} ` +
            `${String(shortfall.marks)}-mark [${shortfall.types.join("|")}]` +
            `${shortfall.needsSubParts ? " with sub-parts" : ""}, bank has ${String(shortfall.available)}`,
        );
      }
      continue;
    }

    // Generated papers land as DRAFT. A student may only sit a published one,
    // so the seed has to take the same second step an editor would.
    await prisma.examPaper.update({
      where: { id: generated.paper.id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });

    result.published += 1;
  }

  return result;
}
