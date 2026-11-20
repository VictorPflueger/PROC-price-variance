// The agent's sixteen tools (brief §7): JSON Schemas sent to the model, and executors that run in the
// browser. Both producers use them: the live loop (js/agent.js) passes the model's tool calls, the
// simulation player (js/simulation.js) passes a script's, and the script checker (js/sim_check.js)
// runs every script through them headlessly, so a replay is held to exactly the live guardrails.
//
// Guardrails in code (policy in js/guards.js):
//   - every input is checked against its tool's schema by the app's own validator (js/schema.js);
//   - only the engine compares: pv_compare takes one comparable group (a material, a manufacturer part
//     number or a cluster a person confirmed in this run), never a material group, a candidate or two
//     groups at once; an alert or option set names one pv_compare result and lines of its group only;
//   - a verified alert needs that pv_compare result, three normalised lines (one of the benchmark pair
//     and one of the highest-priced pair among them) and the benchmark supplier's contract looked up;
//   - options: two or three distinct applicable options from the latest pv_compare of the group, after
//     its verified alert, for a material group only, plus accepting the variance; every figure from the
//     engine; a decision counts once and only for the options on screen; accepting needs a reason;
//   - drafts only after an approval and only of the kinds it allows, with the footers added in code;
//   - the report waits for every decision and draft, and its outcome follows the decision;
//   - the figure audit (js/figures.js) on the alert, the option texts, the cluster note, the drafts and
//     the report: refused twice with the offending tokens, then shown with an "Unchecked" tag.
// Every UI effect is a run event (js/events.js), the same in both modes.

import { erpOverview, erpQuery, erpGetRecord, contractLookups, PRODUCT_NAMES, FILTER_OPS, MAX_ROWS, indexOf, buyerRole } from "./erp.js";
import { matchCandidates, clusterLabel } from "./match.js";
import { groupIndex, unitOfLine, buildGroups, inWindow } from "./groups.js";
import { analyseGroup, scan, portfolioIndex } from "./variance.js";
import { normaliseLine, METHOD_VERSION } from "./normalise.js";
import { valuePipeline } from "./pipeline.js";
import { contextOf, ratesOf } from "./world.js";
import { validate, formatErrors } from "./schema.js";
import { RunEvidence, FigureLedger, verifiedAlert, linesOutsideGroup, optionsError, decisionError, draftError, reportOutcome, valueClaims, OUTCOMES, OPTION_LETTERS } from "./guards.js";
import { finalizeDraft, DRAFT_TYPES, DRAFTS_BY_OPTION, DRAFT_WORDS } from "./drafts.js";
import { ACCEPT_REASONS, OPTION_TITLES } from "./options.js";
import { summarizeToolResult, replayTag } from "./summaries.js";
import { toolPlain } from "./tool_plain.js";
import { shortDate } from "./format.js";

export { OUTCOMES };
export const ABORT = Symbol("abort");
export const FIGURE_RETRIES = 2;
export const REPORT_FOOTERS = {
  live: "*Live agent run. GlobalCorp SE and its data are fictional; every figure comes from the deterministic engine.*",
  authored: "*Simulated run (authored script). GlobalCorp SE and its data are fictional; every figure was recomputed by the engine at playback.*",
  recorded: "*Recorded live run, replayed. GlobalCorp SE and its data are fictional; every figure was recomputed by the engine at playback.*"
};
// The states the agent may mark on the board. "approved" and "accepted" (justified) are a person's
// decisions: only the code marks them, after the decision (review R1).
const BOARD_STATES = ["checking", "above", "neutral"];

// ---- schemas ----------------------------------------------------------------------------------------

const str = (description) => ({ type: "string", description });
const strings = (description) => ({ type: "array", items: { type: "string" }, description });
const obj = (properties, required = []) => ({ type: "object", properties, required, additionalProperties: false });

