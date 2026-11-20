// Run facts: a short, factual summary of a finished run, shown as the console's last line and included
// in the audit export (brief §4): time, tool calls by kind, lines normalised, guardrail refusals, model
// calls against the cap, and cost. It doubles as the run's self-check: at least eight tool calls and
// a visible verification (lines normalised, a revision).

import { splitParagraphs, labelKind } from "./labels.js";
import { AGENT } from "./config.js";
import { eurCents } from "./format.js";

/**
 * rows: audit rows of the run (events and model_call rows) in order.
 * end: the run_end envelope (its `t` is the run time in ms).
 */
export function computeRunFacts(rows, end = null) {
  const events = rows.filter((r) => r.type !== "model_call");
  const start = events.find((e) => e.type === "run_start");
  const mode = start?.payload?.mode || null;
  const finish = end || [...events].reverse().find((e) => e.type === "run_end") || null;
  const totalMs = Math.max(0, finish?.t ?? events[events.length - 1]?.t ?? 0);

  const calls = events.filter((e) => e.type === "tool_call");
  const byKind = { erp: 0, engine: 0, open_data: 0, screen: 0, person: 0 };
  for (const c of calls) {
    const n = String(c.payload.name);
    if (n.startsWith("erp_")) byKind.erp += 1;
    else if (n.startsWith("pv_")) byKind.engine += 1;
    else if (n.startsWith("open_")) byKind.open_data += 1;
    else if (["ui_confirm_cluster", "ui_propose_options", "ui_await_decision", "ui_await_approvals"].includes(n)) byKind.person += 1;
    else byKind.screen += 1;
  }
  const results = events.filter((e) => e.type === "tool_result");
  const normalised = new Set(results.filter((e) => e.payload?.name === "pv_normalise" && e.payload?.ok && !e.payload?.result?.excluded).map((e) => e.payload.result.line)).size;

  const finalText = new Map();
  for (const e of events) if (e.type === "narration" && e.payload?.done) finalText.set(e.payload.msg_id || e.id, String(e.payload.text || ""));
  const kinds = [...finalText.values()].flatMap((t) => splitParagraphs(t)).map(labelKind);
  const revisions = kinds.filter((k) => k === "revised").length;

  // Time spent waiting for a person is not agent time.
  let waitingMs = 0;
  let waitStart = null;
  for (const e of events) {
    if (e.type !== "state_change" && e.type !== "run_end") continue;
    const awaiting = e.type === "state_change" && e.payload?.state === "awaiting_approval";
    if (awaiting && waitStart === null) waitStart = e.t ?? 0;
    else if (!awaiting && waitStart !== null) { waitingMs += Math.max(0, (e.t ?? 0) - waitStart); waitStart = null; }
  }
  if (waitStart !== null) waitingMs += Math.max(0, totalMs - waitStart);
  const agentMs = Math.max(0, totalMs - waitingMs);

  const guardrails = results.filter((e) => e.payload?.guard).length + events.filter((e) => e.type === "notice" && e.payload?.guard).length;
  const approved = events.find((e) => e.type === "option_decision" && e.payload?.decision === "approved");
  const confirmation = events.find((e) => e.type === "confirmation_decision");
  const decisions = events.filter((e) => e.type === "action_decision");
  const cost = [...events].reverse().find((e) => e.type === "cost_update")?.payload || null;
  const report = [...events].reverse().find((e) => e.type === "report")?.payload || null;
  const modelCalls = rows.filter((r) => r.type === "model_call").length;

  return {
    mode,
    status: finish?.payload?.status || "running",
    outcome: report?.outcome || null,
    run_time_s: Math.round(totalMs / 1000),
    agent_time_s: Math.round(agentMs / 1000),
    waiting_time_s: Math.round(waitingMs / 1000),
    model_calls: modelCalls,
    model_call_cap: AGENT.maxSteps,
    tool_calls: calls.length,
    tool_calls_by_kind: byKind,
    lines_normalised: normalised,
    revisions,
    guardrail_refusals: guardrails,
    confirmation: confirmation?.payload?.decision || null,
    approved_option: approved?.payload?.option_id || null,
    drafts: events.filter((e) => e.type === "action_draft").length,
    drafts_approved: decisions.filter((e) => e.payload?.decision === "approved").length,
    drafts_rejected: decisions.filter((e) => e.payload?.decision === "rejected").length,
    cost_eur: cost && !cost.simulated ? Number(cost.eur) || 0 : 0,
    checks: {
      at_least_8_tool_calls: calls.length >= 8,
      verification_visible: normalised >= 3 || mode === null
    }
  };
}

/** One readable sentence for the console. */
export function describeRunFacts(f) {
  const mins = (s) => (s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`);
  const k = f.tool_calls_by_kind;
  const kinds = [
    k.erp ? `${k.erp} ERP` : null,
    k.engine ? `${k.engine} engine` : null,
    k.open_data ? `${k.open_data} open data` : null
  ].filter(Boolean).join(", ");
  const time = f.mode === "simulation"
    ? `${mins(f.run_time_s)} replay`
    : `${mins(f.agent_time_s)} agent time${f.waiting_time_s ? ` plus ${mins(f.waiting_time_s)} waiting for you` : ""}`;
  const check = `${f.lines_normalised} line${f.lines_normalised === 1 ? "" : "s"} normalised, ${f.revisions} revision${f.revisions === 1 ? "" : "s"}${f.guardrail_refusals ? `, ${f.guardrail_refusals} guardrail refusal${f.guardrail_refusals === 1 ? "" : "s"}` : ""}`;
  const calls = f.mode === "live" ? `; ${f.model_calls} of ${f.model_call_cap} model calls` : "";
  const cost = f.mode === "simulation" ? "no cost (simulated)" : `cost ${eurCents(f.cost_eur)}`;
  return `${time}; ${f.tool_calls} tool call${f.tool_calls === 1 ? "" : "s"}${kinds ? ` (${kinds})` : ""}; ${check}${calls}; ${cost}.`;
}
