// Vici's own rules, checked with Vici's own functions (Build a prototype, "Check it"): the How it works
// guide and its key figures (guideProblems), the byline (bylineProblems), the Writing guideline's
// checkable patterns (writingProblems) and the AI notice of a page that can start a live run
// (aiNoticeProblems), on the page, on every sentence the presenter writes for the six cases along every
// decision path, and on the docs. Also the page's layout from Vici's brief (SIMULATION or LIVE in the
// header, one sentence and the byline under it) and vici/: every file byte for byte as in ViciDesign at
// the commit vici/README.md and the GitHub Actions workflow name. Node.js only.
//
// Each imported check first fails on a planted control. Prints VICI CONTROLS OK and VICI STANDARDS OK.
// The functions come from a ViciDesign checkout (VICI_DIR, or ../ViciDesign); without one the suite says
// so and passes, unless --require-vici is given or it runs on GitHub Actions.
// Usage: node tests/vici.mjs [--require-vici]
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import vm from "node:vm";
import { pathToFileURL } from "node:url";
import { APP_ROOT, REQUIRE_VICI, viciDir } from "./lib/harness.mjs";

const dir = viciDir();
if (!dir) {
  console.log(`${REQUIRE_VICI ? "FAIL" : "SKIP"}  no ViciDesign checkout in VICI_DIR or next to this repository (../ViciDesign)`);
  process.exit(REQUIRE_VICI ? 1 : 0);
}
const lib = async (file) => import(pathToFileURL(path.join(dir, "scripts", "lib", file)).href);
const { guideProblems } = await lib("guide.mjs");
const { bylineProblems } = await lib("byline.mjs");
const { writingProblems } = await lib("writing.mjs");
const { aiNoticeProblems, canRunLive, AI_NOTICE } = await lib("ai.mjs");

const read = (f) => readFileSync(path.join(APP_ROOT, f), "utf8");
const html = read("index.html");
const page = (paragraphs) => `<html lang="en-GB"><body>${paragraphs.map((t) => `<p>${String(t).replace(/</g, "&lt;")}</p>`).join("")}</body></html>`;
const controls = [];
const standards = [];
const control = (ok, what) => controls.push([!!ok, what]);
const check = (ok, what) => standards.push([!!ok, what]);

// ---- the checks can fail ----------------------------------------------------------------------------
control(guideProblems(html.replace(/<dialog\b[^>]*vc-guide[\s\S]*?<\/dialog>/, "")).length > 0, "control: guideProblems catches a page without the guide");
control(guideProblems(html.replace('<div class="kpis"', '<p class="vc-stat" data-vc-kpi="Orders checked">32</p><div class="kpis"')).some((p) => /Orders checked/.test(p)), "control: guideProblems catches a key figure the How it works chapter never explains");
control(bylineProblems(html.replace(/href="https:\/\/victorpflueger\.github\.io\/VIP\/index\.html"/, 'href="#"')).length > 0, "control: bylineProblems catches a byline without the website link");
control(writingProblems(page(["Lyon pays more — much more."])).length > 0 && writingProblems(page(["A seamless decision."])).length > 0, "control: writingProblems catches an em dash and a stock word");
control(aiNoticeProblems(html.split(AI_NOTICE.en).join("An assistant")).length > 0 && !aiNoticeProblems('<meta http-equiv="Content-Security-Policy" content="connect-src \'none\'"><p>Replay</p>').length, "control: aiNoticeProblems catches a live page that never says it is an AI, and leaves a page that cannot run live alone");

