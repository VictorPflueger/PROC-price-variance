// Guardrail policy (brief §7, rules 2 to 7), shared by the live tools (js/tools.js) and, through them,
// by the simulation player and the script checker (js/sim_check.js), so a live run and a scripted
// replay are held to the same rules:
//   - evidence: which lines were normalised and whose contracts were looked up in this run;
//   - only the engine compares: an alert or option set names one pv_compare result and lines of its
//     group only; a proposed cluster counts only after a person confirmed it;
//   - verified alert: that pv_compare result, three normalised lines among them one of the benchmark
//     pair and one of the highest-priced pair, and the benchmark supplier's contract looked up;
//   - options: two or three distinct applicable options from the latest pv_compare of the group, after
//     the verified alert of that group and only for a material group; refused after an approval;
//   - drafts: only after an approval and only of the kinds the decision allows;
//   - report: refused while a decision or a draft is open; its outcome follows the decision;
//   - figures: which tool results a text may quote, by where the text goes.
// Pure module: no DOM, no storage, no network.

import { KnownFigures, auditText } from "./figures.js";
import { DRAFTS_BY_OPTION, DRAFT_WORDS, DRAFT_TYPES } from "./drafts.js";
import { ACCEPT_REASONS } from "./options.js";

export const OUTCOMES = Object.freeze(["option_approved", "variance_accepted", "nothing_found", "stopped"]);
export const OPTION_LETTERS = Object.freeze(["H", "R", "B"]);

// ---- evidence --------------------------------------------------------------------------------------

/** What this run has checked: normalised lines and contract lookups by supplier. */
export class RunEvidence {
  constructor() {
    this.normalised = new Map(); // line id -> { group, excluded }
    this.contracts = new Map();  // supplier id -> Set of contract ids found (empty: looked up, none found)
  }
  noteNormalised(result) {
    if (!result || result.error || !result.line) return;
    this.normalised.set(String(result.line), { group: result.group || null, excluded: !!result.excluded });
  }
  noteContracts(suppliers, result) {
    const found = new Map();
    const add = (c) => { if (c && c.supplier) { if (!found.has(String(c.supplier))) found.set(String(c.supplier), new Set()); found.get(String(c.supplier)).add(String(c.id)); } };
    for (const r of result?.rows || []) if (result.product === "contract") add(r);
    if (result?.product === "contract" && result.record) add(result.record);
    if (result?.related?.contract) add(result.related.contract);
    for (const c of result?.related?.contracts || []) add(c);
    for (const s of suppliers) {
      if (!this.contracts.has(s)) this.contracts.set(s, new Set());
      for (const id of found.get(s) || []) this.contracts.get(s).add(id);
    }
  }
  clone() {
    const c = new RunEvidence();
    c.normalised = new Map(this.normalised);
    c.contracts = new Map([...this.contracts].map(([k, v]) => [k, new Set(v)]));
    return c;
  }
}

const pairLines = (analysis, pairId) => new Set((analysis.pairs.find((p) => p.id === pairId)?.lines) || []);

/**
 * Rule 3: is the alert verified by this run's evidence? Returns { error } with everything missing, or
 * { checked } with the "Checked in this run:" list for the card.
 */
export function verifiedAlert(analysis, evidence) {
  if (!analysis) return { error: "The alert names no pv_compare result of this run. Call pv_compare for the group and pass its compare_id." };
  if (!analysis.benchmark) return { error: `Group ${analysis.id} has no benchmark: no plant–supplier pair buys at least the minimum share of its quantity. There is nothing to raise.` };
  const inGroup = new Set(analysis.lines.map((l) => l.id));
  const done = [...evidence.normalised.entries()].filter(([id, n]) => inGroup.has(id) && !n.excluded).map(([id]) => id);
  const bench = pairLines(analysis, analysis.benchmark.pair);
  const high = pairLines(analysis, analysis.highest?.pair);
  const missing = [];
  if (done.length < 3) missing.push(`normalise at least three of the group's lines with pv_normalise (so far ${done.length})`);
  if (!done.some((id) => bench.has(id))) missing.push(`normalise a line of the benchmark pair ${analysis.benchmark.pair}`);
  if (!done.some((id) => high.has(id))) missing.push(`normalise a line of the highest-priced pair ${analysis.highest?.pair}`);
  const supplier = String(analysis.benchmark.supplier);
  if (!evidence.contracts.has(supplier)) missing.push(`look up the benchmark supplier ${supplier}'s contract with the ERP tools (erp_query on contract with a supplier filter counts, even when it finds none)`);
  if (missing.length) return { error: `A verified alert needs this run's evidence. Missing: ${missing.join("; ")}. Then call ui_report_alert again.` };
  const contracts = [...evidence.contracts.get(supplier)];
  const show = (id) => `${id}${bench.has(id) ? ` (benchmark pair ${analysis.benchmark.pair})` : high.has(id) ? ` (highest pair ${analysis.highest.pair})` : ""}`;
  return {
    checked: [
      `pv_compare of group ${analysis.id}`,
      `${done.length} lines normalised: ${done.slice(0, 6).map(show).join(", ")}${done.length > 6 ? ` and ${done.length - 6} more` : ""}`,
      `contract of supplier ${supplier}: ${contracts.length ? contracts.join(", ") : "none found"}`
    ]
  };
}

