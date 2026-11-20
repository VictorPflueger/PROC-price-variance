// The engine against the brief's golden cases and the method's rules (brief §6 and §11):
//   G1    every line's normalised price, display, gap, justified and unexplained part; P7 excluded;
//         section 10's normalisation of P5, field for field
//   G2    the pairs: quantity, price, share; the cheapest pair, which the 10 % floor keeps out
//   G3    the group's totals, benchmark, spread, index and materiality, with every display string
//   G4    the options H, R, B and accepting the variance, with H's moved plants and share, R's
//         suppliers, B's bundle part, and the signs (the small fixture's options do not pay)
//   G4b   H "not applicable" when the benchmark supplier delivers to no plant above it (PLAN.md B5)
//   G5    realised value, leakage and the four stages; the window boundaries (PLAN.md B7)
//   N     normalisation: price units, the person-day, missing conversions, a currency without a rate,
//         every Incoterms 2020 rule, and every unit conversion and currency of the world
//   D     display rules: rounding to 1e-9 before Intl, the half-euro tie, unit prices per EA
//   GR    the guardrail policy (js/guards.js) and the toolbox's refusals in Node: verified alert, one group
//         per comparison, confirmed clusters only, options from the latest comparison, decisions once per
//         set, drafts by decision, report outcome, figure scopes, schema checks
//   S     the script checker (js/sim_check.js): the six scripts pass on every path (positive control), and
//         each planted fault is caught (negative controls, AC-13)
// Raw values must lie within 1e-9 of the exact values; display strings must match exactly.
// Usage: node tests/engine.mjs            (all groups)
//        node tests/engine.mjs G1 G2 G3   (only these groups)
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { APP_ROOT, ONLY } from "./lib/harness.mjs";
import { DEFAULTS, withParams } from "../js/params.js";
import { normaliseLine, METHOD_VERSION, INCOTERM_GROUPS } from "../js/normalise.js";
import { analyseGroup } from "../js/variance.js";
import { realisedValue, valuePipeline } from "../js/pipeline.js";
import { eur, unitPrice, pct, qty } from "../js/format.js";

const GROUPS = ["G1", "G2", "G3", "G4", "G4b", "G5", "N", "D", "GR", "S"];
const chosen = ONLY.length ? ONLY : GROUPS;
const unknown = chosen.filter((g) => !GROUPS.includes(g));
if (unknown.length) { console.error(`Unknown group(s): ${unknown.join(", ")}. Groups: ${GROUPS.join(", ")}`); process.exit(2); }

