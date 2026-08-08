import { ALL_BLUEPRINTS } from "@samjho/exam-blueprints";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../src/generated/prisma/client.js";
import { class10MathsChapters } from "./curriculum/maths.js";
import { class10ScienceChapters } from "./curriculum/science.js";
import { seedId, upsertQuestion, type CurriculumIndex } from "./helpers.js";
import { class10MathsQuestions } from "./questions/maths.js";
import { class10ScienceQuestions } from "./questions/science.js";
import type { SeedChapter, SeedQuestion } from "./types.js";
import { enrolStudents, seedPracticeHistory, seedUsers } from "./users.js";

/**
 * Development seed. Idempotent by construction — every write is an upsert
 * against a deterministic id, so running it twice produces the same database as
 * running it once.
 *
 * That property is not a nicety. A seed that duplicates on re-run is a seed
 * nobody dares run against a database they care about, which means it stops
 * being used and starts rotting.
 */

try {
  process.loadEnvFile();
} catch {
  // No .env file — rely on the ambient environment, as in CI.
}

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set. Copy apps/api/.env.example to apps/api/.env.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

interface SubjectSpec {
  code: string;
  name: string;
  slug: string;
  variant?: string;
  theoryMarks: number;
  internalMarks: number;
  hasPractical: boolean;
  orderIndex: number;
  chapters: SeedChapter[];
  questions: SeedQuestion[];
}

const CLASS_10_SUBJECTS: SubjectSpec[] = [
  {
    code: "MATH",
    name: "Mathematics (Standard)",
    slug: "class-10-mathematics-standard",
    variant: "STANDARD",
    theoryMarks: 80,
    internalMarks: 20,
    hasPractical: false,
    orderIndex: 0,
    chapters: class10MathsChapters,
    questions: class10MathsQuestions,
  },
  {
    code: "SCI",
    name: "Science",
    slug: "class-10-science",
    theoryMarks: 80,
    // Science's other 20 marks are internal assessment, which this platform
    // does not model. The paper is worth 80 and every score here says so.
    internalMarks: 20,
    hasPractical: true,
    orderIndex: 1,
    chapters: class10ScienceChapters,
    questions: class10ScienceQuestions,
  },
];

async function seedSubject(spec: SubjectSpec, authorId: string): Promise<CurriculumIndex> {
  const subjectId = seedId("subject", "10", spec.code);
  const subject = {
    board: "CBSE" as const,
    classLevel: 10,
    code: spec.code,
    name: spec.name,
    slug: spec.slug,
    variant: spec.variant ?? null,
    theoryMarks: spec.theoryMarks,
    internalMarks: spec.internalMarks,
    hasPractical: spec.hasPractical,
    syllabusYear: "2026-27",
    isActive: true,
    orderIndex: spec.orderIndex,
  };
  await prisma.subject.upsert({
    where: { id: subjectId },
    create: { id: subjectId, ...subject },
    update: subject,
  });

  const syllabusId = seedId("syllabus", spec.code, "2026-27");
  const syllabus = { subjectId, academicYear: "2026-27", isCurrent: true };
  await prisma.syllabusVersion.upsert({
    where: { id: syllabusId },
    create: { id: syllabusId, ...syllabus },
    update: syllabus,
  });

  const chapterIdBySlug = new Map<string, string>();
  const topicIdBySlug = new Map<string, string>();

  for (const [chapterIndex, chapter] of spec.chapters.entries()) {
    const chapterId = seedId("chapter", spec.code, chapter.slug);
    const chapterData = {
      subjectId,
      name: chapter.name,
      slug: chapter.slug,
      orderIndex: chapterIndex,
      ncertChapterNo: chapter.ncertChapterNo,
      domain: chapter.domain ?? null,
      isActive: true,
    };
    await prisma.chapter.upsert({
      where: { id: chapterId },
      create: { id: chapterId, ...chapterData },
      update: chapterData,
    });
    chapterIdBySlug.set(chapter.slug, chapterId);

    for (const [topicIndex, topic] of chapter.topics.entries()) {
      const topicId = seedId("topic", spec.code, topic.slug);
      const topicData = {
        chapterId,
        name: topic.name,
        slug: topic.slug,
        orderIndex: topicIndex,
        isActive: true,
      };
      await prisma.topic.upsert({
        where: { id: topicId },
        create: { id: topicId, ...topicData },
        update: topicData,
      });

      if (topicIdBySlug.has(topic.slug)) {
        throw new Error(
          `Seed error: duplicate topic slug "${topic.slug}" within subject ${spec.code}. ` +
            `Topic slugs must be unique per subject because questions refer to them by slug alone.`,
        );
      }
      topicIdBySlug.set(topic.slug, topicId);
    }
  }

  const index: CurriculumIndex = { subjectId, chapterIdBySlug, topicIdBySlug };

  for (const question of spec.questions) {
    await upsertQuestion(prisma, question, index, authorId);
  }

  return index;
}

