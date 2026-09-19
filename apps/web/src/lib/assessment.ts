import {
  diagnosticProgressSchema,
  preparationAnalysisSchema,
  progressTrendSchema,
  type DiagnosticProgress,
  type PreparationAnalysis,
  type ProgressTrend,
} from "@medhavi/contracts";
import { cache } from "react";

import { apiFetchAuthed } from "./api-client";

/**
 * Server-side reads for the assessment space.
 *
 * `no-store` throughout, for the same reason practice uses it: every one of
 * these is a single student's own state, and a cached preparation report is a
 * report of work someone has since done.
 */

export const loadDiagnostics = cache(async function loadDiagnostics(): Promise<DiagnosticProgress> {
  return apiFetchAuthed("/api/v1/assessments/diagnostics", diagnosticProgressSchema, {
    cache: "no-store",
  });
});

export const loadAnalysis = cache(async function loadAnalysis(): Promise<PreparationAnalysis> {
  return apiFetchAuthed("/api/v1/analysis", preparationAnalysisSchema, { cache: "no-store" });
});

export const loadTrend = cache(async function loadTrend(): Promise<ProgressTrend> {
  return apiFetchAuthed("/api/v1/analysis/trend", progressTrendSchema, { cache: "no-store" });
});
