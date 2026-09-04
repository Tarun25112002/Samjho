import { useEffect, useLayoutEffect } from "react";

/**
 * `useLayoutEffect` in the browser, `useEffect` on the server.
 *
 * Animation setup has to run *before* the first paint, or the reader sees the
 * finished layout for one frame and then watches it jump back to the start —
 * which is worse than no animation at all. `useLayoutEffect` is the hook that
 * runs there.
 *
 * It also warns loudly when React renders it on the server, which Next does for
 * every client component. Swapping in `useEffect` for that pass is the standard
 * fix: there is no paint to be early for on the server, so the two are
 * equivalent exactly where they differ.
 *
 * The pay-off is that the server-rendered HTML stays complete and readable. The
 * hidden starting state is applied by GSAP on the client, so a reader with no
 * JavaScript — or a crawler — gets the page rather than a stack of empty divs.
 */
export const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;
