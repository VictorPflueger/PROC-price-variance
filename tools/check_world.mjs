// Checks GlobalCorp SE's world (AC-05, PLAN.md section 3.7): the builder is deterministic and the files are
// current; the 124 accounts equal the extract; plants, lines, units, contracts and materials hold the world's
// rules; every record fits its data contract; each scenario's pattern appears as planted, against its frozen
// reference figures; scenario 4 stays unflagged within ±5 % of the rate; no background group is flagged; the
// past case shows realised value and leakage, and its group is analysed only after the implementation day.
// Every simulation script is played on every path under the live guardrails (AC-13).
//
// Usage: node tools/check_world.mjs        prints "WORLD OK (n checks)" or the failures
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { buildAll, analyseWorld, ratesOf, figuresOf, deliversTo, SEED } from "./build_world.mjs";
import { DEFAULTS } from "../js/params.js";
import { groupIndex, groupIdOf, inWindow, buildGroups } from "../js/groups.js";
import { analyseGroup, scan } from "../js/variance.js";
import { normaliseLine } from "../js/normalise.js";
import { validate, formatErrors } from "../js/schema.js";
import { SCHEMAS, PRODUCT_SCHEMAS } from "../js/schemas.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0;
const failures = [];
const check = (what, ok, detail = "") => { checks += 1; if (!ok) failures.push(`${what}${detail ? `: ${detail}` : ""}`); };

