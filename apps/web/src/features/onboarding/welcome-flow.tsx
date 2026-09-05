"use client";

import type { SubjectSummary } from "@samjho/contracts";
import { useState } from "react";

import { AccountTypeChooser } from "./account-type";
import { OnboardingWizard } from "./onboarding-wizard";

/**
 * The one-decision gate in front of onboarding.
 *
 * A thin client component that holds a single piece of state — which account
 * type was chosen — and renders one of two flows. It exists so the page itself
 * stays a server component: `/welcome` fetches both class levels' subjects
 * up front (see the page for why), and moving that fetch into the browser to
 * accommodate a `useState` would put a spinner in front of every new student.
 *
 * There is no "back" from the student wizard to the chooser, and that is the
 * same reasoning as everywhere else in this flow: a student who reaches step
 * three and taps back to the top loses three screens of answers. The teacher
 * form, which is one screen and holds almost nothing, does offer it.
 */
export function WelcomeFlow({
  subjectsByClass,
}: {
  subjectsByClass: Record<string, SubjectSummary[]>;
}) {
  const [role, setRole] = useState<"unchosen" | "student">("unchosen");

  if (role === "unchosen") {
    return <AccountTypeChooser onChooseStudent={() => setRole("student")} />;
  }

  // Account type is a wide decision with two equal options; the student wizard
  // is deliberately narrow enough to keep one form decision in view. Keeping
  // those widths here lets the route own one responsive canvas without making
  // either step feel undersized or needlessly stretched.
  return (
    <div className="mx-auto w-full max-w-2xl">
      <OnboardingWizard subjectsByClass={subjectsByClass} />
    </div>
  );
}
