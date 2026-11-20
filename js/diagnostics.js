// Diagnostics (brief §4, "Run all tests"): self-tests from the presenter's browser. Network results feed
// the source memory (js/source_health.js), so open_ecb_rate skips a blocked rate host at once and the
// analysis keeps its bundled rates.
//   anthropic    the Claude API: reachability with the browser header, or the key with the free check
//   frankfurter  the ECB reference rates through Frankfurter (the only open-data host)
//   golden       the engine's golden cases G1 to G5 and the figure audit F01 to F16 (brief §11), in the page
//   scripts      every simulation script on every path under the live guardrails (js/sim_check.js)
//   privacy      the security policy equals js/config.js; the key only in this tab's session storage

import { ANTHROPIC, OPEN_DATA, APP, STORAGE } from "./config.js";
import { checkKey, probeEndpoint, networkMessage } from "./anthropic.js";
import { getKey, redactSecrets } from "./keystore.js";
import { buildAuditExport } from "./audit.js";
import { remember, memory as sourceMemory } from "./source_health.js";
import { checkSimRuns } from "./sim_check.js";
import { GOLDEN } from "./golden_data.js";
import { analyseGroup } from "./variance.js";
import { realisedValue } from "./pipeline.js";
import { KnownFigures, auditText } from "./figures.js";
import { DEFAULTS } from "./params.js";
import { eur, unitPrice, pct } from "./format.js";

export const TESTS = [
  { id: "anthropic", label: "Anthropic API", host: "api.anthropic.com", purpose: "The live agent (Claude)" },
  { id: "frankfurter", label: OPEN_DATA.frankfurter.label, host: "api.frankfurter.dev", purpose: "Today's ECB reference rate for a labelled sensitivity" },
  { id: "golden", label: "Golden cases", host: "local", purpose: "The engine and the figure audit against the brief's fixtures (G1 to G5, F01 to F16)" },
  { id: "scripts", label: "Simulation scripts", host: "local", purpose: "The six scripts on every path under the live guardrails" },
  { id: "privacy", label: "Key and privacy", host: "local", purpose: "The security policy, the key kept in this tab only and never exported" }
];

// The only hosts the page may connect to (the policy meta tag in index.html must match).
const ALLOWED_CONNECT = [new URL(ANTHROPIC.messagesUrl).origin, OPEN_DATA.frankfurter.origin];
const KEY_LIKE = /sk-ant-(?!\[REDACTED\])[A-Za-z0-9_-]{8,}/;

export function memory() {
  return sourceMemory();
}

async function fetchJson(url, validate, describe, timeoutMs = 10000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = performance.now();
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store", credentials: "omit", headers: { accept: "application/json" } });
    const ms = Math.round(performance.now() - started);
    if (!res.ok) return { status: "fail", ms, detail: `HTTP ${res.status}` };
    const json = await res.json();
    if (!validate(json)) return { status: "warn", ms, detail: "Reachable, but the response format was unexpected." };
    return { status: "pass", ms, detail: describe(json) };
  } catch (e) {
    return { status: "fail", ms: null, detail: networkMessage(e) };
  } finally {
    clearTimeout(timer);
  }
}

/** The golden cases in the page: the same fixtures and expected values as tests/engine.mjs and tests/audit.mjs. */
export function goldenChecks() {
  const checks = [];
  const near = (name, got, want) => checks.push({ name, ok: Math.abs(got - (Array.isArray(want) ? want[0] / want[1] : want)) <= 1e-9, detail: `${got}` });
  const same = (name, got, want) => checks.push({ name, ok: got === want, detail: String(got) });
  const m = GOLDEN.m100;
  const ctx = { rates: m.rates, params: DEFAULTS, plants: Object.fromEntries(m.plants.map((p) => [p.id, p])), suppliers: Object.fromEntries(m.suppliers.map((s) => [s.id, s])) };
  const mat = m.materials[0];
  const a = analyseGroup({ id: mat.id, kind: "material", base_unit: mat.base_unit, display_quantity: mat.display_quantity, units: { [mat.id]: mat }, lines: m.po_lines }, ctx);
  const E = m.expected;
  for (const [id, x] of Object.entries(E.G1.lines)) {
    const l = a.lines.find((y) => y.id === id);
    near(`G1 ${id} normalised price`, l?.price ?? NaN, x.price);
    same(`G1 ${id} display`, l ? unitPrice(l.price, a.display_quantity, a.base_unit) : "", x.display);
    near(`G1 ${id} unexplained`, l?.unexplained ?? NaN, x.unexplained);
  }
  same("G1 P7 excluded with its reason", a.excluded.find((e) => e.id === "P7")?.reason || "", "no conversion from PAL to EA");
  near("G3 opportunity", a.opportunity, 1738.8);
  same("G3 opportunity display", eur(a.opportunity), "€1,739");
  same("G3 spread display", pct(a.spread), "42.0%");
  same("G3 not flagged at €5,000 and 5 %", a.flagged, false);
  near("G4 H savings", a.options.H.savings, 1621.5);
  same("G4 H savings less one-off, the half-euro tie", eur(a.options.H.net), "-€779");
  near("G4 B bundle part", a.options.B.bundle, 283.59);
  const g5 = GOLDEN.g5;
  const r = realisedValue(g5.value_log[0], g5.po_lines, () => ({ group: "M-200", ...g5.materials[0] }), { rates: { EUR: 1 }, params: DEFAULTS });
  near("G5 realised to date", r.realised, g5.expected.realised);
  near("G5 missed through leakage", r.missed, g5.expected.missed);
  const A = GOLDEN.audit;
  const known = new KnownFigures();
  for (const v of A.known.amounts) known.addAmount(v);
  for (const p of A.known.prices) known.addPrice(p.value, p.display_quantity, p.unit);
  for (const s of A.known.shares) known.addShare(Array.isArray(s) ? s[0] / s[1] : s);
  for (const q of A.known.quantities) known.addQuantity(q.value, q.unit);
  for (const c of A.known.counts) known.addCount(c);
  for (const id of A.known.ids) known.addId(id);
  for (const c of A.known.codes) known.addCode(c);
  for (const c of A.cases) {
    const got = auditText(c.text, known).offending;
    same(`${c.id} ${c.offending.length ? `fails on ${c.offending.join(", ")}` : "passes"}`, JSON.stringify(got), JSON.stringify(c.offending));
  }
  return checks;
}

