/**
 * Shell for Clerk's sign-in and sign-up components.
 *
 * The layout owns only the split: a brand panel and a form column, side by side
 * from `xl` up and stacked below it. The form keeps the whole canvas at smaller
 * desktop widths instead of being squeezed beside decorative content. Both
 * cells are supplied by the page rather than by this file, because the two pages
 * say different things — a returning student and a parent reading over a
 * fourteen-year-old's shoulder are not the
 * same reader, and one shared headline would be written for neither.
 *
 * The forms themselves are Clerk's. Credentials, password rules, verification,
 * MFA and the OAuth dance are exactly the things you do not want to hand-roll
 * for a product that holds minors' data. Their appearance is themed once, in the
 * root layout.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh xl:grid xl:h-dvh xl:min-h-0 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] xl:overflow-hidden">
      {children}
    </main>
  );
}
