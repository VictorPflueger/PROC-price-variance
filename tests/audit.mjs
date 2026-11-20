// The figure audit (brief §7, rule 7) against its cases F01 to F16 (brief §11), and the rules the
// cases do not reach:
//   F         the sixteen texts with the run's figures as the brief types them: result and tokens
//   notes     the brief's three notes: each failing case fails only because of the rule it names
//   engine    the same sixteen verdicts when the known figures come from the engine's own results for
//             M-100 and G5, so the engine types every figure the brief counts as a tool figure
//   rules     exemptions (dates, names with numbers, ids that exist), counts in digits and in words,
//             negative amounts, "per EA", the thousands rule, scales, unknown ids
//   bypasses  the independent review's R2: a label or a year cannot swallow a figure, amounts and
//             percentages in words are read, and a negative figure cannot be written as a gain
//   value     the review's R5: a text may not call value saved or realised; "realised to date" only for
//             a figure the value pipeline returned as realised
// Usage: node tests/audit.mjs
import { readFileSync } from "node:fs";
import path from "node:path";
import { APP_ROOT } from "./lib/harness.mjs";
import { KnownFigures, auditText } from "../js/figures.js";
import { valueClaims } from "../js/guards.js";
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

// ---- the review's bypasses (R2): each disguised figure is read, and the honest forms still pass -------
{
  const k = new KnownFigures();
  k.addAmount(14145.77); k.addAmount(-778.5); k.addAmount(-200); k.addAmount(12501.38); k.addShare(0.42); k.addCount(3); k.addCount(1000);
  k.addPrice(0.069, 100, "EA"); k.addQuantity(240, "PD");
  const verdict = (text) => auditText(text, k).offending;
  expect("R2a: a label does not swallow a percentage (\"a price level 45% above\")", verdict("Lyon pays at a price level 45% above the benchmark."), ["45%"]);
  expect("R2a: a label does not swallow an amount or a quantity", [verdict("Tier 3 €1,600 is cheaper."), verdict("Step 2 250 PD are added.")], [["€1,600"], ["250 PD"]]);
  expect("R2a: labels themselves stay exempt", [verdict("Step 2 of the method and scenario 4."), verdict("At level 3, the rule 5 applies.")], [[], []]);
  expect("R2b: a year does not swallow euros (\"by 2026 euros\")", verdict("Lyon overpays by 2026 euros a month."), ["2026 euros"]);
  expect("R2b: nor pounds, a scale or a unit", [verdict("It rose by 2026 pounds."), verdict("It rose by 2026 thousand."), verdict("It rose by 2026 EA.")], [["2026 pounds"], ["2026"], ["2026 EA"]]);
  expect("R2b: a year stays exempt", [verdict("In 2026 the group held 240 PD."), verdict("Since 2025, by 2027 and for 2026.")], [[], []]);
  expect("R2c: amounts in words are read (\"fifteen thousand euros\")", verdict("Roughly fifteen thousand euros a year stay unexplained."), ["fifteen thousand euros"]);
  expect("R2c: a scale in words is read as an amount", [verdict("About fifteen thousand a year."), verdict("Half a million euros.")], [["fifteen thousand"], ["Half a million euros"]]);
  expect("R2c: a percentage in words is read", [verdict("Lyon pays forty-five per cent more."), verdict("Lyon pays forty-two per cent more.")], [["forty-five per cent"], []]);
  expect("R2c: words that match pass, and counts in words still pass", [verdict("Fourteen thousand one hundred and forty-six euros a year."), verdict("Three suppliers sell above it, per case of a thousand.")], [[], []]);
  expect("R2d: a negative figure is not written as a gain (\"nets €779 a year\")", verdict("Option H nets €779 a year."), ["€779"]);
  expect("R2d: a negative figure with its sign, or as a loss, passes", [verdict("Option H nets -€779 a year."), verdict("Option H loses €779 in its first year."), verdict("It costs €200 more than it saves.")], [[], [], []]);
  expect("R2d: a positive figure with a minus sign fails", verdict("Option H nets -€12,501 a year."), ["-€12,501"]);
}

// ---- value words (review R5): nothing is saved or realised before later order lines show it ----------
{
  const k = new KnownFigures();
  k.addResult({ pipeline: { approved: 11400, implemented: 8000, realised: 2100 } });
  k.addAmount(12501.38);
  const claims = (text) => valueClaims(text, k);
  expect("R5: the reviewer's three texts are refused", [
    claims("Option H: this saves €12,501 a year, realised at once."),
    claims("This saved €12,501 a year."),
    claims("We saved €12,501 a year, realised from today.")
  ].map((x) => x.length > 0), [true, true, true]);
  expect("R5: \"realised\" for a figure that is not realised is refused", [claims("€12,501 realised to date."), claims("Savings of €12,501 a year are realised.")].map((x) => x.length > 0), [true, true]);
  expect("R5: honest wording passes", [
    claims("Approved is a decision, not a saving: value counts as realised only when later order lines show it."),
    claims("Nothing is saved yet; savings of €12,501 a year would follow once the change is in place."),
    claims("The cable ties have realised €2,100 to date."),
    claims("€2,100 realised to date, €8,000 implemented."),
    claims("If approved, H would save €12,501 a year; nothing is realised before later orders show it.")
  ], [[], [], [], [], []]);
}

for (const f of failures) console.log(`FAIL  ${f}`);
console.log(`F01 to F16: ${asExpected} of ${A.cases.length} as expected; ${checks} checks in all.`);
if (failures.length) { console.log("AUDIT FAILED"); process.exit(1); }
console.log(`AUDIT OK: F01-F16 ${asExpected} of ${A.cases.length} (${checks} checks)`);
