// The documents say what the page and the engine say. Node.js only.
//   paths    every repository path a document names (in backticks or as a relative link) exists
//   readme   README.md links the live site, says what is real and what is simulated, and names the four
//            key figures and the five steps as the page does
//   script   DEMO_SCRIPT.md walks the guide's talk track: the same five steps in the same order, each
//            with its minutes, and the same sentence to say, figure for figure
//   figures  every euro amount and percentage in README.md and DEMO_SCRIPT.md is one the engine
//            computes for the six cases (the cost cap aside), and the guide's own figures in index.html
//            are the gloves case's
// Each rule is first tried on a planted example that must break it. Prints DOCS OK.
// Usage: node tests/docs.mjs
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { APP_ROOT } from "./lib/harness.mjs";

const LIVE_URL = "https://victorpflueger.github.io/PROC-price-variance/";
const DOCS = ["README.md", "DEMO_SCRIPT.md", "DESIGN.md", "DATA_SOURCES.md", "tests/README.md", "vici/README.md"];
const KPIS = ["Unexplained a year", "Highest vs best price", "Tip → decision", "Session cost"];
const STEPS = ["The tip", "Like for like", "The gap", "Your decision", "The drafts"];
const ALLOWED = new Set(["€3", "€3.00"]); // the live run's cost cap, a setting rather than a result
const results = [];
const check = (ok, what) => results.push([!!ok, what]);
const read = (f) => readFileSync(path.join(APP_ROOT, f), "utf8");
const text = (html) => html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const norm = (s) => s.replace(/[  ]/g, " ");

// ---- what the engine computes for the six cases ---------------------------------------------------------
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const f of ["fx.js", "world.js", "scenarios.js", "sim_runs.js"]) vm.runInContext(read(`data/${f}`), sandbox);
const { WORLD, FX, SCENARIOS, SIM_RUNS } = sandbox.window;
const { DEFAULTS } = await import("../js/params.js");
const { MODELS } = await import("../js/config.js");
const { playHeadless, estimateCost } = await import("../js/estimate.js");
const { digest } = await import("../js/run.js");
const { story } = await import("../js/story.js");
const { analyseWorld, ratesOf } = await import("../js/world.js");
const { money, pct } = await import("../js/plain.js");
const known = new Set();
const harvest = (v) => {
  if (typeof v === "string") { for (const m of norm(v).matchAll(/[+−-]?€\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d)? %/g)) known.add(m[0].replace(/^[+−-]/, "")); return; }
  if (Array.isArray(v)) return v.forEach(harvest);
  if (v && typeof v === "object") Object.values(v).forEach(harvest);
};
const views = {};
for (const sc of SCENARIOS) {
  const events = await playHeadless({ world: WORLD, fx: FX, params: DEFAULTS, def: SIM_RUNS[sc.id] });
  const decided = story({ world: WORLD, scenario: sc, run: digest(events), params: DEFAULTS });
  const before = story({ world: WORLD, scenario: sc, run: digest(events.filter((e) => e.type !== "option_decision")), params: DEFAULTS });
  views[sc.id] = decided;
  harvest([decided.steps, decided.kpis, before.steps, before.kpis]);
  for (const m of MODELS) known.add(money(estimateCost({ events, world: WORLD, fx: FX, params: DEFAULTS, scenario: sc, modelId: m.id }).eur));
}
for (const a of analyseWorld(WORLD, ratesOf(FX)).analyses) {
  known.add(`€${Math.round(a.opportunity).toLocaleString("en-GB")}`);
  known.add(norm(pct(a.spread)));
  for (const o of Object.values(a.options || {})) for (const x of [o.savings, o.one_off, o.residual]) if (Number.isFinite(x)) known.add(`€${Math.round(x).toLocaleString("en-GB")}`);
}
for (const p of Object.values(DEFAULTS)) if (typeof p === "number" && p < 1) known.add(norm(pct(p)));
for (const [k, v] of Object.entries(DEFAULTS)) if (/_eur$/.test(k)) known.add(`€${Math.round(v).toLocaleString("en-GB")}`);
const unknown = (doc) => [...norm(doc).replace(/```[\s\S]*?```/g, "").matchAll(/€\d{1,3}(?:,\d{3})*(?:\.\d+)?|\b\d+(?:\.\d)? %/g)].map((m) => m[0]).filter((f) => !known.has(f) && !ALLOWED.has(f));

// ---- the rules catch what they are for ----------------------------------------------------------------
check(unknown("Lyon pays €9.80 against €6.90: €99,999 a year.").join() === "€99,999", "control: a euro amount the engine never computes is caught, and its own figures pass");
const say = (doc) => [...doc.matchAll(/^\d\.\s+\*\*(.+?)\*\*.*?\((\d+) min\)\s*\n\s*>?\s*“(.+?)”/gm)].map((m) => ({ step: m[1].replace(/[.:].*$/, "").trim(), min: Number(m[2]), say: norm(m[3]) }));
check(say("1. **The tip.** Point at the figures. (1 min)\n   “Say this.”").length === 1 && say("1. The tip (1 min)").length === 0, "control: the demo script's steps are read as the guide's: name, minutes, sentence");