/** Rule 2: line ids that are not lines of the compared group (a comparison across groups). */
export function linesOutsideGroup(analysis, lineIds = []) {
  const inGroup = new Set([...analysis.lines.map((l) => l.id), ...analysis.excluded.map((l) => l.id)]);
  return [...new Set(lineIds.map(String))].filter((id) => !inGroup.has(id));
}

/**
 * Rule 4: may these options go on screen? Returns an error message, or null.
 * run: { approved, alert: { group_id } | null, latestCompare: Map group -> compare id }
 */
export function optionsError({ approved, alert, compare, latestCompareId, input }) {
  if (approved) return `A decision was already taken (${approved.label}). Continue with its drafts; the options cannot be proposed again.`;
  if (!compare) return `compare_id "${input.compare_id}" is not a pv_compare result of this run.`;
  if (compare.compare_id !== latestCompareId) return `${compare.compare_id} is not the latest pv_compare of group ${compare.id} (the latest is ${latestCompareId}). Options come from the latest comparison of the group.`;
  if (!alert) return "Raise the verified alert first (ui_report_alert): options follow a verified finding.";
  if (alert.group_id !== compare.id) return `Only the engine compares, one group at a time: the alert is about group ${alert.group_id}, and ${compare.compare_id} is group ${compare.id}. Propose options for the group of the alert.`;
  if (!compare.flagged) return `Group ${compare.id} is below materiality (an opportunity of at least the materiality amount a year and a spread of at least the materiality spread), so there is nothing to propose. Say so and report with outcome nothing_found.`;
  const list = Array.isArray(input.options) ? input.options : [];
  if (list.length < 2 || list.length > 3) return "Propose two or three options (of H, R and B); accepting the variance is always added.";
  const ids = list.map((o) => o.id);
  if (new Set(ids).size !== ids.length) return `Each option once: ${ids.join(", ")}.`;
  for (const id of ids) {
    if (!OPTION_LETTERS.includes(id)) return `Unknown option "${id}"; use H, R or B (accepting the variance is added on its own).`;
    if (!compare.options[id]?.applicable) return `Option ${id} is not applicable to group ${compare.id}: ${(compare.options[id]?.warnings || []).join(" ")}`;
  }
  if (!ids.includes(input.recommended)) return `The recommendation "${input.recommended}" must be one of the options on screen (${ids.join(", ")}).`;
  if (!String(input.reason || "").trim()) return "Give the reason for the recommendation.";
  return null;
}

/** The option with the highest annual savings less one-off cost among the ids (P-5). */
export function bestByNet(compare, ids) {
  return ids.slice().sort((a, b) => compare.options[b].net - compare.options[a].net)[0];
}

/** Rule 4: does a decision count for the options on screen? */
export function decisionError(payload, { optionsSeq, options, rejected, approved }) {
  if (!options) return "no options are on screen";
  if (approved) return "a decision was already taken";
  if (payload.options_seq !== optionsSeq) return "the decision belongs to an earlier set of options";
  const id = payload.option_id;
  if (id === "accept") {
    if (payload.decision !== "approved") return "accepting the variance is a decision of its own";
    if (!ACCEPT_REASONS.includes(payload.reason)) return "accepting the variance needs a reason";
    return null;
  }
  if (!options.some((o) => o.id === id)) return `option ${id} is not on screen`;
  if (rejected.has(id)) return `option ${id} was already rejected`;
  if (!["approved", "rejected"].includes(payload.decision)) return "unknown decision";
  return null;
}

/** Rule 5: may this draft be written? Returns an error message, or null. */
export function draftError({ type, approved }) {
  if (!DRAFT_TYPES.includes(type)) return `type must be one of ${DRAFT_TYPES.join(", ")}.`;
  if (!approved) return "Drafts follow a person's decision. Propose options with ui_propose_options and wait for the decision first.";
  const allowed = DRAFTS_BY_OPTION[approved.id] || [];
  if (!allowed.includes(type)) {
    return `${approved.id === "accept" ? "The variance was accepted" : `Option ${approved.id} was approved`}, which allows only ${allowed.map((t) => `${t} (${DRAFT_WORDS[t]})`).join(" and ")}. A ${type} is not part of it.`;
  }
  return null;
}

