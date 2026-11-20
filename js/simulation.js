// Simulation: a script (data/sim_runs.js) plays the part of the model. Every scripted tool call goes
// through the same toolbox as a live run (js/tools.js), so the engine recomputes every figure at
// playback, the ERP tools answer from the world, and every guardrail and the figure audit apply
// exactly as live. Only open data is replayed from the script, labelled: "representative" in authored
// scripts, "recorded" in scripts captured from a live run with "Save run as simulation".
//
// The step runner below is shared with the script checker (js/sim_check.js), which plays every
// script on every path with an automatic person before a demo ever sees it.
//
// Step types (one key per step):
//   say, think          narration and summarised reasoning ({{placeholders}} filled from the engine)
//   tool + input        any non-person tool, re-executed (erp_*, pv_*, ui_mark_board)
//   open + input        open_ecb_rate with a representative or recorded result
//   board               ui_mark_board
//   alert               ui_report_alert on the latest comparison
//   confirm             ui_confirm_cluster, then the branch for the person's answer:
//                       { candidate, base_unit, note, confirmed: [...], split: [...], rejected: [...] }
//   propose             ui_propose_options with the script's options, then the decision loop: the
//                       script's rejected lines, and for an approval its decisions[id] branch (or the
//                       defaults below: the drafts the decision allows, the approvals, the report)
//   draft, awaitApprovals, report     ui_draft_action, ui_await_approvals, ui_final_report
//   if                  { if: "<var>", then: [...], else: [...] } on a filled variable
//   pause               milliseconds (with any other step)
// A step may carry expect: "refused" to show a guardrail at work; the run fails if it is not refused.

import { bus } from "./events.js";
import { createToolbox, ABORT } from "./tools.js";
import { runVars, fillDeep, fillTemplate, unresolvedKeys } from "./sim_vars.js";
import { bestByNet } from "./guards.js";
import { pinToday } from "./clock.js";
import { dateWithYear } from "./format.js";

export class ScriptError extends Error {}

const REPRESENTATIVE = "Representative result written for this simulation; not a live reading.";

/** What a script proposes when it has no texts of its own for an option. */
export const DEFAULT_OPTION_TEXTS = {
  H: { title: "Harmonise to the benchmark supplier", description: "Move the lines above the benchmark at {{option.H.plants_moved}} to supplier {{option.H.supplier}} ({{option.H.supplier_name}}) at the benchmark price.", residual_risk: "Plants the supplier does not deliver to keep their prices: {{option.H.plants_not_covered}}." },
  R: { title: "Renegotiate to the benchmark", description: "Ask every supplier above the benchmark to match {{group.benchmark}}.", residual_risk: "The savings need every supplier to agree; any that does not keeps its price." },
  B: { title: "Bundle the volume in one tender", description: "One tender for the group's whole volume of {{group.quantity}}, with a bundle discount of {{option.B.bundle}} a year (an assumption).", residual_risk: "A tender takes {{option.B.days}} days to a first saving and may change suppliers." }
};
const AUTO_REASON = "It has the highest annual savings less one-off cost of the options on screen.";