// ---- paths -------------------------------------------------------------------------------------------------
for (const doc of DOCS) {
  if (!existsSync(path.join(APP_ROOT, doc))) { check(false, `${doc} exists`); continue; }
  const body = read(doc).replace(/```[\s\S]*?```/g, "");
  const named = [...body.matchAll(/`((?:js|css|data|tests|tools|vici|\.github)\/[^`\s]+|[A-Z_]+\.md|index\.html|favicon\.svg)`/g), ...body.matchAll(/\]\((?!https?:|#|mailto:)([^)\s#]+)/g)].map((m) => m[1]);
  const base = path.dirname(path.join(APP_ROOT, doc));
  const missing = [...new Set(named)].filter((p) => !p.includes("*") && !existsSync(path.join(p.startsWith(".") || doc.includes("/") ? base : APP_ROOT, p)) && !existsSync(path.join(APP_ROOT, p)));
  check(!missing.length, `${doc}: every path it names exists${missing.length ? ` (missing: ${missing.join(", ")})` : ""}`);
}

// ---- README ------------------------------------------------------------------------------------------------
const readme = norm(read("README.md"));
check(readme.includes(LIVE_URL), "README.md links the live site");
check(/fictional/i.test(readme) && /## What is real/.test(readme) && /simulat/i.test(readme), "README.md says what is real and what is simulated");
check(KPIS.every((k) => readme.includes(k)) && STEPS.every((s) => readme.includes(s)), "README.md names the four key figures and the five steps as the page does");

// ---- the demo script walks the guide's talk track ----------------------------------------------------------
const html = read("index.html");
const guide = [...(html.match(/<ol class="vc-guide__path">([\s\S]*?)<\/ol>/) || [, ""])[1].matchAll(/<li><strong>([\s\S]*?)<\/strong>\s*<span class="vc-guide__say">([\s\S]*?)<\/span>\s*<span class="vc-guide__time">(\d+) min<\/span><\/li>/g)]
  .map((m) => ({ step: text(m[1]).replace(/[.:].*$/, "").trim(), min: Number(m[3]), say: norm(text(m[2])).replace(/^“|”$/g, "") }));
const script = say(read("DEMO_SCRIPT.md"));
check(guide.length === 5 && guide.map((g) => g.step).join("|") === STEPS.join("|"), `the guide's talk track has the page's five steps (${guide.map((g) => g.step).join(", ")})`);
check(script.map((s) => s.step).join("|") === guide.map((g) => g.step).join("|") && script.every((s, i) => s.min === guide[i].min), `DEMO_SCRIPT.md walks the same steps with the same minutes (${script.map((s) => `${s.step} ${s.min}`).join(", ")})`);
const differ = script.filter((s, i) => s.say !== guide[i]?.say).map((s) => s.step);
check(script.length === 5 && !differ.length, `DEMO_SCRIPT.md says the guide's sentence at every step${differ.length ? ` (differs at ${differ.join(", ")})` : ""}`);

// ---- figures -----------------------------------------------------------------------------------------------
for (const doc of ["README.md", "DEMO_SCRIPT.md"]) {
  const u = unknown(read(doc));
  check(!u.length, `${doc}: every euro amount and percentage is the engine's${u.length ? ` (not computed: ${[...new Set(u)].join(", ")})` : ""}`);
}
const gloves = views["SC-GLOVES"];
const figs = Object.fromEntries([...html.matchAll(/<span data-fig="([^"]+)">([^<]*)<\/span>/g)].map((m) => [m[1], norm(m[2])]));
check(figs.unexplained === gloves.kpis.unexplained.value && figs.left === gloves.kpis.unexplained.after && norm(figs.spread) === norm(gloves.kpis.highest.value), `the guide's key figures in index.html are the gloves case's (${figs.unexplained}, ${figs.left}, ${figs.spread})`);
const guideFigs = Object.entries(figs).filter(([, v]) => /€|%/.test(v)).filter(([, v]) => !known.has(norm(v).replace(/^[+−-]/, "")));
check(!guideFigs.length, `every euro amount the guide shows before the page fills it in is the engine's${guideFigs.length ? ` (${guideFigs.map(([k, v]) => `${k} ${v}`).join(", ")})` : ""}`);

const failed = results.filter(([ok]) => !ok);
for (const [ok, what] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
if (failed.length) { console.log(`\n${failed.length} of ${results.length} checks failed.`); process.exit(1); }
console.log(`\nAll ${results.length} checks passed.\nDOCS OK`);
