import { PRACTICE_MODE_LABELS } from "@samjho/contracts";
import type { Metadata } from "next";
import Link from "next/link";
import type { ComponentType } from "react";

import {
  BookmarkIcon,
  ChevronRight,
  PaperIcon,
  RedoIcon,
  SlidersIcon,
  StackIcon,
} from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow, PageHeader, PageShell, SectionHeading } from "@/components/ui/page";
import { Card, cardClass, IconTile, Meter, PanelOrbit } from "@/components/ui/surface";
import { StartPractice } from "@/features/practice/start-practice";
import { requireOnboarded } from "@/lib/me";
import { loadSessions } from "@/lib/practice";
import { describeScore, formatDuration } from "@/lib/practice-format";

export const metadata: Metadata = { title: "Practice" };
export const dynamic = "force-dynamic";

/**
 * The practice hub.
 *
 * Ordered by how much each thing helps the student *act*, which is the same rule
 * the dashboard follows (docs/01 §4). "Continue" is first and largest because a
 * half-finished set is the single most likely thing a returning student wants,
 * and the presets come before the filter builder because most students do not
 * want to build anything — they want to start.
 *
 * The custom builder is one row at the bottom rather than a panel. It is the
 * least-used path and the most visually expensive one, and putting it first is
 * how a two-tap product becomes a six-tap product.
 */
