// Run recorder: turns a completed live run (its audit event stream) into a simulation script in the
// data/sim_runs.js format ("Save run as simulation", decision D6). The script replays through the same
// toolbox as every simulation, so every figure is recomputed by the engine at playback, never copied.
//
// What is kept: the agent's narration and reasoning summaries, every successful tool call in order with
// its input, the rate results it fetched (labelled "recorded"), the cluster confirmation, the alert,
// the options it proposed with their texts, its drafts and its report. The person's decisions are not
// baked in: the replay waits for new ones. A cluster answer the live run did not take ends the replay
// with a note; an option it did not take follows the player's default drafts. The key never enters a
// recording: the audit stream holds none, and the script is redacted again.

import { auditEvents, auditRunInfo } from "./audit.js";
import { redactSecrets } from "./keystore.js";
import { APP } from "./config.js";
import { METHOD_VERSION } from "./normalise.js";
import { REPORT_FOOTERS } from "./tools.js";
import { checkSimRun } from "./sim_check.js";
import { downloadText } from "./dom.js";

const REPLAYED_TOOLS = (name) => name.startsWith("erp_") || name.startsWith("pv_") || name === "ui_mark_board";

/** Can the current run be saved as a simulation? → { ok, reason } */
export function canRecord() {
  const run = auditRunInfo();
  if (!run) return { ok: false, reason: "No run yet. Complete a live run of a preset scenario first." };
  if (run.mode !== "live") return { ok: false, reason: "Only live runs can be saved as a simulation." };
  if (run.entry !== "scenario" || !run.scenario_id) return { ok: false, reason: "Only runs of a preset scenario can replace its simulation." };
  if (!["done", "no_findings"].includes(run.status)) return { ok: false, reason: run.status === "running" ? "Available when the run has completed." : "Only completed runs can be saved as a simulation." };
  if (!auditEvents().some((e) => e.type === "report")) return { ok: false, reason: "The run ended without a report." };
  // A simulation always runs at the default parameters, so only a run at the defaults can become one.
  if ((run.parameters_changed || []).length) return { ok: false, reason: `This run used changed parameters (${run.parameters_changed.map((c) => c.name).join(", ")}); simulations run at the defaults, so it cannot replace one.` };
  return { ok: true, reason: "" };
}

/** Builds { key, def } from the audit stream of the last run. */
export function buildRecordedRun() {
  const run = auditRunInfo();
  const events = auditEvents();
  const cost = [...events].reverse().find((e) => e.type === "cost_update")?.payload || null;
  const def = {
    title: run.title,
    source: "recorded",
    recorded: {
      at: run.started_at,
      model: run.model,
      app_version: APP.version,
      world_version: globalThis.WORLD?.meta?.world_version || null,
      method_version: METHOD_VERSION,
      fx_version: globalThis.FX?.version || null,
      run_id: run.run_id,
      cost_eur: cost ? Math.round(cost.eur * 100) / 100 : null
    },
    ...toScript(events)
  };
  return { key: run.scenario_id, def };
}

/** Builds, checks and downloads the script of the last run. Returns { ok, message }. */
export async function saveRunAsSimulation({ world, fx, params }) {
  const can = canRecord();
  if (!can.ok) return { ok: false, message: can.reason };
  const rec = buildRecordedRun();
  const check = await checkSimRun(world, fx, params, rec.def);
  if (check.errors.length) return { ok: false, message: `The recording is not a valid simulation script (${check.errors[0]}).` };
  const name = recordedRunFileName(rec);
  downloadText(name, recordedRunScript(rec), "text/javascript");
  return { ok: true, message: `Saved ${name}. Append it to data/sim_runs.js to replace the authored replay of this scenario with this run.` };
}

/** The downloadable script: appended to data/sim_runs.js, it replaces the authored run. */
export function recordedRunScript({ key, def }) {
  const when = def.recorded.at ? `${def.recorded.at.replace("T", " ").slice(0, 16)} UTC` : "unknown time";
  const header = [
    "/*",
    " * PRICE VARIANCE AGENT: recorded live run, exported with \"Save run as simulation\".",
    ` * Scenario: ${key} (${String(def.title || "").replace(/\*\//g, "* /")})`,
    ` * Recorded: ${when} on ${def.recorded.model || "unknown model"}, Price Variance Agent ${def.recorded.app_version}`,
    " * To use it, append this file's content to the end of data/sim_runs.js. It then replaces the",
    " * authored simulation for this scenario; delete it again to restore the authored one.",
    " */"
  ].join("\n");
  const body = `window.SIM_RUNS = window.SIM_RUNS || {};\nwindow.SIM_RUNS[${JSON.stringify(key)}] = ${JSON.stringify(def, null, 2)};\n`;
  return redactSecrets(`${header}\n${body}`);
}