const DEFINITIONS = [
  {
    name: "erp_get_overview",
    description: "Company codes, plants, the data products with row counts and as-of day, the exchange rates of the analysis window with their dates, and the method's parameters (all assumptions). Call first.",
    input_schema: obj({})
  },
  {
    name: "erp_query",
    description: `Rows of one data product, filtered. At most ${MAX_ROWS} rows plus the total count. Filters combine with AND; value is always a string ("in" takes a comma-separated list, gte/lte a number). Days are relative to today (day 0; negative is past). Example: product po_line, filters [{field: "material", op: "eq", value: "20001001"}, {field: "plant", op: "in", value: "1010,3010"}].`,
    input_schema: obj({
      product: { type: "string", enum: PRODUCT_NAMES, description: "The data product." },
      filters: {
        type: "array",
        description: "Conditions on fields of the product (contains is case-insensitive).",
        items: obj({ field: str("A field of the product."), op: { type: "string", enum: FILTER_OPS }, value: str("The value, as a string.") }, ["field", "op", "value"])
      },
      sort: str("A field to sort by; prefix with - for descending (\"-order_day\")."),
      limit: { type: "integer", description: `Rows to return, at most ${MAX_ROWS} (default 20).` }
    }, ["product"])
  },
  {
    name: "erp_get_record",
    description: "One record with its related records: a po_line with its material, supplier, plant, buyer and contract; a material with its contracts and any material sharing its manufacturer part number; a supplier with its contracts and the plants it delivers to; a contract with its supplier and material.",
    input_schema: obj({ product: { type: "string", enum: PRODUCT_NAMES }, id: str("The record's id.") }, ["product", "id"])
  },
  {
    name: "pv_scan",
    description: "Engine: every comparable group with its spread, opportunity, index and materiality flag, ranked by opportunity (flagged first); the portfolio's price variance index and the value pipeline (identified, approved, implemented, realised).",
    input_schema: obj({ limit: { type: "integer", description: "Groups to list (default 15)." } })
  },
  {
    name: "pv_normalise",
    description: "Engine: one order line's normalisation step by step (price per order unit, per base unit, in euros at the window's ECB rate, delivered with the logistics uplift for Incoterms groups E and F), or why it is excluded.",
    input_schema: obj({ line_id: str("The order line, for example 4500010001-00010.") }, ["line_id"])
  },
  {
    name: "pv_compare",
    description: "Engine: one comparable group in full (a material number, MPN:<manufacturer>:<part number>, or a cluster CL-nn a person confirmed in this run): pairs, benchmark, every line's gap with its justified and unexplained part, normalised spend, spread, index, materiality and the options H, R, B and accept with their figures, under a compare_id. With at_rate_of (a rate fetched with open_ecb_rate in this run: its date, or \"latest\"), also the group's figures at that rate as a labelled sensitivity; the window's figures stay the basis.",
    input_schema: obj({ group_id: str("The comparable group."), at_rate_of: str("Date of a rate fetched in this run (YYYY-MM-DD), or \"latest\".") }, ["group_id"])
  },
  {
    name: "pv_match",
    description: "Engine: candidate clusters for free-text or service lines (same material group, units that convert to one base unit, similar short texts, at least two plant–supplier pairs), with their evidence. Candidates never count until a person confirms them with ui_confirm_cluster.",
    input_schema: obj({ text: str("Words of the item or service, in any language."), material_group: str("A material group id, for example SRV-CON."), line_ids: strings("Order lines the candidate should contain.") })
  },
  {
    name: "ui_confirm_cluster",
    description: "Person: opens the cluster dialog with the candidate's lines and evidence and waits (Your confirmation). The person confirms the cluster with a base unit, splits it (confirms some lines) or rejects it. Only a confirmed cluster becomes a comparable group (CL-nn).",
    input_schema: obj({ candidate_id: str("From pv_match."), base_unit: str("The base unit you propose, one of the candidate's base_units."), note: str("One or two sentences for the person: what the lines have in common and what differs.") }, ["candidate_id", "base_unit"])
  },
  {
    name: "open_ecb_rate",
    description: "Open data: the ECB euro reference rate of a currency, today's or of a date, through Frankfurter. Use it for a labelled sensitivity (pv_compare at_rate_of); the analysis keeps the window's mean rate.",
    input_schema: obj({ currency: str("ISO code, for example GBP."), date: str("YYYY-MM-DD; omit for the latest rate.") }, ["currency"])
  },
  {
    name: "ui_mark_board",
    description: "Screen: highlights a group, pairs (\"1010 / 30024\") or lines on the price board. state: checking (what you are reading), above (paid above the benchmark: only pairs and lines the latest pv_compare of the named group puts above it) or neutral. The app marks approved and accepted pairs itself after a person's decision.",
    input_schema: obj({ state: { type: "string", enum: BOARD_STATES }, group_id: str("The group to show."), pair_ids: strings("Pairs, \"plant / supplier\"."), line_ids: strings("Order lines.") }, ["state"])
  },
  {
    name: "ui_report_alert",
    description: "Screen: the verified finding for one pv_compare result. Refused unless this run normalised at least three of the group's lines (one of the benchmark pair and one of the highest-priced pair among them) and looked up the benchmark supplier's contract. Figures in title and summary must be the engine's, written as returned.",
    input_schema: obj({ compare_id: str("The pv_compare result the alert rests on."), title: str("Short title."), summary: str("Two or three sentences: what differs, by how much, and why it is unexplained."), line_ids: strings("The affected lines (optional; default: every line with an unexplained part).") }, ["compare_id", "title", "summary"])
  },
  {
    name: "ui_propose_options",
    description: "Person: puts two or three of the engine's options (H harmonise, R renegotiate, B bundle) on screen from the latest pv_compare of the alert's group, plus accepting the variance, and waits for the person's decision. Every figure comes from the engine by option id; write titles and texts without figures you did not get from a tool. Recommend the option with the highest annual savings less one-off cost, or give your reason.",
    input_schema: obj({
      compare_id: str("The latest pv_compare of the group."),
      options: {
        type: "array",
        description: "Two or three options.",
        items: obj({ id: { type: "string", enum: OPTION_LETTERS }, title: str("Short title."), description: str("What happens, in one or two sentences."), residual_risk: str("What could still go wrong.") }, ["id", "title", "description", "residual_risk"])
      },
      recommended: { type: "string", enum: OPTION_LETTERS },
      reason: str("Why this option, in one sentence.")
    }, ["compare_id", "options", "recommended", "reason"])
  },
  {
    name: "ui_await_decision",
    description: "Person: waits for the next decision on the options on screen (after a rejection).",
    input_schema: obj({})
  },
  {
    name: "ui_draft_action",
    description: "Outbox: a draft of a kind the decision allows: change_request and buyer_notice (H), negotiation_brief (R), tender_memo (B), variance_memo (accept). Nothing is sent; footers are added in code.",
    input_schema: obj({ type: { type: "string", enum: DRAFT_TYPES }, recipient: str("A role, for example \"Buyer, MRO, Lyon\"."), subject: str("Subject."), body: str("Body in plain text; figures only as the engine returned them.") }, ["type", "recipient", "subject", "body"])
  },
  {
    name: "ui_await_approvals",
    description: "Person: waits until every draft in the Outbox is approved or rejected.",
    input_schema: obj({})
  },
  {
    name: "ui_final_report",
    description: "Summary: ends the run with a short Markdown report. outcome follows the decision: option_approved, variance_accepted, or without a decision nothing_found (nothing material or nothing comparable) or stopped (the person stopped the case).",
    input_schema: obj({ outcome: { type: "string", enum: OUTCOMES }, markdown: str("The report.") }, ["outcome", "markdown"])
  }
];

/** The tool list for a request; strict follows P-3 and is dropped once if the API refuses it. */
export function toolDefinitions({ strict = true } = {}) {
  return DEFINITIONS.map((d) => (strict ? { ...d, strict: true } : { ...d }));
}
export const TOOL_NAMES = Object.freeze(DEFINITIONS.map((d) => d.name));
export const UI_BLOCKING_TOOLS = new Set(["ui_confirm_cluster", "ui_propose_options", "ui_await_decision", "ui_await_approvals"]);
/** Independent reads that may run in parallel. */
export const ORDER_FREE = (name) => name.startsWith("erp_") || name === "pv_normalise";

/** The run state a tool call moves the rail to (the rail itself never moves back). */
export function phaseForTool(name, phase, entry) {
  if (["options", "awaiting_approval", "executing"].includes(phase)) return phase;
  if (name === "pv_scan") return "scanning";
  if (name.startsWith("erp_")) return phase === "verifying" || phase === "simulating" ? phase : phase === "scanning" && entry === "sweep" ? "scanning" : "diagnosing";
  if (name === "pv_normalise" || name === "pv_match" || name === "open_ecb_rate") return phase === "simulating" ? phase : "verifying";
  if (name === "pv_compare") return "simulating";
  return phase;
}

// ---- executors ------------------------------------------------------------------------------------

/**
 * One run's tools.
 * ctx: { world, fx, params, emit(type, payload), waitUntil(test) → Promise, takeDecision(kind) → ev|null
 *        (kind "option" or "confirmation", oldest first), drafts: Map, onPhase(state), getPhase(),
 *        isEnded(), signal, ecbRate(input, io) → Promise (resolves, never throws), mode ("live" |
 *        "authored" | "recorded"), entry ("scenario" | "sweep" | "custom"), beforeExecute?(name) → Promise
 *        (the player's pacing) }
 */
