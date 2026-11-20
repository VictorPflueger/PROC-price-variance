// Audit trail by design (brief §1): every run event plus every model request and response, exported as
// JSON. An audit event carries the alert, its evidence ("Checked in this run:"), the method, engine,
// world and exchange-rate versions, the person's role as reviewer, the decision with its timestamp and
// the disposition (approved, rejected, accepted with a reason). Secrets never enter it: the API key is
// part of no event, and the export is redacted again.
//
// Two lists are kept: `events` (the run-event stream as the screen saw it, without the engine's full
// analysis that only the board draws) and `apiExchanges` (one record per model call: what was sent,
// what came back, usage and timing). The Audit tab shows both in one chronological view.

import { bus } from "./events.js";
import { APP, MODELS } from "./config.js";
import { redactSecrets } from "./keystore.js";
import { computeRunFacts } from "./run_facts.js";
import { METHOD_VERSION } from "./normalise.js";
import { exportFileName } from "./exports.js";

const events = [];
const apiExchanges = [];
const rows = [];
const listeners = new Set();
let run = null;

bus.onAny((ev) => {
  // Streaming narration arrives as many partial updates; the audit keeps only final texts.
  if ((ev.type === "narration" || ev.type === "reasoning") && !ev.payload?.done) return;
  const copy = safeClone(ev.type === "tool_result" && ev.payload?.detail ? { ...ev, payload: { ...ev.payload, detail: undefined } } : ev);
  if (["option_decision", "confirmation_decision", "action_decision"].includes(ev.type)) copy.reviewer = "Presenter (the person in charge)";
  events.push(copy);
  if (ev.type === "run_start") {
    run = {
      run_id: ev.payload.run_id, mode: ev.payload.mode, entry: ev.payload.entry,
      scenario_id: ev.payload.scenario_id || null, title: ev.payload.title, model: ev.payload.model || null,
      sim_source: ev.payload.sim_source || null,
      parameters: ev.payload.parameters || null,
      parameters_changed: ev.payload.parameters_changed || [],
      started_at: ev.ts, ended_at: null, status: "running"
    };
  }
  if (ev.type === "run_end" && run) {
    run.ended_at = ev.ts;
    run.status = ev.payload.status;
  }
  addRow(copy);
});

function addRow(row) {
  rows.push(row);
  for (const fn of listeners) fn(row);
}