// ---- the page ---------------------------------------------------------------------------------------
const g = guideProblems(html);
check(!g.length, `the guide follows Vici's standard, a row in How it works for each key figure included${g.length ? `: ${g.join("; ")}` : ""}`);
check(/<h2 class="vc-dialog__title" id="guide-title">How the prototype works<\/h2>/.test(html), "the guide is titled How the prototype works");
const kpis = [...html.matchAll(/\bdata-vc-kpi="([^"]+)"/g)].map((m) => m[1]);
check(kpis.join("|") === "Unexplained a year|Highest vs best price|Tip → decision|Session cost", `the header marks its four key figures (${kpis.join(", ")})`);
const b = bylineProblems(html);
check(!b.length, `the byline follows Vici's standard${b.length ? `: ${b.join("; ")}` : ""}`);
const w = writingProblems(html);
check(!w.length, `index.html keeps Vici's writing rules${w.length ? `: ${w.join("; ")}` : ""}`);
const a = aiNoticeProblems(html);
check(canRunLive(html) && !a.length, `the page can start a live run and says "${AI_NOTICE.en}"${a.length ? `: ${a.join("; ")}` : ""}`);
// Beside the control that starts a live run, in a lilac tag: Start agent, and the live card's own start.
const tag = `<span class="vc-tag vc-tag--feature ai-notice"><span class="vc-icon vc-icon--sparkle" aria-hidden="true"></span>${AI_NOTICE.en}</span>`;
check(new RegExp(`id="start" data-vc-live>[\\s\\S]{0,160}</button>\\s*${tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(html), "the AI notice stands in a lilac tag right beside Start agent, which can start a live run");
check(/<section class="start-card start-card--live"[\s\S]*?vc-tag--feature ai-notice-full[\s\S]*?You are interacting with an AI system[\s\S]*?id="live-start" data-vc-live/.test(html), "the live card says it too, in a lilac tag above its key and its start button");
check(/<html lang="en-GB">/.test(html), 'the page is marked lang="en-GB"');
const header = (html.match(/<header class="app-header">[\s\S]*?<\/header>/) || [""])[0];
check(/<span class="vc-tag vc-tag--lg mode-tag"[^>]*><span id="mode-text">SIMULATION<\/span><\/span>/.test(header) && /"LIVE"/.test(read("js/app.js")), "the header says SIMULATION, or LIVE during a live run, in capitals");
const strip = (html.match(/<\/header>\s*<div class="intro">([\s\S]*?)<\/div>\s*<nav/) || [])[1] || "";
check(/<p class="intro-text">[^<]{40,180}fictional[^<]*<\/p>/.test(strip) && /class="vc-byline"/.test(strip), "one sentence under the header says what the prototype does and that its data is fictional, beside the byline");
check((html.match(/class="vc-byline"/g) || []).length === 1, "the page carries one byline");

// ---- every sentence the presenter writes, for the six cases along every decision path ----------------
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const f of ["fx.js", "world.js", "scenarios.js", "sim_runs.js"]) vm.runInContext(read(`data/${f}`), sandbox);
const { WORLD, FX, SCENARIOS, SIM_RUNS } = sandbox.window;
const { DEFAULTS } = await import("../js/params.js");
const { playPath } = await import("../js/sim_check.js");
const { playHeadless } = await import("../js/estimate.js");
const { digest } = await import("../js/run.js");
const { story } = await import("../js/story.js");
const said = new Set();
const collect = (v) => {
  if (typeof v === "string") { if (/[a-z]/i.test(v)) said.add(v); return; }
  if (Array.isArray(v)) return v.forEach(collect);
  if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (!["id", "kind", "at", "reasons"].includes(k)) collect(x);
};
const FORBIDDEN = [[/\b\d{4} \/ \d{5}\b/, "a pair id"], [/\bper (100 |1,000 )?(EA|PD|H)\b/, "a unit code"], [/\b4500\d{6}-\d{5}\b/, "a line number"], [/\b(CL|CAND)-\d+\b/, "a cluster id"], [/\b[Oo]ption [HRB]\b/, "an option letter"], [/\{\{|\}\}/, "an unfilled placeholder"]];
const OPTION_PLANS = ["recommended", "other:0", "other:1", "reject-then-approve", "reject-all-then-accept", "accept"];
const CONFIRM_PLANS = ["confirmed", "confirmed:other-unit", "split:0", "rejected"];
let paths = 0;
for (const sc of SCENARIOS) {
  const def = SIM_RUNS[sc.id];
  collect([sc.title, sc.seed]);
  const runs = [{ events: await playHeadless({ world: WORLD, fx: FX, params: DEFAULTS, def }) }];
  const confirms = JSON.stringify(def.steps).includes("\"confirm\"") ? CONFIRM_PLANS : [null];
  for (const confirm of confirms) for (const option of OPTION_PLANS) runs.push(await playPath(WORLD, FX, DEFAULTS, def, { confirm, option }));
  for (const r of runs) {
    paths += 1;
    // Every stage of the run: before the decision, after it, after each draft.
    const cut = [r.events.findIndex((e) => e.type === "option_decision"), r.events.length].filter((i) => i > 0);
    for (const n of cut) {
      const v = story({ world: WORLD, scenario: sc, run: digest(r.events.slice(0, n)), params: DEFAULTS });
      collect(v.steps.map(({ label, title, lead, agent, recommendation, stage }) => ({ label, title, lead, agent, recommendation, stage })));
      collect([v.kpis, v.log.map((l) => l.what)]);
    }
  }
}
const sentences = [...said];
const written = writingProblems(page(sentences));
check(sentences.length > 200 && !written.length, `the ${sentences.length} sentences, labels and figures the presenter writes on ${paths} runs of the six cases keep the writing rules${written.length ? `: ${written.join("; ")}` : ""}`);
for (const [re, what] of FORBIDDEN) {
  const hit = sentences.find((t) => re.test(t));
  check(!hit, `no sentence on any path shows ${what}${hit ? `: "${hit.slice(0, 120)}"` : ""}`);
}
// The words the modules write themselves: every string and template in the presenter's modules.
const literals = ["js/app.js", "js/view.js", "js/story.js", "js/plain.js", "js/live.js", "js/main.js"].flatMap((f) => [...read(f).replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, "").matchAll(/"((?:[^"\\\n]|\\.){12,})"|`((?:[^`\\\n]|\\.){12,})`/g)]
  .map((m) => (m[1] || m[2]).replace(/\$\{[^}]*\}/g, "x").replace(/\\n/g, " ").replace(/\\(.)/g, "$1")).filter((t) => / [a-z]/.test(t) && !/^[\w.-]+$/.test(t)));
const own = writingProblems(page(literals));
check(literals.length > 40 && !own.length, `the presenter's modules keep the writing rules in their ${literals.length} strings${own.length ? `: ${own.join("; ")}` : ""}`);

// ---- the docs, as text --------------------------------------------------------------------------------
for (const doc of ["README.md", "DEMO_SCRIPT.md", "DESIGN.md", "DATA_SOURCES.md", "tests/README.md"]) {
  const there = existsSync(path.join(APP_ROOT, doc));
  const p = there ? writingProblems(page([read(doc).replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "")])) : ["missing"];
  check(!p.length, `${doc} keeps the writing rules${p.length ? `: ${p.join("; ")}` : ""}`);
}