export function createToolbox(ctx) {
  const world = ctx.world;
  const params = ctx.params;
  const run = {
    rates: ratesOf(ctx.fx),
    refreshed: new Map(),
    clusters: [],
    candidates: new Map(),
    candidateKeys: new Map(),
    confirmation: null,
    confirmSeq: 0,
    compares: new Map(),
    sensitivities: new Map(),
    latestCompare: new Map(),
    compareSeq: 0,
    scanned: null,
    compared: new Map(),
    evidence: new RunEvidence(),
    ledger: new FigureLedger(world, params),
    alert: null,
    options: null,
    optionsSeq: 0,
    optionsCompare: null,
    optionsPayload: null,
    rejected: new Set(),
    approved: null,
    approvals: [],
    figureRejections: { alert: 0, options: 0, draft: 0, report: 0, cluster: 0 },
    guardrails: 0,
    normalisedCount: 0,
    calls: { erp: 0, engine: 0, open: 0, ui: 0 },
    reported: false,
    outcome: null
  };
  const io = { signal: ctx.signal };
  const emit = (type, payload) => ctx.emit(type, payload);
  const engineCtx = (rates = run.rates) => contextOf(world, rates, params);
  const groupsAt = (rates = run.rates) => buildGroups(world, engineCtx(rates), { clusters: run.clusters });

  const handlers = {
    erp_get_overview: () => erpOverview(world, ctx.fx, params),
    erp_query: (i) => erpQuery(world, ctx.fx, i),
    erp_get_record: (i) => erpGetRecord(world, ctx.fx, i),
    pv_scan: pvScan,
    pv_normalise: pvNormalise,
    pv_compare: pvCompare,
    pv_match: pvMatch,
    ui_confirm_cluster: confirmCluster,
    open_ecb_rate: openEcbRate,
    ui_mark_board: markBoard,
    ui_report_alert: reportAlert,
    ui_propose_options: proposeOptions,
    ui_await_decision: awaitDecision,
    ui_draft_action: draftAction,
    ui_await_approvals: awaitApprovals,
    ui_final_report: finalReport
  };
  const schemas = new Map(DEFINITIONS.map((d) => [d.name, d.input_schema]));

  /** Executes one tool: { content (for the model), isError, result, summary, guard?, detail? }. */
  async function execute(name, input = {}) {
    const fn = handlers[name];
    if (!fn) return done(name, { error: `Unknown tool "${name}". The tools are: ${TOOL_NAMES.join(", ")}.` });
    const checked = validate(input ?? {}, schemas.get(name));
    if (!checked.ok) {
      return done(name, { error: `The input does not match ${name}'s schema: ${formatErrors(checked.errors)}. Correct it and call ${name} again.`, guardrail: "input" });
    }
    let result;
    try {
      result = await fn(input || {});
    } catch (e) {
      if (e === ABORT || typeof e === "symbol" || e?.name === "AbortError") throw e;
      console.error(`[Price Variance Agent] tool ${name} failed:`, e);
      result = { error: `The tool failed unexpectedly (${String(e?.message || "unknown error")}). Try different input or another tool.` };
    }
    if (result && !result.error && result.ok !== false) {
      if (name.startsWith("erp_")) {
        run.calls.erp += 1;
        run.ledger.addFacts(result);
        const suppliers = contractLookups(name, input, result);
        if (suppliers.size) run.evidence.noteContracts(suppliers, result);
      } else if (name.startsWith("pv_")) run.calls.engine += 1;
      else if (name.startsWith("open_")) run.calls.open += 1;
      else run.calls.ui += 1;
    }
    if (result?.guardrail) run.guardrails += 1;
    return done(name, result);
  }

  function done(name, result) {
    const { detail, ...forModel } = result || {};
    const isError = !!(forModel.error || forModel.ok === false);
    return {
      content: JSON.stringify(forModel),
      isError,
      result: forModel,
      summary: summarizeToolResult(name, forModel),
      ...(forModel.guardrail ? { guard: forModel.guardrail } : {}),
      ...(detail ? { detail } : {})
    };
  }

  /** A tool call with its run events (tool_call, then tool_result), for either producer. */
  async function call(callId, name, input = {}) {
    if (!UI_BLOCKING_TOOLS.has(name)) ctx.onPhase(phaseForTool(name, ctx.getPhase(), ctx.entry));
    emit("tool_call", { call_id: callId, name, input, plain: toolPlain(name, input, world, ctx.mode), server: false });
    if (ctx.beforeExecute) await ctx.beforeExecute(name);
    const out = await execute(name, input);
    if (ctx.isEnded?.()) throw ABORT;
    emit("tool_result", {
      call_id: callId, name, ok: !out.isError, summary: out.summary, result: out.result, server: false,
      ...(out.guard ? { guard: out.guard } : {}),
      ...(out.detail ? { detail: out.detail } : {})
    });
    return out;
  }

  const guard = (error, rule) => ({ error, guardrail: rule });

  // -- engine ---------------------------------------------------------------------------------------

  function pipelineNow(identified) {
    const index = groupIndex(world, { clusters: run.clusters });
    return valuePipeline({ valueLog: world.value_log || [], approvals: run.approvals, identified, lines: world.po_line || [], unitOf: (l) => unitOfLine(index, l), ctx: engineCtx() });
  }

  function emitKpi() {
    const scope = run.scanned ? run.scanned.analyses : [...run.compared.values()];
    const flagged = scope.filter((a) => a.flagged);
    const identified = flagged.reduce((s, a) => s + a.opportunity, 0);
    const approvals = run.approvals.filter((x) => scope.some((a) => a.id === x.group));
    const pi = portfolioIndex(scope, approvals);
    const pipe = pipelineNow(identified);
    emit("kpi_update", {
      identified_eur: identified,
      flagged_groups: flagged.length,
      index: scope.length ? pi.index : null,
      index_scope: run.scanned ? "portfolio" : "groups",
      groups_in_scope: scope.length,
      index_projected: pi.projected,
      approved_eur: pipe.approved,
      approved_bundle_eur: pipe.approved_bundle,
      implemented_eur: pipe.implemented,
      realised_eur: pipe.realised,
      leakage_lines: pipe.leakage_lines,
      leakage_missed_eur: pipe.leakage_missed
    });
  }

  function pvScan(i) {
    const groups = groupsAt();
    const analyses = groups.map((g) => analyseGroup(g, engineCtx()));
    const rows = scan(analyses);
    const flagged = rows.filter((r) => r.flagged);
    const portfolio = portfolioIndex(analyses);
    const pipe = pipelineNow(flagged.reduce((s, r) => s + r.opportunity, 0));
    run.scanned = { analyses };
    emitKpi();
    const limit = Math.max(1, Math.min(MAX_ROWS, Number.isInteger(i.limit) ? i.limit : 15));
    emit("board_update", { view: "portfolio", state: "neutral", group_ids: flagged.map((r) => r.id) });
    return {
      method_version: METHOD_VERSION,
      groups: analyses.length,
      flagged: flagged.length,
      portfolio: { unexplained: portfolio.unexplained, spend: portfolio.spend, index: portfolio.index },
      rows: rows.slice(0, limit).map((r) => ({ id: r.id, kind: r.kind, label: r.label, material_group: r.material_group, base_unit: r.base_unit, display_quantity: r.display_quantity, lines: r.lines, pairs: r.pairs, benchmark: r.benchmark, spend: r.spend, opportunity: r.opportunity, index: r.index, spread: r.spread, flagged: r.flagged })),
      pipeline: { identified: pipe.identified, approved: pipe.approved, approved_bundle: pipe.approved_bundle, implemented: pipe.implemented, realised: pipe.realised, leakage_lines: pipe.leakage_lines, leakage_missed: pipe.leakage_missed },
      note: "Opportunity is the unexplained variance over the window, read as euros a year at the current volume (an assumption). Flagged: opportunity and spread at or above the materiality parameters."
    };
  }

  function pvNormalise(i) {
    const id = String(i.line_id);
    const line = indexOf(world).po_line.get(id);
    if (!line) return { error: `No order line "${id}". Line ids look like 4500010001-00010; find them with erp_query on po_line.` };
    const index = groupIndex(world, { clusters: run.clusters });
    const unit = unitOfLine(index, line);
    const n = normaliseLine(line, unit, engineCtx());
    const inGroup = !!unit && !line.cancelled && inWindow(line.order_day, params, 0);
    const res = {
      ...n,
      pair: `${line.plant} / ${line.supplier}`,
      plant: line.plant,
      supplier: line.supplier,
      quantity: line.quantity,
      order_unit: line.order_unit,
      order_day: line.order_day,
      in_window: inWindow(line.order_day, params, 0),
      ...(unit ? {} : { note: line.material ? "The material belongs to no comparable group." : "A free-text line is comparable only inside a cluster a person confirmed (pv_match, then ui_confirm_cluster)." })
    };
    if (inGroup && !n.excluded) { run.evidence.noteNormalised(res); run.normalisedCount += 1; }
    run.ledger.addFacts(res);
    if (unit) emit("board_update", { view: "group", group_id: unit.group, line_ids: [id], state: "checking", focus: unit.group });
    return res;
  }

  function pvCompare(i) {
    const gid = String(i.group_id).trim();
    if (run.candidates.has(gid)) return guard(`${gid} is a candidate, not a comparable group: its lines count only after a person confirms the cluster. Call ui_confirm_cluster with it first.`, "cluster");
    if (/^CAND-\d+$/.test(gid)) return guard(`${gid} is not a candidate of this run, and even a candidate is never a comparable group until a person confirms it (pv_match, then ui_confirm_cluster).`, "cluster");
    if (/^CL-\d+$/.test(gid) && !run.clusters.some((c) => c.id === gid)) return guard(`${gid} is not a cluster a person confirmed in this run. Propose one with pv_match and ui_confirm_cluster.`, "cluster");
    if (/[+,&]|\s(and|vs|with)\s/i.test(gid)) return guard(`Only the engine compares, and only lines of one comparable group: "${gid}" names several. Call pv_compare for one group.`, "groups");
    const groups = groupsAt();
    const g = groups.find((x) => x.id === gid);
    if (!g) {
      const ix = indexOf(world);
      if (ix.material_group.has(gid)) return guard(`${gid} is a material group, not a comparable group. Lines are comparable only within one material, one manufacturer part number or a confirmed cluster; similar items never merge on their own.`, "groups");
      const index = groupIndex(world, { clusters: run.clusters });
      const owner = index.groupOfMaterial.get(gid);
      if (owner && owner !== gid) return { error: `Material ${gid} is compared in group ${owner} (same manufacturer part number). Call pv_compare with that group id.` };
      if (owner) return { error: `Group ${gid} has no lines in the analysis window.` };
      return { error: `Unknown comparable group "${gid}". Use a material number, MPN:<manufacturer>:<part number> or a confirmed cluster CL-nn.` };
    }
    const a = analyseGroup(g, engineCtx());
    run.compareSeq += 1;
    const compareId = `CMP-${run.compareSeq}`;
    const analysis = { ...a, compare_id: compareId };
    let sensitivity = null;
    if (i.at_rate_of !== undefined && String(i.at_rate_of).trim() !== "") {
      const s = sensitivityOf(g, a, String(i.at_rate_of).trim());
      if (s.error) { run.compareSeq -= 1; return s; }
      sensitivity = s;
    }
    run.compares.set(compareId, analysis);
    if (sensitivity) run.sensitivities.set(compareId, sensitivity);
    run.latestCompare.set(gid, compareId);
    run.compared.set(gid, analysis);
    run.ledger.addId(compareId);
    run.ledger.addCompare(compareId, compactAnalysis(analysis), sensitivity);
    emitKpi();
    emit("board_update", { view: "group", group_id: gid, state: "neutral", focus: gid });
    if (sensitivity) emit("fx_sensitivity", { group_id: gid, compare_id: compareId, ...sensitivity });
    return { ...compactAnalysis(analysis), ...(sensitivity ? { sensitivity } : {}), detail: { analysis, sensitivity } };
  }

  function sensitivityOf(g, a, at) {
    const currencies = [...new Set(g.lines.map((l) => l.currency).filter((c) => c && c !== "EUR"))];
    if (!currencies.length) return { error: `Every line of group ${g.id} is in euros, so a refreshed rate changes nothing. Leave at_rate_of out.` };
    const rates = { ...run.rates };
    const used = [];
    for (const cur of currencies) {
      const r = at === "latest" ? run.refreshed.get(cur) : run.refreshed.get(`${cur}@${at}`);
      if (!r) return { error: `No ECB rate for ${cur}${at === "latest" ? "" : ` of ${at}`} was fetched in this run. Call open_ecb_rate first; at_rate_of uses a rate fetched in this run.` };
      rates[cur] = r.rate_to_eur;
      used.push(r);
    }
    const g2 = groupsAt(rates).find((x) => x.id === g.id);
    const b = analyseGroup(g2, engineCtx(rates));
    const r0 = used[0];
    return {
      label: `at the ECB rate of ${shortDate(r0.date)}${replayTag(r0.source)}`,
      currency: r0.currency,
      date: r0.date,
      per_eur: r0.per_eur,
      rate_to_eur: r0.rate_to_eur,
      window_rate_to_eur: run.rates[r0.currency],
      base_unit: b.base_unit,
      display_quantity: b.display_quantity,
      opportunity: b.opportunity,
      spend: b.spend,
      unexplained: b.unexplained,
      index: b.index,
      spread: b.spread,
      flagged: b.flagged,
      benchmark: b.benchmark ? { pair: b.benchmark.pair, price: b.benchmark.price } : null,
      highest: b.highest ? { pair: b.highest.pair, price: b.highest.price } : null,
      pairs: b.pairs.map((p) => ({ pair: p.id, price: p.price, unexplained: p.unexplained })),
      note: "A labelled sensitivity: the tiles, the alert's basis and the options keep the window's mean rate."
    };
  }

  function pvMatch(i) {
    const confirmed = new Set(run.clusters.flatMap((c) => c.line_ids));
    const r = matchCandidates(world, i, { params, today: 0, confirmed });
    const ix = indexOf(world);
    const out = r.candidates.map((c) => {
      let id = run.candidateKeys.get(c.key);
      if (!id) {
        id = `CAND-${run.candidateKeys.size + 1}`;
        run.candidateKeys.set(c.key, id);
      }
      const cand = {
        candidate_id: id,
        material_group: c.material_group,
        base_units: c.base_units,
        proposed_base_unit: c.proposed_base_unit,
        evidence: c.evidence,
        lines: c.lines.map((l) => ({ ...l, supplier_name: ix.supplier.get(l.supplier)?.name ?? null, plant_city: ix.plant.get(l.plant)?.city ?? null }))
      };
      run.candidates.set(id, { ...cand, key: c.key, line_ids: c.line_ids });
      run.ledger.addId(id);
      return cand;
    });
    const res = {
      candidates: out,
      considered: r.considered,
      note: out.length
        ? "Candidates are proposals: their lines are not comparable until a person confirms the cluster with ui_confirm_cluster."
        : "No candidate: no free-text lines of one material group with convertible units and similar texts across at least two plant–supplier pairs."
    };
    run.ledger.addFacts(res);
    if (out[0]) emit("board_update", { view: "candidate", candidate_id: out[0].candidate_id, line_ids: out[0].lines.map((l) => l.id), state: "checking" });
    return res;
  }

  // -- person: cluster ---------------------------------------------------------------------------------

  async function confirmCluster(i) {
    const cand = run.candidates.get(String(i.candidate_id));
    if (!cand) return { error: `Unknown candidate "${i.candidate_id}". Call pv_match first and use one of its candidate_id values.` };
    if (run.confirmation) return { error: "A cluster confirmation is already open." };
    if (run.clusters.some((c) => c.key === cand.key)) return { error: `${i.candidate_id} was already confirmed as ${run.clusters.find((c) => c.key === cand.key).id}.` };
    const base = String(i.base_unit);
    if (!cand.base_units.includes(base)) return { error: `base_unit must be one of ${cand.base_units.join(", ")} for ${cand.candidate_id}.` };
    let note = String(i.note || "").trim().slice(0, 600);
    const audit = figureCheck(note, "cluster", null, "ui_confirm_cluster");
    if (audit.reject) return audit.reject;
    if (audit.flag) note = strike(note, audit.bad);
    run.confirmSeq += 1;
    const requestId = `CF-${run.confirmSeq}`;
    run.confirmation = { request_id: requestId, candidate: cand };
    const lines = cand.lines.map((l) => ({ ...l, buyer: buyerOf(l.id) }));
    emit("confirmation_request", {
      request_id: requestId, candidate_id: cand.candidate_id, material_group: cand.material_group, lines,
      evidence: cand.evidence, base_units: cand.base_units, proposed_base_unit: base, note,
      ...(audit.flag ? { unchecked: audit.bad } : {})
    });
    ctx.onPhase("awaiting_approval");
    let ev = null;
    try {
      ev = await ctx.waitUntil(() => takeConfirmation(requestId));
    } finally {
      run.confirmation = null;
    }
    const p = ev.payload;
    ctx.onPhase("verifying");
    if (p.decision === "rejected") {
      return {
        decision: "rejected", candidate_id: cand.candidate_id,
        next: "The person rejected the cluster: these lines are not comparable, so nothing is compared. Say so in one sentence and publish the report with outcome stopped."
      };
    }
    const chosen = p.decision === "split" ? cand.line_ids.filter((id) => (p.line_ids || []).includes(id)) : cand.line_ids.slice();
    const unit = cand.base_units.includes(p.base_unit) ? p.base_unit : base;
    const clusterId = `CL-${String(run.clusters.length + 1).padStart(2, "0")}`;
    run.clusters.push({ id: clusterId, key: cand.key, base_unit: unit, line_ids: chosen, material_group: cand.material_group, label: clusterLabel(world, cand) });
    run.ledger.addId(clusterId);
    const left = cand.line_ids.filter((id) => !chosen.includes(id));
    return {
      decision: p.decision, candidate_id: cand.candidate_id, cluster_id: clusterId, base_unit: unit, line_ids: chosen,
      ...(left.length ? { left_out: left } : {}),
      next: `${clusterId} is now a comparable group with base unit ${unit}${left.length ? `, without the ${left.length} lines the person left out` : ""}. Compare it with pv_compare (group_id "${clusterId}"); normalise its lines with pv_normalise.`
    };
  }

  function takeConfirmation(requestId) {
    for (let ev = ctx.takeDecision("confirmation"); ev; ev = ctx.takeDecision("confirmation")) {
      const p = ev.payload || {};
      if (p.request_id !== requestId) { guardNotice("confirmation ignored: it belongs to another request"); continue; }
      if (!["confirmed", "split", "rejected"].includes(p.decision)) { guardNotice("confirmation ignored: unknown answer"); continue; }
      if (p.decision === "split" && (!Array.isArray(p.line_ids) || p.line_ids.length < 2)) { guardNotice("a split needs at least two confirmed lines"); continue; }
      return ev;
    }
    return null;
  }

  function buyerOf(lineId) {
    const l = indexOf(world).po_line.get(lineId);
    return l?.buyer ? buyerRole(world, l.buyer) : null;
  }

  // -- open data ----------------------------------------------------------------------------------------

  async function openEcbRate(i) {
    const currency = String(i.currency).toUpperCase();
    if (currency === "EUR") return { error: "Euro lines need no rate." };
    const res = await ctx.ecbRate({ currency, date: i.date || null }, io);
    if (res && res.ok) {
      const r = { ...res, currency };
      run.refreshed.set(currency, r);
      run.refreshed.set(`${currency}@${r.date}`, r);
      run.ledger.addFacts(r);
      return r;
    }
    const bundled = ctx.fx?.currencies?.[currency];
    emit("notice", { level: "warn", text: `The ECB rate for ${currency} could not be fetched (${res?.error || "no answer"}). The analysis keeps the bundled rates${bundled ? ` (${ctx.fx.label})` : ""}.` });
    return {
      ok: false,
      currency,
      error: res?.error || "The rate could not be fetched.",
      bundled_rate_stays: true,
      bundled: bundled ? { currency, rate_to_eur: bundled.rate_to_eur, label: ctx.fx.label } : null,
      next: "Continue with the bundled rates and say that the refreshed rate could not be checked."
    };
  }

  // -- screen -------------------------------------------------------------------------------------------

  function markBoard(i) {
    const ix = indexOf(world);
    const index = groupIndex(world, { clusters: run.clusters });
    const gid = i.group_id ? String(i.group_id) : null;
    const knownGroup = gid && (index.defs.has(gid) || run.candidates.has(gid));
    const lines = [...new Set((i.line_ids || []).map(String))];
    const pairs = [...new Set((i.pair_ids || []).map(String))];
    const okLines = lines.filter((id) => ix.po_line.has(id)).slice(0, 60);
    const okPairs = pairs.filter((p) => /^\S+ \/ \S+$/.test(p) && ix.plant.has(p.split(" / ")[0]) && ix.supplier.has(p.split(" / ")[1])).slice(0, 20);
    const ignored = [...lines.filter((x) => !okLines.includes(x)), ...pairs.filter((x) => !okPairs.includes(x)), ...(gid && !knownGroup ? [gid] : [])];
    if (i.state === "above") {
      // "above" says a price is paid above the benchmark, so it needs the benchmark: only the pairs and
      // lines the latest comparison of the named group puts above it (review R1).
      if (!gid) return guard("state above needs the group (group_id) whose latest pv_compare puts these pairs or lines above the benchmark.", "board");
      const a = run.compares.get(run.latestCompare.get(gid));
      if (!a) return guard(`state above needs the benchmark of group ${gid}: compare it first (pv_compare), then mark what the comparison puts above the benchmark.`, "board");
      const strangers = [...pairs.filter((p) => !a.pairs.some((x) => x.id === p)), ...lines.filter((l) => !a.lines.some((x) => x.id === l))];
      if (strangers.length) return guard(`${strangers.slice(0, 5).join(", ")} ${strangers.length === 1 ? "is" : "are"} not a pair or line of group ${gid}'s latest comparison.`, "board");
      const below = [...a.pairs.filter((p) => pairs.includes(p.id) && !(p.gap > 1e-9)).map((p) => `pair ${p.id}`), ...a.lines.filter((l) => lines.includes(l.id) && !(l.gap > 1e-9)).map((l) => `line ${l.id}`)];
      if (below.length) return guard(`${below.slice(0, 5).join(", ")} ${below.length === 1 ? "is" : "are"} not above the benchmark of group ${gid} (${a.compare_id}); mark only what is paid above it.`, "board");
    }
    emit("board_update", { view: knownGroup && run.candidates.has(gid) ? "candidate" : "group", ...(knownGroup ? { group_id: gid, focus: gid } : {}), pair_ids: okPairs, line_ids: okLines, state: i.state });
    return { ok: true, marked: okLines.length + okPairs.length + (knownGroup ? 1 : 0), ...(ignored.length ? { ignored_unknown_ids: ignored } : {}) };
  }

  function reportAlert(i) {
    const a = run.compares.get(String(i.compare_id));
    if (!a) return guard(`compare_id "${i.compare_id}" is not a pv_compare result of this run.`, "alert");
    if (run.alert && run.alert.group_id !== a.id) return guard(`This run already raised an alert for group ${run.alert.group_id}; one finding per run.`, "groups");
    if (run.latestCompare.get(a.id) !== a.compare_id) return guard(`${a.compare_id} is not the latest pv_compare of group ${a.id} (the latest is ${run.latestCompare.get(a.id)}).`, "alert");
    const outside = linesOutsideGroup(a, i.line_ids || []);
    if (outside.length) return guard(`Only the engine compares, one group at a time: ${outside.slice(0, 5).join(", ")} ${outside.length === 1 ? "is" : "are"} not lines of group ${a.id}. An alert names lines of its own group only.`, "groups");
    const v = verifiedAlert(a, run.evidence);
    if (v.error) return guard(v.error, "alert");
    let title = String(i.title || "Price variance finding").trim().slice(0, 160);
    let summary = String(i.summary || "").trim().slice(0, 700);
    const words = valueCheck(`${title}\n${summary}`, "alert", null, "ui_report_alert");
    if (words) return words;
    const audit = figureCheck(`${title}\n${summary}`, "alert", null, "ui_report_alert");
    if (audit.reject) return audit.reject;
    if (audit.flag) { title = strike(title, audit.bad); summary = strike(summary, audit.bad); }
    const affected = (i.line_ids && i.line_ids.length ? i.line_ids.map(String) : a.lines.filter((l) => l.unexplained > 0).map((l) => l.id));
    const buyers = [...new Set(affected.map(buyerOf).filter(Boolean))];
    run.alert = { compare_id: a.compare_id, group_id: a.id };
    emit("alert", {
      compare_id: a.compare_id, group_id: a.id, label: a.label, title, summary, line_ids: affected, buyers, checked: v.checked,
      opportunity: a.opportunity, spread: a.spread, index: a.index, base_unit: a.base_unit, display_quantity: a.display_quantity,
      benchmark: a.benchmark, highest: a.highest,
      ...(audit.flag ? { unchecked: audit.bad } : {})
    });
    emit("board_update", { view: "group", group_id: a.id, line_ids: affected, state: "above", focus: a.id });
    return { ok: true, shown: true, checked: v.checked, affected_lines: affected.length };
  }

  // -- options and decisions --------------------------------------------------------------------------

  async function proposeOptions(i) {
    const compare = run.compares.get(String(i.compare_id));
    const err = optionsError({ approved: run.approved, alert: run.alert, compare, latestCompareId: compare ? run.latestCompare.get(compare.id) : null, input: i });
    if (err) return guard(err, "options");
    const texts = i.options.flatMap((o) => [o.title, o.description, o.residual_risk]);
    const words = valueCheck([...texts, i.reason].join("\n"), "options", compare.compare_id, "ui_propose_options");
    if (words) return words;
    const audit = figureCheck([...texts, i.reason].join("\n"), "options", compare.compare_id, "ui_propose_options");
    if (audit.reject) return audit.reject;
    const fix = (s, n) => (audit.flag ? strike(String(s || "").slice(0, n), audit.bad) : String(s || "").slice(0, n));
    const cards = i.options.map((o) => ({
      ...optionFigures(compare.options[o.id]),
      id: o.id,
      title: fix(o.title, 90),
      description: fix(o.description, 400),
      residual_risk: fix(o.residual_risk, 300),
      recommended: o.id === i.recommended
    }));
    cards.push({
      ...optionFigures(compare.options.accept),
      id: "accept", title: OPTION_TITLES.accept, description: "Record the variance with a reason; nothing changes for the suppliers.", residual_risk: "", recommended: false,
      residual: compare.unexplained, index_after: compare.index, reasons: ACCEPT_REASONS.slice()
    });
    // Decisions queued for an earlier set of options do not count for this one.
    for (let ev = ctx.takeDecision("option"); ev; ev = ctx.takeDecision("option")) guardNotice("decision ignored: it belongs to an earlier set of options");
    run.optionsSeq += 1;
    run.options = cards;
    run.optionsCompare = compare.compare_id;
    run.rejected.clear();
    run.optionsPayload = {
      options_seq: run.optionsSeq, compare_id: compare.compare_id, group_id: compare.id, label: compare.label,
      base_unit: compare.base_unit, display_quantity: compare.display_quantity,
      recommended: i.recommended, reason: fix(i.reason, 300), options: cards,
      opportunity: compare.opportunity, index: compare.index, spend: compare.spend
    };
    ctx.onPhase("options");
    emit("options", run.optionsPayload);
    return waitForDecision();
  }

  async function awaitDecision() {
    if (!run.options) return guard("No options are on screen. Use ui_propose_options first.", "options");
    if (run.approved) return guard(`A decision was already taken (${run.approved.label}). Continue with its drafts.`, "options");
    return waitForDecision();
  }

  function takeValidDecision() {
    for (let ev = ctx.takeDecision("option"); ev; ev = ctx.takeDecision("option")) {
      const why = decisionError(ev.payload || {}, { optionsSeq: run.optionsSeq, options: run.options, rejected: run.rejected, approved: run.approved });
      if (why) { guardNotice(`decision ignored: ${why}`); continue; }
      return ev;
    }
    return null;
  }

  async function waitForDecision() {
    ctx.onPhase("awaiting_approval");
    const ev = await ctx.waitUntil(() => takeValidDecision());
    const { option_id: id, decision, reason } = ev.payload;
    const compare = run.compares.get(run.optionsCompare);
    const card = run.options.find((o) => o.id === id);
    if (decision === "approved") {
      const label = id === "accept" ? `Accept the variance (${reason})` : `Option ${id}: ${card.title}`;
      run.approved = { id, label, reason: id === "accept" ? reason : null, compare_id: compare.compare_id, group_id: compare.id };
      if (id !== "accept") run.approvals.push({ group: compare.id, option: id, savings: card.savings, bundle: card.bundle });
      emitKpi();
      const o = compare.options[id === "accept" ? "accept" : id];
      emit("board_update", {
        view: "group", group_id: compare.id, focus: compare.id, state: id === "accept" ? "justified" : "approved",
        pair_ids: id === "accept" ? compare.pairs.filter((p) => p.unexplained > 0).map((p) => p.id) : compare.pairs.filter((p) => p.unexplained > 0 && (o.plants || []).includes(p.plant)).map((p) => p.id),
        option_id: id, ...(id === "accept" ? { reason } : {})
      });
      ctx.onPhase("executing");
      const allowed = DRAFTS_BY_OPTION[id];
      const outcome = id === "accept" ? "variance_accepted" : "option_approved";
      return {
        decision: "approved", option_id: id, option: label, ...(id === "accept" ? { reason } : {}),
        figures: id === "accept" ? { residual: compare.unexplained } : { savings: card.savings, bundle: card.bundle, one_off: card.one_off, net: card.net, days_to_first_saving: card.days_to_first_saving },
        next: `Draft what this decision allows, and nothing else: ${allowed.map((t) => `${t} (${DRAFT_WORDS[t]})`).join(" and ")}. Then call ui_await_approvals, then ui_final_report with outcome ${outcome}.`
      };
    }
    run.rejected.add(id);
    const remaining = run.options.filter((o) => o.id !== "accept" && !run.rejected.has(o.id)).map((o) => o.id);
    return {
      decision: "rejected", option_id: id, remaining_options: remaining,
      next: remaining.length
        ? "Acknowledge the rejection in one sentence and draft nothing for it. Then call ui_await_decision for the next decision."
        : "Every option was rejected. Nothing changes unless the person accepts the variance with a reason; say so in one sentence and call ui_await_decision."
    };
  }

  // -- drafts and approvals -----------------------------------------------------------------------------

  function draftAction(i) {
    const err = draftError({ type: i.type, approved: run.approved });
    if (err) return guard(err, "drafts");
    const subject = String(i.subject || "").trim().slice(0, 200);
    const raw = String(i.body || "").trim();
    if (!subject || !raw) return { error: "subject and body are required." };
    const words = valueCheck(`${subject}\n${raw}`, "draft", run.optionsCompare, "ui_draft_action");
    if (words) return words;
    const audit = figureCheck(`${subject}\n${raw}`, "draft", run.optionsCompare, "ui_draft_action");
    if (audit.reject) return audit.reject;
    const body = finalizeDraft(i.type, audit.flag ? `${raw}\n\nUnchecked figures (no tool returned them): ${audit.flag}. Check them against the option card before approving.` : raw);
    const actionId = `act-${ctx.drafts.size + 1}`;
    const recipient = String(i.recipient || "").trim().slice(0, 160);
    ctx.drafts.set(actionId, { status: "pending", type: i.type, subject, recipient });
    ctx.onPhase("executing");
    emit("action_draft", { action_id: actionId, type: i.type, recipient, subject, body, status: "pending", option_id: run.approved.id, ...(audit.flag ? { unchecked: audit.bad } : {}) });
    return { action_id: actionId, status: "pending_approval", note: "Queued in the Outbox as a draft. Nothing is sent." };
  }

  async function awaitApprovals() {
    const pending = () => [...ctx.drafts.values()].filter((d) => d.status === "pending").length;
    if (!ctx.drafts.size) return guard("There are no drafts. Use ui_draft_action first.", "drafts");
    if (pending()) {
      ctx.onPhase("awaiting_approval");
      emit("notice", { level: "info", text: `Waiting for your approval of ${pending()} draft${pending() === 1 ? "" : "s"} in the Outbox.` });
      await ctx.waitUntil(() => pending() === 0);
    }
    ctx.onPhase("executing");
    const decisions = [...ctx.drafts.entries()].map(([id, d]) => ({ action_id: id, type: d.type, subject: d.subject, decision: d.status }));
    return {
      all_decided: true,
      approved: decisions.filter((d) => d.decision === "approved").length,
      rejected: decisions.filter((d) => d.decision === "rejected").length,
      decisions,
      next: "Publish the report with ui_final_report. Approved drafts are cleared for a person to send; nothing was sent."
    };
  }

  function finalReport(i) {
    const pendingDrafts = [...ctx.drafts.values()].filter((d) => d.status === "pending").length;
    const o = reportOutcome({ requested: i.outcome, optionsShown: !!run.options, approved: run.approved, pendingDrafts, confirmationOpen: !!run.confirmation });
    if (o.error) return guard(o.error, "report");
    let markdown = String(i.markdown || "").trim().slice(0, 19000);
    if (markdown.length < 40) return { error: "The report is empty. Write a short Markdown report." };
    const words = valueCheck(markdown, "report", null, "ui_final_report");
    if (words) return words;
    const audit = figureCheck(markdown, "report", null, "ui_final_report");
    if (audit.reject) return audit.reject;
    if (audit.flag) markdown = `${markdown}\n\n*Unchecked figures (no tool returned them): ${audit.flag}.*`;
    const footer = REPORT_FOOTERS[ctx.mode] || REPORT_FOOTERS.live;
    if (!markdown.includes(footer)) markdown = `${markdown}\n\n${footer}`;
    run.reported = true;
    run.outcome = o.outcome;
    emit("report", { markdown, outcome: o.outcome, ...(audit.flag ? { unchecked: audit.bad } : {}) });
    return { ok: true, published: true, outcome: o.outcome, next: "End your turn now with one short closing sentence." };
  }

  // -- figure audit ------------------------------------------------------------------------------------

  /**
   * Rule 7: refuses a text up to FIGURE_RETRIES times with the tokens to fix, then lets it through with
   * the unchecked tokens marked, and says so in the console.
   */
  function figureCheck(text, kind, compareId, tool) {
    if (!String(text || "").trim()) return {};
    const scope = kind === "cluster" ? "facts" : kind;
    const bad = run.ledger.offending(text, scope, compareId);
    if (!bad.length) return {};
    const list = bad.slice(0, 8).join(", ");
    if (run.figureRejections[kind] < FIGURE_RETRIES) {
      run.figureRejections[kind] += 1;
      return { reject: guard(`These figures match nothing a tool returned that this text may quote: ${list}. Write figures exactly as the engine, ERP or rate results give them (or leave them out), then call ${tool} again.`, "figures") };
    }
    const where = { draft: "draft", report: "report", options: "option cards", alert: "alert", cluster: "cluster note" }[kind];
    emit("notice", { level: "warn", text: `The ${where} quote${kind === "options" ? "" : "s"} figures no tool returned (${list}); they are shown with an Unchecked tag.` });
    return { flag: list, bad };
  }

  // Value words (review R5): nothing is saved or realised before later order lines show it, so a text that
  // says so is refused every time, whatever it says about figures.
  function valueCheck(text, kind, compareId, tool) {
    const bad = valueClaims(text, run.ledger.scope(kind, compareId));
    if (!bad.length) return null;
    return guard(`Nothing is saved or realised before later order lines show it: approved savings are a decision, written "a year" ("savings of €… a year", "would save"), and realised value is only what the value pipeline returned "to date". Reword: ${bad.map((x) => `"${x}"`).join("; ")}. Then call ${tool} again.`, "value");
  }

  function guardNotice(text) {
    run.guardrails += 1;
    emit("notice", { level: "warn", guard: true, text: `Guardrail: ${text}.` });
  }

  return {
    execute,
    call,
    state: () => ({
      reported: run.reported, outcome: run.outcome, approved: run.approved, options: !!run.options, alert: run.alert,
      confirmationOpen: !!run.confirmation, clusters: run.clusters.map((c) => ({ ...c })), compares: run.compareSeq,
      guardrails: run.guardrails, normalised: run.normalisedCount, calls: { ...run.calls }, approvals: run.approvals.slice()
    }),
    /** The engine figures a script may name (js/sim_vars.js reads them). */
    latest: () => ({
      compare: run.compares.get([...run.compares.keys()].pop()) || null,
      sensitivity: run.sensitivities.get([...run.compares.keys()].pop()) || null,
      scanned: run.scanned,
      candidates: [...run.candidates.values()],
      clusters: run.clusters.slice(),
      refreshed: [...run.refreshed.entries()].filter(([k]) => !k.includes("@")).map(([, v]) => v),
      approved: run.approved,
      optionsPayload: run.optionsPayload,
      drafts: [...ctx.drafts.values()]
    }),
    ledger: () => run.ledger
  };
}