/** The drafts, approvals and report that follow a decision when a script has no branch of its own. */
export const DEFAULT_DECISIONS = {
  H: [
    { say: "Option H is approved. I draft the change request and the buyer notice; nothing is sent." },
    { draft: { type: "change_request", recipient: "Procurement master data", subject: "Change request: {{group.label}} to supplier {{option.H.supplier}}", body: "Please change the source of supply for {{group.label}} at {{option.H.plants_moved}} to supplier {{option.H.supplier}} ({{option.H.supplier_name}}) at the benchmark price of {{group.benchmark}}, from {{date:+30}}.\n\nEvidence: the benchmark is the price {{group.benchmark_plant}} already pays at volume (pair {{group.benchmark_pair}}). Expected savings: {{option.H.savings}} a year for a one-off {{option.H.one_off}}. Plants not covered: {{option.H.plants_not_covered}}." } },
    { draft: { type: "buyer_notice", recipient: "Buyers at {{option.H.plants_moved}}", subject: "{{group.label}}: new source of supply", body: "From {{date:+30}}, please order {{group.label}} from supplier {{option.H.supplier}} ({{option.H.supplier_name}}) at {{group.benchmark}}. Your plant pays more than this for the same item; the comparison shows how much of the difference a documented reason, such as an urgent order, explains. The category manager answers questions." } },
    { awaitApprovals: true },
    { report: { markdown: "## {{group.label}}: option H approved\n\nThe engine compared the group's lines after normalising price unit, unit of measure, currency and delivery terms. The benchmark is {{group.benchmark}} ({{group.benchmark_pair}}); the unexplained variance is {{group.opportunity}} a year, with a spread of {{group.spread}}.\n\nApproved: harmonise to supplier {{option.H.supplier}}, {{option.H.savings}} a year for a one-off {{option.H.one_off}}, first saving after {{option.H.days}} days. Approved is a decision, not a saving: value counts as realised only when later order lines show it.\n\nThe drafts were decided in the Outbox; nothing was sent." } }
  ],
  R: [
    { say: "Option R is approved. I draft the negotiation brief for the buyer; nothing is sent." },
    { draft: { type: "negotiation_brief", recipient: "Category manager", subject: "Negotiation brief: {{group.label}}", body: "Goal: every supplier above the benchmark of {{group.benchmark}} moves to it.\n\nEvidence, normalised by the engine: the benchmark pair {{group.benchmark_pair}} buys at {{group.benchmark}}; the highest pair {{group.highest_pair}} pays {{group.highest}}. The unexplained variance is {{group.opportunity}} a year.\n\nIf every supplier agrees: {{option.R.savings}} a year for a one-off {{option.R.one_off}}. A supplier that does not agree keeps its price; this brief prepares the talks and commits to nothing." } },
    { awaitApprovals: true },
    { report: { markdown: "## {{group.label}}: option R approved\n\nThe benchmark is {{group.benchmark}} ({{group.benchmark_pair}}); the unexplained variance is {{group.opportunity}} a year.\n\nApproved: renegotiate to the benchmark, {{option.R.savings}} a year if every supplier agrees, for a one-off {{option.R.one_off}}. Approved is a decision, not a saving: value counts as realised only when later order lines show it.\n\nThe brief was decided in the Outbox; nothing was sent." } }
  ],
  B: [
    { say: "Option B is approved. I draft the tender request memo; nothing is sent." },
    { draft: { type: "tender_memo", recipient: "Category manager", subject: "Tender request: {{group.label}}", body: "Please prepare one tender for the group's whole volume of {{group.quantity}} across the plants that buy it.\n\nBasis: the benchmark of {{group.benchmark}} ({{group.benchmark_pair}}) and an unexplained variance of {{group.opportunity}} a year. Expected: {{option.B.savings}} a year, of which {{option.B.bundle}} is the bundle discount (an assumption), for a one-off {{option.B.one_off}}; first saving after {{option.B.days}} days." } },
    { awaitApprovals: true },
    { report: { markdown: "## {{group.label}}: option B approved\n\nThe benchmark is {{group.benchmark}} ({{group.benchmark_pair}}); the unexplained variance is {{group.opportunity}} a year.\n\nApproved: one tender for the group's volume, {{option.B.savings}} a year including a bundle discount of {{option.B.bundle}}, for a one-off {{option.B.one_off}}. Approved is a decision, not a saving: value counts as realised only when later order lines show it.\n\nThe memo was decided in the Outbox; nothing was sent." } }
  ],
  accept: [
    { say: "The variance is accepted with a reason. I draft the memo that records it; nothing is sent." },
    { draft: { type: "variance_memo", recipient: "Procurement controlling", subject: "Accepted variance: {{group.label}}", body: "The price variance on {{group.label}} is accepted. Reason: {{decision.reason}}.\n\nThe unexplained part of {{group.opportunity}} a year stays as it is, against a benchmark of {{group.benchmark}} ({{group.benchmark_pair}}). The next sweep shows the group again unless its prices change." } },
    { awaitApprovals: true },
    { report: { markdown: "## {{group.label}}: variance accepted\n\nThe benchmark is {{group.benchmark}} ({{group.benchmark_pair}}); the unexplained variance is {{group.opportunity}} a year.\n\nDecision: the variance is accepted ({{decision.reason}}). Nothing changes for the suppliers, and nothing is counted as approved savings.\n\nThe memo was decided in the Outbox; nothing was sent." } }
  ]
};
export const DEFAULT_REJECTED = {
  H: "Option H is rejected; nothing is drafted for it.",
  R: "Option R is rejected; nothing is drafted for it.",
  B: "Option B is rejected; nothing is drafted for it."
};
const DEFAULT_ALL_REJECTED = "Every option is rejected. Nothing changes unless you accept the variance with a reason.";

