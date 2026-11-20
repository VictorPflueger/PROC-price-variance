// Live agent: the Claude tool-use loop, run entirely in the presenter's browser (Rebate Hunter's loop,
// without web search, with the budget checked before every call as well as after each, PLAN.md B8).
//
// One run = repeated streaming calls to POST /v1/messages. Every response is appended to the
// conversation unchanged (thinking blocks and signatures included). stop_reason drives the loop:
//   tool_use   → execute the tools (independent reads in parallel), send the tool_result blocks
//   max_tokens → retry once with more room if a tool call was cut off, otherwise continue
//   end_turn   → the run ends, unless the agent stopped before its report (two nudges at most)
//   refusal, model_context_window_exceeded → the run ends
// Caps: 40 model calls (the retry of a cut turn included) and €3; no call starts once €3 is spent.
// All UI effects go through the run-event bus, exactly as the simulation player emits them. A
// response that is not kept (an attempt that failed and was retried, or a turn redone after
// max_tokens) is marked as discarded, and nothing it did counts.

import { bus } from "./events.js";
import { MODELS, AGENT } from "./config.js";
import { streamMessage, withRetry, ApiError } from "./anthropic.js";
import { toolDefinitions, createToolbox, ORDER_FREE, ABORT } from "./tools.js";
import { buildSystemPrompt, buildOpeningMessage } from "./prompt.js";
import { createCostTracker } from "./cost.js";
import { recordApiExchange } from "./audit.js";
import { getKey } from "./keystore.js";
import { ecbRate } from "./opendata.js";
import { eurCents } from "./format.js";
import { appToday } from "./clock.js";

/**
 * deps: { getWorld(), getFx(), getParams(), onKeyRejected() }
 */
