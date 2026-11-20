// The figure audit (brief §7, rule 7) against its cases F01 to F16 (brief §11), and the rules the
// cases do not reach:
//   F         the sixteen texts with the run's figures as the brief types them: result and tokens
//   notes     the brief's three notes: each failing case fails only because of the rule it names
//   engine    the same sixteen verdicts when the known figures come from the engine's own results for
//             M-100 and G5, so the engine types every figure the brief counts as a tool figure
//   rules     exemptions (dates, names with numbers, ids that exist), counts in digits and in words,
//             negative amounts, "per EA", the thousands rule, scales, unknown ids
// Usage: node tests/audit.mjs
import { readFileSync } from "node:fs";
import path from "node:path";
import { APP_ROOT } from "./lib/harness.mjs";
import { KnownFigures, auditText } from "../js/figures.js";
import { DEFAULTS } from "../js/params.js";
import { analyseGroup } from "../js/variance.js";
import { realisedValue, valuePipeline } from "../js/pipeline.js";

const fixture = (f) => JSON.parse(readFileSync(path.join(APP_ROOT, "tests", "fixtures", f), "utf8"));
const A = fixture("audit-f01-f16.json");
const frac = (v) => (Array.isArray(v) ? v[0] / v[1] : v);
let checks = 0;
const failures = [];
const expect = (what, got, want) => {
  checks += 1;
  if (JSON.stringify(got) !== JSON.stringify(want)) failures.push(`${what}: got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
};

// ---- F01 to F16 with the brief's typed figures -------------------------------------------------------
const known = new KnownFigures();
for (const v of A.known.amounts) known.addAmount(v);
for (const p of A.known.prices) known.addPrice(p.value, p.display_quantity, p.unit);
for (const s of A.known.shares) known.addShare(frac(s));
for (const q of A.known.quantities) known.addQuantity(q.value, q.unit);
for (const c of A.known.counts) known.addCount(c);
for (const id of A.known.ids) known.addId(id);
for (const c of A.known.codes) known.addCode(c);

let asExpected = 0;
for (const c of A.cases) {
  const r = auditText(c.text, known);
  const ok = JSON.stringify(r.offending) === JSON.stringify(c.offending) && r.ok === (c.offending.length === 0);
  checks += 1;
  if (ok) asExpected += 1;
  else failures.push(`${c.id} "${c.text}": got ${r.ok ? "Pass" : `Fail: ${r.offending.join(", ")}`}, expected ${c.offending.length ? `Fail: ${c.offending.join(", ")}` : "Pass"}`);
}

// ---- the brief's three notes ------------------------------------------------------------------------
{
  const f02 = auditText(A.notes[0].text, known, { floor: A.notes[0].floor });
  expect("F02 passes with Rebate Hunter's €0.50 floor", f02.ok, true);
  const n = A.notes[1];
  const off = Math.abs(n.written - n.figure);
  expect("F15 lies within the precision written", off <= n.half_unit, true);
  expect("F15 is 2.2 % from €1,738.80, above the 2 % cap", [Math.round((off / n.figure) * 1000) / 10, off / n.figure > 0.02], [2.2, true]);
  expect("F16 read with a decimal comma would match P9's €9.50", auditText("Lyon pays €9.50 a year.", known).ok, true);
}

// ---- the same verdicts from the engine's own results -----------------------------------------------
{
  const m100 = fixture("m100.json");
  const ctx = { rates: m100.rates, params: DEFAULTS, plants: Object.fromEntries(m100.plants.map((p) => [p.id, p])), suppliers: Object.fromEntries(m100.suppliers.map((s) => [s.id, s])) };
  const m = m100.materials[0];
  const analysis = analyseGroup({ id: m.id, kind: "material", base_unit: m.base_unit, display_quantity: m.display_quantity, units: { [m.id]: m }, lines: m100.po_lines }, ctx);
  const g5 = fixture("g5.json");
  const unitOf = () => ({ group: "M-200", ...g5.materials[0] });
  const realised = realisedValue(g5.value_log[0], g5.po_lines, unitOf, { rates: { EUR: 1 }, params: DEFAULTS });
  const pipeline = valuePipeline({ valueLog: g5.value_log, approvals: [], identified: 0, lines: g5.po_lines, unitOf, ctx: { rates: { EUR: 1 }, params: DEFAULTS } });
  const fromEngine = new KnownFigures();
  fromEngine.addResult(analysis);
  fromEngine.addResult(realised);
  fromEngine.addResult(pipeline);
  for (const id of A.known.ids) fromEngine.addId(id);
  for (const c of A.known.codes) fromEngine.addCode(c);
  for (const c of A.cases) {
    const r = auditText(c.text, fromEngine);
    expect(`${c.id} with the engine's figures`, r.offending, c.offending);
  }
}

