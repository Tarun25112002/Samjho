import { REVIEW_DAILY_CAP, type RevisionQueue } from "@samjho/contracts";
import type { Metadata } from "next";

import { Eyebrow, PageHeader, PageShell, SectionHeading } from "@/components/ui/page";
import { Card, PanelOrbit } from "@/components/ui/surface";
import { StartRevision } from "@/features/revision/start-revision";
import { INDIA_TIME_ZONE } from "@/lib/india-time";
import { requireOnboarded } from "@/lib/me";
import { loadRevisionQueue } from "@/lib/revision";

export const metadata: Metadata = { title: "Revision" };
export const dynamic = "force-dynamic";

/**
 * The revision queue.
 *
 * ## The page has one job and it is a number and a button
 *
 * Everything else here is context for that number. A student arriving at this
 * page should be able to start without reading anything, and the layout is built
 * to make that true: the count and the button are in the first panel, above the
 * fold on a phone, before any breakdown or history.
 *
 * That ordering is the same rule the dashboard follows — when a feature could be
 * more analytics or more practice, choose practice (docs/00 §1) — and it matters
 * more here than anywhere else in the product, because a spaced-repetition queue
 * only works if it is actually opened, daily, by a fifteen-year-old.
 *
 * ## Why the backlog is shown even when it is bad news
 *
 * `dueToday` is capped at twenty; `dueTotal` is not. A student returning after
 * two weeks has a real backlog, and both available lies are worse than the
 * truth: show them 340 and they close the app, show them 20 with no context and
 * they clear it daily for a fortnight while the number never moves and the
 * feature looks broken. So: twenty to do, and a second line saying how the
 * mountain behind it is coming down.
 */
