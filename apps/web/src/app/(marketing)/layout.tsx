import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { SmoothScroll } from "@/components/marketing/smooth-scroll";

/**
 * The public shell.
 *
 * Its own route group rather than a variant of the app shell, because the two
 * have opposite jobs: this one is for someone deciding, and `(app)` is for
 * someone working. The signed-in product deliberately does not get the smooth
 * scrolling — a student who presses End mid-set wants the bottom of the page
 * now, not in 900ms.
 *
 * The skip link is here rather than in the root layout because this is the first
 * layout with navigation to skip past.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SmoothScroll />

      <a
        href="#main"
        className="bg-brand-500 text-on-brand rounded-control sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:px-4 focus:py-2 focus:font-semibold"
      >
        Skip to content
      </a>

      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