/** Rule 6: the report's outcome from the decision. Returns { outcome } or { error }. */
export function reportOutcome({ requested, optionsShown, approved, pendingDrafts = 0, confirmationOpen = false }) {
  if (confirmationOpen) return { error: "A cluster confirmation is still open. Wait for the person's answer first." };
  if (pendingDrafts) return { error: `${pendingDrafts} draft(s) are still waiting for approval. Call ui_await_approvals first.` };
  const asked = OUTCOMES.includes(requested) ? requested : null;
  if (approved) {
    const outcome = approved.id === "accept" ? "variance_accepted" : "option_approved";
    if (asked !== outcome) return { error: `The outcome is ${outcome}: the person ${approved.id === "accept" ? "accepted the variance" : `approved option ${approved.id}`}. Publish the report with outcome "${outcome}".` };
    return { outcome };
  }
  if (optionsShown) return { error: "The options are still waiting for a decision. Call ui_await_decision first; the report follows the decision." };
  if (asked === "nothing_found" || asked === "stopped") return { outcome: asked };
  return { error: "No options were decided, so the outcome is nothing_found (nothing material, or nothing comparable) or stopped (the person stopped the case, for example by rejecting a cluster)." };
}

// ---- figures -------------------------------------------------------------------------------------

/** One set of known figures from several (the audit reads one). */
export function mergeKnown(list) {
  const out = new KnownFigures();
  for (const k of list) {
    if (!k) continue;
    out.amounts.push(...k.amounts);
    out.prices.push(...k.prices);
    out.shares.push(...k.shares);
    out.quantities.push(...k.quantities);
    out.rates.push(...k.rates);
    for (const x of k.counts) out.counts.add(x);
    for (const x of k.ids) out.ids.add(x);
    for (const x of k.codes) out.codes.add(x);
    for (const x of k.names) out.names.add(x);
    for (const x of k.units) out.units.add(x);
  }
  return out;
}

/** The ids, codes and names of the world: a text may name any record that exists. */
export function worldKnown(world) {
  const k = new KnownFigures();
  for (const p of world.plant || []) k.addCode(p.id);
  for (const c of world.company_code || []) { k.addCode(c.code); k.addId(c.id); }
  for (const list of ["supplier", "material", "contract", "buyer", "value_log", "material_group"]) for (const r of world[list] || []) k.addId(r.id);
  for (const l of world.po_line || []) { k.addId(l.id); k.addId(l.order); k.addName(l.short_text); }
  for (const m of world.material || []) k.addName(m.description);
  for (const s of world.supplier || []) k.addName(s.name);
  for (const m of world.material || []) if (m.manufacturer && m.mpn) { k.addId(`MPN:${m.manufacturer}:${m.mpn}`); k.addId(m.mpn); }
  return k;
}

/**
 * The figures a run's tools returned, kept apart by origin, so each kind of text quotes only what it
 * may (rule 7): facts (ERP, rates, normalisations, the scan, candidates, parameters), each comparison
 * at the window's rate, and each sensitivity at a refreshed rate (a projection, quoted as one only in
 * the alert and the report).
 */
export class FigureLedger {
  constructor(world, params) {
    this.facts = mergeKnown([worldKnown(world), new KnownFigures().addParams(params || {})]);
    this.compares = new Map();      // compare id -> KnownFigures (window rate)
    this.sensitivities = new Map(); // compare id -> KnownFigures (refreshed rate)
  }
  addFacts(result) { this.facts.addResult(result); }
  addId(id) { this.facts.addId(id); }
  addCompare(compareId, analysis, sensitivity = null) {
    this.compares.set(compareId, new KnownFigures().addResult(analysis));
    if (sensitivity) this.sensitivities.set(compareId, new KnownFigures().addResult(sensitivity));
  }
  /** alert, report: facts, comparisons and sensitivities; options, draft: facts and the options' comparison. */
  scope(kind, compareId = null) {
    const all = [...this.compares.values()];
    const sens = [...this.sensitivities.values()];
    switch (kind) {
      case "alert": case "report": return mergeKnown([this.facts, ...all, ...sens]);
      case "options": case "draft": return mergeKnown([this.facts, compareId ? this.compares.get(compareId) : all[all.length - 1]]);
      default: return mergeKnown([this.facts]);
    }
  }
  /** The tokens of a text that match no figure of its scope (empty when the text passes). */
  offending(text, kind, compareId = null) {
    const r = auditText(text, this.scope(kind, compareId));
    return r.ok ? [] : [...new Set(r.offending.map((t) => t.raw ?? t))];
  }
}