/**
 * Runs a script through a toolbox.
 * env: { world, toolbox, def, say(text), think(text), pause(ms), setOpen({ok, result}), nextCallId(),
 *        onCall?(name, out) }
 */
export async function runScript(def, env) {
  const stats = { calls: 0, callsBeforeDecision: null, decided: false, refusals: 0 };
  const vars = () => runVars(env.world, env.toolbox.latest());
  const fill = (value, where) => {
    const missing = [];
    const out = fillDeep(vars(), value, missing);
    if (missing.length) throw new ScriptError(`${where}: unresolved placeholder${missing.length === 1 ? "" : "s"} ${[...new Set(missing)].map((k) => `{{${k}}}`).join(", ")}`);
    return out;
  };

  async function call(name, input, step = {}) {
    stats.calls += 1;
    const out = await env.toolbox.call(env.nextCallId(), name, input);
    env.onCall?.(name, out, input);
    if (env.afterCall) await env.afterCall(name, out);
    if (step.expect === "refused") {
      if (!out.isError) throw new ScriptError(`${name} was expected to be refused by a guardrail, and was not`);
      stats.refusals += 1;
      return out;
    }
    if (out.isError) throw new ScriptError(`${name} refused: ${out.result.error}`);
    return out;
  }

  async function steps(list = []) {
    for (const step of list) {
      if (step.pause) await env.pause(step.pause);
      if (step.say !== undefined) await env.say(fill(step.say, "say"));
      else if (step.think !== undefined) await env.think(fill(step.think, "think"));
      else if (step.tool) await call(step.tool, fill(step.input || {}, step.tool), step);
      else if (step.open) {
        env.setOpen({ ok: step.ok !== false, result: step.result || {}, error: step.error });
        await call(step.open, fill(step.input || {}, step.open), step);
      } else if (step.board) await call("ui_mark_board", fill(step.board, "board"), step);
      else if (step.alert) await call("ui_report_alert", fill({ compare_id: "{{compare.id}}", ...step.alert }, "alert"), step);
      else if (step.confirm) await confirm(step.confirm);
      else if (step.propose) await propose(step.propose === true ? {} : step.propose);
      else if (step.draft) await call("ui_draft_action", fill(step.draft, "draft"), step);
      else if (step.awaitApprovals) await call("ui_await_approvals", {}, step);
      else if (step.report) await report(step);
      else if (step.if !== undefined) {
        const v = vars()[step.if];
        await steps(v ? step.then : step.else);
      }
      if (env.toolbox.state().reported) return;
    }
  }

  async function confirm(c) {
    const input = fill({ candidate_id: c.candidate || "{{candidate.1}}", base_unit: c.base_unit, ...(c.note ? { note: c.note } : {}) }, "confirm");
    const out = await call("ui_confirm_cluster", input);
    const branch = c[out.result.decision];
    if (!branch) throw new ScriptError(`confirm: no branch for the answer "${out.result.decision}"`);
    await steps(branch);
  }

  async function propose(p) {
    const o = def.options || {};
    const latest = env.toolbox.latest().compare;
    if (!latest) throw new ScriptError("propose: no comparison yet");
    const texts = { ...DEFAULT_OPTION_TEXTS, ...(o.texts || {}) };
    const ids = (p.ids || o.ids || ["H", "R", "B"]).filter((id) => latest.options[id]?.applicable && texts[id]).slice(0, 3);
    const recommended = (p.recommended || o.recommended || "auto") === "auto" ? bestByNet(latest, ids) : (p.recommended || o.recommended);
    const reason = (p.recommended || o.recommended || "auto") === "auto" && !(p.reason || o.reason) ? AUTO_REASON : (p.reason || o.reason || AUTO_REASON);
    const input = fill({
      compare_id: "{{compare.id}}",
      options: ids.map((id) => ({ id, title: texts[id].title, description: texts[id].description, residual_risk: texts[id].residual_risk })),
      recommended, reason
    }, "propose");
    if (stats.callsBeforeDecision === null) stats.callsBeforeDecision = stats.calls;
    stats.decided = true;
    let out = await call("ui_propose_options", input);
    for (;;) {
      const r = out.result;
      if (r.decision === "approved") {
        await steps((def.decisions || {})[r.option_id] || DEFAULT_DECISIONS[r.option_id]);
        return;
      }
      const line = (def.rejected || {})[r.option_id] || DEFAULT_REJECTED[r.option_id];
      if (line) await env.say(fill(line, "rejected"));
      if (!(r.remaining_options || []).length) await env.say(fill(def.allRejected || DEFAULT_ALL_REJECTED, "allRejected"));
      out = await call("ui_await_decision", {});
    }
  }

  async function report(step) {
    const r = typeof step.report === "string" ? { markdown: step.report } : step.report;
    const approved = env.toolbox.latest().approved;
    const outcome = r.outcome || step.outcome || (approved ? (approved.id === "accept" ? "variance_accepted" : "option_approved") : "nothing_found");
    if (stats.callsBeforeDecision === null) stats.callsBeforeDecision = stats.calls;
    await call("ui_final_report", { outcome, markdown: fill(r.markdown, "report") });
  }

  await steps(def.steps);
  return stats;
}