/** The engine's figures of one option, as the cards show them. */
export function optionFigures(o) {
  return {
    applicable: o.applicable,
    savings: o.savings, bundle: o.bundle, one_off: o.one_off, net: o.net, residual: o.residual, index_after: o.index_after,
    days_to_first_saving: o.days_to_first_saving, plants: o.plants || [], suppliers: o.suppliers || [], warnings: o.warnings || [],
    ...(o.share_after !== undefined ? { share_after: o.share_after } : {}),
    ...(o.plants_moved ? { plants_moved: o.plants_moved, plants_not_covered: o.plants_not_covered } : {}),
    ...(o.supplier ? { supplier: o.supplier } : {})
  };
}

/** One group's analysis as the model reads it: totals, pairs, compact lines, exclusions and options. */
export function compactAnalysis(a) {
  return {
    compare_id: a.compare_id,
    group: a.id,
    kind: a.kind,
    label: a.label,
    material_group: a.material_group,
    base_unit: a.base_unit,
    display_quantity: a.display_quantity,
    method_version: a.method_version,
    quantity: a.quantity,
    spend: a.spend,
    gap: a.gap,
    justified: a.justified,
    unexplained: a.unexplained,
    opportunity: a.opportunity,
    index: a.index,
    spread: a.spread,
    flagged: a.flagged,
    materiality: a.materiality,
    benchmark: a.benchmark,
    highest: a.highest,
    pairs: a.pairs.map((p) => ({ pair: p.id, plant: p.plant, supplier: p.supplier, quantity: p.quantity, price: p.price, share: p.share, gap: p.gap, justified: p.justified, unexplained: p.unexplained, eligible: p.eligible, lines: p.lines })),
    lines: a.lines.map((l) => ({ id: l.id, pair: l.pair, quantity: l.quantity, price: l.price, gap: l.gap, justified: l.justified, unexplained: l.unexplained, urgent: l.urgent, ...(l.urgent_reason ? { urgent_reason: l.urgent_reason } : {}), contract: l.contract, order_day: l.order_day })),
    excluded: a.excluded,
    options: Object.fromEntries(Object.entries(a.options).map(([k, o]) => [k, { title: o.title, ...optionFigures(o), ...(o.reasons ? { reasons: o.reasons } : {}) }])),
    note: "Every figure comes from the engine. Opportunity: the unexplained parts over the window, read as euros a year at the current volume (an assumption)."
  };
}

/** Marks unchecked tokens in a short text shown on a card: "€1.2M" becomes "€1.2M (unchecked)". */
export function strike(text, bad = []) {
  let out = String(text || "");
  for (const raw of bad) out = out.split(raw).join(`${raw} (unchecked)`);
  return out;
}