// ---- rules beyond the cases -------------------------------------------------------------------------
{
  const k = new KnownFigures();
  k.addAmount(1738.8); k.addAmount(-778.5); k.addPrice(38, 1, "EA"); k.addQuantity(240, "PD"); k.addCount(3); k.addShare(0.42);
  k.addId("4500012345-00010"); k.addId("20001001"); k.addId("30008"); k.addCode("1010"); k.addName("Euro pallet 1200 × 800"); k.addName("Inno IT-Services AG");
  const verdict = (text) => auditText(text, k).offending;
  expect("dates in the display form and ISO form are exempt", verdict("Ordered on Thu 19 Nov and on 2026-11-19, and on Wed 19 Nov 2025."), []);
  expect("names with numbers are exempt: Incoterms 2020", verdict("Delivered under Incoterms 2020 rules."), []);
  expect("a known name with numbers is exempt as a whole", verdict("The Euro pallet 1200 × 800 costs more in Birmingham."), []);
  expect("an id that exists passes; one that does not fails", [verdict("Line 4500012345-00010 of material 20001001."), verdict("Line 4500099999-00010.")], [[], ["4500099999-00010"]]);
  expect("a supplier number after 'supplier' must exist", [verdict("Supplier 30008 delivers."), verdict("Vendor 30009 delivers.")], [[], ["30009"]]);
  expect("counts written in digits must be counts a tool returned; in words they pass", [verdict("Three suppliers sell above it."), verdict("3 suppliers sell above it."), verdict("4 suppliers sell above it.")], [[], [], ["4"]]);
  expect("negative amounts match by size", verdict("H nets -€779 in its first year."), []);
  expect("a unit price per EA is per 1 EA", [verdict("Duisburg pays €38.00 per EA."), verdict("Duisburg pays €38.50 per EA.")], [[], ["€38.50"]]);
  expect("a quantity in person-days", [verdict("The group holds 240 PD."), verdict("The group holds 250 PD.")], [[], ["250 PD"]]);
  expect("a comma before three digits groups thousands, a dot is a decimal point", [verdict("It is €1,738.80."), verdict("It is €1.738,80.")], [[], ["€1.738,80"]]);
  expect("scales: k and m", [verdict("About €1.74k a year."), verdict("About €0.00174m a year.")], [[], []]);
  expect("an amount nothing returned fails even when small", verdict("It costs €0.30 more."), ["€0.30"]);
  expect("percentages within half a unit of their last digit", [verdict("The spread is 42%."), verdict("The spread is 42.1%.")], [[], ["42.1%"]]);
  expect("a plant code after 'plant' must exist", [verdict("Plant 1010 pays it."), verdict("plant 1011 pays it.")], [[], ["1011"]]);
  k.addRate(1.15, "GBP");
  expect("rates match the run's rate in either direction", [verdict("At 1 GBP = 1.15 EUR."), verdict("At £0.87 per EUR."), verdict("At €1.19 per GBP.")], [[], [], ["€1.19"]]);
  expect("a year after 'in' is exempt, a quantity is not a year", [verdict("In 2026 the group held 240 PD."), verdict("In 2026 the group held 2026 PD.")], [[], ["2026 PD"]]);
  expect("a currency after the amount", [verdict("It is 1,739 EUR a year."), verdict("It is 1,700 EUR a year.")], [[], ["1,700 EUR"]]);
}

for (const f of failures) console.log(`FAIL  ${f}`);
console.log(`F01 to F16: ${asExpected} of ${A.cases.length} as expected; ${checks} checks in all.`);
if (failures.length) { console.log("AUDIT FAILED"); process.exit(1); }
console.log(`AUDIT OK: F01-F16 ${asExpected} of ${A.cases.length} (${checks} checks)`);