// ---- vici/: Vici's files, unchanged, at the commit the README and the workflow name -------------------
const pin = (read("vici/README.md").match(/commit \*\*`([0-9a-f]{7,40})`\*\*/) || [])[1];
const ref = (read(".github/workflows/tests.yml").match(/repository: VictorPflueger\/ViciDesign\s+ref: ([0-9a-f]{7,40})/) || [])[1];
check(pin && ref && ref.startsWith(pin), `vici/README.md and the workflow name the same ViciDesign commit (${pin} and ${ref})`);
let head = null;
try { head = execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch { /* not a git checkout */ }
check(!head || !pin || head.startsWith(pin), `the ViciDesign checkout is at that commit (${head ? head.slice(0, 7) : "not a git checkout"})`);
const files = [];
const walk = (d) => { for (const f of readdirSync(path.join(APP_ROOT, d))) { const p = `${d}/${f}`; if (statSync(path.join(APP_ROOT, p)).isDirectory()) walk(p); else files.push(p); } };
walk("vici");
const ours = files.filter((f) => f !== "vici/README.md");
const differ = ours.filter((f) => { const there = path.join(dir, f.slice("vici/".length)); return !existsSync(there) || !readFileSync(there).equals(readFileSync(path.join(APP_ROOT, f))); });
check(ours.length >= 18 && !differ.length, `the ${ours.length} files in vici/ equal ViciDesign's byte for byte${differ.length ? `: ${differ.join(", ")} differ` : ""}`);
const listed = [...read("vici/README.md").matchAll(/^\| `([^`]+)` \|/gm)].map((m) => m[1]);
const unlisted = ours.filter((f) => !listed.some((l) => (l.includes("*") ? new RegExp(`^${l.replace(/[.]/g, "\\.").replace(/\*/g, "[^/]*")}$`).test(f.slice(5)) : f.slice(5) === l)));
check(!unlisted.length, `vici/README.md lists every file it holds${unlisted.length ? `: ${unlisted.join(", ")} missing` : ""}`);

let failed = 0;
const report = (results, token) => {
  const f = results.filter(([ok]) => !ok).length;
  for (const [ok, what] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  failed += f;
  return f ? null : token;
};
const tokens = [report(controls, "VICI CONTROLS OK"), report(standards, "VICI STANDARDS OK")].filter(Boolean);
console.log(`(Vici's checks from ${dir})`);
if (failed) { console.log(`\n${failed} checks failed.`); process.exit(1); }
console.log(`\nAll ${controls.length + standards.length} checks passed.\n${tokens.join("\n")}\nVICI OK`);