export default async function PracticeHubPage() {
  const me = await requireOnboarded();

  const [inProgress, recent] = await Promise.all([
    loadSessions({ status: "IN_PROGRESS", limit: 1 }),
    loadSessions({ limit: 8 }),
  ]);

  const resume = inProgress.items[0];
  const subjects = me.profile?.subjects ?? [];
  const resumePercent =
    resume === undefined
      ? 0
      : Math.round((resume.totals.answered / Math.max(resume.totals.totalQuestions, 1)) * 100);

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Practice space"
        title="Practice with purpose."
        lede="Build fluency, understand the answer, and return to the questions that still need work."
        action={
          <Link
            href="/practice/new"
            className="text-brand-700 inline-flex min-h-11 items-center gap-1 text-sm font-semibold hover:underline"
          >
            Build a set <ChevronRight className="size-4" />
          </Link>
        }
      />

      {resume ? (
        <Card
          tone="brand"
          aria-labelledby="continue-heading"
          className="relative grid gap-5 overflow-hidden lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end"
        >
          <PanelOrbit />
          <div className="relative min-w-0">
            <Eyebrow className="flex items-center gap-2">
              <span className="bg-brand-500 size-2 rounded-full" /> Ready when you are
            </Eyebrow>
            <h2 id="continue-heading" className="text-text text-heading mt-3 truncate">
              {resume.focus ?? PRACTICE_MODE_LABELS[resume.mode]}
            </h2>
            <div className="mt-4 max-w-2xl">
              <div className="text-text-soft flex items-baseline justify-between gap-4 text-sm">
                <span>
                  {resume.totals.answered} of {resume.totals.totalQuestions} answered
                </span>
                <span className="tabular-nums">{resumePercent}%</span>
              </div>
              <Meter percent={resumePercent} className="bg-brand-200 mt-2" />
            </div>
          </div>

          <ButtonLink
            href={`/practice/sessions/${resume.id}`}
            className="relative justify-self-start lg:justify-self-end"
          >
            Resume
          </ButtonLink>
        </Card>
      ) : null}

      <section aria-labelledby="start-heading" className="flex flex-col gap-4">
        <SectionHeading
          id="start-heading"
          eyebrow="Choose your route"
          title="Start where it helps most"
        />

        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Preset
            icon={StackIcon}
            title="Quick practice"
            body="Ten questions you have not seen, drawn from everything you are studying."
          >
            <StartPractice mode="QUICK" filters={{ unseenOnly: true }} count={10} label="Start" />
          </Preset>

          <Preset
            icon={RedoIcon}
            title="Fix your mistakes"
            body="Questions you got wrong and have not got right since. The point of the whole app."
          >
            <StartPractice mode="MISTAKE_REVIEW" label="Practise these" variant="secondary" />
          </Preset>

          <Preset
            icon={BookmarkIcon}
            title="Saved questions"
            body="The ones you marked to come back to."
          >
            <StartPractice mode="BOOKMARKS" label="Practise saved" variant="secondary" />
          </Preset>

          <Preset
            icon={PaperIcon}
            title="Previous-year questions"
            body="Straight from CBSE board and sample papers, with the paper and year attached."
          >
            <StartPractice mode="PREVIOUS_YEAR" label="Practise PYQs" variant="secondary" />
          </Preset>
        </ul>

        <Link
          href="/practice/new"
          className={`${cardClass({ interactive: true })} group flex items-center gap-4`}
        >
          <IconTile
            size="large"
            className="group-hover:bg-brand-50 group-hover:text-brand-700 transition-colors"
          >
            <SlidersIcon className="size-5" />
          </IconTile>
          <span className="min-w-0 flex-1">
            <span className="text-text block font-semibold">Build a custom set</span>
            <span className="text-text-soft mt-0.5 block text-sm">
              Pick a subject, chapter, question type, difficulty, or paper year.
            </span>
          </span>
          <ChevronRight className="text-text-faint group-hover:text-brand-700 size-5 shrink-0 transition-colors" />
        </Link>
      </section>

      {subjects.length > 0 ? (
        <section aria-labelledby="subjects-heading" className="flex flex-col gap-4">
          <SectionHeading
            id="subjects-heading"
            eyebrow="Your syllabus"
            title="Practise by subject"
          />

          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {subjects.map((subject) => (
              <li key={subject.id}>
                <Link
                  href={`/subjects/${subject.slug}`}
                  className={`${cardClass({ interactive: true })} group flex h-full min-h-36 flex-col`}
                >
                  <p className="text-text font-semibold">{subject.name}</p>
                  <p className="text-text-soft mt-1 text-sm">
                    Browse chapters or target one topic.
                  </p>
                  <span className="text-brand-700 mt-auto inline-flex items-center gap-1 pt-5 text-sm font-semibold">
                    Explore subject{" "}
                    <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="recent-heading" className="flex flex-col gap-4">
        <SectionHeading id="recent-heading" eyebrow="Your activity" title="Recent practice" />

        {recent.items.length === 0 ? (
          <Card pad="roomy">
            <p className="text-text-soft text-sm">Nothing yet. Your first set will appear here.</p>
          </Card>
        ) : (
          <Card pad="flush" className="overflow-hidden">
            <ul className="divide-line divide-y">
              {recent.items.map((session) => (
                <li key={session.id}>
                  <Link
                    href={
                      session.status === "IN_PROGRESS"
                        ? `/practice/sessions/${session.id}`
                        : `/practice/sessions/${session.id}/result`
                    }
                    className="hover:bg-raised flex min-h-16 flex-wrap items-center gap-x-3 gap-y-1 px-5 py-4 transition-colors sm:px-6"
                  >
                    <span className="text-text font-medium">
                      {session.focus ?? PRACTICE_MODE_LABELS[session.mode]}
                    </span>
                    <span className="text-text-soft text-sm">{describeScore(session.totals)}</span>
                    <span className="text-text-faint ml-auto text-sm">
                      {session.status === "IN_PROGRESS"
                        ? "In progress"
                        : formatDuration(session.totals.timeSpentMs)}
                    </span>
                    <ChevronRight className="text-text-faint size-4 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </PageShell>
  );
}

/**
 * One way into a set.
 *
 * The icon is doing real work here rather than decorating: four cards of
 * identical text at a glance are four cards nobody reads, and the shape is what
 * a returning student navigates by once they know which one they want.
 */
function Preset({
  icon: Icon,
  title,
  body,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <Card as="li" interactive className="flex min-h-64 flex-col gap-5">
      <div>
        <IconTile size="large" className="mb-4">
          <Icon className="size-5" />
        </IconTile>
        <h3 className="text-text text-subheading">{title}</h3>
        <p className="text-text-soft mt-1 text-sm leading-relaxed">{body}</p>
      </div>
      <div className="mt-auto">{children}</div>
    </Card>
  );
}
