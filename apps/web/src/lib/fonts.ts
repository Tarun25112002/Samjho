import { Poppins, Source_Serif_4 } from "next/font/google";

/**
 * The two families, downloaded at build time and served from our own origin.
 *
 * Self-hosting is not a performance detail here — it is the same commitment the
 * landing page makes out loud. A `<link>` to fonts.googleapis.com would put a
 * request carrying a minor's IP address on every page of a product that says, in
 * writing, that it runs no third-party tracking. `next/font/google` copies the
 * files into the build, so the browser never talks to anyone but us.
 *
 * The cost is that a clean production build needs network access once. Worth it.
 */

/**
 * The interface: navigation, headings, numbers, buttons, chips.
 *
 * Four weights and no more. Poppins is not a variable font, so every weight is a
 * separate file on the wire, and a fifth would buy a distinction nobody can see
 * — 400 for body, 500 for labels, 600 for headings and buttons, 700 for the two
 * or three display lines on a screen.
 *
 * The Devanagari subset is here for one word: `समझो` in the wordmark. Setting
 * the product's own name in a fallback the OS picked is the kind of detail that
 * quietly tells an Indian reader the Hindi was an afterthought.
 */
export const poppins = Poppins({
  subsets: ["latin", "devanagari"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

/**
 * The reading face: question bodies, marking schemes, solutions.
 *
 * docs/01 §9 asks for a serif or humanist face for the text students actually
 * read, and this is also the practical call. Poppins has a small x-height for
 * its cap height and perfectly circular bowls — superb on a button, tiring
 * across four hundred words of physics. Source Serif is cut for screens and sits
 * correctly beside KaTeX, which is the real constraint; a display serif would
 * fight every formula on the page.
 *
 * Variable, so the whole weight axis arrives in one file.
 */
export const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
});

/** Applied to `<html>` so both custom properties are in scope everywhere. */
export const fontVariables = `${poppins.variable} ${sourceSerif.variable}`;