const RUNNERS = {
  async anthropic() {
    const key = getKey();
    if (!key) {
      const r = await probeEndpoint();
      return { status: r.ok ? "pass" : "fail", ms: r.ms, detail: r.ok ? `${r.detail} Add your key in Live mode to check it.` : r.detail };
    }
    const r = await checkKey(key);
    if (!r.ok) {
      const msg = r.status === 401 ? "Key rejected (401). Check that it is active and copied completely." : `${r.error?.type || "error"}: ${r.error?.message || ""}`;
      return { status: "fail", ms: r.ms, detail: msg };
    }
    const missing = r.missing.length ? ` Missing for this key: ${r.missing.join(", ")}.` : ` All three ${APP.name} models are available.`;
    return { status: r.missing.length ? "warn" : "pass", ms: r.ms, detail: `Key valid (free check, no tokens used).${missing}` };
  },
  frankfurter: () => fetchJson(OPEN_DATA.frankfurter.probe, (j) => typeof j?.rates?.GBP === "number", (j) => `ECB rate ${j.date}: 1 EUR = ${j.rates.GBP} GBP.`),
  async golden() {
    const started = performance.now();
    const checks = goldenChecks();
    const passed = checks.filter((c) => c.ok).length;
    return { status: passed === checks.length ? "pass" : "fail", ms: Math.round(performance.now() - started), detail: `${passed}/${checks.length} golden-case checks passed.`, checks };
  },
  async scripts() {
    const started = performance.now();
    const r = await checkSimRuns(globalThis.WORLD, globalThis.FX, DEFAULTS, globalThis.SIM_RUNS || {}, globalThis.SCENARIOS || []);
    const passed = r.checks.filter((c) => c.ok).length;
    return { status: passed === r.checks.length && r.checks.length ? "pass" : "fail", ms: Math.round(performance.now() - started), detail: `${passed}/${r.checks.length} scripts valid on ${r.paths} paths.`, checks: r.checks };
  },
  async privacy() {
    const issues = [];
    const notes = [];
    const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute("content") || "";
    const connect = (/connect-src([^;]*)/.exec(csp)?.[1] || "").trim().split(/\s+/).filter(Boolean);
    const extra = connect.filter((x) => !ALLOWED_CONNECT.includes(x));
    const missing = ALLOWED_CONNECT.filter((x) => !connect.includes(x));
    if (!csp || !connect.length) issues.push("no connection policy found");
    else if (extra.length || missing.length) issues.push(`the policy differs from js/config.js (${[...extra.map((x) => `also ${x}`), ...missing.map((x) => `not ${x}`)].join(", ")})`);
    else notes.push(`connections limited to ${connect.join(" and ")}`);
    let inLocal = false;
    try { for (let i = 0; i < localStorage.length; i++) if (KEY_LIKE.test(localStorage.getItem(localStorage.key(i)) || "")) inLocal = true; } catch { /* storage unavailable */ }
    if (inLocal) issues.push("an API key was found in local storage");
    notes.push(getKey() ? `your key is stored for this tab only (${STORAGE.apiKey})` : "no key stored");
    const sample = getKey() || "sk-ant-EXAMPLE-not-a-real-key-0000";
    if (redactSecrets(`x ${sample} y`).includes(sample)) issues.push("key redaction failed");
    if (KEY_LIKE.test(buildAuditExport())) issues.push("the audit export contains a key");
    else notes.push("audit export checked");
    const text = issues.length ? `${issues.join("; ")}.` : `${notes.join("; ")}.`;
    return { status: issues.length ? "fail" : "pass", ms: null, detail: text.charAt(0).toUpperCase() + text.slice(1) };
  }
};

/** Run one test; network results are remembered for the rate tool. */
export async function runTest(id) {
  const fn = RUNNERS[id];
  if (!fn) return { status: "skip", detail: "Unknown test." };
  const r = await fn();
  if (id === "frankfurter") remember(id, r.status, r.detail, "diagnostics");
  return r;
}

/** Run all tests, reporting each result as it arrives. */
export async function runAll(onResult) {
  const results = {};
  await Promise.all(TESTS.map(async (t) => {
    onResult?.(t.id, { status: "running" });
    const r = await runTest(t.id);
    results[t.id] = r;
    onResult?.(t.id, r);
  }));
  return results;
}