function load(files) {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  for (const f of files) vm.runInContext(readFileSync(path.join(ROOT, f), "utf8"), sandbox);
  return sandbox.window;
}
/** Equal within 1e-9 for numbers, exactly for everything else. */
function sameFigures(a, b, at = "") {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) <= 1e-9 ? null : `${at}: ${a} against ${b}`;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${at}: ${a.length} items against ${b.length}`;
    for (let i = 0; i < a.length; i += 1) { const d = sameFigures(a[i], b[i], `${at}[${i}]`); if (d) return d; }
    return null;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) { const d = sameFigures(a[k], b[k], `${at}.${k}`); if (d) return d; }
    return null;
  }
  return a === b ? null : `${at}: ${JSON.stringify(a)} against ${JSON.stringify(b)}`;
}

// ---- determinism and current files ---------------------------------------------------------------------
const first = buildAll();
const second = buildAll();
check(`two builds with seed ${SEED} give the same bytes`, Object.keys(first).every((f) => first[f] === second[f]));
for (const [f, text] of Object.entries(first)) {
  check(`${f} is current (node tools/build_world.mjs)`, existsSync(path.join(ROOT, f)) && readFileSync(path.join(ROOT, f), "utf8") === text);
}

const { WORLD: W, FX, SCENARIOS, REFERENCE_CASES: REF } = load(["data/fx.js", "data/world.js", "data/scenarios.js", "data/reference_cases.js"]);
const extract = JSON.parse(readFileSync(path.join(ROOT, "tools", "source", "accounts.json"), "utf8"));
const supplierById = Object.fromEntries(W.supplier.map((s) => [s.id, s]));
const plantById = Object.fromEntries(W.plant.map((p) => [p.id, p]));

// ---- accounts ---------------------------------------------------------------------------------------------
{
  const kept = W.supplier.filter((s) => !s.added);
  const fields = ["id", "name", "city", "country", "currency", "category", "company_code"];
  const same = kept.length === extract.accounts.length && extract.accounts.every((a, i) => fields.every((f) => kept[i][f] === a[f]));
  check("the world keeps the 124 accounts of the extract (id, name, city, country, currency, category, company code)", same && kept.length === 124, `${kept.length} kept`);
  const added = W.supplier.filter((s) => s.added);
  check("the added accounts have ids from 80001 and those in GB invoice in pounds", added.length > 0 && added.every((s) => Number(s.id) >= 80001 && (s.country !== "GB" || s.currency === "GBP")));
  check("every supplier delivers to its own country, plus DE and FR from the continent; the new British accounts to GB only",
    W.supplier.every((s) => JSON.stringify(s.delivers_to) === JSON.stringify(s.added && s.country === "GB" ? ["GB"] : deliversTo(s))));
}

// ---- company codes and plants ------------------------------------------------------------------------
check("the three company codes of Rebate Hunter's world", JSON.stringify(W.company_code.map((c) => [c.id, c.code, c.currency])) === JSON.stringify([["CC-1000", "1000", "EUR"], ["CC-2000", "2000", "GBP"], ["CC-3000", "3000", "EUR"]]));
check("four plants: 1010 Frankfurt and 1020 Duisburg (1000), 2010 Birmingham (2000), 3010 Lyon (3000)",
  JSON.stringify(W.plant.map((p) => [p.id, p.company_code, p.city, p.country])) === JSON.stringify([["1010", "CC-1000", "Frankfurt am Main", "DE"], ["1020", "CC-1000", "Duisburg", "DE"], ["2010", "CC-2000", "Birmingham", "GB"], ["3010", "CC-3000", "Lyon", "FR"]]));

// ---- order lines ----------------------------------------------------------------------------------------
const L = W.po_line;
const inWin = L.filter((l) => inWindow(l.order_day, DEFAULTS));
check("about 1,500 order lines in the window (1,400 to 1,600)", inWin.length >= 1400 && inWin.length <= 1600, `${inWin.length}`);
check("every line's supplier delivers to its plant's country", L.every((l) => supplierById[l.supplier]?.delivers_to.includes(plantById[l.plant]?.country)),
  L.filter((l) => !supplierById[l.supplier]?.delivers_to.includes(plantById[l.plant]?.country)).map((l) => l.id).slice(0, 3).join(", "));
check("every line's company code is its plant's", L.every((l) => l.company_code === plantById[l.plant].company_code));
check("every line is in its supplier's invoicing currency", L.every((l) => l.currency === supplierById[l.supplier].currency));
check("only urgent lines carry an urgent reason, and every urgent line has one", L.every((l) => (l.urgent ? Boolean(l.urgent_reason) : l.urgent_reason === null)));
check("services carry no Incoterms rule, goods one", L.every((l) => (l.material_group.startsWith("SRV") ? l.incoterm === null : l.incoterm !== null)));
check("order numbers are unique", new Set(L.map((l) => l.id)).size === L.length);
check("some lines are cancelled", L.some((l) => l.cancelled));
const urgentShare = inWin.filter((l) => l.urgent).length / inWin.length;
check("a few per cent of lines are urgent", urgentShare > 0.01 && urgentShare < 0.06, `${(urgentShare * 100).toFixed(1)} %`);

// ---- materials, groups and contracts -----------------------------------------------------------------------
check("60 to 80 materials", W.material.length >= 60 && W.material.length <= 80, `${W.material.length}`);
const index = groupIndex(W);
check("materials that share a manufacturer part number share a base unit", index.warnings.length === 0, index.warnings.join("; "));
const plantsOfGroup = new Map();
for (const l of inWin) {
  const id = groupIdOf(index, l);
  if (id) plantsOfGroup.set(id, new Set([...(plantsOfGroup.get(id) || []), l.plant]));
}
const thin = [...index.defs.keys()].filter((id) => (plantsOfGroup.get(id)?.size ?? 0) < 2);
check("every comparable group of materials is bought by at least two plants", thin.length === 0, thin.join(", "));
check("20 to 30 contracts", W.contract.length >= 20 && W.contract.length <= 30, `${W.contract.length}`);
const contractById = Object.fromEntries(W.contract.map((c) => [c.id, c]));
const offContract = L.filter((l) => l.contract).filter((l) => {
  const c = contractById[l.contract];
  return !c || c.supplier !== l.supplier || c.material !== l.material || c.company_code !== l.company_code || c.order_unit !== l.order_unit
    || c.price !== l.net_price || c.price_unit !== l.price_unit || c.currency !== l.currency || c.incoterm !== l.incoterm
    || l.order_day < c.valid_from || l.order_day > c.valid_to;
});
check("every line on a contract has the contract's supplier, material, unit, price, currency and Incoterms, inside its validity", offContract.length === 0, offContract.map((l) => l.id).slice(0, 3).join(", "));
const keptWithLines = new Set(L.map((l) => l.supplier).filter((id) => !supplierById[id].added));
check("30 to 40 of the kept accounts have order lines", keptWithLines.size >= 30 && keptWithLines.size <= 40, `${keptWithLines.size}`);

// ---- data contracts ----------------------------------------------------------------------------------------
{
  let invalid = [];
  for (const [product, name] of Object.entries(PRODUCT_SCHEMAS)) {
    for (const r of W[product]) { const v = validate(r, name, { defs: SCHEMAS, path: `${product}[${r.id}]` }); if (!v.ok) invalid = invalid.concat(formatErrors(v.errors)); }
  }
  for (const [c, v] of Object.entries(FX.currencies)) { const r = validate({ currency: c, ...v }, "FxRate", { defs: SCHEMAS }); if (!r.ok) invalid = invalid.concat(formatErrors(r.errors)); }
  check("every record of every data product fits its schema", invalid.length === 0, invalid.slice(0, 3).join("; "));
  const text = readFileSync(path.join(ROOT, "data", "world.js"), "utf8");
  check("no tax id, bank or account number field in the world", !/"(tax_id|bank|iban|bic|last4)"\s*:/i.test(text));
}

// ---- exchange rates -----------------------------------------------------------------------------------------
{
  const cur = Object.entries(FX.currencies).filter(([c]) => c !== "EUR");
  check("data/fx.js is a snapshot or a labelled fallback", ["snapshot", "fallback"].includes(FX.status) && /\d{4}|\d{1,2} \w{3} \d{4}/.test(FX.label || ""));
  check("every rate to EUR is 1 / the mean quote per euro", cur.every(([, v]) => Math.abs(v.rate_to_eur * v.mean_per_eur - 1) < 1e-12));
  const used = [...new Set(L.map((l) => l.currency))];
  check("every currency of an order line has a rate", used.every((c) => Number.isFinite(FX.currencies[c]?.rate_to_eur)), used.join(", "));
}

// ---- scenarios against their frozen figures ---------------------------------------------------------------------
check("the frozen figures were computed at the bundled rates", REF.fx_version === FX.version, `${REF.fx_version} against ${FX.version} (node tools/build_world.mjs)`);
check("six scenarios, each with a tip", SCENARIOS.length === 6 && SCENARIOS.every((s, i) => s.number === i + 1 && s.seed && s.title));
const rates = ratesOf(FX);
const cluster = REF.cases["SC-CONSULT"].cluster;
const { analyses, ctx } = analyseWorld(W, rates, { clusters: [cluster] });
const byId = Object.fromEntries(analyses.map((a) => [a.id, a]));
for (const s of SCENARIOS) {
  const ref = REF.cases[s.id];
  const a = byId[ref.group_id];
  const diff = a ? sameFigures(figuresOf(a), ref.figures, s.id) : "no analysis";
  check(`scenario ${s.number} (${s.short}) equals its frozen figures within 1e-9`, diff === null, diff || "");
}
const plain = analyseWorld(W, rates).analyses;
const flagged = scan(plain).filter((r) => r.flagged).map((r) => r.id);
const S = Object.fromEntries(SCENARIOS.map((s) => [s.number, s]));
const expectFlagged = [S[5].group_id, S[1].group_id, S[3].group_id, S[6].group_id];
check("at the defaults the sweep flags scenarios 5, 1, 3 and 6, in that order, and no other group", JSON.stringify(flagged) === JSON.stringify(expectFlagged), flagged.join(", "));
const shifted = (f) => ({ ...rates, GBP: rates.GBP * f });
const flaggedAt = (f, id) => analyseWorld(W, shifted(f), { clusters: [cluster] }).analyses.find((x) => x.id === id)?.flagged;

{ // 1: gloves
  const a = byId[S[1].group_id];
  const contract = W.contract.find((c) => c.material === S[1].group_id);
  check("1: the benchmark is Frankfurt's contract price", a.benchmark.pair === `1010 / ${contract.supplier}` && Math.abs(a.benchmark.price - contract.price / contract.price_unit / 100) < 1e-12);
  const bham = L.find((l) => l.material === S[1].group_id && l.plant === "2010");
  const perPiece = bham.net_price / bham.price_unit / 1000;
  const pair = a.pairs.find((p) => p.plant === "2010");
  check("1: Birmingham's price per piece in pounds looks below the benchmark; delivered in euros it is above", perPiece < a.benchmark.price && pair.price > a.benchmark.price && bham.incoterm === "FCA" && bham.currency === "GBP");
  check("1: Lyon buys off contract from a local distributor, partly urgent with a reason", a.lines.filter((l) => l.plant === "3010").every((l) => !l.contract && supplierById[l.supplier].city === "Lyon") && a.justified > 0);
  check("1: a line without a conversion is excluded with its reason", a.excluded.some((x) => /^no conversion from PAL to EA$/.test(x.reason)));
  check("1: H moves 1020 and 3010 and leaves 2010", JSON.stringify([a.options.H.plants_moved, a.options.H.plants_not_covered]) === JSON.stringify([["1020", "3010"], ["2010"]]));
}
{ // 2: consultants, a cluster only after confirmation
  const ids = new Set(cluster.line_ids);
  const lines = L.filter((l) => ids.has(l.id));
  check("2: free-text service lines in three company codes, per day and per hour", lines.every((l) => l.material === null && l.material_group === "SRV-CON") && new Set(lines.map((l) => l.company_code)).size === 3 && new Set(lines.map((l) => l.order_unit)).size === 2);
  check("2: before a confirmation the lines are in no comparable group", lines.every((l) => groupIdOf(index, l) === null));
  const a = byId[cluster.id];
  check("2: after the confirmation the cluster is flagged, in person-days", a && a.flagged && a.base_unit === "PD" && Math.abs(a.quantity - 240) < 1e-9);
}
{ // 3: hoses
  const a = byId[S[3].group_id];
  const urgent = a.lines.filter((l) => l.justified > 0);
  check("3: the justified part comes only from urgent lines with a recorded reason", urgent.length > 0 && urgent.every((l) => l.urgent && l.urgent_reason));
  const routine = a.lines.filter((l) => l.plant === "1020" && !l.urgent);
  check("3: Duisburg's routine orders at the same price are unexplained, and they are the larger part", routine.every((l) => l.unexplained > 0 && l.justified === 0) && routine.reduce((s, l) => s + l.unexplained, 0) > a.justified);
}
{ // 4: boxes, an honest negative
  const a = byId[S[4].group_id];
  const lyon = L.find((l) => l.material === S[4].group_id && l.plant === "3010");
  const uk = L.find((l) => l.material === S[4].group_id && l.plant === "2010");
  const asWritten = (uk.net_price / uk.price_unit) * rates.GBP / (lyon.net_price / lyon.price_unit) - 1;
  check("4: the UK pays about 6 % more as written at the bundled rate (2 % to 10 %), delivered, against Lyon's ex-works price", asWritten > 0.02 && asWritten < 0.1 && lyon.incoterm === "EXW" && uk.incoterm === "DAP", `${(asWritten * 100).toFixed(1)} %`);
  check("4: not flagged at the defaults, nor at the rate 5 % lower or higher", !a.flagged && flaggedAt(0.95, a.id) === false && flaggedAt(1.05, a.id) === false);
  check("4: opportunity and spread both below the thresholds at the rate", a.opportunity < DEFAULTS.materiality_eur && a.spread < DEFAULTS.materiality_spread);
}
{ // 5: pallets in pounds
  const a = byId[S[5].group_id];
  check("5: flagged at the rate and at the rate 5 % lower or higher", a.flagged && flaggedAt(0.95, a.id) === true && flaggedAt(1.05, a.id) === true);
  check("5: H does not pay, R and B do", a.options.H.net < 0 && a.options.R.net > 0 && a.options.B.net > 0);
}
{ // 6: the same shoe on two numbers
  const a = byId[S[6].group_id];
  const def = index.defs.get(S[6].group_id);
  check("6: two material numbers with the same manufacturer and part number form one group", def?.kind === "mpn" && def.materials.length === 2 && a.flagged);
  check("6: neither material is analysed on its own", def.materials.every((m) => !byId[m]));
}
for (const s of SCENARIOS) {
  const a = byId[REF.cases[s.id].group_id];
  if (!a.flagged) continue;
  const paying = ["H", "R", "B"].filter((o) => a.options[o].applicable && a.options[o].net > 0);
  check(`${s.number}: at least two applicable options pay in their first year`, paying.length >= 2, paying.join(", "));
}

// ---- the past cases and the value pipeline --------------------------------------------------------------
{
  const P = REF.past_cases;
  check("the implemented option shows realised value to date and leakage", P.implemented.realised > 0 && P.implemented.leakage_lines >= 1 && P.implemented.missed > 0);
  check("its group is analysed only after the implementation day: flagged without the rule, not with it", P.implemented.without_the_rule.flagged === true && P.implemented.analysed_after_implementation.flagged === false);
  const tie = buildGroups(W, ctx).find((g) => g.id === P.implemented.group);
  check("the analysed lines of that group all come after the implementation day", tie.lines.every((l) => l.order_day > W.value_log[0].implemented_day) && tie.left_out.before_implementation > 0);
  check("an approved option without an implementation day, so approved and implemented differ", W.value_log.some((e) => e.implemented_day === null) && REF.pipeline.approved > REF.pipeline.implemented);
  check("the approved stretch film group is not flagged at the defaults", P.approved.flagged === false);
  const baseline = L.filter((l) => l.plant === "1020" && l.material === P.implemented.group && l.supplier === W.value_log[0].old_supplier && l.order_day < -364);
  check("the baseline reaches back before the window with the earlier lines it needs", baseline.length > 0);
}

// ---- every line normalises, or is excluded with its reason --------------------------------------------------
{
  const unitOf = (l) => { const id = groupIdOf(index, l); const def = id && index.defs.get(id); return def ? { group: id, base_unit: def.base_unit, display_quantity: def.display_quantity, conversions: (def.units[l.material] || {}).conversions || {} } : null; };
  const reasons = new Set();
  let unexplainedExclusions = 0;
  for (const l of inWin) {
    const unit = unitOf(l);
    if (!unit || l.cancelled) continue;
    const n = normaliseLine(l, unit, { rates, params: DEFAULTS });
    if (n.excluded) { reasons.add(n.reason); if (!/^no conversion from \S+ to \S+$/.test(n.reason)) unexplainedExclusions += 1; }
  }
  check("every line in a group normalises, or is excluded for a missing conversion with its reason", unexplainedExclusions === 0 && reasons.size >= 1, [...reasons].join("; "));
  const all = analyseGroup({ ...index.defs.get(S[1].group_id), lines: L.filter((l) => l.material === S[1].group_id) }, ctx);
  check("cancelled lines are left out of every figure", all.cancelled.length >= 1 && all.lines.every((l) => !L.find((x) => x.id === l.id).cancelled));
}

// ---- every simulation script, on every path, under the live guardrails (AC-13) --------------------------------
// js/sim_check.js plays each script through the live toolbox (js/tools.js) with an automatic person:
// approve the recommendation, approve each other option, reject then approve, reject all then accept,
// accept; for the cluster also confirm, split and reject. A refused tool call, a figure the engine did
// not return, an unresolved placeholder, a missing hypothesis or revision, fewer than eight tool calls
// before the decision or an outcome that does not follow the decision fails the script.
let scriptPaths = 0;
let scriptCount = 0;
{
  check("data/sim_runs.js exists", existsSync(path.join(ROOT, "data", "sim_runs.js")));
  const { SIM_RUNS } = load(["data/sim_runs.js"]);
  const { checkSimRuns } = await import("../js/sim_check.js");
  const r = await checkSimRuns(W, FX, DEFAULTS, SIM_RUNS || {}, SCENARIOS);
  for (const c of r.checks) check(c.name, c.ok, c.ok ? "" : c.detail);
  check("one script for each of the six scenarios", r.scripts === SCENARIOS.length && SCENARIOS.length === 6, `${r.scripts} scripts`);
  check("every script is authored or recorded", Object.values(SIM_RUNS || {}).every((d) => ["authored", "recorded"].includes(d.source)));
  scriptPaths = r.paths;
  scriptCount = r.scripts;
}

for (const f of failures) console.log(`FAIL  ${f}`);
if (failures.length) { console.log(`WORLD FAILED: ${failures.length} of ${checks} checks`); process.exit(1); }
console.log(`WORLD OK (${checks} checks); SCRIPTS OK (${scriptCount} scripts, ${scriptPaths} paths)`);