const fixture = (f) => JSON.parse(readFileSync(path.join(APP_ROOT, "tests", "fixtures", f), "utf8"));
const frac = (v) => (Array.isArray(v) ? v[0] / v[1] : v);
let checks = 0;
const failures = [];
const near = (group, what, got, want) => {
  checks += 1;
  const ok = typeof got === "number" && Number.isFinite(got) && Math.abs(got - frac(want)) <= 1e-9;
  if (!ok) failures.push(`${group} ${what}: got ${got}, expected ${frac(want)}`);
};
const same = (group, what, got, want) => {
  checks += 1;
  if (JSON.stringify(got) !== JSON.stringify(want)) failures.push(`${group} ${what}: got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
};

/** The engine's context for a fixture: rates, plants, suppliers and parameters. */
function contextOf(fx, params = DEFAULTS) {
  return {
    rates: fx.rates || { EUR: 1 },
    params,
    plants: Object.fromEntries((fx.plants || []).map((p) => [p.id, p])),
    suppliers: Object.fromEntries((fx.suppliers || []).map((s) => [s.id, s]))
  };
}
/** A material group of a fixture. */
function materialGroup(fx, materialId, lines) {
  const m = fx.materials.find((x) => x.id === materialId);
  return { id: m.id, kind: "material", base_unit: m.base_unit, display_quantity: m.display_quantity, units: { [m.id]: m }, lines };
}

// ---- M-100: G1 to G4 -------------------------------------------------------------------------------
const m100 = fixture("m100.json");
const ctx100 = contextOf(m100);
const a100 = analyseGroup(materialGroup(m100, "M-100", m100.po_lines), ctx100);
const lineOf = (a, id) => a.lines.find((l) => l.id === id);
const pairOf = (a, id) => a.pairs.find((p) => p.id === id);

if (chosen.includes("G1")) {
  const E = m100.expected.G1;
  for (const [id, e] of Object.entries(E.lines)) {
    const l = lineOf(a100, id);
    if (!l) { failures.push(`G1 ${id}: missing from the analysis`); checks += 1; continue; }
    near("G1", `${id} normalised price`, l.price, e.price);
    same("G1", `${id} display`, unitPrice(l.price, a100.display_quantity, a100.base_unit), e.display);
    same("G1", `${id} display from the normalisation`, l.normalisation.display, e.display);
    near("G1", `${id} gap`, l.gap, e.gap);
    near("G1", `${id} justified`, l.justified, e.justified);
    near("G1", `${id} unexplained`, l.unexplained, e.unexplained);
  }
  for (const [id, reason] of Object.entries(E.excluded)) {
    same("G1", `${id} is not among the compared lines`, !!lineOf(a100, id), false);
    same("G1", `${id} is listed as excluded with its reason`, a100.excluded.find((x) => x.id === id)?.reason, reason);
  }
  // Section 10: the normalisation of P5, field for field.
  const n5 = normaliseLine(m100.po_lines.find((l) => l.id === "P5"), { group: "M-100", ...m100.materials[0] }, ctx100);
  const w5 = E.normalisation_P5;
  same("G1", "P5 normalisation: line, group, currency, incoterm, display, excluded, method version",
    [n5.line, n5.group, n5.steps.currency, n5.steps.incoterm, n5.display, n5.excluded, n5.method_version],
    [w5.line, w5.group, w5.steps.currency, w5.steps.incoterm, w5.display, w5.excluded, w5.method_version]);
  for (const k of ["price_per_order_unit", "base_units_per_order_unit", "price_per_base_unit", "rate_to_eur", "price_per_base_unit_eur", "logistics_uplift", "normalised_price_eur"]) {
    near("G1", `P5 normalisation step ${k}`, n5.steps[k], w5.steps[k]);
  }
  same("G1", "P5 normalisation carries exactly the brief's step names", Object.keys(n5.steps).sort(), Object.keys(w5.steps).sort());
  same("G1", "method version", METHOD_VERSION, "1.0.0");
}

if (chosen.includes("G2")) {
  const E = m100.expected.G2;
  same("G2", "pair ids", a100.pairs.map((p) => p.id).sort(), Object.keys(E.pairs).sort());
  for (const [id, e] of Object.entries(E.pairs)) {
    const p = pairOf(a100, id);
    if (!p) { failures.push(`G2 ${id}: missing`); checks += 1; continue; }
    near("G2", `${id} quantity`, p.quantity, e.quantity);
    near("G2", `${id} price`, p.price, e.price);
    near("G2", `${id} share`, p.share, e.share);
  }
  const cheapest = [...a100.pairs].sort((x, y) => x.price - y.price)[0];
  same("G2", "the cheapest pair", cheapest.id, E.cheapest_pair);
  same("G2", "the cheapest pair's price", unitPrice(cheapest.price, 100, "EA"), E.cheapest_display);
  same("G2", "the cheapest pair is below the 10 % floor and not the benchmark", [cheapest.share < DEFAULTS.benchmark_min_share, a100.benchmark.pair !== cheapest.id], [true, true]);
}

if (chosen.includes("G3")) {
  const E = m100.expected.G3;
  near("G3", "comparable quantity", a100.quantity, E.quantity);
  same("G3", "comparable quantity display", qty(a100.quantity, "EA"), E.quantity_display);
  same("G3", "benchmark pair", a100.benchmark.pair, E.benchmark_pair);
  near("G3", "benchmark", a100.benchmark.price, E.benchmark);
  same("G3", "benchmark display", unitPrice(a100.benchmark.price, 100, "EA"), E.benchmark_display);
  for (const k of ["spend", "gap", "justified", "unexplained"]) {
    near("G3", k, a100[k], E[k]);
    same("G3", `${k} display`, eur(a100[k]), E[`${k}_display`]);
  }
  near("G3", "opportunity equals the unexplained part", a100.opportunity, E.unexplained);
  near("G3", "index", a100.index, E.index);
  same("G3", "index display", pct(a100.index), E.index_display);
  near("G3", "spread", a100.spread, E.spread);
  same("G3", "spread display", pct(a100.spread), E.spread_display);
  same("G3", "flagged at €5,000 and 5 %", a100.flagged, E.flagged_at_defaults);
  const at1000 = analyseGroup(materialGroup(m100, "M-100", m100.po_lines), contextOf(m100, withParams({ materiality_eur: 1000 })));
  same("G3", "flagged at €1,000 and 5 %", at1000.flagged, E.flagged_at_1000_eur);
}

if (chosen.includes("G4")) {
  const E = m100.expected.G4;
  const O = a100.options;
  for (const id of ["H", "R", "B", "accept"]) {
    for (const k of ["savings", "one_off", "net", "residual", "index_after"]) if (k in E[id]) near("G4", `${id} ${k}`, O[id][k], E[id][k]);
    if ("days_to_first_saving" in E[id]) same("G4", `${id} days to first saving`, O[id].days_to_first_saving, E[id].days_to_first_saving);
  }
  same("G4", "H moves plants", O.H.plants_moved, E.H.plants_moved);
  same("G4", "H leaves the plants its supplier does not deliver to", O.H.plants_not_covered, E.H.plants_not_covered);
  near("G4", "H supplier's share afterwards", O.H.share_after, E.H.share_after);
  same("G4", "H share display", pct(O.H.share_after), E.H.share_after_display);
  same("G4", "H savings display", eur(O.H.savings), E.H.savings_display);
  same("G4", "H savings less one-off cost, display (tie half away from zero)", eur(O.H.net), E.H.net_display);
  same("G4", "H index after, display", pct(O.H.index_after), E.H.index_after_display);
  same("G4", "H is applicable", O.H.applicable, true);
  same("G4", "R counts suppliers, not pairs", O.R.suppliers, E.R.suppliers);
  same("G4", "R depends on every supplier's agreement and says so", O.R.warnings.some((w) => /agree/i.test(w)), true);
  near("G4", "B bundle part", O.B.bundle, E.B.bundle);
  same("G4", "B bundle display", eur(O.B.bundle), E.B.bundle_display);
  same("G4", "accept needs a reason: the six reasons", O.accept.reasons, ["specification differs", "supply security", "local requirement", "price change within the window", "volume tier", "other"]);
  same("G4", "signs: none of the small fixture's options pays in a year", ["H", "R", "B"].map((x) => O[x].net < 0), [true, true, true]);
}

if (chosen.includes("G4b")) {
  const b = fixture("m100-h-not-applicable.json");
  const fx = JSON.parse(JSON.stringify(m100));
  fx.po_lines = fx.po_lines.filter((l) => !b.drop_lines.includes(l.id));
  for (const s of fx.suppliers) Object.assign(s, b.supplier_changes[s.id] || {});
  const a = analyseGroup(materialGroup(fx, "M-100", fx.po_lines), contextOf(fx));
  same("G4b", "benchmark pair", a.benchmark.pair, b.expected.benchmark_pair);
  same("G4b", "H not applicable", a.options.H.applicable, b.expected.H.applicable);
  near("G4b", "H savings", a.options.H.savings, b.expected.H.savings);
  near("G4b", "H one-off cost", a.options.H.one_off, b.expected.H.one_off);
  same("G4b", "H moves no plant", a.options.H.plants_moved, b.expected.H.plants_moved);
  same("G4b", "H says why", a.options.H.warnings.some((w) => /not applicable/i.test(w)), true);
  same("G4b", "R's suppliers", a.options.R.suppliers, b.expected.R.suppliers);
  same("G4b", "applicable options", ["H", "R", "B"].filter((x) => a.options[x].applicable), b.expected.options_applicable);
}

if (chosen.includes("G5")) {
  const g5 = fixture("g5.json");
  const E = g5.expected;
  const unitOf = () => ({ group: "M-200", ...g5.materials[0] });
  const ctx = { rates: { EUR: 1 }, params: DEFAULTS };
  const r = realisedValue(g5.value_log[0], g5.po_lines, unitOf, ctx);
  near("G5", "baseline", r.baseline, E.baseline);
  same("G5", "baseline display", unitPrice(r.baseline, 100, "EA"), E.baseline_display);
  near("G5", "realised to date", r.realised, E.realised);
  same("G5", "realised display", eur(r.realised), E.realised_display);
  same("G5", "leakage lines", r.leakage.length, E.leakage_lines);
  near("G5", "leakage quantity", r.leakage_quantity, E.leakage_quantity);
  same("G5", "leakage quantity display", qty(r.leakage_quantity, "EA"), E.leakage_quantity_display);
  near("G5", "missed through leakage", r.missed, E.missed);
  same("G5", "missed display", eur(r.missed), E.missed_display);
  const newOnly = r.after.filter((l) => l.supplier === g5.value_log[0].new_supplier).reduce((s, l) => s + l.quantity * (r.baseline - l.price), 0);
  near("G5", "counting only the new supplier would give €1,200 (the wrong reading)", newOnly, E.realised_new_supplier_only);
  const p = valuePipeline({ valueLog: g5.value_log, approvals: [], identified: 0, lines: g5.po_lines, unitOf, ctx });
  near("G5", "approved a year", p.approved, E.approved);
  same("G5", "approved display", eur(p.approved), E.approved_display);
  near("G5", "implemented a year", p.implemented, E.implemented);
  near("G5", "realised in the pipeline", p.realised, E.realised);
  // Boundaries (B7)
  const B = g5.boundary;
  const rb = realisedValue(g5.value_log[0], [...g5.po_lines, ...B.extra_lines], unitOf, ctx);
  near("G5", "boundary: baseline counts day -455, not -456 or the implementation day", rb.baseline, B.expected.baseline);
  same("G5", "boundary: after implementation starts the day after", rb.after.map((l) => l.id), B.expected.after_lines);
  near("G5", "boundary: realised", rb.realised, B.expected.realised);
  same("G5", "boundary: leakage lines", rb.leakage.length, B.expected.leakage_lines);
  near("G5", "boundary: missed", rb.missed, B.expected.missed);
}

if (chosen.includes("N")) {
  const N = fixture("normalise.json");
  const ctx = { rates: N.rates, params: DEFAULTS };
  for (const c of N.cases) {
    const n = normaliseLine({ id: c.id, ...c.line }, { group: c.unit, ...N.units[c.unit] }, ctx);
    if (c.excluded) {
      same("N", `${c.id} ${c.what}: excluded with its reason`, [n.excluded, n.reason], [true, c.reason]);
    } else {
      same("N", `${c.id} ${c.what}: not excluded`, n.excluded, false);
      near("N", `${c.id} ${c.what}: price`, n.steps.normalised_price_eur, c.price);
      if ("base_units_per_order_unit" in c) near("N", `${c.id} base units per order unit`, n.steps.base_units_per_order_unit, c.base_units_per_order_unit);
      same("N", `${c.id} display`, n.display, c.display);
    }
  }
  const I = N.incoterms;
  same("N", "all eleven Incoterms 2020 rules, in their groups", INCOTERM_GROUPS, I.groups);
  for (const [rule, uplift] of Object.entries(I.uplift)) {
    const n = normaliseLine({ id: `I-${rule}`, ...I.line, incoterm: rule }, { group: "I", ...N.units[I.unit] }, ctx);
    near("N", `${rule} (group ${I.groups[rule]}) uplift`, n.steps.logistics_uplift, uplift);
    near("N", `${rule} normalised price`, n.steps.normalised_price_eur, I.price_before_uplift * (1 + uplift));
  }
  const svc = normaliseLine({ id: "S-none", quantity: 1, order_unit: "DAY", net_price: 1000, price_unit: 1, currency: "EUR", incoterm: null }, { group: "S", ...N.units.consulting_pd }, ctx);
  same("N", "a line without Incoterms (a service) gets no uplift", [svc.steps.incoterm, svc.steps.logistics_uplift], [null, 0]);
  const odd = normaliseLine({ id: "X", quantity: 1, order_unit: "BOX", net_price: 1, price_unit: 1, currency: "EUR", incoterm: "DAT" }, { group: "X", ...N.units.gloves }, ctx);
  same("N", "a rule that is not in Incoterms 2020 (DAT, replaced by DPU) is excluded with its reason", [odd.excluded, odd.reason], [true, "unknown Incoterms rule DAT"]);
  const eight = normaliseLine({ id: "P8h", quantity: 1, order_unit: "H", net_price: 100, price_unit: 1, currency: "EUR", incoterm: null }, { group: "S", ...N.units.consulting_pd }, { rates: N.rates, params: withParams({ person_day_hours: 7.5 }) });
  near("N", "the person-day is a parameter: at 7.5 hours an hour is 1/7.5 of a person-day", eight.steps.base_units_per_order_unit, 1 / 7.5);

  // Every unit conversion and every currency of the world, at the bundled rates.
  const worldFile = path.join(APP_ROOT, "data", "world.js");
  const fxFile = path.join(APP_ROOT, "data", "fx.js");
  if (!existsSync(worldFile) || !existsSync(fxFile)) {
    failures.push("N: data/world.js or data/fx.js is missing (node tools/build_world.mjs)"); checks += 1;
  } else {
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(readFileSync(fxFile, "utf8"), sandbox);
    vm.runInContext(readFileSync(worldFile, "utf8"), sandbox);
    const W = sandbox.window.WORLD;
    const FX = sandbox.window.FX;
    const rates = Object.fromEntries(Object.entries(FX.currencies).map(([c, v]) => [c, v.rate_to_eur]));
    const wctx = { rates, params: DEFAULTS };
    let conversions = 0;
    for (const m of W.material) {
      for (const [unit, per] of Object.entries(m.conversions)) {
        const n = normaliseLine({ id: `${m.id}-${unit}`, quantity: 1, order_unit: unit, net_price: 100, price_unit: 1, currency: "EUR", incoterm: "DAP" }, { group: m.id, ...m }, wctx);
        near("N", `world: ${m.id} ${unit} = ${per} ${m.base_unit}`, n.steps.normalised_price_eur, 100 / per);
        conversions += 1;
      }
    }
    same("N", "world: every material has its base unit among its conversions or is a service", W.material.every((m) => m.conversions[m.base_unit] === 1 || ["PD", "H"].includes(m.base_unit)), true);
    const currencies = [...new Set(W.po_line.map((l) => l.currency))].sort();
    same("N", "world: every currency of an order line has a bundled rate", currencies.every((c) => Number.isFinite(rates[c]) && rates[c] > 0), true);
    for (const c of currencies) {
      const line = W.po_line.find((l) => l.currency === c && l.material && !l.cancelled);
      const m = W.material.find((x) => x.id === line.material);
      const n = normaliseLine(line, { group: m.id, ...m }, wctx);
      near("N", `world: ${c} converts at the bundled rate`, n.steps.rate_to_eur, rates[c]);
    }
    const units = new Set(W.po_line.map((l) => l.order_unit));
    same("N", `world: ${conversions} conversions and ${currencies.length} currencies checked; order units ${[...units].sort().join(" ")}`, conversions > 0, true);
  }
}

if (chosen.includes("D")) {
  same("D", "a tie of €778.50 shows as €779 and -€778.50 as -€779", [eur(778.5), eur(-778.5)], ["€779", "-€779"]);
  same("D", "floating-point noise never moves a digit", [eur(1738.7999999999997), eur(2022.3899999999999), eur(0.1 + 0.2 + 778.2)], ["€1,739", "€2,022", "€779"]);
  same("D", "unit price at a display quantity of 1 drops the 1", unitPrice(38, 1, "EA"), "€38.00 per EA");
  same("D", "unit price at 100", unitPrice(0.074865, 100, "EA"), "€7.49 per 100 EA");
  same("D", "percentages with one decimal", [pct(29 / 69), pct(117.3 / 9655.8), pct(0)], ["42.0%", "1.2%", "0.0%"]);
  same("D", "quantities whole with their unit", [qty(137000, "EA"), qty(240, "PD")], ["137,000 EA", "240 PD"]);
  const src = ["js/format.js", "js/normalise.js", "js/variance.js", "js/options.js", "js/pipeline.js", "js/groups.js", "js/params.js"].map((f) => readFileSync(path.join(APP_ROOT, f), "utf8")).join("\n");
  same("D", "no toFixed in the engine (Intl after rounding to 1e-9 only)", /\.toFixed\(/.test(src), false);
}

// ---- GR and S: guardrails and the script checker ----------------------------------------------------------
const loadData = (files) => {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  for (const f of files) vm.runInContext(readFileSync(path.join(APP_ROOT, "data", f), "utf8"), sandbox);
  return sandbox.window;
};
const truthy = (group, what, ok, detail = "") => { checks += 1; if (!ok) failures.push(`${group} ${what}${detail ? `: ${detail}` : ""}`); };

if (chosen.includes("GR")) {
  const D = loadData(["fx.js", "world.js"]);
  const W = D.WORLD;
  const { createToolbox } = await import("../js/tools.js");
  const G = await import("../js/guards.js");
  const { ACCEPT_REASONS } = await import("../js/options.js");
  const headless = () => {
    const h = {};
    const q = { option: [], confirmation: [] };
    const events = [];
    const drafts = new Map();
    let phase = null;
    const tb = createToolbox({
      world: W, fx: D.FX, params: DEFAULTS, emit: (t, p) => { events.push({ t, p }); if (t === "options") h.onOptions?.(p); },
      waitUntil: async (test) => { const v = test(); if (!v) throw new Error("waits with nothing to answer"); return v; },
      takeDecision: (k) => q[k].shift() || null, drafts, onPhase: (x) => { phase = x; }, getPhase: () => phase, isEnded: () => false,
      ecbRate: async () => ({ ok: false, error: "offline" }), mode: "authored", entry: "scenario"
    });
    let n = 0;
    Object.assign(h, { tb, q, events, drafts, call: (name, input) => tb.call(`t${++n}`, name, input) });
    return h;
  };
  const refused = async (h, name, input, rule, text) => {
    const o = await h.call(name, input);
    truthy("GR", `${name} refused (${text})`, o.isError && o.guard === rule && (!text || o.result.error.includes(text)), o.isError ? `${o.guard}: ${o.result.error.slice(0, 140)}` : "accepted");
    return o;
  };

  // Rule 2: one comparable group per comparison; clusters only once confirmed; the schema first.
  {
    const h = headless();
    await refused(h, "pv_compare", { group_id: "SRV-CON" }, "groups", "material group");
    await refused(h, "pv_compare", { group_id: "20001001+20001003" }, "groups", "several");
    await refused(h, "pv_compare", { group_id: "CL-01" }, "cluster", "not a cluster a person confirmed");
    await h.call("pv_match", { material_group: "SRV-CON" });
    await refused(h, "pv_compare", { group_id: "CAND-1" }, "cluster", "candidate");
    await refused(h, "erp_query", { product: "po_line", limit: "ten" }, "input", "schema");
    await refused(h, "erp_query", { product: "po_line", extra: 1 }, "input", "schema");
    await refused(h, "ui_propose_options", { compare_id: "CMP-1", options: [], recommended: "Z", reason: "x" }, "input", "schema");
    const ok = await h.call("pv_compare", { group_id: "20001001" });
    truthy("GR", "a material number is a comparable group", !ok.isError && ok.result.compare_id === "CMP-1");
    const mpn = await h.call("pv_compare", { group_id: "20001002" });
    truthy("GR", "a material inside a part-number group points to that group", mpn.isError && /MPN:Brekholt:BH-7730-S3/.test(mpn.result.error));
  }

  // The board (review R1): approved and accepted are a person's decisions, so only the code marks them
  // (after the decision, as the decision's own board update); "above" only on the pairs and lines the
  // latest comparison of their group puts above the benchmark.
  {
    const h = headless();
    await refused(h, "ui_mark_board", { state: "approved", group_id: "20001001", pair_ids: ["3010 / 80002"] }, "input", "schema");
    await refused(h, "ui_mark_board", { state: "justified", group_id: "20001001", pair_ids: ["1020 / 30024"] }, "input", "schema");
    await refused(h, "ui_mark_board", { state: "above", group_id: "20001001", pair_ids: ["3010 / 80002"] }, "board", "pv_compare");
    const a = (await h.call("pv_compare", { group_id: "20001001" })).result;
    const bench = a.pairs.find((p) => p.pair === a.benchmark.pair);
    await refused(h, "ui_mark_board", { state: "above", pair_ids: ["3010 / 80002"] }, "board", "group_id");
    await refused(h, "ui_mark_board", { state: "above", group_id: "20001001", pair_ids: [a.benchmark.pair] }, "board", "not above");
    await refused(h, "ui_mark_board", { state: "above", group_id: "20001001", pair_ids: ["1020 / 30062"] }, "board", "not above");
    await refused(h, "ui_mark_board", { state: "above", group_id: "20001001", line_ids: [bench.lines[0]] }, "board", "not above");
    await refused(h, "ui_mark_board", { state: "above", group_id: "20001001", pair_ids: ["1010 / 30135"] }, "board", "not a pair");
    const ok = await h.call("ui_mark_board", { state: "above", group_id: "20001001", pair_ids: ["3010 / 80002", "2010 / 80001"] });
    truthy("GR", "above passes for pairs the comparison puts above the benchmark", !ok.isError && ok.result.marked === 3, JSON.stringify(ok.result));
    const reading = await h.call("ui_mark_board", { state: "checking", group_id: "20001001", line_ids: [bench.lines[0]] });
    truthy("GR", "checking passes for any line of the group", !reading.isError, JSON.stringify(reading.result));
    truthy("GR", "no board update painted a decision", !h.events.some((e) => e.t === "board_update" && ["approved", "justified"].includes(e.p.state)));
  }

  // Rule 3: the verified alert, its evidence and what it says it checked.
  {
    const h = headless();
    const a = (await h.call("pv_compare", { group_id: "20001001" })).result;
    const line = (pair, i = 0) => a.pairs.find((p) => p.pair === pair).lines[i];
    await refused(h, "ui_report_alert", { compare_id: a.compare_id, title: "t", summary: "s" }, "alert", "at least three");
    await h.call("pv_normalise", { line_id: line(a.benchmark.pair) });
    await h.call("pv_normalise", { line_id: line(a.benchmark.pair, 1) });
    await h.call("pv_normalise", { line_id: line("2010 / 80001") });
    const noHigh = await refused(h, "ui_report_alert", { compare_id: a.compare_id, title: "t", summary: "s" }, "alert", "highest-priced pair");
    truthy("GR", "three lines are not enough without one of the highest pair", !/at least three/.test(noHigh.result.error));
    await h.call("pv_normalise", { line_id: line(a.highest.pair) });
    await refused(h, "ui_report_alert", { compare_id: a.compare_id, title: "t", summary: "s" }, "alert", "contract");
    await h.call("erp_query", { product: "contract", filters: [{ field: "supplier", op: "eq", value: a.benchmark.supplier }] });
    await refused(h, "ui_report_alert", { compare_id: a.compare_id, title: "t", summary: "s", line_ids: ["4500010001-00010"] }, "groups", "not lines of group");
    await refused(h, "ui_report_alert", { compare_id: a.compare_id, title: "Lyon pays €9.90 per 100 EA", summary: "s" }, "figures", "€9.90");
    const ok = await h.call("ui_report_alert", { compare_id: a.compare_id, title: "Lyon pays above the benchmark", summary: "Lyon pays €9.80 per 100 EA; the benchmark is €6.90 per 100 EA, and €14,146 a year is unexplained." });
    const alert = h.events.find((e) => e.t === "alert");
    truthy("GR", "a verified alert passes with its evidence", !ok.isError && !!alert, ok.result.error || "");
    truthy("GR", "the card says what was checked in this run", alert && alert.p.checked.length === 3 && /contract of supplier 30024: 4600000101/.test(alert.p.checked[2]) && /4 lines normalised/.test(alert.p.checked[1]), JSON.stringify(alert?.p.checked));
    // A contract query that finds nothing still counts as the lookup.
    const ev = new G.RunEvidence();
    ev.noteContracts(new Set(["30059"]), { product: "contract", rows: [] });
    truthy("GR", "a contract lookup that finds none counts", ev.contracts.has("30059") && ev.contracts.get("30059").size === 0);
  }

  // Rule 4: options from the latest comparison of the alert's group, material only, decided once.
  {
    const h = headless();
    const a = (await h.call("pv_compare", { group_id: "20001003" })).result;
    const opts = [{ id: "H", title: "Harmonise", description: "Move the lines.", residual_risk: "None known." }, { id: "R", title: "Renegotiate", description: "Ask the suppliers.", residual_risk: "They may refuse." }];
    await refused(h, "ui_propose_options", { compare_id: a.compare_id, options: opts, recommended: "H", reason: "Best net." }, "options", "verified alert first");
    for (const pair of [a.benchmark.pair, a.highest.pair]) await h.call("pv_normalise", { line_id: a.pairs.find((p) => p.pair === pair).lines[0] });
    await h.call("pv_normalise", { line_id: a.pairs.find((p) => p.pair === a.highest.pair).lines[1] });
    await h.call("erp_get_record", { product: "supplier", id: a.benchmark.supplier });
    const al = await h.call("ui_report_alert", { compare_id: a.compare_id, title: "Duisburg pays above the benchmark", summary: "Routine orders pay the urgent price." });
    truthy("GR", "a supplier record with its contracts counts as the contract lookup", !al.isError, al.result.error || "");
    const b = (await h.call("pv_compare", { group_id: "20001003" })).result;
    await refused(h, "ui_propose_options", { compare_id: a.compare_id, options: opts, recommended: "H", reason: "Best net." }, "options", "not the latest");
    const other = (await h.call("pv_compare", { group_id: "20001001" })).result;
    await refused(h, "ui_propose_options", { compare_id: other.compare_id, options: opts, recommended: "H", reason: "Best net." }, "options", "one group at a time");
    await refused(h, "ui_propose_options", { compare_id: b.compare_id, options: opts.slice(0, 1), recommended: "H", reason: "Best net." }, "options", "two or three");
    await refused(h, "ui_propose_options", { compare_id: b.compare_id, options: [opts[0], opts[0]], recommended: "H", reason: "Best net." }, "options", "once");
    await refused(h, "ui_propose_options", { compare_id: b.compare_id, options: opts, recommended: "B", reason: "Best net." }, "options", "must be one of");
    // Decisions bind to the options on screen and count once; anything else shows a Guardrail line.
    h.q.option.push({ payload: { options_seq: 0, option_id: "H", decision: "approved" } });
    h.onOptions = (p) => {
      h.q.option.push({ payload: { options_seq: p.options_seq, option_id: "accept", decision: "approved" } });
      h.q.option.push({ payload: { options_seq: p.options_seq, option_id: "R", decision: "rejected" } });
    };
    const first = await h.call("ui_propose_options", { compare_id: b.compare_id, options: opts, recommended: "H", reason: "Best net." });
    const notes = () => h.events.filter((e) => e.t === "notice" && e.p.guard).map((e) => e.p.text);
    truthy("GR", "a decision queued for an earlier set shows a Guardrail line and does not count", notes().some((t) => /earlier set/.test(t)) && first.result.decision === "rejected", JSON.stringify(first.result).slice(0, 120));
    truthy("GR", "accepting without a reason does not count", notes().some((t) => /needs a reason/.test(t)));
    h.q.option.push({ payload: { options_seq: 1, option_id: "R", decision: "approved" } });
    h.q.option.push({ payload: { options_seq: 1, option_id: "H", decision: "approved" } });
    const second = await h.call("ui_await_decision", {});
    truthy("GR", "a rejected option cannot be approved afterwards", notes().some((t) => /already rejected/.test(t)) && second.result.decision === "approved" && second.result.option_id === "H", JSON.stringify(second.result).slice(0, 120));
    await refused(h, "ui_await_decision", {}, "options", "already taken");
    await refused(h, "ui_propose_options", { compare_id: b.compare_id, options: opts, recommended: "H", reason: "Best net." }, "options", "already taken");
    await refused(h, "ui_draft_action", { type: "tender_memo", recipient: "Category manager", subject: "Tender", body: "A tender." }, "drafts", "allows only change_request");
    await refused(h, "ui_final_report", { outcome: "variance_accepted", markdown: "## Report\n\nOption H was approved for the hydraulic hoses." }, "report", "outcome is option_approved");
    const rep = await h.call("ui_final_report", { outcome: "option_approved", markdown: "## Report\n\nOption H was approved for the hydraulic hoses." });
    const shown = h.events.find((e) => e.t === "report");
    truthy("GR", "the report follows the decision and carries the simulation footer in code", !rep.isError && shown && /Simulated run \(authored script\)/.test(shown.p.markdown));
  }

  // Pure policy functions.
  {
    const ok = (what, got) => truthy("GR", what, got === null, got || "");
    const err = (what, got, text) => truthy("GR", what, typeof got === "string" && got.includes(text), got || "null");
    err("no draft before a decision", G.draftError({ type: "buyer_notice", approved: null }), "follow a person's decision");
    ok("H allows a change request", G.draftError({ type: "change_request", approved: { id: "H" } }));
    ok("H allows a buyer notice", G.draftError({ type: "buyer_notice", approved: { id: "H" } }));
    err("H allows no tender memo", G.draftError({ type: "tender_memo", approved: { id: "H" } }), "allows only change_request");
    ok("R allows a negotiation brief", G.draftError({ type: "negotiation_brief", approved: { id: "R" } }));
    err("R allows no change request", G.draftError({ type: "change_request", approved: { id: "R" } }), "negotiation_brief");
    ok("B allows a tender memo", G.draftError({ type: "tender_memo", approved: { id: "B" } }));
    ok("accepting allows a variance memo", G.draftError({ type: "variance_memo", approved: { id: "accept" } }));
    err("accepting allows nothing else", G.draftError({ type: "buyer_notice", approved: { id: "accept" } }), "variance was accepted");
    const ro = (x) => G.reportOutcome(x);
    truthy("GR", "report refused while drafts wait", !!ro({ requested: "option_approved", optionsShown: true, approved: { id: "H" }, pendingDrafts: 1 }).error);
    truthy("GR", "report refused while a confirmation is open", !!ro({ requested: "stopped", confirmationOpen: true }).error);
    truthy("GR", "report outcome follows an approval", ro({ requested: "option_approved", optionsShown: true, approved: { id: "B" } }).outcome === "option_approved" && !!ro({ requested: "variance_accepted", optionsShown: true, approved: { id: "B" } }).error);
    truthy("GR", "report outcome follows accepting", ro({ requested: "variance_accepted", optionsShown: true, approved: { id: "accept" } }).outcome === "variance_accepted");
    truthy("GR", "report refused while the options wait", !!ro({ requested: "nothing_found", optionsShown: true, approved: null }).error);
    truthy("GR", "without options: nothing_found or stopped", ro({ requested: "nothing_found" }).outcome === "nothing_found" && ro({ requested: "stopped" }).outcome === "stopped" && !!ro({ requested: "option_approved" }).error);
    const seq = { optionsSeq: 2, options: [{ id: "H" }, { id: "R" }, { id: "accept" }], rejected: new Set(["R"]), approved: null };
    err("a decision on an earlier set is stale", G.decisionError({ options_seq: 1, option_id: "H", decision: "approved" }, seq), "earlier set");
    err("a rejected option cannot be decided again", G.decisionError({ options_seq: 2, option_id: "R", decision: "approved" }, seq), "already rejected");
    err("an option not on screen", G.decisionError({ options_seq: 2, option_id: "B", decision: "approved" }, seq), "not on screen");
    err("accepting needs a reason", G.decisionError({ options_seq: 2, option_id: "accept", decision: "approved" }, seq), "needs a reason");
    ok("accepting with a reason counts", G.decisionError({ options_seq: 2, option_id: "accept", decision: "approved", reason: ACCEPT_REASONS[0] }, seq));
    err("nothing counts after an approval", G.decisionError({ options_seq: 2, option_id: "H", decision: "approved" }, { ...seq, approved: { id: "H" } }), "already taken");
  }

  // Figure scopes: a draft quotes only the comparison its option rests on; a sensitivity only in the alert and report.
  {
    const L = new G.FigureLedger(W, DEFAULTS);
    L.addCompare("CMP-1", { group: "x", base_unit: "EA", display_quantity: 1, opportunity: 11736.4 });
    L.addCompare("CMP-2", { group: "y", base_unit: "EA", display_quantity: 1, opportunity: 36155.4 }, { base_unit: "EA", display_quantity: 1, opportunity: 41000.2 });
    truthy("GR", "a draft quotes its own comparison", L.offending("Savings of €11,736 a year.", "draft", "CMP-1").length === 0);
    truthy("GR", "a draft does not quote another comparison", L.offending("Savings of €36,155 a year.", "draft", "CMP-1").join() === "€36,155");
    truthy("GR", "a sensitivity is quoted in the alert", L.offending("At today's rate €41,000 a year.", "alert").length === 0);
    truthy("GR", "a sensitivity is not quoted in a draft", L.offending("At today's rate €41,000 a year.", "draft", "CMP-2").join() === "€41,000");
    truthy("GR", "world ids exist for every text", L.offending("Plant 1010 buys from supplier 30024 under contract 4600000101.", "draft", "CMP-1").length === 0 && L.offending("Plant 1011 buys from supplier 30024.", "draft", "CMP-1").join() === "1011");
  }
}

if (chosen.includes("S")) {
  const D = loadData(["fx.js", "world.js", "scenarios.js", "sim_runs.js"]);
  const { checkSimRun, checkSimRuns } = await import("../js/sim_check.js");
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const S = D.SIM_RUNS;
  const all = await checkSimRuns(D.WORLD, D.FX, DEFAULTS, S, D.SCENARIOS);
  truthy("S", "positive control: the six scripts pass on every path", all.scripts === 6 && all.checks.every((c) => c.ok) && all.paths >= 30, all.checks.filter((c) => !c.ok).map((c) => c.detail).join(" | "));
  const faults = {
    "an alert before the evidence (no line normalised)": [() => { const d = clone(S["SC-GLOVES"]); d.steps = d.steps.filter((s) => s.tool !== "pv_normalise"); return d; }, /at least three of the group's lines/],
    "no contract lookup": [() => { const d = clone(S["SC-GLOVES"]); d.steps = d.steps.filter((s) => !(s.tool === "erp_query" && s.input.product === "contract")); return d; }, /contract/],
    "no visible revision": [() => { const d = clone(S["SC-SHOES"]); d.steps = d.steps.filter((s) => !(s.say && /^Revised/.test(s.say))); return d; }, /Revised:/],
    "no hypothesis": [() => { const d = clone(S["SC-SHOES"]); d.steps = d.steps.filter((s) => !(s.say && /^Hypothesis/.test(s.say))); return d; }, /Hypothesis:/],
    "fewer than eight tool calls": [() => { const d = clone(S["SC-SHOES"]); d.steps = d.steps.filter((s) => !(s.tool === "erp_get_overview" || (s.tool === "erp_query" && s.input.product !== "contract") || s.tool === "erp_get_record")); return d; }, /at least 8 are needed/],
    "a typed figure in the narration": [() => { const d = clone(S["SC-GLOVES"]); d.steps.splice(3, 0, { say: "Lyon pays €9.90 per 100 EA." }); return d; }, /€9\.90/],
    "a typed figure in an alert": [() => { const d = clone(S["SC-SHOES"]); const a = d.steps.find((s) => s.alert); a.alert.summary = "Lyon pays €81.00 per EA."; return d; }, /€81\.00/],
    "a draft the option does not allow": [() => { const d = clone(S["SC-GLOVES"]); d.decisions = { H: [{ draft: { type: "tender_memo", recipient: "Category manager", subject: "Tender", body: "A tender." } }] }; return d; }, /allows only change_request/],
    "a report outcome that does not follow the decision": [() => { const d = clone(S["SC-BOXES"]); d.steps[d.steps.length - 1].report.outcome = "option_approved"; return d; }, /nothing_found/],
    "options on a group below materiality": [() => { const d = clone(S["SC-BOXES"]); d.steps.splice(d.steps.length - 1, 1, { tool: "pv_normalise", input: { line_id: "{{highest.line}}" } }, { alert: { title: "Boxes", summary: "Boxes differ." } }, { propose: true }); return d; }, /below materiality/],
    "an unresolved placeholder": [() => { const d = clone(S["SC-GLOVES"]); d.steps.splice(3, 0, { say: "{{group.nothing}}" }); return d; }, /unresolved placeholder/],
    "a script without a source": [() => { const d = clone(S["SC-GLOVES"]); delete d.source; return d; }, /source must be/]
  };
  for (const [what, [make, expect]] of Object.entries(faults)) {
    const r = await checkSimRun(D.WORLD, D.FX, DEFAULTS, make());
    truthy("S", `the checker catches ${what}`, r.errors.some((e) => expect.test(e)), r.errors.slice(0, 2).join(" | ") || "no error");
  }
  // Scenario 2's texts follow the person's answer (review R4): confirmed in hours, the narration and the
  // alert say the hour; split without Birmingham, option H no longer says Birmingham stays as it is.
  {
    const { playPath } = await import("../js/sim_check.js");
    const texts = (r) => r.events.filter((e) => ["alert", "options", "report"].includes(e.type)).map((e) => JSON.stringify(e.payload)).join(" ");
    const hour = await playPath(D.WORLD, D.FX, DEFAULTS, S["SC-CONSULT"], { confirm: "confirmed:other-unit", option: "recommended" });
    const decided = hour.events.find((e) => e.type === "tool_result" && e.payload.name === "ui_confirm_cluster")?.payload?.result?.base_unit;
    const said = JSON.stringify(S["SC-CONSULT"].steps);
    truthy("S", "scenario 2 confirmed in hours: the alert says the hour, never the person-day, and the narration names the unit chosen", hour.errors.length === 0 && decided === "H" && /the hour/.test(texts(hour)) && !/person-day/.test(texts(hour)) && !/with the person-day as its base unit/.test(said), `${decided}; ${hour.errors.join(" | ")}; ${(texts(hour).match(/.{0,60}person-day.{0,40}/) || [""])[0]}`);
    const req = hour.events.find((e) => e.type === "confirmation_request")?.payload;
    const brum = req ? req.evidence.plants.indexOf("2010") : -1;
    const split = await playPath(D.WORLD, D.FX, DEFAULTS, S["SC-CONSULT"], { confirm: `split:${brum}`, option: "recommended" });
    const h = split.events.filter((e) => e.type === "options").pop()?.payload?.options?.find((o) => o.id === "H");
    truthy("S", "scenario 2 split without Birmingham: option H says every plant moves, not that Birmingham stays", brum >= 0 && split.errors.length === 0 && !!h && !/Birmingham/.test(JSON.stringify(h)) && /Every plant above the benchmark moves/.test(h.residual_risk || ""), JSON.stringify(h || split.errors).slice(0, 240));
    const whole = await playPath(D.WORLD, D.FX, DEFAULTS, S["SC-CONSULT"], { confirm: "confirmed", option: "recommended" });
    const h2 = whole.events.filter((e) => e.type === "options").pop()?.payload?.options?.find((o) => o.id === "H");
    truthy("S", "scenario 2 confirmed whole: option H names Birmingham as the plant it cannot move", !!h2 && /Birmingham stays as it is/.test(h2.residual_risk || ""), JSON.stringify(h2).slice(0, 200));
  }
}

for (const f of failures) console.log(`FAIL  ${f}`);
if (failures.length) {
  console.log(`\nENGINE FAILED: ${failures.length} of ${checks} checks in ${chosen.join(" ")}`);
  process.exit(1);
}
console.log(`ENGINE OK: ${chosen.join(" ")} (${checks} checks)`);
