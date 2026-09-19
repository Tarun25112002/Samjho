import {
  dailyStudyPlanSchema,
  weeklyStudyPlanSchema,
  type DailyStudyPlan,
  type WeeklyStudyPlan,
} from "@samjho/contracts";
import { cache } from "react";

import { apiFetchAuthed } from "./api-client";

/**
 * The plan is intentionally never cached across requests: completing a review
 * or starting a teacher assignment should change the next recommendation on
 * the very next dashboard render. React still deduplicates it within one
 * server render through `cache`.
 */
export const loadDailyStudyPlan = cache(
  async function loadDailyStudyPlan(): Promise<DailyStudyPlan> {
    return apiFetchAuthed("/api/v1/study-plan/today", dailyStudyPlanSchema, { cache: "no-store" });
  },
);

/**
 * The week ahead. Also uncached, and for a sharper reason than the daily plan:
 * clearing the revision queue on Monday changes which of the seven days are
 * revision days, and a student looking at a cached Tuesday would be reading a
 * plan for a backlog they have already cleared.
 */
export const loadWeeklyStudyPlan = cache(
  async function loadWeeklyStudyPlan(): Promise<WeeklyStudyPlan> {
    return apiFetchAuthed("/api/v1/study-plan/week", weeklyStudyPlanSchema, { cache: "no-store" });
  },
);
