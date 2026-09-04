import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";

import { AuthAside } from "@/components/auth/auth-aside";
import { AuthFormColumn } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Create an account" };

export default function SignUpPage() {
  return (
    <>
      <AuthAside
        headline="Practise the paper you are actually going to sit."
        note="Signing up asks for a parent or guardian's email address. Samjho carries no advertising and no behavioural tracking, and every account is treated as belonging to a student under 18."
      />

      <AuthFormColumn mobileHeadline="Class 10 Maths and Science, on the CBSE pattern">
        <div className="flex flex-col gap-6">
          <SignUp />

          {/*
            Shown before the account exists, not after. A parent's address is
            asked for during onboarding, and someone signing their child up
            should know that at the point they decide — not once the account is
            already created.
          */}
          <p className="bg-raised border-line rounded-control text-text-soft border p-4 text-sm leading-relaxed">
            Next, we&rsquo;ll ask for a parent or guardian&rsquo;s email address. Samjho is in a
            closed pilot and every account is treated as belonging to a student under 18.
          </p>
        </div>
      </AuthFormColumn>
    </>
  );
}