/**
 * Write the validated blueprints into the database.
 *
 * The blueprint *document* is stored as JSON rather than normalised into tables.
 * Normalising it would make every CBSE pattern change a schema migration, which
 * is the exact outcome the blueprint design exists to prevent. The columns
 * alongside it are denormalised copies used only for listing and filtering.
 */
async function seedBlueprints(subjectIdByCode: Map<string, string>): Promise<number> {
  let written = 0;

  for (const blueprint of ALL_BLUEPRINTS) {
    const subjectId = subjectIdByCode.get(blueprint.subject.code);
    if (!subjectId) {
      // Class 12 Physics has no Subject row: it is a validator fixture with no
      // content and no students. Skipping it here is deliberate, not a gap.
      continue;
    }

    const id = seedId("blueprint", blueprint.id);
    const data = {
      key: blueprint.id,
      subjectId,
      name: blueprint.name,
      academicYear: blueprint.academicYear,
      version: blueprint.version,
      totalMarks: blueprint.totalMarks,
      totalQuestions: blueprint.totalQuestions,
      durationMinutes: blueprint.durationMinutes,
      structure: blueprint as unknown as object,
      verifiedAgainstOfficial: blueprint.verifiedAgainstOfficial,
      sourceUrl: blueprint.sourceUrl ?? null,
      isActive: true,
    };
    await prisma.examBlueprint.upsert({ where: { id }, create: { id, ...data }, update: data });
    written += 1;
  }

  return written;
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  const log = (message: string) => {
    process.stdout.write(`${message}\n`);
  };

  log("Seeding Samjho development data…\n");

  const { adminId, studentIds } = await seedUsers(prisma);
  log(`  users              1 admin, ${String(studentIds.length)} demo students`);

  const subjectIdByCode = new Map<string, string>();
  for (const spec of CLASS_10_SUBJECTS) {
    const index = await seedSubject(spec, adminId);
    subjectIdByCode.set(spec.code, index.subjectId);

    const chapters = spec.chapters.length;
    const topics = spec.chapters.reduce((s, c) => s + c.topics.length, 0);
    const subParts = spec.questions.reduce((s, q) => s + (q.subParts?.length ?? 0), 0);
    const domains = new Set(spec.chapters.map((c) => c.domain).filter(Boolean)).size;

    log(
      `  ${spec.code.padEnd(18)} ${String(chapters)} chapters, ${String(topics)} topics, ` +
        `${String(spec.questions.length)} questions (+${String(subParts)} sub-parts)` +
        (domains > 0 ? `, ${String(domains)} domains` : ""),
    );
  }

  const blueprintCount = await seedBlueprints(subjectIdByCode);
  log(
    `  blueprints         ${String(blueprintCount)} written, ` +
      `${String(ALL_BLUEPRINTS.length - blueprintCount)} validated but not stored (no subject)`,
  );

  await enrolStudents(prisma, [...subjectIdByCode.values()]);

  for (const spec of CLASS_10_SUBJECTS) {
    const subjectId = subjectIdByCode.get(spec.code);
    if (subjectId) {
      await seedPracticeHistory(prisma, { id: subjectId, code: spec.code });
    }
  }
  log("  progress           practice history, mastery rollups, mistakes and bookmarks");

  log(`\nDone in ${String(Date.now() - startedAt)} ms.`);
}

main()
  .catch((error: unknown) => {
    process.exitCode = 1;
    console.error("\nSeed failed:\n", error);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
