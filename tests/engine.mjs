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

const GROUPS = ["G1", "G2", "G3", "G4", "G4b", "G5", "N", "D"];
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

for (const f of failures) console.log(`FAIL  ${f}`);
if (failures.length) {
  console.log(`\nENGINE FAILED: ${failures.length} of ${checks} checks in ${chosen.join(" ")}`);
  process.exit(1);
}
console.log(`ENGINE OK: ${chosen.join(" ")} (${checks} checks)`);