/** Subscribe to new audit rows (events and model calls). */
export function onAuditEvent(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The run-event stream of the current (or last) run. */
export function auditEvents() {
  return events.slice();
}

/** Events and model calls in the order they happened, for the Audit tab. */
export function auditRows() {
  return rows.slice();
}

/** Summary of the current (or last) run: id, mode, entry, scenario, model, status, times. */
export function auditRunInfo() {
  return run ? { ...run } : null;
}

/** Record one model request and response (from the live agent). Never pass headers. */
export function recordApiExchange(entry) {
  const ts = new Date().toISOString();
  const record = safeClone({ ts, ...entry });
  apiExchanges.push(record);
  const current = bus.currentRun();
  const r = record.response || {};
  const q = record.request || {};
  addRow({
    type: "model_call",
    ts,
    t: current ? Math.round(performance.now() - current.t0) : null,
    payload: {
      step: record.step,
      request_id: record.request_id || null,
      duration_ms: record.duration_ms ?? null,
      model: q.model || r.model || null,
      messages_total: q.messages_total ?? null,
      max_tokens: q.max_tokens ?? null,
      stop_reason: r.stop_reason || null,
      input_tokens: r.usage?.input_tokens ?? 0,
      output_tokens: r.usage?.output_tokens ?? 0,
      cache_read_tokens: r.usage?.cache_read_input_tokens ?? 0,
      cache_write_tokens: r.usage?.cache_creation_input_tokens ?? 0,
      blocks: Array.isArray(r.content) ? r.content.map((b) => b.type) : []
    }
  });
}

export function resetAudit() {
  events.length = 0;
  apiExchanges.length = 0;
  rows.length = 0;
  run = null;
}

/** The rates the run used: the window's mean rates, and any rate fetched in the run (a sensitivity). */
function ratesUsed() {
  const fx = globalThis.FX || {};
  const refreshed = events
    .filter((e) => e.type === "tool_result" && e.payload?.name === "open_ecb_rate")
    .map((e) => ({ ok: e.payload.ok, ...(e.payload.result || {}) }));
  return {
    basis: { version: fx.version || null, label: fx.label || null, status: fx.status || null, source: fx.source || null, currencies: fx.currencies || {} },
    fetched_in_run: refreshed
  };
}

/** Builds the JSON export for the current run. */
export function buildAuditExport() {
  const world = globalThis.WORLD?.meta || {};
  const lastCost = [...events].reverse().find((e) => e.type === "cost_update")?.payload || null;
  const mode = run?.mode || null;
  const recorded = run?.sim_source === "recorded";
  const model = run?.model ? MODELS.find((m) => m.id === run.model) || { id: run.model } : null;
  const usage = apiExchanges.reduce((u, x) => {
    const s = x.response?.usage || {};
    u.input_tokens += s.input_tokens || 0;
    u.output_tokens += s.output_tokens || 0;
    u.cache_read_input_tokens += s.cache_read_input_tokens || 0;
    u.cache_creation_input_tokens += s.cache_creation_input_tokens || 0;
    return u;
  }, { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 });
  const doc = {
    app: `${APP.name} (${APP.fullName})`,
    app_version: APP.version,
    exported_at: new Date().toISOString(),
    mode,
    mode_statement: mode === "simulation"
      ? recorded
        ? "SIMULATION: replay of a recorded live run. No model was called during this replay; the engine recomputed every figure; open data shown was recorded earlier and is not live."
        : "SIMULATION: scripted replay of an authored run. No model was called; the engine recomputed every figure; open data shown is representative, not live."
      : mode === "live"
        ? "LIVE: real model reasoning and real tool calls made from the presenter's browser; every figure comes from the deterministic engine."
        : "No run recorded.",
    ai_disclosure: "This log documents an AI system. Every outbound action is a draft in the app's Outbox; nothing was sent to anyone.",
    company_note: "Fictional company, no client data: GlobalCorp SE, its company codes, plants, supplier accounts, materials, contracts and order lines are invented. The exchange rates are the ECB's public reference rates.",
    versions: { app: APP.version, method: METHOD_VERSION, engine: METHOD_VERSION, world: world.world_version || null, fx: globalThis.FX?.version || null },
    model: model ? { id: model.id, label: model.label || null, price_usd_per_million: model.price || null } : null,
    usage: apiExchanges.length ? usage : null,
    cost: lastCost,
    rates: ratesUsed(),
    // The method's parameters this run used (a simulation: the defaults), those that differ from the
    // defaults, and any change logged during the run.
    parameters: {
      in_effect: run?.parameters || null,
      changed_from_defaults: run?.parameters_changed || [],
      changes: events.filter((e) => e.type === "param_change").map((e) => ({ ts: e.ts, ...e.payload }))
    },
    run,
    run_facts: run && run.status !== "running" ? safeFacts() : null,
    decisions: events.filter((e) => ["confirmation_decision", "option_decision", "action_decision"].includes(e.type)).map((e) => ({ type: e.type, ts: e.ts, reviewer: e.reviewer, ...e.payload })),
    counts: { ...countBy(events.map((e) => e.type)), model_calls: apiExchanges.length },
    events,
    api_exchanges: apiExchanges
  };
  return redactSecrets(JSON.stringify(doc, null, 2));
}

/** price-variance-<run id>-SIMULATION-audit.json (brief §9: every export starts with price-variance-). */
export function auditFileName() {
  return exportFileName("audit", { runId: run?.run_id || `run-${Date.now()}`, mode: run?.mode || null });
}

function safeFacts() {
  try { return computeRunFacts(rows); } catch { return null; }
}

function countBy(list) {
  const out = {};
  for (const x of list) out[x] = (out[x] || 0) + 1;
  return out;
}

function safeClone(obj) {
  try {
    return JSON.parse(redactSecrets(JSON.stringify(obj)));
  } catch {
    return { unserializable: true };
  }
}
