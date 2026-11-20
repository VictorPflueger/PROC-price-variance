// The run-event bus. Every UI effect flows through here, whether a live agent or the simulation
// player produced it. The UI subscribes to event types and never asks which producer is running;
// only the mode badge, the console watermark and the audit export read the envelope's `mode`.
//
// Envelope: { id, seq, type, ts (ISO), t (ms since run start or null), run_id, mode, payload }
//
// Event types and payloads (PLAN.md section 6.1; JSON Schema RunEvent in js/schemas.js)
//   run_start        { run_id, mode: "live"|"simulation", entry: "scenario"|"sweep"|"custom", scenario_id?, title, seed?,
//                      model?, model_label?, sim_source?: "authored"|"recorded", recorded_on?, recorded_model? }
//   state_change     { state, note? }   states: see RUN_STATES
//   narration        { msg_id, text, done }            streamed upsert: same msg_id replaces text
//   reasoning        { msg_id, text, done }            summarised model thinking (shown collapsed)
//   tool_call        { call_id, name, input, plain }   plain: the sentence above the call (js/tool_plain.js)
//   tool_result      { call_id, name, ok, summary, result, compare_id?, versions? }
//   alert            { compare_id, group_id, title, summary, line_ids, checked }   checked: "Checked in this run:"
//   board_update     { view: "group"|"portfolio", group_id?, pair_ids?, line_ids?, state, focus? }
//                    states: checking, above, justified, approved, neutral
//   kpi_update       { identified_eur?, flagged_groups?, index?, index_projected?, approved_eur?, implemented_eur?, realised_eur? }
//   options          { options_seq, compare_id, group_id, recommended, reason, options:[...] }
//   option_decision  { option_id: "H"|"R"|"B"|"accept", option_label?, options_seq, decision: "approved"|"rejected", reason?, by: "user" }
//   confirmation_request  { request_id, candidate_id, lines, evidence, base_units, proposed_base_unit, note }
//   confirmation_decision { request_id, decision: "confirmed"|"split"|"rejected", cluster_id?, base_unit?, line_ids? }
//   fx_sensitivity   { group_id, currency, date, per_eur, figures }   a refreshed rate, beside the window's
//   param_change     { name, from, to, at }   at: when the person made it (a change between runs joins the next live run)
//   action_draft     { action_id, type, recipient, subject, body, status: "pending", unchecked?: [token] }
//   action_decision  { action_id, decision: "approved"|"rejected", by: "user", label? }
//   report           { markdown, outcome: "option_approved"|"variance_accepted"|"nothing_found"|"stopped" }
//   cost_update      { eur, usd, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, web_searches, simulated }
//   notice           { level: "info"|"warn"|"error", text }
//   attempt_discarded { msg_ids, call_ids, reason }   a response that was not kept (failed and retried, or redone)
//   run_end          { status: "done"|"no_findings"|"incomplete"|"aborted"|"error", reason? }
//                    no_findings: an honest negative (scenario 4); incomplete: the agent stopped early

export const RUN_STATES = {
  idle: "Idle",
  scanning: "Scanning",
  diagnosing: "Diagnosing",
  verifying: "Verifying",
  // The state keeps the shell's name (the rail maps it to Calculate); its label must not say "Simulating",
  // which would read as the replay mode in a live run (review R6).
  simulating: "Calculating",
  options: "Options",
  awaiting_approval: "Awaiting approval",
  executing: "Executing",
  done: "Done",
  stopped: "Stopped",
  aborted: "Aborted",
  error: "Error"
};

class RunEventBus {
  constructor() {
    this.handlers = new Map();
    this.anyHandlers = new Set();
    this.seq = 0;
    this.run = null; // { run_id, mode, t0 }
  }

  /** Subscribe to one event type. Returns an unsubscribe function. */
  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(fn);
    return () => this.handlers.get(type)?.delete(fn);
  }

  /** Subscribe to every event. Returns an unsubscribe function. */
  onAny(fn) {
    this.anyHandlers.add(fn);
    return () => this.anyHandlers.delete(fn);
  }

  /** Marks the start of a run so events carry run id, mode and relative time. */
  beginRun({ run_id, mode }) {
    this.run = { run_id, mode, t0: performance.now() };
  }

  endRun() {
    this.run = null;
  }

  currentRun() {
    return this.run ? { ...this.run } : null;
  }

  emit(type, payload = {}) {
    const envelope = {
      id: `ev-${Date.now().toString(36)}-${(++this.seq).toString(36)}`,
      seq: this.seq,
      type,
      ts: new Date().toISOString(),
      t: this.run ? Math.round(performance.now() - this.run.t0) : null,
      run_id: this.run?.run_id ?? null,
      mode: this.run?.mode ?? null,
      payload
    };
    for (const fn of this.handlers.get(type) || []) safeCall(fn, envelope);
    for (const fn of this.anyHandlers) safeCall(fn, envelope);
    return envelope;
  }
}

function safeCall(fn, envelope) {
  try {
    fn(envelope);
  } catch (err) {
    // A failing subscriber must never break the run; surface it in the browser console only.
    console.error(`[Price Variance Agent] event handler failed for ${envelope.type}:`, err);
  }
}

export const bus = new RunEventBus();

/** New run id, e.g. run-20261012-1556-k3f9. */
export function newRunId() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `run-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}-${Math.random().toString(36).slice(2, 6)}`;
}
