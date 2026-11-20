// Runs every check in order and prints a summary. The app itself needs none of this.
// Usage: node tests/run-all.mjs                  (all suites)
//        node tests/run-all.mjs unit showcase   (only the named suites)
//        node tests/run-all.mjs --require-vici  (Vici's checks must run: no ViciDesign checkout fails)
import { spawnSync } from "node:child_process";
import path from "node:path";
import { APP_ROOT } from "./lib/harness.mjs";

const SUITES = [
  { id: "tokens", what: "colour system on Vici's tokens, light and dark: contrast, colour-blind separation", file: "tests/tokens.mjs", browser: false },
  { id: "page-icon", what: "page icon: favicon, header and loading screen, as on the website's card", file: "tests/page-icon.mjs", browser: false },
  { id: "fingerprint", what: "the case intact: engine, tools, agent, data and scripts byte for byte 1.0.0's, with 1.0.0's figures on every path", file: "tests/fingerprint.mjs", browser: false },
  { id: "world", what: "the world, the six scenarios and their frozen figures, every script on every path", file: "tools/check_world.mjs", browser: false },
  { id: "unit", what: "streaming client, cost maths, display, schema validator, the security policy, the exports, Play's pace and the person's turn", file: "tests/unit.mjs", browser: false },
  { id: "engine", what: "golden cases G1 to G5, normalisation, display rules, the guardrails call by call", file: "tests/engine.mjs", browser: false },
  { id: "audit", what: "the figure audit: F01 to F16 and the rules around them", file: "tests/audit.mjs", browser: false },
  { id: "hygiene", what: "no private term and no e-mail address in any published file", file: "tests/hygiene.mjs", browser: false },
  { id: "vici", what: "Vici's own checks: guide, byline, writing, AI notice; every sentence of six cases on every path; vici/ byte for byte", file: "tests/vici.mjs", browser: false, vici: true },
  { id: "lean", what: "the limits: modules, lines, one stylesheet, two network modules, the policy, the docs' length", file: "tests/lean.mjs", browser: false },
  { id: "docs", what: "the docs say what the page and the engine say: paths, talk track, figures", file: "tests/docs.mjs", browser: false },
  { id: "showcase", what: "the presenter in Chromium: Play and Your turn, steps, key figures, decisions, six cases, the guide (with Vici's render check), layout at three sizes in both themes", file: "tests/showcase.mjs", browser: true, vici: true },
  { id: "hexagon", what: "nothing round: the app's files, and the rendered app in both themes", file: "tests/hexagon.mjs", browser: true },
  { id: "live", what: "a live run against a stand-in API: Start agent, LIVE and the AI notice, steps unlocking, decisions, cost measured, the key, Stop, the caps, offline", file: "tests/live.mjs", browser: true }
];

const REQUIRE = process.argv.includes("--require-vici");
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const chosen = SUITES.filter((s) => !only.length || only.includes(s.id));
const summary = [];
// In GitHub Actions a failed suite also becomes an annotation with its FAIL lines, readable in the
// run's summary and through the API without the full log.
const CI = process.env.GITHUB_ACTIONS === "true";
const annotate = (s, out) => {
  // Each FAIL line with the indented detail lines under it; otherwise the last lines of the output.
  const lines = out.split("\n").filter((l) => l.trim());
  const picked = [];
  lines.forEach((l, i) => {
    if (!/^(FAIL|Error|AssertionError|TypeError)|failed|exceeded/i.test(l.trim())) return;
    picked.push(l.trim());
    for (let j = i + 1; j < lines.length && /^\s+(-|at |\S)/.test(lines[j]) && j <= i + 8; j++) picked.push(lines[j].trim());
  });
  const text = (picked.length ? picked : lines.slice(-12).map((l) => l.trim())).join(" ⏎ ").slice(0, 6000);
  console.log(`::error title=${s.id} suite failed::${text}`);
};
for (const s of chosen) {
  console.log(`\n=== ${s.id}: ${s.what} ===`);
  const started = Date.now();
  const r = spawnSync(process.execPath, [path.join(APP_ROOT, s.file), ...(s.args || []), ...(s.vici && REQUIRE ? ["--require-vici"] : [])], { cwd: APP_ROOT, stdio: CI ? ["inherit", "pipe", "pipe"] : "inherit", env: process.env, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (CI) {
    process.stdout.write(r.stdout || "");
    process.stderr.write(r.stderr || "");
    if (r.status !== 0 && !(s.optional && r.status === 2)) annotate(s, `${r.stdout || ""}\n${r.stderr || ""}`);
  }
  // An optional suite without what it needs exits 2: skipped.
  if (s.optional && r.status === 2) {
    summary.push({ ...s, ok: true, skipped: true, code: r.status, seconds: Math.round((Date.now() - started) / 1000) });
    continue;
  }
  summary.push({ ...s, ok: r.status === 0, code: r.status, seconds: Math.round((Date.now() - started) / 1000) });
  if (r.status === 2 && s.browser) {
    console.log("Playwright is missing; browser suites are skipped. See tests/README.md.");
    break;
  }
}

console.log("\n=== Summary ===");
for (const s of summary) console.log(`${s.skipped ? "SKIP" : s.ok ? "PASS" : "FAIL"}  ${s.id.padEnd(10)} ${String(s.seconds).padStart(4)} s  ${s.what}`);
const skipped = chosen.length - summary.length;
if (skipped) console.log(`(${skipped} suite${skipped === 1 ? "" : "s"} not run)`);
const allPassed = summary.length === chosen.length && summary.every((s) => s.ok);
// The success line names a run of every suite, none skipped (a partial run or a skipped suite says so above).
if (allPassed && !only.length && summary.every((s) => !s.skipped)) console.log(`ALL SUITES PASSED (${summary.length} of ${SUITES.length})`);
process.exit(allPassed ? 0 : 1);
