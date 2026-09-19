import { dailyStudyPlanSchema, type DailyStudyPlan } from "@samjho/contracts";
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