export default async function RevisionPage() {
  await requireOnboarded();
  const queue = await loadRevisionQueue();

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Revision"
        title="What to go over today."
        lede="Questions you have got wrong come back on a widening schedule — tomorrow, then in three days, then in a week — until you have got them right four times running. Then they stop coming back."
      />

      <QueuePanel queue={queue} />

      {queue.bySubject.length > 0 ? (
        <section aria-labelledby="by-subject">
          <SectionHeading
            id="by-subject"
            eyebrow="Split"
            title="By subject"
            lede="Narrow the review if you want to spend the half hour on one paper."
          />
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {queue.bySubject.map((row) => (
              <Card key={row.subject.id}>
                <p className="text-text text-base font-semibold">{row.subject.name}</p>
                <p className="text-text-soft mt-1 text-sm">
                  {row.due > 0 ? `${String(row.due)} due now` : "Nothing due — all caught up here"}
                  {row.upcoming > 0 ? ` · ${String(row.upcoming)} this week` : ""}
                </p>

                {row.due > 0 ? (
                  <div className="mt-4">
                    <StartRevision
                      subjectId={row.subject.id}
                      count={Math.min(row.due, REVIEW_DAILY_CAP)}
                      variant="secondary"
                      label={`Review ${row.subject.name}`}
                    />
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="streak">
        <SectionHeading
          id="streak"
          eyebrow="Habit"
          title="Your study days"
          lede="Spaced repetition works on the calendar, not in bursts. Short and daily beats long and occasional."
        />
        <div className="mt-4">
          <StreakPanel queue={queue} />
        </div>
      </section>
    </PageShell>
  );
}

/**
 * The number and the button.
 *
 * Three states, and each one needs different words rather than the same panel
 * with a different figure in it:
 *
 *  - **Nothing has been missed yet.** A new student. Telling them their queue is
 *    empty reads as a broken feature, so it explains where the queue comes from.
 *  - **Cleared for today.** The success state, and it says *when the next batch
 *    lands* — otherwise "all done" is indistinguishable from "nothing here".
 *  - **Work waiting.** The number, the button, and nothing competing with them.
 */
function QueuePanel({ queue }: { queue: RevisionQueue }) {
  const nothingEverMissed =
    queue.dueTotal === 0 && queue.dueThisWeek === 0 && queue.graduated === 0;

  if (nothingEverMissed) {
    return (
      <Card tone="brand" pad="roomy" className="relative overflow-hidden">
        <PanelOrbit />
        <div className="relative">
          <Eyebrow>Nothing to review</Eyebrow>
          <p className="text-text mt-2 text-xl font-semibold">Your revision queue is empty.</p>
          <p className="text-text-soft mt-2 max-w-xl text-sm leading-relaxed">
            It fills itself. Every question you get wrong in practice is scheduled to come back
            tomorrow, and then at widening gaps until you have it. Go and practise something and
            this page will have work on it.
          </p>
        </div>
      </Card>
    );
  }

  if (queue.dueTotal === 0) {
    return (
      <Card tone="brand" pad="roomy" className="relative overflow-hidden">
        <PanelOrbit />
        <div className="relative">
          <Eyebrow>Cleared</Eyebrow>
          <p className="text-text mt-2 text-xl font-semibold">
            Nothing due today.{" "}
            {queue.reviewedToday > 0 ? `You cleared ${String(queue.reviewedToday)}.` : ""}
          </p>
          <p className="text-text-soft mt-2 max-w-xl text-sm leading-relaxed">
            {queue.nextDueAt === null
              ? "Nothing is scheduled at the moment."
              : `Your next questions come back ${relativeDay(queue.nextDueAt)}.`}
            {queue.graduated > 0
              ? ` ${String(queue.graduated)} question${queue.graduated === 1 ? " has" : "s have"} left the queue for good.`
              : ""}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card tone="brand" pad="roomy" className="relative overflow-hidden">
      <PanelOrbit />
      <div className="relative flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <div className="min-w-0">
          <Eyebrow>Due today</Eyebrow>
          <p className="text-text mt-2 text-4xl font-semibold tabular-nums">
            {queue.dueToday}
            <span className="text-text-soft ml-2 text-base font-medium">
              question{queue.dueToday === 1 ? "" : "s"}
            </span>
          </p>

          <p className="text-text-soft mt-2 max-w-xl text-sm leading-relaxed">
            {queue.dueTotal > queue.dueToday ? (
              <>
                Capped at {REVIEW_DAILY_CAP} a day so it stays finishable.{" "}
                <strong className="text-text font-semibold">{queue.dueTotal}</strong> are waiting in
                total — clear today&rsquo;s and that number comes down.
              </>
            ) : (
              <>Everything the schedule says you owe. Half an hour, and it is empty.</>
            )}
          </p>

          {queue.reviewedToday > 0 ? (
            <p className="text-text-faint mt-2 text-sm">
              {queue.reviewedToday} already reviewed today.
            </p>
          ) : null}
        </div>

        <div className="shrink-0">
          <StartRevision count={queue.dueToday} />
        </div>
      </div>
    </Card>
  );
}

/**
 * The streak, and the fortnight behind it.
 *
 * Two weeks rather than a full year heatmap. A year of squares is a beautiful
 * thing on a desktop and an unreadable grey smear at 360px, and the question a
 * student actually has — "am I keeping this up?" — is answered by the last
 * fourteen days and the two numbers beside them.
 */
function StreakPanel({ queue }: { queue: RevisionQueue }) {
  const byDate = new Map(queue.streak.recent.map((day) => [day.date, day]));
  const days = lastFourteenDays().map((date) => ({ date, day: byDate.get(date) }));

  return (
    <Card>
      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
        <div>
          <p className="text-text text-2xl font-semibold tabular-nums">
            {queue.streak.current}
            <span className="text-text-soft ml-2 text-sm font-medium">
              day{queue.streak.current === 1 ? "" : "s"} running
            </span>
          </p>
        </div>
        <p className="text-text-faint text-sm">Best: {queue.streak.longest} days</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {days.map(({ date, day }) => (
          <div
            key={date}
            // `title` and an accessible label, because a bare coloured square is
            // meaningless to anyone who cannot see it and ambiguous to everyone
            // who can — "did I do six questions or sixty?"
            title={
              day === undefined
                ? `${date}: nothing`
                : `${date}: ${String(day.attempts)} answered, ${String(day.reviews)} reviewed`
            }
            aria-label={
              day === undefined ? `${date}: no work` : `${date}: ${String(day.attempts)} answered`
            }
            className={[
              "size-6 rounded-[0.3rem] border",
              day === undefined
                ? "border-line bg-raised"
                : day.reviews > 0
                  ? "border-brand-300 bg-brand-400"
                  : "border-brand-200 bg-brand-100",
            ].join(" ")}
          />
        ))}
      </div>

      <p className="text-text-faint mt-3 text-xs">
        Filled squares are days you practised; the darker ones are days you cleared revision.
      </p>

      {!queue.streak.studiedToday && queue.streak.current > 0 ? (
        <p className="text-text-soft mt-3 text-sm">
          {/*
            Framed as the streak being intact rather than at risk. A student who
            has not started at 9am has not failed at anything, and "your streak
            ends today unless…" is the kind of nudge that makes people close an
            app rather than open it.
          */}
          Your {queue.streak.current}-day run is still going. Anything today keeps it.
        </p>
      ) : null}
    </Card>
  );
}

/** The last fourteen IST days, oldest first, as `YYYY-MM-DD`. */
function lastFourteenDays(): string[] {
  const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const today = Math.floor((Date.now() + IST_OFFSET_MS) / DAY_MS) * DAY_MS;

  return Array.from({ length: 14 }, (_, index) =>
    new Date(today - (13 - index) * DAY_MS).toISOString().slice(0, 10),
  );
}

/** "tomorrow" / "in 3 days" / "on 21 September". Rounded to whole days. */
function relativeDay(iso: string): string {
  const days = Math.ceil((Date.parse(iso) - Date.now()) / (24 * 60 * 60 * 1000));

  if (days <= 0) return "shortly";
  if (days === 1) return "tomorrow";
  if (days <= 7) return `in ${String(days)} days`;

  return `on ${new Date(iso).toLocaleDateString("en-IN", {
    timeZone: INDIA_TIME_ZONE,
    day: "numeric",
    month: "long",
  })}`;
}
