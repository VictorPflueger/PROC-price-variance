// The case stays intact: the engine, the data, the six scripts and the live agent are the files of
// version 1.0.0 (commit 6b40c27), byte for byte, and they give 1.0.0's figures on every decision path.
//   files    SHA-256 of every module, data file and tool the presenter shell builds on; config.js with
//            its version masked, the only line 2.0.0 changes there
//   groups   every comparable group of the world: opportunity, spread, index, benchmark, flagged
//   paths    every script on every path a person can take (js/sim_check.js): outcome, the options'
//            figures, the drafts and the report's heading
// The fixture was written from 1.0.0 with --write and is never rewritten by 2.0.0.
// Usage: node tests/fingerprint.mjs          prints "FINGERPRINT OK" or the differences
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { APP_ROOT } from "./lib/harness.mjs";

const FIXTURE = path.join(APP_ROOT, "tests", "fixtures", "fingerprint-1.0.0.json");
const UNCHANGED = [
  "js/agent.js", "js/anthropic.js", "js/audit.js", "js/clock.js", "js/cost.js", "js/drafts.js", "js/erp.js",
  "js/events.js", "js/exports.js", "js/figures.js", "js/format.js", "js/groups.js", "js/guards.js", "js/keystore.js",
  "js/labels.js", "js/match.js", "js/normalise.js", "js/opendata.js", "js/options.js", "js/params.js", "js/pipeline.js",
  "js/prompt.js", "js/run_facts.js", "js/schema.js", "js/schemas.js", "js/session.js", "js/sim_check.js",
  "js/sim_vars.js", "js/similarity.js", "js/simulation.js", "js/source_health.js", "js/sse.js", "js/summaries.js",
  "js/theme.js", "js/tool_plain.js", "js/tools.js", "js/variance.js", "js/world.js",
  "data/fx.js", "data/reference_cases.js", "data/scenarios.js", "data/sim_runs.js", "data/world.js",
  "tools/build_fx.mjs", "tools/build_world.mjs", "tools/check_world.mjs", "tools/extract_accounts.mjs",
  "tools/source/accounts.json", "tools/source/material_groups.json"
];
const sha = (s) => createHash("sha256").update(s).digest("hex");
const read = (f) => readFileSync(path.join(APP_ROOT, f), "utf8");
const maskVersion = (s) => s.replace(/(\bversion:\s*")[^"]*(")/, "$1…$2");

function files() {
  const out = Object.fromEntries(UNCHANGED.map((f) => [f, sha(read(f))]));
  out["js/config.js (version masked)"] = sha(maskVersion(read("js/config.js")));
  return out;
}

const r2 = (x) => (x === null || x === undefined ? x : Math.round(x * 100) / 100);
const r6 = (x) => (x === null || x === undefined ? x : Math.round(x * 1e6) / 1e6);
// Dates in narration and drafts count from today; the fingerprint keeps what does not move.
const undate = (s) => String(s || "").replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2} [A-Z][a-z]{2}( \d{4})?\b/g, "<date>");

async function figures() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  for (const f of ["fx.js", "world.js", "scenarios.js", "reference_cases.js", "sim_runs.js"]) vm.runInContext(read(`data/${f}`), sandbox);
  const { WORLD, FX, SCENARIOS, SIM_RUNS } = sandbox.window;
  const { scanWorld } = await import("../js/world.js");
  const { DEFAULTS } = await import("../js/params.js");
  const { playPath } = await import("../js/sim_check.js");
  const groups = scanWorld(WORLD, FX).rows.map((r) => ({
    id: r.id, flagged: r.flagged, lines: r.lines, opportunity: r2(r.opportunity), spread: r6(r.spread), index: r6(r.index), benchmark: r6(r.benchmark)
  }));
  const OPTION_PLANS = ["recommended", "other:0", "other:1", "reject-then-approve", "reject-all-then-accept", "accept"];
  const CONFIRM_PLANS = ["confirmed", "confirmed:other-unit", "split:0", "split:1", "split:2", "split:3", "rejected"];
  const paths = {};
  for (const sc of SCENARIOS) {
    const def = SIM_RUNS[sc.id];
    const confirms = JSON.stringify(def.steps).includes("\"confirm\"") ? CONFIRM_PLANS : [null];
    for (const confirm of confirms) {
      for (const option of OPTION_PLANS) {
        const r = await playPath(WORLD, FX, DEFAULTS, def, { confirm, option });
        const ev = (t) => r.events.filter((e) => e.type === t).map((e) => e.payload);
        const opts = ev("options").at(-1);
        paths[`${sc.id} ${confirm || "-"} ${option}`] = {
          errors: r.errors.length, skipped: r.skipped, outcome: r.outcome || null,
          options: opts ? opts.options.map((o) => [o.id, r2(o.savings), r2(o.one_off), r2(o.net), o.days_to_first_saving ?? null, r2(o.residual)]) : null,
          recommended: opts ? opts.recommended : null,
          decided: ev("option_decision").map((d) => `${d.option_id}:${d.decision}`),
          drafts: ev("action_draft").map((d) => `${d.type}: ${undate(d.subject)}`),
          alerts: ev("alert").map((a) => undate(a.title)),
          report: (ev("report").at(-1)?.markdown || "").split("\n")[0]
        };
      }
    }
  }
  return { groups, paths };
}

const now = { files: files(), ...(await figures()) };
if (process.argv.includes("--write")) {
  writeFileSync(FIXTURE, `${JSON.stringify(now, null, 1)}\n`);
  console.log(`Wrote ${path.relative(APP_ROOT, FIXTURE)}: ${Object.keys(now.files).length} files, ${now.groups.length} groups, ${Object.keys(now.paths).length} paths.`);
  process.exit(0);
}

const then = JSON.parse(read("tests/fixtures/fingerprint-1.0.0.json"));
const diffs = [];
for (const [f, h] of Object.entries(then.files)) if (now.files[f] !== h) diffs.push(`file changed or missing: ${f}`);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
if (!same(now.groups, then.groups)) {
  for (const g of then.groups) {
    const n = now.groups.find((x) => x.id === g.id);
    if (!same(n, g)) diffs.push(`group ${g.id}: ${JSON.stringify(n)} is not ${JSON.stringify(g)}`);
  }
  if (now.groups.length !== then.groups.length) diffs.push(`${now.groups.length} groups, 1.0.0 had ${then.groups.length}`);
}
for (const [k, v] of Object.entries(then.paths)) if (!same(now.paths[k], v)) diffs.push(`path ${k}: ${JSON.stringify(now.paths[k])} is not ${JSON.stringify(v)}`);
const errors = Object.entries(now.paths).filter(([, v]) => v.errors).map(([k]) => k);
if (errors.length) diffs.push(`script errors on ${errors.join(", ")}`);

if (diffs.length) {
  console.log(`FAIL: ${diffs.length} difference(s) from 1.0.0`);
  for (const d of diffs.slice(0, 30)) console.log(`  - ${d}`);
  process.exit(1);
}
console.log(`${Object.keys(then.files).length} files byte-identical to 1.0.0, ${then.groups.length} groups and ${Object.keys(then.paths).length} decision paths with 1.0.0's figures.`);
console.log("FINGERPRINT OK");
