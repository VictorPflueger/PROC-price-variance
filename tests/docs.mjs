// The documents are consistent with the code, and at release complete:
//   - every section the code cites ("TECH_NOTES §3", "DESIGN.md §3") exists;
//   - every repository path a document names (in backticks or as a relative link) exists;
//   - each document that exists carries the sections its milestone needs, and the README links the
//     live site and says the company is fictional;
//   - with --complete (milestone M3, AC-23): README, DESIGN, DEMO_SCRIPT, DATA_SOURCES, TECH_NOTES,
//     REVIEW and tests/README all exist, are substantial and carry their release sections, and the
//     demo script answers the brief's four questions. Adapted from the Timetable Translator's test,
//     whose demo script is German; this app's documents are English.
// Usage: node tests/docs.mjs             (consistency, and the sections of the current milestone)
//        node tests/docs.mjs --complete  (the release's documentation set, AC-23)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { APP_ROOT } from "./lib/harness.mjs";

const COMPLETE = process.argv.includes("--complete");
// now: what each document holds from milestone M1; release: what AC-23 asks at M3.
const DOCS = {
  "README.md": {
    now: { words: 500, sections: ["What it is", "How it works", "Status", "Run it", "Tests", "Files", "In production"] },
    release: { words: 1500, sections: ["The demo in five minutes", "Deploy", "The two modes", "Your API key", "What a run costs", "Troubleshooting", "Safety and the EU AI Act", "Quality and acceptance"] }
  },
  "TECH_NOTES.md": {
    now: { words: 1500, numbered: 12 },
    release: { words: 3000, numbered: 12, sections: ["Verification log", "Acceptance checklist"] }
  },
  "DATA_SOURCES.md": { now: { words: 700, numbered: 6 }, release: { words: 900, numbered: 6 } },
  "DESIGN.md": { now: { words: 500, numbered: 4 }, release: { words: 900, numbered: 8 } },
  "REVIEW.md": { now: { words: 300, sections: ["Part 1: the shared shell"] }, release: { words: 700, sections: ["Part 1: the shared shell", "Part 2: the independent review"] } },
  "tests/README.md": { now: { words: 200, sections: ["What runs", "Setup for the browser suites"] }, release: { words: 300, sections: ["What runs", "Setup for the browser suites"] } },
  "DEMO_SCRIPT.md": {
    now: null,
    release: { words: 900, sections: ["Pre-flight", "The five-minute version", "Contingencies", "Questions that will come"],
      phrases: ["Is this real data?", "Is that really the same item?", "Why is this price justified?", "When is a saving real?"] }
  }
};
const LIVE_URL = "https://victorpflueger.github.io/PROC-price-variance/";

