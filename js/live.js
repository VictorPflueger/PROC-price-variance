// Run it live: the visitor's key, checked with Anthropic's free models call, and the unchanged live agent
// (js/agent.js) on the case's tip. Loaded only when a live run is asked for. Its events reach the page
// on the bus, as the simulation's do.

import { createLiveAgent } from "./agent.js";
import { checkKey as askAnthropic } from "./anthropic.js";
import { looksLikeKey, setKey, forgetKey } from "./keystore.js";

/** What is wrong with a key before Anthropic is asked, or null. */
export function keyProblem(key) {
  const framed = (() => { try { return window.top !== window.self; } catch { return true; } })();
  if (framed) return "Open the prototype in its own tab to run it live; inside another page a key could be misused.";
  if (!key) return "Paste your Anthropic API key. It starts with sk-ant-.";
  if (!looksLikeKey(key)) return "That doesn't look like an Anthropic API key. It starts with sk-ant-.";
  return null;
}

/** Checks the key with GET /v1/models, which uses no tokens. Keeps it for this tab only when it works. */
export async function checkKey(key) {
  const r = await askAnthropic(key);
  if (r.ok) { setKey(key); return { ok: true }; }
  if (r.status === 0) return { ok: false, message: `api.anthropic.com could not be reached (${r.error?.message || "network"}). Try another network, or use the simulation.` };
  if (r.status === 401) return { ok: false, message: "Anthropic rejected this key (401). Check that it is active and copied completely." };
  return { ok: false, message: `Anthropic answered ${r.status}: ${r.error?.message || r.error?.type || "unknown error"}.` };
}

/** Starts the agent on the case's tip; onEnd runs when it stops for any reason. */
export function startAgent({ world, fx, params, scenario, modelId, onEnd }) {
  const agent = createLiveAgent({ getWorld: () => world, getFx: () => fx, getParams: () => params, onKeyRejected: () => forgetKey() });
  agent.run({ entry: "scenario", scenario, modelId }).finally(() => onEnd?.());
  return { abort: (reason) => agent.abort(reason), isActive: () => agent.isActive() };
}
