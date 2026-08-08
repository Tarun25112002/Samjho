/**
 * Tailwind v4 is configured in CSS (`@theme` in globals.css), not in a
 * tailwind.config.js. The PostCSS plugin is the only build-time wiring needed.
 */
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