/** price-variance-sim-run-<scenario>-recorded-<yyyymmdd>.js */
export function recordedRunFileName({ key, def }) {
  const t = new Date(def.recorded.at || Date.now());
  const d = Number.isNaN(t.getTime()) ? new Date() : t;
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `price-variance-sim-run-${key}-recorded-${ymd}.js`;
}

// ---------------------------------------------------------------------------------------------

/** The steps, options, decision branch and rejection lines of a live run. */
export function toScript(events) {
  const steps = [];
  let cursor = steps;
  const out = { steps, decisions: {}, rejected: {} };
  const calls = new Map();
  const byMsg = new Map();
  let inOptions = false;
  let rejectedFor = null;
  const push = (step) => { cursor.push(step); return step; };
  const remove = (ref) => { const k = ref ? ref.list.indexOf(ref.step) : -1; if (k >= 0) ref.list.splice(k, 1); };
  const decide = (r) => {
    if (r?.decision === "approved") {
      inOptions = false;
      rejectedFor = null;
      cursor = out.decisions[r.option_id] = [];
    } else if (r?.decision === "rejected") rejectedFor = r.option_id;
  };

  for (const ev of events) {
    const p = ev.payload || {};
    switch (ev.type) {
      case "narration": {
        const text = String(p.text || "");
        if (!p.done || !text.trim()) break;
        if (inOptions) {
          if (rejectedFor) out.rejected[rejectedFor] = out.rejected[rejectedFor] ? `${out.rejected[rejectedFor]}\n\n${text}` : text;
          break;
        }
        const seen = p.msg_id && byMsg.get(`n:${p.msg_id}`);
        if (seen) seen.step.say = text;
        else byMsg.set(`n:${p.msg_id}`, { step: push({ say: text }), list: cursor });
        break;
      }
      case "reasoning": {
        const text = String(p.text || "");
        if (!p.done || !text.trim() || inOptions) break;
        const seen = p.msg_id && byMsg.get(`r:${p.msg_id}`);
        if (seen) seen.step.think = text;
        else byMsg.set(`r:${p.msg_id}`, { step: push({ think: text }), list: cursor });
        break;
      }
      case "attempt_discarded":
        for (const id of p.msg_ids || []) { remove(byMsg.get(`n:${id}`)); remove(byMsg.get(`r:${id}`)); }
        break;
      case "tool_call":
        calls.set(p.call_id, p);
        break;
      case "tool_result": {
        const call = calls.get(p.call_id) || { name: p.name, input: {} };
        const name = p.name || call.name;
        const input = call.input || {};
        const r = p.result || {};
        if (name === "open_ecb_rate") {
          push(p.ok
            ? { open: name, input, result: { currency: r.currency, date: r.date, per_eur: r.per_eur, rate_to_eur: r.rate_to_eur, source: "ECB via Frankfurter" } }
            : { open: name, input, ok: false, error: String(r.error || "unreachable").slice(0, 200) });
          break;
        }
        if (!p.ok) break; // a refused or failed call is not replayed
        if (REPLAYED_TOOLS(name)) push({ tool: name, input });
        else if (name === "ui_confirm_cluster") {
          const live = r.decision;
          const branch = [];
          const end = (answer) => [
            { say: `This recorded run continued after the answer "${live}"; with "${answer}" the replay ends here.` },
            { report: { outcome: "stopped", markdown: `## Replay ended\n\nThe recorded live run continued after the answer "${live}" to the cluster confirmation. With the answer "${answer}", this replay has nothing recorded to show, so it ends here.` } }
          ];
          push({ confirm: { candidate: input.candidate_id, base_unit: input.base_unit, ...(input.note ? { note: input.note } : {}), confirmed: live === "confirmed" ? branch : end("confirmed"), split: live === "split" ? branch : end("split"), rejected: live === "rejected" ? branch : end("rejected") } });
          cursor = branch;
        } else if (name === "ui_report_alert") push({ alert: { title: input.title, summary: input.summary, ...(input.line_ids ? { line_ids: input.line_ids } : {}) } });
        else if (name === "ui_propose_options") {
          out.options = {
            ids: (input.options || []).map((o) => o.id),
            texts: Object.fromEntries((input.options || []).map((o) => [o.id, { title: o.title, description: o.description, residual_risk: o.residual_risk }])),
            recommended: input.recommended,
            reason: input.reason
          };
          push({ propose: true });
          inOptions = true;
          decide(r);
        } else if (name === "ui_await_decision") decide(r);
        else if (name === "ui_draft_action") push({ draft: { type: input.type, recipient: input.recipient, subject: input.subject, body: input.body } });
        else if (name === "ui_await_approvals") push({ awaitApprovals: true });
        else if (name === "ui_final_report") push({ report: { outcome: r.outcome || input.outcome, markdown: String(input.markdown || "").replace(REPORT_FOOTERS.live, "").trim() } });
        break;
      }
      default:
        break;
    }
  }
  if (!out.options) { delete out.decisions; delete out.rejected; }
  return out;
}
