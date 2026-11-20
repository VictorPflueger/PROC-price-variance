// Open data for the live agent: the ECB's euro reference rates through Frankfurter (brief §6.3 and §7,
// rule 9), as Rebate Hunter's open_ecb_rate reads them. Frankfurter's v1 serves the ECB's rates only;
// its v2 blends other providers by default, so it is not used (PLAN.md B2).
// The function resolves, never throws, except with an AbortError when the run is stopped; on failure it
// returns { ok: false, error }, and the analysis keeps its bundled rates. A failure is remembered for
// the session only when it says something about the source: network, CORS, timeout or a 5xx answer.

import { OPEN_DATA } from "./config.js";
import { recentFailure, remember } from "./source_health.js";

const timeOfDay = (iso) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** GET JSON from Frankfurter. Returns { json } or { failed, error, inputError }. */
async function getJson(url, { timeoutMs = 10000, signal = null } = {}) {
  const label = OPEN_DATA.frankfurter.label;
  const prior = recentFailure("frankfurter");
  if (prior) {
    const when = `${timeOfDay(prior.at)}: ${prior.detail}`;
    return { failed: true, error: prior.origin === "diagnostics"
      ? `${label} failed the Diagnostics check in this browser session (${when}), so it was skipped. Run Diagnostics again to retest it.`
      : `${label} failed earlier in this session (${when}), so it was skipped. Diagnostics can test it again.` };
  }
  if (signal?.aborted) throw abortError();
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, timeoutMs);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    let res;
    try {
      res = await fetch(url, { signal: ctrl.signal, cache: "no-store", credentials: "omit", headers: { accept: "application/json" } });
    } catch {
      if (signal?.aborted) throw abortError();
      const why = timedOut ? "timed out" : "was blocked or unreachable from this browser (network, firewall or CORS)";
      remember("frankfurter", "fail", why);
      return { failed: true, error: `${label} ${why}.` };
    }
    if (res.status === 429) return { failed: true, error: `${label} is limiting the request rate (HTTP 429). Wait a minute.` };
    if (!res.ok) {
      // Only a server error says the source is unwell; another 4xx comes from the request.
      if (res.status >= 500) remember("frankfurter", "fail", `HTTP ${res.status}`);
      return { failed: true, error: `${label} answered HTTP ${res.status}${res.status < 500 ? " (check the date or currency)" : ""}.`, inputError: res.status < 500 };
    }
    let json;
    try {
      json = await res.json();
    } catch {
      if (signal?.aborted) throw abortError();
      return { failed: true, error: `${label} answered with something that is not JSON (a proxy or captive portal page, perhaps).` };
    }
    remember("frankfurter", "pass", "Used by the agent");
    return { json };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

function abortError() {
  const e = new Error("The run was stopped.");
  e.name = "AbortError";
  return e;
}

/**
 * The ECB reference rate of a currency per euro, latest or of a date.
 * Returns { ok: true, currency, date, per_eur, rate_to_eur, source } or { ok: false, error }.
 */
export async function ecbRate({ currency = "GBP", date = "" } = {}, { signal = null } = {}) {
  const cur = String(currency || "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(cur) || cur === "EUR") return { ok: false, error: "currency must be a three-letter code other than EUR, for example GBP." };
  const d = String(date || "").trim();
  if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return { ok: false, error: "date must be YYYY-MM-DD, or left out for the latest rate." };
  const r = await getJson(`${OPEN_DATA.frankfurter.base}/${d || "latest"}?base=EUR&symbols=${cur}`, { signal });
  if (r.failed) return { ok: false, error: r.error };
  const perEur = Number(r.json?.rates?.[cur]);
  if (!Number.isFinite(perEur) || perEur <= 0) return { ok: false, error: `No ECB reference rate for ${cur}.` };
  return {
    ok: true,
    source: OPEN_DATA.frankfurter.source,
    date: r.json?.date || d || null,
    currency: cur,
    per_eur: perEur,
    rate_to_eur: 1 / perEur
  };
}
