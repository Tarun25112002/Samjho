/**
 * Fail the build on a Tailwind class that compiles to nothing.
 *
 * ## Why this exists
 *
 * Tailwind drops a class whose token does not resolve, silently: no build
 * error, no console warning, just an element with no background. That is a
 * failure mode with no other detector, and it has already bitten this codebase
 * twice — `bg-ink-50` survived the removal of the `ink-*` ramp and left the
 * "Imported" status pill unfilled among four filled ones, and `border-half-300`
 * asked for a gold step that the half ramp does not have.
 *
 * Neither showed up in typecheck, lint, tests or the production build. Both
 * show up here, because this compiles the app's real stylesheet and asks it,
 * class by class, whether anything came out.
 *
 *     node scripts/check-css-tokens.mjs
 *
 * ## What it can and cannot see
 *
 * It reads string literals out of the source rather than parsing JSX, so a
 * class assembled at runtime from fragments (`bg-${tone}-50`) is invisible to
 * it — as it is to Tailwind's own scanner, which is why the codebase writes
 * whole class names in every branch instead. The pre-sieve below is generous;
 * the compiler is the actual judge, so a false negative is possible and a false
 * positive is not.
 */
import fs from "node:fs";
import path from "node:path";
import { compile } from "tailwindcss";

const ROOTS = ["src", "../../packages/ui/src"];
const STYLESHEET = "src/app/globals.css";

const css = fs.readFileSync(STYLESHEET, "utf8");
const compiler = await compile(css, {
  base: process.cwd(),
  loadStylesheet: async (_id, base) => ({
    base,
    content: fs.readFileSync("node_modules/tailwindcss/index.css", "utf8"),
    path: "node_modules/tailwindcss/index.css",
  }),
});

const files = [];
for (const root of ROOTS) {
  if (!fs.existsSync(root)) continue;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name)) files.push(full);
    }
  };
  walk(root);
}

/**
 * Strip comments before scanning.
 *
 * A doc comment that *names* a dead token — "`bg-ink-50` used to be drawn
 * here" — is documentation, not a bug, and reporting it would train everyone to
 * ignore this check's output.
 */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** Looks like `sm:hover:bg-brand-500` or `grid-cols-[minmax(0,1fr)]`, not like a word. */
const UTILITY = /^(-?[a-z][a-z0-9]*:)*-?[a-z][a-z0-9]*(-[a-z0-9.[\]()/,_%+-]+)+$/;

const candidates = new Map();
const collect = (chunk, file) => {
  for (const token of chunk.split(/\s+/)) {
    if (!token || token.includes("${") || token.includes("{")) continue;
    if (!UTILITY.test(token)) continue;
    if (/\.(tsx?|css|json|md)$/.test(token)) continue;
    if (!candidates.has(token)) candidates.set(token, new Set());
    candidates.get(token).add(file);
  }
};

for (const file of files) {
  const source = stripComments(fs.readFileSync(file, "utf8"));
  for (const match of source.matchAll(/class(?:Name)?=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    collect(match[1] ?? match[2] ?? "", file);
  }
  // Class strings also live in plain consts, lookup maps and ternaries.
  for (const match of source.matchAll(/"([^"\n]{3,})"|`([^`\n$]{3,})`/g)) {
    collect(match[1] ?? match[2] ?? "", file);
  }
}

const wanted = [...candidates.keys()];
// Tailwind writes `.xl\:px-10` and `.w-\[2px\]`; dropping the escapes lets a
// plain substring test work for every shape of candidate.
const built = compiler.build(wanted).replaceAll("\\", "");
const projectClasses = new Set([...css.matchAll(/^\s*\.([a-z][\w-]*)/gm)].map((m) => m[1]));

const dead = [];
for (const token of wanted) {
  const bare = token.replace(/^-/, "");
  if (projectClasses.has(bare)) continue;
  const at = built.indexOf("." + bare);
  // A prefix match is not a match: `.text-brand-7` must not satisfy
  // `text-brand-700`, and `.bg-card` must not satisfy `bg-cardigan`.
  const next = at === -1 ? "" : built.charAt(at + bare.length + 1);
  if (at === -1 || /[\w-]/.test(next)) dead.push(token);
}

// Only utility-shaped survivors are worth reporting; ids, header names and
// hyphenated words also reach this point and compile to nothing quite correctly.
const UTILITY_PREFIX =
  /^(-?[a-z0-9]+:)*(bg|text|border|ring|outline|divide|from|to|via|fill|stroke|shadow|rounded|tracking|leading|font|accent|caret|decoration|placeholder|marker|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|w|h|size|min|max|inset|top|bottom|left|right|z|opacity|scale|rotate|translate|origin|duration|delay|ease|transition|grid|col|row|flex|basis|grow|shrink|order|items|justify|self|place|space|aspect|object|overflow|whitespace|break|line|list|indent|align|cursor|select|touch|will|snap|scroll|resize|appearance|backdrop|blur|animate|container)-/;

const report = dead.filter((token) => UTILITY_PREFIX.test(token));

if (report.length === 0) {
  console.log(`✓ ${String(wanted.length)} classes checked; every one compiles.`);
  process.exit(0);
}

console.error("Classes that compile to nothing — the token they name does not exist:\n");
for (const token of report.sort()) {
  console.error(`  ${token.padEnd(28)} ${[...candidates.get(token)].join(", ")}`);
}
console.error(`\n${String(report.length)} dead ${report.length === 1 ? "class" : "classes"}.`);
process.exit(1);