// ---- the player (browser) ---------------------------------------------------------------------------

/**
 * Plays a script on the page through the run-event bus.
 * deps: { getSpeed(), world, fx, params }
 */
export function createSimulationPlayer({ getSpeed, getWorld, getFx, getParams, session = null }) {
  let ctx = null;

  async function play(def, { scenario = null } = {}) {
    const recorded = def.source === "recorded";
    const r = {
      ended: false, cancelled: false, waiters: new Set(), poke: null, phase: null, msg: 0, call: 0,
      queues: { option: [], confirmation: [] }, drafts: new Map(), open: null,
      recordedOn: recorded && def.recorded?.at ? dateWithYear(def.recorded.at) : null
    };
    ctx = r;
    if (recorded && def.recorded?.at) pinToday(def.recorded.at);
    // Decisions are captured from the start, so none is lost while the player is busy narrating.
    const offs = [
      bus.on("option_decision", (ev) => { if (!r.ended) { r.queues.option.push(ev); r.poke?.(); } }),
      bus.on("confirmation_decision", (ev) => { if (!r.ended) { r.queues.confirmation.push(ev); r.poke?.(); } }),
      bus.on("action_decision", (ev) => {
        if (r.ended) return;
        const d = r.drafts.get(ev.payload.action_id);
        if (d && d.status === "pending") d.status = ev.payload.decision;
        r.poke?.();
      })
    ];
    const emit = (type, payload) => { if (!r.ended) bus.emit(type, payload); };
    const toolbox = createToolbox({
      world: getWorld(), fx: getFx(), params: getParams(),
      emit,
      waitUntil: (test) => waitUntil(r, test),
      takeDecision: (kind) => r.queues[kind].shift() || null,
      drafts: r.drafts,
      onPhase: (s) => setPhase(r, s),
      getPhase: () => r.phase,
      isEnded: () => r.ended,
      signal: null,
      ecbRate: async () => {
        const o = r.open || { ok: false, result: {} };
        const note = recorded ? `Recorded during a live run${r.recordedOn ? ` on ${r.recordedOn}` : ""}; replayed, not a live reading.` : REPRESENTATIVE;
        if (!o.ok) return { ok: false, error: `${o.error || "unreachable"} (${recorded ? "recorded" : "representative"})` };
        return { ...o.result, ok: true, source: `${o.result.source || "ECB via Frankfurter"} (${recorded ? "recorded" : "representative"})`, note };
      },
      mode: recorded ? "recorded" : "authored",
      entry: "scenario",
      session,
      beforeExecute: (name) => wait(r, name.startsWith("ui_") ? 450 : name.startsWith("pv_") ? 900 : 700)
    });
    try {
      bus.emit("cost_update", { simulated: true, eur: 0, usd: 0, input_tokens: 0, output_tokens: 0, web_searches: 0 });
      setPhase(r, "scanning");
      await runScript(def, {
        world: getWorld(),
        toolbox,
        say: (text) => say(r, text),
        think: async (text) => { emit("reasoning", { msg_id: `sim-r${++r.msg}`, text, done: true }); await wait(r, 300); },
        pause: (ms) => wait(r, ms),
        setOpen: (o) => { r.open = o; },
        nextCallId: () => `sim-c${++r.call}`,
        afterCall: () => wait(r, 350)
      });
      const st = toolbox.state();
      if (!r.ended && !r.cancelled) end(r, st.outcome === "nothing_found" ? "no_findings" : st.reported ? "done" : "incomplete");
    } catch (e) {
      if (e === ABORT || r.cancelled) return;
      console.error(e);
      emit("notice", { level: "error", text: `Simulation stopped: ${e.message}` });
      end(r, "error", e.message);
    } finally {
      offs.forEach((off) => off());
      if (recorded) pinToday(null);
      if (ctx === r) ctx = null;
    }
  }

  function abort(reason = "Stopped by the user.") {
    if (!ctx || ctx.ended) return;
    const r = ctx;
    r.cancelled = true;
    for (const w of r.waiters) w();
    r.waiters.clear();
    end(r, "aborted", reason);
  }

  return { play, abort, isActive: () => !!ctx && !ctx.ended };

  function setPhase(r, state) {
    if (!state || state === r.phase || r.ended) return;
    r.phase = state;
    bus.emit("state_change", { state });
  }

  function end(r, status, reason) {
    if (r.ended) return;
    r.ended = true;
    const state = status === "done" || status === "no_findings" ? "done" : status === "aborted" ? "aborted" : status === "incomplete" ? "stopped" : "error";
    bus.emit("state_change", { state });
    bus.emit("run_end", { status, ...(reason ? { reason } : {}) });
  }

  function wait(r, ms) {
    if (r.cancelled) return Promise.reject(ABORT);
    const speed = Math.max(0.25, Number(getSpeed()) || 1);
    return new Promise((resolve, reject) => {
      const cancel = () => { clearTimeout(t); reject(ABORT); };
      const t = setTimeout(() => { r.waiters.delete(cancel); resolve(); }, ms / speed);
      r.waiters.add(cancel);
    });
  }

  function waitUntil(r, test) {
    if (r.cancelled) return Promise.reject(ABORT);
    const now = test();
    if (now) return Promise.resolve(now);
    return new Promise((resolve, reject) => {
      const check = () => {
        const v = test();
        if (!v) return;
        if (r.poke === check) r.poke = null;
        r.waiters.delete(cancel);
        resolve(v);
      };
      const cancel = () => {
        if (r.poke === check) r.poke = null;
        reject(ABORT);
      };
      r.poke = check;
      r.waiters.add(cancel);
    });
  }

  async function say(r, text) {
    const id = `sim-n${++r.msg}`;
    await wait(r, 350);
    const words = text.split(/(\s+)/);
    let out = "";
    for (let i = 0; i < words.length; i += 6) {
      out += words.slice(i, i + 6).join("");
      if (!r.ended) bus.emit("narration", { msg_id: id, text: out, done: false });
      await wait(r, Math.max(40, (words.slice(i, i + 6).join("").length / 70) * 1000));
    }
    if (!r.ended) bus.emit("narration", { msg_id: id, text, done: true });
    await wait(r, 300);
  }
}

export { fillTemplate, unresolvedKeys };
