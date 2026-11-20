// The script checker: plays every simulation script (data/sim_runs.js) through the live toolbox with
// an automatic person, on every path a presenter can take, before any demo sees it. Run by
// tools/check_world.mjs (AC-13) and by Diagnostics. A script passes only if, on every path:
//   - no tool call is refused by a guardrail (the live rules of js/guards.js: verified alert, one group
//     per comparison, confirmed clusters only, options from the latest comparison, drafts by decision,
//     report outcome) and no text quotes a figure the engine did not return (the figure audit, applied
//     to the narration too);
//   - every {{placeholder}} resolves from this run's engine results;
//   - the verification pattern is there: a hypothesis, a visible "Revised:" line, at least eight tool
//     calls before the first decision (or before the report, for an honest negative);
//   - the run ends with a report whose outcome follows the person's decision.
// Paths: approve the recommendation, approve each other option, reject the recommendation then approve
// the next, reject every option then accept, accept; for a cluster also the confirmed (in either base unit), split (without each plant in turn) and
// rejected answers. Pure module: no DOM, no network.

import { createToolbox } from "./tools.js";
import { runScript, ScriptError } from "./simulation.js";
import { ACCEPT_REASONS } from "./options.js";
import { bestByNet } from "./guards.js";

export const MIN_CALLS_BEFORE_DECISION = 8;
const OPTION_PLANS = ["recommended", "other:0", "other:1", "reject-then-approve", "reject-all-then-accept", "accept"];
// The person's answers to a cluster: confirmed in the proposed base unit and in the other one offered
// (review R4: hours, not person-days), split leaving out each plant in turn (a split without the plant an
// option cannot cover changes what the option may say), and rejected.
const CONFIRM_PLANS = ["confirmed", "confirmed:other-unit", "split:0", "split:1", "split:2", "split:3", "rejected"];

/** Checks every preset scenario's script. Returns { checks: [{ name, ok, detail }], paths, scripts }. */
export async function checkSimRuns(world, fx, params, simRuns = {}, scenarios = []) {
  const checks = [];
  let paths = 0;
  let scripts = 0;
  for (const sc of scenarios) {
    const def = simRuns[sc.id];
    if (!def) {
      checks.push({ name: `Simulation ${sc.number}: script present`, ok: false, detail: `no script for ${sc.id}` });
      continue;
    }
    scripts += 1;
    const r = await checkSimRun(world, fx, params, def);
    paths += r.paths;
    checks.push({
      name: `Simulation ${sc.number}: script valid on every path (${def.source === "recorded" ? "recorded live run" : "authored"})`,
      ok: r.errors.length === 0,
      detail: r.errors.length ? r.errors.slice(0, 3).join(" | ") : r.summary
    });
  }
  return { checks, paths, scripts };
}

/** Plays one script on every path. Returns { errors, paths, summary }. */
export async function checkSimRun(world, fx, params, def) {
  const errors = [];
  if (!def || !Array.isArray(def.steps) || !def.steps.length) return { errors: ["the script has no steps"], paths: 0, summary: "" };
  if (!["authored", "recorded"].includes(def.source)) errors.push(`source must be "authored" or "recorded", not ${JSON.stringify(def.source)}`);
  if (def.source === "authored" && !String(def.hypothesis || "").trim()) errors.push("an authored script states its hypothesis");
  const hasConfirm = JSON.stringify(def.steps).includes("\"confirm\"");
  const first = await playPath(world, fx, params, def, { confirm: "confirmed", option: "recommended" });
  const plans = [];
  for (const confirm of hasConfirm ? CONFIRM_PLANS : [null]) {
    if (confirm === "rejected") { plans.push({ confirm, option: "recommended" }); continue; }
    const probe = confirm === "confirmed" || confirm === null ? first : await playPath(world, fx, params, def, { confirm, option: "recommended" });
    if (!probe.optionsShown) { plans.push({ confirm, option: "recommended" }); continue; }
    for (const option of OPTION_PLANS) plans.push({ confirm, option });
  }
  let played = 0;
  const outcomes = new Set();
  for (const plan of plans) {
    const r = plan.confirm === first.plan.confirm && plan.option === first.plan.option ? first : await playPath(world, fx, params, def, plan);
    if (r.skipped) continue;
    played += 1;
    for (const e of r.errors) errors.push(`${describe(plan)}: ${e}`);
    if (r.outcome) outcomes.add(r.outcome);
  }
  return {
    errors: [...new Set(errors)],
    paths: played,
    summary: `${played} paths; outcomes ${[...outcomes].sort().join(", ") || "none"}; ${first.stats?.callsBeforeDecision ?? 0} tool calls before the first decision`
  };
}

