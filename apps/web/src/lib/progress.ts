import { progressOverviewSchema, type ProgressOverview } from "@samjho/contracts";
import { cache } from "react";

import { apiFetchAuthed } from "./api-client";

/** The rollup-backed view used by the dashboard and the dedicated progress page. */
export const loadProgressOverview = cache(
  async function loadProgressOverview(): Promise<ProgressOverview> {
    return apiFetchAuthed("/api/v1/progress/overview", progressOverviewSchema, {
      cache: "no-store",
    });
  },
);
