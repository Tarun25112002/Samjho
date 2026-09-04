"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { useEffect } from "react";

/**
 * Smooth scrolling, and the one thing that makes it safe to add.
 *
 * Lenis replaces the browser's own scroll with an interpolated one. That is a
 * real intervention — it is the kind of effect that gives some people motion
 * sickness — so the entire thing is behind `prefers-reduced-motion`. Someone who
 * has asked their operating system for less motion gets the native scroll, and
 * every other animation on this page checks the same query.
 *
 * ## Why GSAP drives the loop
 *
 * Lenis and ScrollTrigger each want to own a requestAnimationFrame loop, and
 * running both means ScrollTrigger reads scroll positions Lenis has not written
 * yet — pinned sections lag by a frame and jitter. Driving Lenis from GSAP's
 * ticker and feeding `ScrollTrigger.update` from Lenis' scroll event puts them
 * in one loop, in the right order. `lagSmoothing(0)` stops GSAP from silently
 * skipping ahead after a slow frame, which on a mid-range Android is often.
 *
 * Rendered once, from the marketing layout. The signed-in app does not use it:
 * a student mid-practice pressing End wants the bottom of the page now, not in
 * 900ms.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({
      duration: 1.05,
      smoothWheel: true,
      // In-page links still have to land. Lenis owns the scroll position, so
      // the browser's native anchor jump would be overwritten mid-flight.
      anchors: { offset: -80 },
    });

    const onScroll = () => {
      ScrollTrigger.update();
    };
    lenis.on("scroll", onScroll);

    // GSAP's ticker is in seconds; Lenis wants milliseconds.
    const raf = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(raf);
      lenis.off("scroll", onScroll);
      lenis.destroy();
    };
  }, []);

  return null;
}