const problems = [];
const text = {};
for (const [f, rules] of Object.entries(DOCS)) {
  const rule = COMPLETE ? { ...rules.now, ...rules.release, sections: [...(rules.now?.sections || []), ...(rules.release?.sections || [])] } : rules.now;
  const p = path.join(APP_ROOT, f);
  if (!fs.existsSync(p)) { if (rule) problems.push(`${f} is missing`); continue; }
  const t = fs.readFileSync(p, "utf8");
  text[f] = t;
  if (!rule) continue;
  const words = t.split(/\s+/).filter(Boolean).length;
  if (words < rule.words) problems.push(`${f} has ${words} words (at least ${rule.words} expected)`);
  const heads = [...t.matchAll(/^#{2,3} (.+)$/gm)].map((m) => m[1].trim());
  for (const s of rule.sections || []) if (!heads.some((h) => h.startsWith(s) || h.includes(s))) problems.push(`${f} lacks the section "${s}"`);
  if (rule.numbered) for (let n = 1; n <= rule.numbered; n++) if (!heads.some((h) => h.startsWith(`${n}. `))) problems.push(`${f} lacks section ${n}`);
  for (const ph of rule.phrases || []) if (!t.includes(ph)) problems.push(`${f} does not answer "${ph}"`);
}

// Sections the code cites.
const tracked = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: APP_ROOT, encoding: "utf8" }).split("\n").filter(Boolean);
const sources = tracked.filter((f) => /\.(m?js|css|html)$/.test(f) && !f.startsWith("vici/"));
const DOC_OF = { TECH_NOTES: "TECH_NOTES.md", DESIGN: "DESIGN.md", DATA_SOURCES: "DATA_SOURCES.md" };
let cited = 0;
for (const f of sources) {
  const t = fs.readFileSync(path.join(APP_ROOT, f), "utf8");
  for (const m of t.matchAll(/\b(TECH_NOTES|DESIGN|DATA_SOURCES)(?:\.md)? ?§ ?(\d+)(?:[–-](\d+))?(?: and §(\d+))?/g)) {
    const doc = DOC_OF[m[1]];
    const nums = [Number(m[2]), m[3] ? Number(m[3]) : null, m[4] ? Number(m[4]) : null].filter((x) => x !== null);
    const all = m[3] ? Array.from({ length: Number(m[3]) - Number(m[2]) + 1 }, (_, i) => Number(m[2]) + i) : nums;
    for (const n of all) {
      cited += 1;
      if (!text[doc]) problems.push(`${f} cites ${doc} §${n}, but ${doc} does not exist`);
      else if (!new RegExp(`^#{2,3} ${n}\\. `, "m").test(text[doc])) problems.push(`${f} cites ${doc} §${n}, which does not exist`);
    }
  }
}

// Paths the documents name.
const EXT = /\.(m?js|css|html|md|json|svg|yml|txt|jpg|woff2)$/;
const FOLDERS = ["", "js", "css", "data", "tests", "tests/lib", "tests/fixtures", "tools", "tools/source", "vici", "vici/dist", ".github/workflows"];
let named = 0;
for (const [f, t] of Object.entries(text)) {
  const base = path.dirname(path.join(APP_ROOT, f));
  const names = new Set();
  for (const m of t.matchAll(/`([^`\s]+)`/g)) names.add(m[1]);
  for (const m of t.matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/g)) if (!/^[a-z]+:/i.test(m[1])) names.add(m[1]);
  for (const n of names) {
    const clean = n.replace(/[.,;:]$/, "");
    if (/[<>*{}$]|^~|^\/|^https?:|^-/.test(clean)) continue;
    if (/^[\w-]+(\.[\w-]+)*\.(io|com|org|net|de|dev|ai|eu)(\/|$)/i.test(clean)) continue; // a web address, not a path
    if (!clean.includes("/") && !EXT.test(clean)) continue;
    if (!/^[\w./ -]+$/.test(clean) || !(EXT.test(clean) || clean.endsWith("/") || /^(js|css|data|tests|tools|vici)(\/|$)/.test(clean))) continue;
    named += 1;
    // A bare file name ("variance.js") may live in any of the app's folders.
    const candidates = clean.includes("/")
      ? [path.join(APP_ROOT, clean), path.join(base, clean)]
      : FOLDERS.map((d) => path.join(APP_ROOT, d, clean));
    if (!candidates.some((c) => fs.existsSync(c))) problems.push(`${f} names ${clean}, which does not exist`);
  }
}

if (text["README.md"] && !text["README.md"].includes(LIVE_URL)) problems.push(`README.md does not link the live site (${LIVE_URL})`);
if (text["README.md"] && !text["README.md"].includes("Fictional company, no client data")) problems.push("README.md does not say \"Fictional company, no client data\"");

for (const p of problems) console.log(`FAIL  ${p}`);
console.log(`${Object.keys(text).length} documents checked${COMPLETE ? " for the release (AC-23)" : ""}: ${cited} cited sections, ${named} named paths, ${problems.length} problem${problems.length === 1 ? "" : "s"}.`);
if (!problems.length) console.log(COMPLETE ? "DOCS COMPLETE" : "DOCS OK");
process.exit(problems.length ? 1 : 0);