export function createLiveAgent(deps = {}) {
  let current = null;

  async function run({ entry, scenario = null, customText = "", modelId }) {
    const modelDef = MODELS.find((m) => m.id === modelId) || MODELS[0];
    const today = appToday().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const world = deps.getWorld();
    const fx = deps.getFx();
    const params = deps.getParams();
    const r = {
      entry, modelDef, today,
      ended: false, cancelled: false,
      ac: new AbortController(),
      waiters: new Set(), poke: null,
      queues: { option: [], confirmation: [] }, drafts: new Map(),
      phase: null, step: 0, calls: 0,
      compat: { effort: true, display: true, thinking: true, cache: true, strict: true },
      maxTokens: modelDef.maxTokens,
      cost: createCostTracker(modelDef.id),
      exchanges: 0
    };
    current = r;

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

    const toolbox = createToolbox({
      world, fx, params,
      // Nothing a tool emits after the run has ended (Abort, Reset) may reach the next run's screen.
      emit: (type, payload) => { if (!r.ended) bus.emit(type, payload); },
      waitUntil: (test) => waitUntil(r, test),
      takeDecision: (kind) => r.queues[kind].shift() || null,
      drafts: r.drafts,
      onPhase: (s) => setPhase(r, s),
      getPhase: () => r.phase,
      isEnded: () => r.ended || r.cancelled,
      signal: r.ac.signal,
      ecbRate,
      mode: "live",
      entry,
      session: deps.session || null
    });

    bus.emit("cost_update", r.cost.snapshot());
    setPhase(r, "scanning");

    const system = buildSystemPrompt({ world, fx, params, today });
    const opening = buildOpeningMessage({ entry, seed: entry === "custom" ? customText : scenario?.seed, scenarioTitle: scenario?.title });
    const messages = [{ role: "user", content: opening }];
    let sentUpTo = 0;
    let maxTokensRetried = false;
    let nudges = 0;

    try {
      for (;;) {
        if (r.cancelled) throw ABORT;
        // Every model turn counts against the cap, the one redone after max_tokens included.
        if (r.calls >= AGENT.maxSteps) {
          return finish(r, "error", `Step limit reached (${AGENT.maxSteps} model calls). The run stops here to protect time and cost.`);
        }
        // No call starts once the budget is spent (PLAN.md B8).
        const spent = r.cost.snapshot().eur;
        if (spent >= AGENT.budgetEur) {
          return finish(r, "aborted", `Cost cap reached: this run has used ${eurCents(spent)}, the ${eurCents(AGENT.budgetEur)} safety limit per run. No further model call starts.`);
        }
        r.step += 1;
        r.calls += 1;

        const started = performance.now();
        const call = await callModel(r, system, messages);
        const { message, requestId, incomplete, attemptBody, attemptIds } = call;
        const snap = r.cost.add(message.usage);
        bus.emit("cost_update", snap);
        audit(r, { step: r.step, body: attemptBody, appended: messages.slice(sentUpTo).filter((m) => m.role === "user"), message, requestId, ms: Math.round(performance.now() - started) });
        sentUpTo = messages.length;

        if (snap.eur >= AGENT.budgetEur) {
          messages.push({ role: "assistant", content: message.content });
          return finish(r, "aborted", `Cost cap reached: this run has used ${eurCents(snap.eur)}, at or above the ${eurCents(AGENT.budgetEur)} safety limit per run.`);
        }

        const stop = message.stop_reason;
        if (stop === "max_tokens" && incomplete.size && !maxTokensRetried) {
          // A tool call was cut off mid-input: discard this turn and retry once with more room.
          maxTokensRetried = true;
          r.maxTokens = Math.min(AGENT.maxOutputTokens, Math.round(r.maxTokens * 1.5));
          discardAttempt(attemptIds, "The response hit the output limit in the middle of a tool call; it is discarded and retried with more room.");
          continue;
        }

        const kept = cleanContent(message.content, incomplete);
        if (kept.length) messages.push({ role: "assistant", content: kept });

        const uses = message.content.filter((b, i) => b.type === "tool_use" && !incomplete.has(i));
        if (stop === "tool_use" || (stop === "max_tokens" && uses.length)) {
          if (!uses.length) continue;
          const results = await runTools(r, uses, toolbox);
          messages.push({ role: "user", content: results });
          continue;
        }
        if (stop === "max_tokens") {
          sentUpTo = Math.min(sentUpTo, pushUserText(messages, "Continue from where you stopped."));
          continue;
        }
        if (stop === "refusal") return finish(r, "error", "The model declined to continue this request. Try another scenario or model.");
        if (stop === "model_context_window_exceeded") return finish(r, "error", "The conversation exceeded the model's context window.");
        // end_turn: done, unless the agent stopped before its report; nobody can answer in the console,
        // so it is asked at most twice, visibly, to carry on.
        const st = toolbox.state();
        if (st.reported) return finish(r, st.outcome === "nothing_found" ? "no_findings" : "done");
        if (nudges < 2) {
          nudges += 1;
          bus.emit("notice", { level: "info", text: "The agent paused before finishing the workflow. The Price Variance Agent asked it to continue on its own." });
          sentUpTo = Math.min(sentUpTo, pushUserText(messages, continueInstruction(st, entry)));
          continue;
        }
        return finish(r, "incomplete", st.approved
          ? "The agent ended without a report. Approved drafts stay in the Outbox."
          : "The agent ended its turn twice without completing the workflow. Start a new run or try another model.");
      }
    } catch (e) {
      if (e === ABORT || e?.name === "AbortError") {
        if (!r.ended) finish(r, "aborted", r.abortReason || "Stopped by the user.");
        return;
      }
      handleError(r, e);
    } finally {
      offs.forEach((off) => off());
      for (const w of r.waiters) w();
      r.waiters.clear();
      if (current === r) current = null;
    }
  }

  // ---- model calls ------------------------------------------------------------------------------

  async function callModel(r, system, messages) {
    const stream = makeStreamHooks(r);
    let downgraded = 0;
    for (;;) {
      const body = requestBody(r, system, messages);
      try {
        const out = await withRetry(
          () => { stream.beginAttempt(); return streamMessage({ key: getKey(), body, signal: r.ac.signal, hooks: stream.hooks, idleMs: AGENT.idleTimeoutMs }); },
          {
            retries: 2,
            signal: r.ac.signal,
            onRetry: ({ attempt, waitMs, error }) => {
              discardAttempt(stream.ids(), null);
              bus.emit("notice", { level: "warn", text: `The API reported ${describeTransient(error)}. Retrying in ${Math.round(waitMs / 1000)} s (attempt ${attempt} of 2).` });
            }
          }
        );
        return { ...out, attemptBody: body, attemptIds: stream.ids() };
      } catch (e) {
        if (r.cancelled) throw ABORT;
        discardAttempt(stream.ids(), null);
        if (!(e instanceof ApiError) || e.status !== 400 || downgraded >= 5) throw e;
        // Graceful degradation for optional request features, each dropped once (TECH_NOTES §2 and §3).
        if (/strict/i.test(e.message) && r.compat.strict) {
          r.compat.strict = false;
          bus.emit("notice", { level: "warn", text: "The API refused the strict tool schemas; the tools are sent without strict, and every input is still checked against its schema in code." });
        } else if (/output_config|effort/i.test(e.message) && r.compat.effort) r.compat.effort = false;
        else if (/display/i.test(e.message) && r.compat.display) r.compat.display = false;
        else if (/thinking/i.test(e.message) && r.compat.thinking) r.compat.thinking = false;
        else if (/cache_control/i.test(e.message) && r.compat.cache) r.compat.cache = false;
        else throw e;
        downgraded += 1;
      } finally {
        stream.flush();
      }
    }
  }

  function requestBody(r, system, messages) {
    const body = {
      model: r.modelDef.id,
      max_tokens: r.maxTokens,
      system,
      tools: toolDefinitions({ strict: r.compat.strict }),
      tool_choice: { type: "auto" },
      messages
    };
    if (r.compat.cache) body.cache_control = { type: "ephemeral" };
    if (r.compat.thinking) body.thinking = r.compat.display ? { type: "adaptive", display: "summarized" } : { type: "adaptive" };
    if (r.compat.effort) body.output_config = { effort: r.modelDef.effort };
    return body;
  }

  /** Streams narration and reasoning to the console while a response arrives. */
  function makeStreamHooks(r) {
    const pending = new Map();
    let timer = null;
    let attempt = 0;
    let shown = { msg_ids: [], call_ids: [] };
    const flushPending = () => {
      timer = null;
      if (!r.ended) for (const [id, ev] of pending) bus.emit(ev.type, { msg_id: id, text: ev.text, done: false });
      pending.clear();
    };
    const queue = (type, id, text) => {
      if (r.ended) return;
      pending.set(id, { type, text });
      if (!timer) timer = setTimeout(flushPending, 45);
    };
    const nid = (i) => `n-${r.step}-${attempt}-${i}`;
    const rid = (i) => `r-${r.step}-${attempt}-${i}`;
    const seen = (id) => { if (!shown.msg_ids.includes(id)) shown.msg_ids.push(id); };
    return {
      beginAttempt: () => {
        clearTimeout(timer);
        timer = null;
        pending.clear();
        attempt += 1;
        shown = { msg_ids: [], call_ids: [] };
      },
      ids: () => ({ msg_ids: shown.msg_ids.slice(), call_ids: shown.call_ids.slice() }),
      hooks: {
        onText: (i, text) => { if (text.trim()) { seen(nid(i)); queue("narration", nid(i), text); } },
        onThinking: (i, text) => { if (text.trim()) { seen(rid(i)); queue("reasoning", rid(i), text); } },
        onBlockStop: (i, block) => {
          if (r.ended) return;
          if (block.type === "text" && block.text.trim()) {
            pending.delete(nid(i));
            seen(nid(i));
            bus.emit("narration", { msg_id: nid(i), text: block.text, done: true });
          } else if (block.type === "thinking" && block.thinking?.trim()) {
            pending.delete(rid(i));
            seen(rid(i));
            bus.emit("reasoning", { msg_id: rid(i), text: block.thinking, done: true });
          }
        }
      },
      flush: () => {
        clearTimeout(timer);
        timer = null;
        pending.clear();
      }
    };
  }

  /** Marks what a response that is not kept showed as discarded. */
  function discardAttempt(ids, note) {
    if (ids && (ids.msg_ids.length || ids.call_ids.length)) bus.emit("attempt_discarded", { ...ids, reason: note || "The API call failed and was retried; this part of the response is not used." });
    if (note) bus.emit("notice", { level: "info", text: note });
  }

  // ---- tools ----------------------------------------------------------------------------------------

  async function runTools(r, uses, toolbox) {
    const results = new Array(uses.length);
    let i = 0;
    while (i < uses.length) {
      if (r.cancelled) throw ABORT;
      if (ORDER_FREE(uses[i].name)) {
        // A run of independent reads executes in parallel.
        let j = i;
        while (j < uses.length && ORDER_FREE(uses[j].name)) j++;
        const outs = await Promise.all(uses.slice(i, j).map((b) => execOne(r, b, toolbox)));
        outs.forEach((o, k) => { results[i + k] = o; });
        i = j;
      } else {
        results[i] = await execOne(r, uses[i], toolbox);
        i += 1;
      }
    }
    return results;
  }

  async function execOne(r, block, toolbox) {
    let out;
    try {
      out = await toolbox.call(block.id, block.name, block.input || {});
    } catch (e) {
      if (e === ABORT || typeof e === "symbol" || e?.name === "AbortError") throw ABORT;
      const why = String(e?.message || "unknown error");
      out = { content: JSON.stringify({ error: why }), isError: true };
      bus.emit("tool_result", { call_id: block.id, name: block.name, ok: false, summary: `Error: ${why}`, result: { error: why }, server: false });
    }
    // A slow lookup that returns after Abort or Reset is dropped, never shown in the next run.
    if (r.ended || r.cancelled) throw ABORT;
    return { type: "tool_result", tool_use_id: block.id, content: out.content, ...(out.isError ? { is_error: true } : {}) };
  }

  // ---- phases and waits -------------------------------------------------------------------------------

  function setPhase(r, state) {
    if (!state || state === r.phase || r.ended) return;
    r.phase = state;
    bus.emit("state_change", { state });
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

  // ---- ending -----------------------------------------------------------------------------------------

  function finish(r, status, reason) {
    if (r.ended) return;
    r.ended = true;
    const st = status === "done" || status === "no_findings" ? "done" : status === "incomplete" ? "stopped" : status;
    bus.emit("state_change", { state: st });
    bus.emit("run_end", { status, ...(reason ? { reason } : {}) });
  }

  function handleError(r, e) {
    console.error("[Price Variance Agent] live run failed:", e);
    let text;
    if (e instanceof ApiError) {
      if (e.status === 401) {
        text = "Anthropic rejected the API key (401). It has been removed from this tab; start again and enter a valid key.";
        deps.onKeyRejected?.();
      } else if (e.spendLimit || e.status === 402) {
        text = "The API key has reached its spend limit or has no credit. Raise the workspace's spend limit at platform.claude.com (Settings, Workspaces), or use Simulation mode.";
      } else if ((e.status === 400 || e.status === 403) && /workspace/i.test(e.message || "")) {
        text = `Anthropic refused the request because of this key's workspace (${e.message}).`;
      } else if (e.status === 404) {
        text = `The model ${r.modelDef.label} is not available to this API key. Choose another model.`;
      } else if (e.status === 0 && e.type === "network_error") {
        text = `Could not reach api.anthropic.com from this browser (${e.message}). Check the network or run Diagnostics; Simulation mode works offline.`;
      } else if (e.retryable) {
        text = `The API is busy right now (${describeTransient(e)}), even after two retries. Try again in a minute, or run the Simulation.`;
      } else {
        text = `The API returned an error (${e.status || ""} ${e.type}): ${e.message}`;
      }
      if (e.requestId) text += ` Request id: ${e.requestId}.`;
    } else {
      text = `The run stopped because of an unexpected error: ${e?.message || e}`;
    }
    bus.emit("notice", { level: "error", text });
    finish(r, "error", "See the message above.");
  }

  function abort(reason = "Stopped by the user.") {
    const r = current;
    if (!r || r.ended) return;
    r.cancelled = true;
    r.abortReason = reason;
    r.ac.abort();
    for (const w of r.waiters) w();
    r.waiters.clear();
    finish(r, "aborted", reason);
  }

  // ---- audit ------------------------------------------------------------------------------------------

  function audit(r, { step, body, appended, message, requestId, ms }) {
    r.exchanges += 1;
    const request = {
      model: body.model, max_tokens: body.max_tokens,
      thinking: body.thinking || null, output_config: body.output_config || null,
      cache_control: body.cache_control || null,
      strict_tools: body.tools.every((t) => t.strict === true),
      tools: body.tools.map((t) => t.name),
      messages_total: body.messages.length,
      appended_messages: appended.map(stripOpaque)
    };
    if (r.exchanges === 1) {
      request.system = body.system;
      request.tool_definitions = body.tools;
    }
    recordApiExchange({
      step, request_id: requestId, duration_ms: ms,
      request,
      response: { id: message.id, model: message.model, stop_reason: message.stop_reason, usage: message.usage, content: message.content.map(stripBlock) }
    });
  }

  return { run, abort, isActive: () => !!current && !current.ended };
}

// ---------------------------------------------------------------------------------------------------

/** Drops tool_use blocks that were cut off by max_tokens (they cannot be answered). */
function cleanContent(content, incomplete) {
  if (!incomplete?.size) return content;
  return content.filter((_, i) => !incomplete.has(i));
}

/** Adds a text instruction as the next user turn, merging into a trailing user turn if needed. */
function pushUserText(messages, text) {
  const last = messages[messages.length - 1];
  if (last?.role === "user") {
    const content = Array.isArray(last.content) ? last.content : [{ type: "text", text: String(last.content) }];
    last.content = [...content, { type: "text", text }];
    return messages.length - 1;
  }
  messages.push({ role: "user", content: text });
  return messages.length - 1;
}

/** What the agent is told when it ends its turn before ui_final_report. */
function continueInstruction(st, entry) {
  const base = "Nobody can answer questions in the console, so do not wait for a reply. Decide yourself and continue the workflow with your tools.";
  if (st.approved) return `${base} The person decided: ${st.approved.label}. Draft what it allows with ui_draft_action, call ui_await_approvals, then publish the report with ui_final_report.`;
  if (st.options) return `${base} The options are on screen. Call ui_await_decision to wait for the person's decision.`;
  if (entry === "sweep") return `${base} Investigate the first flagged group of pv_scan through the whole workflow. If nothing is flagged, publish the report with ui_final_report and outcome nothing_found.`;
  return `${base} Complete the steps: normalise three lines, look up the benchmark supplier's contract, pv_compare, the alert, two or three options with ui_propose_options. If nothing is material, publish the report with outcome nothing_found. End your turn only after ui_final_report.`;
}

function describeTransient(e) {
  if (e.status === 429) return "a rate limit (429)";
  if (e.status === 529 || e.type === "overloaded_error") return "overload (529)";
  if (e.type === "timeout_error") return "a timeout";
  if (e.type === "network_error") return "a network interruption";
  return `${e.status || ""} ${e.type}`.trim();
}

function stripOpaque(msg) {
  return { role: msg.role, content: Array.isArray(msg.content) ? msg.content.map(stripBlock) : msg.content };
}

function stripBlock(b) {
  if (!b || typeof b !== "object") return b;
  const copy = { ...b };
  if (copy.signature) copy.signature = "[signature omitted]";
  if (copy.type === "redacted_thinking") copy.data = "[redacted]";
  return copy;
}
