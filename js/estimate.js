// Two things the presenter needs before any decision is taken:
//   playHeadless  a case's script played at once through the live toolbox with an automatic person who
//                 confirms clusters, approves the recommended option and every draft (as
//                 js/sim_check.js does), returning the run's events, narration included
//   estimateCost  what that run would cost live, from its own prompts and replies at list price: about
//                 four characters a token, the system prompt and tools cached after the first call, every
//                 new message written to the cache once and read back on later calls, parallel reads in
//                 one call, and 300 thinking tokens a call (the agent thinks before it acts)
// Pure module: the page and the tests share it.

import { createToolbox, toolDefinitions, ORDER_FREE } from "./tools.js";
import { runScript } from "./simulation.js";
import { buildSystemPrompt, buildOpeningMessage } from "./prompt.js";
import { usageCostUsd } from "./cost.js";
import { FX_USD_EUR } from "./config.js";

export const CHARS_PER_TOKEN = 4;
export const THINKING_PER_CALL = 300;

export async function playHeadless({ world, fx, params, def }) {
  const events = [];
  const drafts = new Map();
  let phase = null;
  let options = null;
  let confirmation = null;
  let open = { ok: false, result: {} };
  let n = 0;
  const push = (type, payload) => events.push({ type, payload });
  const toolbox = createToolbox({
    world, fx, params,
    emit: (type, payload) => {
      push(type, payload);
      if (type === "options") options = payload;
      if (type === "confirmation_request") confirmation = payload;
      if (type === "action_draft") { drafts.get(payload.action_id).status = "approved"; push("action_decision", { action_id: payload.action_id, decision: "approved", by: "user" }); }
    },
    waitUntil: async (test) => test(),
    takeDecision: (kind) => {
      if (kind === "option" && options && !events.some((e) => e.type === "option_decision")) {
        const ev = { type: "option_decision", payload: { options_seq: options.options_seq, option_id: options.recommended, decision: "approved", by: "user" } };
        events.push(ev);
        return ev;
      }
      if (kind === "confirmation" && confirmation) {
        const c = confirmation;
        confirmation = null;
        return { type: "confirmation_decision", payload: { request_id: c.request_id, decision: "confirmed", base_unit: c.proposed_base_unit } };
      }
      return null;
    },
    drafts, onPhase: (s) => { phase = s; }, getPhase: () => phase, isEnded: () => false, signal: null,
    ecbRate: async () => (open.ok ? { ...open.result, ok: true } : { ok: false, error: open.error || "unreachable" }),
    mode: "authored", entry: "scenario"
  });
  await runScript(def, {
    world, toolbox,
    say: async (text) => push("narration", { msg_id: `h${++n}`, text, done: true }),
    think: async () => {},
    pause: async () => {},
    setOpen: (o) => { open = o; },
    nextCallId: () => `hc${++n}`
  });
  return events;
}

const tokens = (s) => Math.ceil(String(s || "").length / CHARS_PER_TOKEN);

/** The estimated cost of a run in euros and its usage, at the list price of modelId. */
export function estimateCost({ events, world, fx, params, scenario, modelId, today = "today" }) {
  const prefix = tokens(buildSystemPrompt({ world, fx, params, today })) + tokens(JSON.stringify(toolDefinitions()));
  const opening = tokens(buildOpeningMessage({ entry: "scenario", seed: scenario.seed, scenarioTitle: scenario.title }));
  // One model call per turn: what the agent says, then its tool calls (independent reads together).
  const turns = [];
  let turn = null;
  const results = new Map();
  for (const e of events) {
    if (e.type === "narration") {
      if (!turn || turn.calls.length) turns.push(turn = { out: 0, calls: [], back: 0 });
      turn.out += tokens(e.payload.text);
    } else if (e.type === "tool_call") {
      const p = e.payload;
      const parallel = turn && turn.calls.length && ORDER_FREE(p.name) && turn.calls.every(ORDER_FREE);
      if (!turn || (turn.calls.length && !parallel)) turns.push(turn = { out: 0, calls: [], back: 0 });
      turn.calls.push(p.name);
      turn.out += tokens(p.name) + tokens(JSON.stringify(p.input || {}));
      results.set(p.call_id, turn);
    } else if (e.type === "tool_result") {
      const t = results.get(e.payload.call_id);
      if (t) t.back += tokens(JSON.stringify(e.payload.result || {}));
    }
  }
  turns.push({ out: tokens("The report is published; nothing was sent."), calls: [], back: 0 });
  let cached = 0;
  let pending = prefix + opening;
  let usd = 0;
  const total = { input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0, calls: turns.length };
  for (const t of turns) {
    const usage = { input_tokens: 0, cache_creation_input_tokens: pending, cache_read_input_tokens: cached, output_tokens: t.out + THINKING_PER_CALL };
    usd += usageCostUsd(modelId, usage);
    for (const k of ["cache_creation_input_tokens", "cache_read_input_tokens", "output_tokens"]) total[k] += usage[k];
    cached += pending;
    pending = t.out + t.back;
  }
  return { ...total, usd, eur: usd * FX_USD_EUR, model: modelId };
}