const describe = (plan) => [plan.confirm ? `cluster ${plan.confirm}` : null, `options ${plan.option}`].filter(Boolean).join(", ");

/** One path through a script, with an automatic person (exported for the tests). */
export async function playPath(world, fx, params, def, plan) {
  const errors = [];
  const events = [];
  const drafts = new Map();
  let phase = null;
  let optionsPayload = null;
  let confirmation = null;
  let open = { ok: false, result: {} };
  const decisions = [];
  let decided = false;
  let rejectedOnce = false;
  let skipped = false;

  // The person: answers the open request when the toolbox asks for it.
  const person = {
    option() {
      if (!optionsPayload) return null;
      const p = optionsPayload;
      const ids = p.options.filter((o) => o.id !== "accept").map((o) => o.id);
      const others = ids.filter((id) => id !== p.recommended);
      const decide = (option_id, decision, reason) => ({ type: "option_decision", payload: { options_seq: p.options_seq, option_id, decision, ...(reason ? { reason } : {}), by: "user" } });
      if (decided) return null;
      switch (plan.option) {
        case "recommended": decided = true; return decide(p.recommended, "approved");
        case "other:0": case "other:1": {
          const id = others[Number(plan.option.split(":")[1])];
          if (!id) { skipped = true; decided = true; return decide(p.recommended, "approved"); }
          decided = true;
          return decide(id, "approved");
        }
        case "reject-then-approve":
          if (!rejectedOnce) { rejectedOnce = true; return decide(p.recommended, "rejected"); }
          decided = true;
          return decide(others.slice().sort((a, b) => (p.options.find((o) => o.id === b).net) - (p.options.find((o) => o.id === a).net))[0], "approved");
        case "reject-all-then-accept": {
          const next = ids.find((id) => !decisions.some((d) => d.option_id === id));
          if (next) { decisions.push({ option_id: next }); return decide(next, "rejected"); }
          decided = true;
          return decide("accept", "approved", ACCEPT_REASONS[1]);
        }
        case "accept": decided = true; return decide("accept", "approved", ACCEPT_REASONS[0]);
        default: return null;
      }
    },
    confirmation() {
      if (!confirmation) return null;
      const c = confirmation;
      confirmation = null;
      if (plan.confirm === "rejected") return { type: "confirmation_decision", payload: { request_id: c.request_id, decision: "rejected" } };
      if (String(plan.confirm).startsWith("split:")) {
        // Leave out the lines of one plant the candidate lists (a plan beyond its plants is skipped).
        const drop = c.evidence.plants[Number(plan.confirm.split(":")[1])];
        if (!drop) skipped = true;
        const keep = c.lines.filter((l) => l.plant !== drop).map((l) => l.id);
        return { type: "confirmation_decision", payload: { request_id: c.request_id, decision: "split", base_unit: c.proposed_base_unit, line_ids: keep } };
      }
      if (plan.confirm === "confirmed:other-unit") {
        const other = (c.base_units || []).find((u) => u !== c.proposed_base_unit);
        if (!other) skipped = true;
        return { type: "confirmation_decision", payload: { request_id: c.request_id, decision: "confirmed", base_unit: other || c.proposed_base_unit } };
      }
      return { type: "confirmation_decision", payload: { request_id: c.request_id, decision: "confirmed", base_unit: c.proposed_base_unit } };
    }
  };

  const toolbox = createToolbox({
    world, fx, params,
    emit: (type, payload) => {
      events.push({ type, payload });
      if (type === "options") optionsPayload = payload;
      if (type === "confirmation_request") confirmation = payload;
      if (type === "action_draft") drafts.get(payload.action_id).status = "approved";
      if (type === "notice" && payload.guard) errors.push(`guardrail notice: ${payload.text}`);
    },
    waitUntil: async (test) => {
      const v = test();
      if (!v) throw new ScriptError("the run waits for a person with nothing left to answer");
      return v;
    },
    takeDecision: (kind) => (kind === "option" ? person.option() : person.confirmation()),
    drafts,
    onPhase: (s) => { phase = s; },
    getPhase: () => phase,
    isEnded: () => false,
    signal: null,
    ecbRate: async () => (open.ok ? { ...open.result, ok: true } : { ok: false, error: open.error || "unreachable" }),
    mode: def.source === "recorded" ? "recorded" : "authored",
    entry: "scenario"
  });

  const narration = [];
  let n = 0;
  let stats = null;
  try {
    stats = await runScript(def, {
      world, toolbox,
      say: async (text) => {
        narration.push(text);
        // A recorded run's narration is the model's own and, as live, not audited.
        if (def.source !== "authored") return;
        const bad = toolbox.ledger().offending(text, "report");
        if (bad.length) errors.push(`narration quotes figures no tool returned: ${bad.join(", ")} in "${text.slice(0, 80)}"`);
      },
      think: async (text) => { narration.push(text); },
      pause: async () => {},
      setOpen: (o) => { open = o; },
      nextCallId: () => `chk-${++n}`
    });
  } catch (e) {
    errors.push(e instanceof ScriptError ? e.message : `the run failed: ${e?.message || e}`);
  }
  const st = toolbox.state();
  if (def.source === "authored") {
    if (!narration.some((t) => /^Hypothesis:/i.test(t.trim()))) errors.push("no narration line starts with \"Hypothesis:\"");
    if (!narration.some((t) => /^Revised:/i.test(t.trim()))) errors.push("no visible revision (a narration line starting with \"Revised:\")");
  }
  // A person who rejects the cluster ends the case early; every other path shows the full check.
  if (def.source === "authored" && stats && plan.confirm !== "rejected" && (stats.callsBeforeDecision ?? stats.calls) < MIN_CALLS_BEFORE_DECISION) {
    errors.push(`${stats.callsBeforeDecision ?? stats.calls} tool calls before the first decision; at least ${MIN_CALLS_BEFORE_DECISION} are needed`);
  }
  if (!st.reported) errors.push("the run ends without a report");
  const expected = !st.options
    ? (plan.confirm === "rejected" ? "stopped" : "nothing_found")
    : plan.option === "accept" || plan.option === "reject-all-then-accept" ? "variance_accepted" : "option_approved";
  // A recorded run ends with a note where the presenter answers the cluster differently than live.
  const fine = def.source === "recorded" && !st.options ? ["stopped", "nothing_found"] : [expected];
  if (st.reported && !fine.includes(st.outcome)) errors.push(`outcome ${st.outcome}, expected ${expected}`);
  if (st.options && !st.approved) errors.push("options were shown, but no decision was reached");
  if (st.options) {
    const latest = toolbox.latest().compare;
    const shown = optionsPayload.options.filter((o) => o.id !== "accept").map((o) => o.id);
    if (optionsPayload.recommended !== bestByNet(latest, shown) && !String(def.options?.reason || "").trim()) {
      errors.push(`the recommendation ${optionsPayload.recommended} is not the option with the highest net and the script gives no reason`);
    }
  }
  const drafted = events.filter((e) => e.type === "action_draft").length;
  if (st.approved && !drafted) errors.push("a decision was taken but nothing was drafted");
  return { errors, plan, stats, outcome: st.outcome, optionsShown: !!st.options, skipped, events };
}
