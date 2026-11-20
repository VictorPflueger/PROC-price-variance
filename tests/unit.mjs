// Unit tests (Node.js 22; no browser needed), in groups:
//   stream   the shared streaming client js/anthropic.js with a mocked fetch: SSE parsing and message
//            reconstruction, retries, aborts, truncated streams (Rebate Hunter's cases)
//   cost     the price table in js/cost.js: usage × price per model and tier, the euro conversion
//   format   display strings beyond the engine suite: cents, dates with and without the year, the clock
//   schema   the validator of js/schema.js on planted good and bad records, and the data contracts
//   static   AC-07: the security policy exactly as the brief's section 4, nothing from a third party,
//            every storage key under "pv." apart from Vici's "vc-theme"; the golden data of Diagnostics
//            current with the fixtures
//   tools    the sixteen tool schemas: within the strict-tool limits (TECH_NOTES §1), only supported
//            keywords, every object closed; every tool's input checked by the app's own validator; a
//            plain sentence and a result line for every tool
//   exports  AC-16: the file names, the report's banner, the group analysis as CSV against the engine
//            (RFC 4180 quoting, a byte order mark, CRLF), and the audit export of a run valid against
//            AuditExport, with planted faults each refused
// Usage: node tests/unit.mjs              (all groups)
//        node tests/unit.mjs static       (only these groups)
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { APP_ROOT, ONLY } from "./lib/harness.mjs";

const GROUPS = ["stream", "cost", "format", "schema", "static", "tools", "exports"];
const chosen = ONLY.length ? ONLY : GROUPS;
const unknown = chosen.filter((g) => !GROUPS.includes(g));
if (unknown.length) { console.error(`Unknown group(s): ${unknown.join(", ")}. Groups: ${GROUPS.join(", ")}`); process.exit(2); }
const mod = (p) => import(pathToFileURL(path.join(APP_ROOT, p)).href);
const read = (p) => readFileSync(path.join(APP_ROOT, p), "utf8");
let checks = 0;
const failures = [];
const check = (group, what, ok, detail = "") => { checks += 1; if (!ok) failures.push(`${group} ${what}${detail ? `: ${detail}` : ""}`); };
const attempt = async (group, what, fn) => {
  try { await fn(); check(group, what, true); } catch (e) { check(group, what, false, String(e.message || e).split("\n")[0]); }
};

// ---- stream ---------------------------------------------------------------------------------------
if (chosen.includes("stream")) {
  const { streamMessage, ApiError, withRetry } = await mod("js/anthropic.js");
  const sse = (events, { crlf = false } = {}) => {
    const nl = crlf ? "\r\n" : "\n";
    return events.map(([ev, data]) => `event: ${ev}${nl}data: ${JSON.stringify(data)}${nl}${nl}`).join("");
  };
  const chunked = (text, sizes) => {
    const enc = new TextEncoder().encode(text);
    const parts = [];
    let i = 0; let k = 0;
    while (i < enc.length) { const n = sizes[k++ % sizes.length]; parts.push(enc.slice(i, i + n)); i += n; }
    return new ReadableStream({ start(c) { for (const p of parts) c.enqueue(p); c.close(); } });
  };
  const events = [
    ["message_start", { type: "message_start", message: { id: "msg_1", model: "claude-sonnet-5-5", role: "assistant", content: [], usage: { input_tokens: 1200, cache_creation_input_tokens: 3000, cache_read_input_tokens: 0, output_tokens: 3 } } }],
    ["content_block_start", { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "", signature: "" } }],
    ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "Normalise the Birmingham line " } }],
    ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "first." } }],
    ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "signature_delta", signature: "SIG==abc" } }],
    ["content_block_stop", { type: "content_block_stop", index: 0 }],
    ["ping", { type: "ping" }],
    ["content_block_start", { type: "content_block_start", index: 1, content_block: { type: "text", text: "" } }],
    ["content_block_delta", { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "Hypothesis: Lyon pays more " } }],
    ["content_block_delta", { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "for the same gloves — Lyon ✓" } }],
    ["content_block_stop", { type: "content_block_stop", index: 1 }],
    ["content_block_start", { type: "content_block_start", index: 2, content_block: { type: "tool_use", id: "toolu_1", name: "pv_normalise", input: {} } }],
    ["content_block_delta", { type: "content_block_delta", index: 2, delta: { type: "input_json_delta", partial_json: "{\"line_" } }],
    ["content_block_delta", { type: "content_block_delta", index: 2, delta: { type: "input_json_delta", partial_json: "id\": \"4500010001-00010\"}" } }],
    ["content_block_stop", { type: "content_block_stop", index: 2 }],
    ["content_block_start", { type: "content_block_start", index: 3, content_block: { type: "tool_use", id: "toolu_2", name: "erp_get_overview", input: {} } }],
    ["content_block_stop", { type: "content_block_stop", index: 3 }],
    ["message_delta", { type: "message_delta", delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 240, server_tool_use: { web_search_requests: 0 } } }],
    ["message_stop", { type: "message_stop" }]
  ];
  for (const [label, crlf, sizes] of [["lf, small chunks", false, [7, 13, 1, 50]], ["crlf, odd chunks", true, [3, 1, 2, 97, 5]], ["one chunk", false, [100000]]]) {
    await attempt("stream", `reconstructs a message (${label})`, async () => {
      globalThis.fetch = async () => new Response(chunked(sse(events, { crlf }), sizes), { status: 200, headers: { "content-type": "text/event-stream", "request-id": "req_123" } });
      const texts = [];
      const r = await streamMessage({ key: "k", body: { model: "claude-sonnet-5-5", messages: [] }, hooks: { onText: (i, t) => texts.push(t) } });
      const m = r.message;
      assert.equal(m.stop_reason, "tool_use");
      assert.equal(m.content.length, 4);
      assert.deepEqual(m.content[0], { type: "thinking", thinking: "Normalise the Birmingham line first.", signature: "SIG==abc" });
      assert.equal(m.content[1].text, "Hypothesis: Lyon pays more for the same gloves — Lyon ✓");
      assert.deepEqual(m.content[2].input, { line_id: "4500010001-00010" });
      assert.deepEqual(m.content[3].input, {});
      assert.equal(m.usage.output_tokens, 240);
      assert.equal(m.usage.cache_creation_input_tokens, 3000);
      assert.equal(r.requestId, "req_123");
      assert.ok(texts.length >= 2);
    });
  }
  await attempt("stream", "a mid-stream error is retryable", async () => {
    globalThis.fetch = async () => new Response(chunked(sse([events[0], ["error", { type: "error", error: { type: "overloaded_error", message: "Overloaded" } }]]), [11]), { status: 200 });
    await assert.rejects(() => streamMessage({ key: "k", body: {} }), (e) => e instanceof ApiError && e.type === "overloaded_error" && e.retryable && e.midStream);
  });
  await attempt("stream", "429 with retry-after", async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({ type: "error", error: { type: "rate_limit_error", message: "slow down" }, request_id: "req_9" }), { status: 429, headers: { "retry-after": "1" } });
    await assert.rejects(() => streamMessage({ key: "k", body: {} }), (e) => e.status === 429 && e.retryAfter === "1" && e.retryable);
  });
  await attempt("stream", "a spend limit is not retryable", async () => {
    assert.equal(new ApiError({ status: 429, type: "rate_limit_error", message: "x", details: { error_code: "enforced_spend_limit_reached" } }).retryable, false);
  });
  await attempt("stream", "withRetry succeeds on the third attempt", async () => {
    let n = 0;
    const v = await withRetry(async () => { n += 1; if (n < 3) throw new ApiError({ status: 529, type: "overloaded_error", message: "o" }); return 42; }, { retries: 2 });
    assert.equal(v, 42); assert.equal(n, 3);
  });
  await attempt("stream", "an incomplete tool input (max_tokens) is flagged", async () => {
    const cut = [events[0], ["content_block_start", { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "toolu_x", name: "ui_draft_action", input: {} } }],
      ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: "{\"subject\": \"Harmonise glove pri" } }],
      ["content_block_stop", { type: "content_block_stop", index: 0 }],
      ["message_delta", { type: "message_delta", delta: { stop_reason: "max_tokens" }, usage: { output_tokens: 16000 } }]];
    globalThis.fetch = async () => new Response(chunked(sse(cut), [64]), { status: 200 });
    const rc = await streamMessage({ key: "k", body: {} });
    assert.equal(rc.message.stop_reason, "max_tokens"); assert.ok(rc.incomplete.has(0));
  });
  await attempt("stream", "an abort rejects with AbortError", async () => {
    const ac = new AbortController();
    globalThis.fetch = async (url, init) => new Promise((res, rej) => init.signal.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" }))));
    setTimeout(() => ac.abort(), 20);
    await assert.rejects(() => streamMessage({ key: "k", body: {}, signal: ac.signal }), (e) => e.name === "AbortError");
  });
  await attempt("stream", "a body that ends without a stop reason is an interrupted connection", async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({ data: [] }), { status: 200, headers: { "content-type": "application/json" } });
    await assert.rejects(() => streamMessage({ key: "k", body: {} }), (e) => e instanceof ApiError && e.type === "network_error" && e.midStream);
    globalThis.fetch = async () => new Response(chunked(sse(events.slice(0, 6)), [40]), { status: 200 });
    await assert.rejects(() => streamMessage({ key: "k", body: {} }), (e) => e instanceof ApiError && e.type === "network_error");
  });
}

// ---- cost ------------------------------------------------------------------------------------------
if (chosen.includes("cost")) {
  const { usageCostUsd, createCostTracker } = await mod("js/cost.js");
  const { MODELS, FX_USD_EUR } = await mod("js/config.js");
  const usd = usageCostUsd("claude-sonnet-5-5", { input_tokens: 1200, cache_creation_input_tokens: 3000, cache_read_input_tokens: 10000, output_tokens: 240 });
  const expected = (1200 * 2 + 3000 * 2.5 + 10000 * 0.1 + 240 * 10) / 1e6;
  check("cost", "Sonnet 5.5: input, cache write, cache read and output at their prices", Math.abs(usd - expected) < 1e-12, `${usd} vs ${expected}`);
  const haikuLong = usageCostUsd("claude-haiku-5-5", { input_tokens: 90000, cache_read_input_tokens: 20000, output_tokens: 1000 });
  check("cost", "Haiku 5.5 above 100,000 prompt tokens at the long-prompt prices", Math.abs(haikuLong - (90000 * 0.5 + 20000 * 0.05 + 1000 * 2.5) / 1e6) < 1e-12);
  const t = createCostTracker("claude-opus-5-5");
  t.add({ input_tokens: 1e6 });
  const snap = t.add({ output_tokens: 1e6 });
  check("cost", "the tracker sums calls and converts at 1 USD = 0.894 EUR", Math.abs(snap.usd - 24) < 1e-9 && Math.abs(snap.eur - 24 * 0.894) < 1e-9 && snap.requests === 2);
  check("cost", "the three models of the brief with the verified prices", JSON.stringify(MODELS.map((m) => [m.id, m.price.input, m.price.output])) === JSON.stringify([["claude-sonnet-5-5", 2, 10], ["claude-haiku-5-5", 0.1, 0.5], ["claude-opus-5-5", 4, 20]]) && FX_USD_EUR === 0.894);
}

// ---- format ----------------------------------------------------------------------------------------
if (chosen.includes("format")) {
  const { eurCents, shortDate, dateWithYear, clock, int, num2, round9 } = await mod("js/format.js");
  const today = new Date(2026, 10, 19, 12);
  check("format", "cents: €0.38 and -€1.50", eurCents(0.375) === "€0.38" && eurCents(-1.5) === "-€1.50", `${eurCents(0.375)} ${eurCents(-1.5)}`);
  check("format", "a date of this year: Thu 19 Nov", shortDate(0, today) === "Thu 19 Nov", shortDate(0, today));
  check("format", "a date of another year: Wed 19 Nov 2025, without a comma", shortDate(-365, today) === "Wed 19 Nov 2025", shortDate(-365, today));
  check("format", "an ISO date: Fri 14 Aug", shortDate("2026-08-14", today) === "Fri 14 Aug", shortDate("2026-08-14", today));
  check("format", "September is Sep", shortDate("2026-09-01", today) === "Tue 1 Sep", shortDate("2026-09-01", today));
  check("format", "a date with its year: 19 Nov 2026", dateWithYear("2026-11-19") === "19 Nov 2026");
  check("format", "the clock: 01:05 and 1:00:05", clock(65000) === "01:05" && clock(3605000) === "1:00:05");
  check("format", "whole numbers with groups: 1,370,000", int(1370000) === "1,370,000");
  check("format", "two decimals: 1.16", num2(1.1609456252677857) === "1.16");
  check("format", "rounding to 1e-9 removes noise and -0", round9(1738.7999999999997) === 1738.8 && Object.is(round9(-1e-12), 0));
}

// ---- schema ----------------------------------------------------------------------------------------
if (chosen.includes("schema")) {
  const { validate, formatErrors } = await mod("js/schema.js");
  const { SCHEMAS, CONTRACT_NAMES } = await mod("js/schemas.js");
  const v = (value, name) => validate(value, name, { defs: SCHEMAS });
  check("schema", "the sixteen contracts of the brief are defined", CONTRACT_NAMES.length === 16 && CONTRACT_NAMES.every((n) => SCHEMAS[n]));
  const plant = { id: "1010", company_code: "CC-1000", city: "Frankfurt am Main", country: "DE", role: "Headquarters" };
  check("schema", "a valid plant passes", v(plant, "Plant").ok);
  const bad = v({ ...plant, id: "101", extra: 1 }, "Plant");
  check("schema", "a bad id and an unknown field are named", !bad.ok && formatErrors(bad.errors).some((e) => /Plant\.id: expected a text matching/.test(e)) && formatErrors(bad.errors).some((e) => /Plant\.extra: is not a field/.test(e)), formatErrors(bad.errors).join("; "));
  const missing = v({ id: "1010" }, "Plant");
  check("schema", "a missing required field is named", !missing.ok && formatErrors(missing.errors).some((e) => /missing the required field company_code/.test(e)));
  check("schema", "NaN and infinity are not numbers", !v({ currency: "GBP", rate_to_eur: NaN }, "FxRate").ok && !v({ currency: "GBP", rate_to_eur: Infinity }, "FxRate").ok);
  check("schema", "an integer field refuses 1.5", !v({ id: "VL-1", group: "x", option: "H", plant: "1020", old_supplier: null, new_supplier: null, new_price: null, approved_day: -1.5, approved_savings_eur: 1, bundle_part_eur: 0, implemented_day: null }, "ValueLogEntry").ok);
  check("schema", "an enum refuses an option that does not exist", !v({ options_seq: 1, option_id: "X", decision: "approved", by: "user" }, "Decision").ok && v({ options_seq: 1, option_id: "accept", decision: "approved", reason: "volume tier", by: "user" }, "Decision").ok);
  check("schema", "anyOf: a date or null", v({ currency: "GBP", rate_to_eur: 1.16, first: null }, "FxRate").ok && !v({ currency: "GBP", rate_to_eur: 1.16, first: "19 Nov" }, "FxRate").ok);
  check("schema", "an unsupported keyword in a schema is an error, never silently ignored", !validate(1, { type: "number", multipleOf: 2 }).ok);
  check("schema", "a reference to an unknown definition is an error", !validate(1, { $ref: "#/$defs/Nothing" }, { defs: SCHEMAS }).ok);
  check("schema", "unique items", !validate([1, 1], { type: "array", uniqueItems: true }).ok && validate([1, 2], { type: "array", uniqueItems: true }).ok);
  const event = { id: "ev-1", seq: 1, type: "confirmation_request", ts: "2026-11-19T20:00:00Z", t: 10, run_id: "run-1", mode: "simulation", payload: {} };
  check("schema", "a run event of this app's new types passes; an unknown type does not", v(event, "RunEvent").ok && !v({ ...event, type: "rebate_found" }, "RunEvent").ok);
}

// ---- tools: the schemas sent with strict: true, and the validator in code ---------------------------
if (chosen.includes("tools")) {
  const { toolDefinitions, TOOL_NAMES, createToolbox } = await mod("js/tools.js");
  const { toolPlain } = await mod("js/tool_plain.js");
  const { summarizeToolResult } = await mod("js/summaries.js");
  const tools = toolDefinitions();
  const ALLOWED = new Set(["type", "properties", "required", "additionalProperties", "enum", "items", "description"]);
  check("tools", "sixteen tools with unique names, as the brief's section 7 lists them", tools.length === 16 && new Set(TOOL_NAMES).size === 16 && ["erp_get_overview", "erp_query", "erp_get_record", "pv_scan", "pv_normalise", "pv_compare", "pv_match", "ui_confirm_cluster", "open_ecb_rate", "ui_mark_board", "ui_report_alert", "ui_propose_options", "ui_await_decision", "ui_draft_action", "ui_await_approvals", "ui_final_report"].every((n) => TOOL_NAMES.includes(n)), TOOL_NAMES.join(", "));
  check("tools", "every tool is sent with strict: true, at most twenty strict tools", tools.every((t) => t.strict === true) && tools.length <= 20);
  check("tools", "strict can be dropped (a 400 that names it)", toolDefinitions({ strict: false }).every((t) => !("strict" in t)));
  let optional = 0;
  let unions = 0;
  const bad = [];
  const walk = (schema, at) => {
    for (const k of Object.keys(schema)) if (!ALLOWED.has(k)) bad.push(`${at}: keyword ${k}`);
    if (Array.isArray(schema.type)) unions += 1;
    if (schema.type === "object") {
      if (schema.additionalProperties !== false) bad.push(`${at}: object not closed`);
      const props = Object.keys(schema.properties || {});
      for (const r of schema.required || []) if (!props.includes(r)) bad.push(`${at}: required ${r} is not a property`);
      optional += props.filter((p) => !(schema.required || []).includes(p)).length;
      for (const [k, v] of Object.entries(schema.properties || {})) walk(v, `${at}.${k}`);
    }
    if (schema.items) walk(schema.items, `${at}[]`);
  };
  for (const t of tools) walk(t.input_schema, t.name);
  check("tools", "only keywords of the strict subset, every object closed, required fields declared", bad.length === 0, bad.join("; "));
  check("tools", "at most 24 optional parameters across the strict tools (this app: 14)", optional <= 24 && optional === 14, String(optional));
  check("tools", "no union-typed parameter", unions === 0, String(unions));
  check("tools", "every tool has a description", tools.every((t) => typeof t.description === "string" && t.description.length > 30));
  // Every input is checked against its tool's schema before anything runs.
  globalThis.window = globalThis;
  for (const f of ["fx", "world"]) await mod(`data/${f}.js`);
  const tb = createToolbox({
    world: globalThis.WORLD, fx: globalThis.FX, params: (await mod("js/params.js")).DEFAULTS, emit: () => {},
    waitUntil: async () => { throw new Error("no person in this test"); }, takeDecision: () => null, drafts: new Map(),
    onPhase: () => {}, getPhase: () => null, isEnded: () => false, ecbRate: async () => ({ ok: false, error: "offline" }), mode: "live", entry: "scenario"
  });
  const refusedInputs = [];
  for (const t of tools) {
    const out = await tb.execute(t.name, { unexpected_field: 1 });
    if (!(out.isError && out.guard === "input" && /schema/.test(out.result.error))) refusedInputs.push(t.name);
  }
  check("tools", "every tool refuses an input that breaks its schema, with an instructive message", refusedInputs.length === 0, refusedInputs.join(", "));
  const wrongType = await tb.execute("pv_normalise", { line_id: 4500010001 });
  check("tools", "a wrong type names the field and what it expects", wrongType.isError && /line_id: expected string/.test(wrongType.result.error), wrongType.result.error);
  check("tools", "a plain sentence for every tool call (js/tool_plain.js)", tools.every((t) => typeof toolPlain(t.name, {}, globalThis.WORLD) === "string"));
  // A replay fetches no rate, so its console line says it replays one (review R14).
  const rateLines = ["live", "authored", "recorded"].map((m) => toolPlain("open_ecb_rate", { currency: "GBP" }, globalThis.WORLD, m));
  check("tools", "a rate request reads Fetches in Live, Replays a representative or recorded rate in a simulation", /^Fetches .* through Frankfurter$/.test(rateLines[0]) && /^Replays a representative .*not fetched/.test(rateLines[1]) && /^Replays .*recorded, not fetched again/.test(rateLines[2]) && !/Fetches/.test(rateLines[1] + rateLines[2]), rateLines.join(" | "));
  check("tools", "a result line for every tool (js/summaries.js)", tools.every((t) => summarizeToolResult(t.name, { ok: true }) !== "Result received"));
}

// ---- static: AC-07 ---------------------------------------------------------------------------------
if (chosen.includes("static")) {
  const POLICY = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src https://api.anthropic.com https://api.frankfurter.dev; object-src 'none'; base-uri 'none'; form-action 'none'";
  const html = read("index.html");
  const metas = [...html.matchAll(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"\s*>/gi)];
  check("static", "index.html carries one security policy, exactly the brief's", metas.length === 1 && metas[0][1] === POLICY, metas.map((m) => m[1]).join(" | "));
  check("static", "no other http-equiv and no inline script or style in index.html",
    (html.match(/http-equiv/gi) || []).length === 1 && !/<script(?![^>]*\bsrc=)[^>]*>/i.test(html) && !/<style\b/i.test(html) && !/\sstyle="/i.test(html));
  const srcs = [...html.matchAll(/<(?:script|link|img)\b[^>]*\s(?:src|href)="([^"]+)"/gi)].map((m) => m[1]);
  check("static", "every script, style, icon and image of index.html comes from this site", srcs.length > 5 && srcs.every((u) => !/^(?:[a-z]+:)?\/\//i.test(u) && !/^data:/i.test(u)), srcs.filter((u) => /^(?:[a-z]+:)?\/\//i.test(u)).join(", "));
  const walk = (dir) => readdirSync(path.join(APP_ROOT, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  const appFiles = [...walk("js"), ...walk("css"), ...walk("data"), "index.html"];
  const outside = [];
  for (const f of appFiles) {
    const t = read(f);
    if (/\.css$/.test(f) && /(?:@import|url\()\s*["']?(?:[a-z]+:)?\/\//i.test(t)) outside.push(`${f}: a stylesheet or font from another site`);
    if (/\.js$/.test(f) && /\bimport\s*(?:\(|[^;]*?\bfrom)\s*["'](?:[a-z]+:)?\/\//i.test(t)) outside.push(`${f}: a module from another site`);
    if (/\.js$/.test(f) && /createElement\(\s*["'](?:script|link|iframe)["']/i.test(t)) outside.push(`${f}: creates a script, link or frame element`);
    if (/\.js$/.test(f) && /\b(?:fonts\.googleapis|cdn\.|unpkg\.com|jsdelivr)/i.test(t)) outside.push(`${f}: names a content host`);
  }
  check("static", "no script, style, font or module from a third party in js/, css/ and data/", outside.length === 0, outside.join("; "));
  const viciCss = read("vici/dist/vici.min.css");
  check("static", "Vici's stylesheet loads its fonts from vici/ itself", ![...viciCss.matchAll(/url\(\s*["']?([^"')]+)/g)].some((m) => /^(?:[a-z]+:)?\/\//i.test(m[1])));
  const { STORAGE } = await mod("js/config.js");
  check("static", "every storage key in js/config.js starts with pv.", Object.values(STORAGE).length >= 5 && Object.values(STORAGE).every((k) => k.startsWith("pv.")), JSON.stringify(STORAGE));
  const calls = [];
  for (const f of walk("js")) {
    const text = read(f);
    for (const m of text.matchAll(/\b(?:localStorage|sessionStorage)\s*\.\s*(getItem|setItem|removeItem)\(\s*([^,)]+)/g)) calls.push({ f, text, key: m[2].trim(), method: m[1] });
    if (/\b(?:localStorage|sessionStorage)\s*\[|\b(?:localStorage|sessionStorage)\.(?!getItem|setItem|removeItem|key\(|length)\w+\s*=/.test(text)) calls.push({ f, text, key: "a key set without getItem/setItem", method: "set" });
  }
  // Allowed besides a STORAGE key and Vici's vc-theme: reading every key by its index (Diagnostics
  // looks for a stray API key), and a helper's key parameter when every call of the helper, in any
  // module, passes a STORAGE key.
  const jsTexts = walk("js").map((g) => read(g));
  const helperOk = (text, param, texts) => {
    const helpers = [...text.matchAll(new RegExp(`function\\s+(\\w+)\\(\\s*${param}\\b`, "g"))].map((m) => m[1]);
    const args = texts.flatMap((t) => helpers.flatMap((name) => [...t.matchAll(new RegExp(`\\b${name}\\(([^,)]*)`, "g"))].map((m) => m[1].trim()))).filter((a) => a !== param);
    return helpers.length > 0 && args.length > 0 && args.every((a) => /^STORAGE\.\w+$/.test(a));
  };
  const allowed = ({ text, key, method }, texts = jsTexts) => /^STORAGE\.\w+$/.test(key) || key === '"vc-theme"' || key === "'vc-theme'"
    || (method === "getItem" && /^(?:localStorage|sessionStorage)\.key\(/.test(key))
    || (/^\w+$/.test(key) && helperOk(text, key, texts));
  const strays = calls.filter((c) => !allowed(c));
  check("static", "every storage call in js/ uses a key from STORAGE or Vici's vc-theme", calls.length >= 4 && strays.length === 0, strays.map((c) => `${c.f}: ${c.key}`).join("; "));
  // The rule must be able to fail: a helper called with a key of its own, a literal key, a write by index.
  const planted = "function store(key, v) { try { sessionStorage.setItem(key, v); } catch {} }\nstore(STORAGE.speed, 1);\nstore(\"rh.speed\", 2);";
  check("static", "the storage rule catches a planted helper call, a literal key and a write by index",
    !allowed({ text: planted, key: "key", method: "setItem" }, [...jsTexts, planted]) && !allowed({ text: "", key: '"rh.speed"', method: "setItem" }) && !allowed({ text: "", key: "localStorage.key(0)", method: "setItem" }));
  const viciJs = read("vici/dist/vici.js");
  const viciKeys = [...viciJs.matchAll(/storage(?:Get|Set)\(\s*([^,)]+)/g)].map((m) => m[1].trim()).filter((k) => k !== "key");
  check("static", "Vici's script stores only vc-theme", /STORAGE_KEY = 'vc-theme'/.test(viciJs) && viciKeys.every((k) => k === "STORAGE_KEY"), viciKeys.join(", "));
  check("static", "the key's storage is this tab's session storage, under pv.anthropic.key", STORAGE.apiKey === "pv.anthropic.key" && /sessionStorage\.setItem\(STORAGE\.apiKey/.test(read("js/keystore.js")) && !/localStorage[^\n]*STORAGE\.apiKey/.test(read("js/keystore.js")));
  // Diagnostics runs the golden cases in the browser from js/golden_data.js: it must be the fixtures'.
  const { goldenText } = await import(pathToFileURL(path.join(APP_ROOT, "tools", "build_golden.mjs")).href);
  check("static", "js/golden_data.js is current with tests/fixtures (node tools/build_golden.mjs writes it)", read("js/golden_data.js") === goldenText());
}

// ---- exports: AC-16 ---------------------------------------------------------------------------------
if (chosen.includes("exports")) {
  const vm = await import("node:vm");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  for (const f of ["fx.js", "world.js", "reference_cases.js"]) vm.runInContext(read(`data/${f}`), sandbox);
  const D = sandbox.window;
  globalThis.WORLD = D.WORLD;
  globalThis.FX = D.FX;
  const { exportFileName, fileSlug, reportFile, groupAnalysisCsv, parseCsv, csvField, ANALYSIS_COLUMNS } = await mod("js/exports.js");
  const { analyseWorld, ratesOf } = await mod("js/world.js");
  const { validate, formatErrors } = await mod("js/schema.js");
  const { SCHEMAS } = await mod("js/schemas.js");
  const { DEFAULTS } = await mod("js/params.js");
  check("exports", "file names: price-variance-, the run, its mode in capitals, the kind",
    exportFileName("report", { runId: "run-20261120-1012-ab3x", mode: "simulation" }) === "price-variance-run-20261120-1012-ab3x-SIMULATION-report.md"
    && exportFileName("audit", { runId: "run-1", mode: "live" }) === "price-variance-run-1-LIVE-audit.json"
    && exportFileName("analysis", { runId: "run-1", mode: "live", groupId: "MPN:Brekholt:BH-7730-S3" }) === "price-variance-run-1-LIVE-MPN-Brekholt-BH-7730-S3-analysis.csv"
    && exportFileName("report", {}) === "price-variance-report.md" && fileSlug("CL-01") === "CL-01");
  check("exports", "a simulation's report opens with its banner; a live one is left as it is",
    reportFile("# R", { mode: "simulation" }).startsWith("> SIMULATION: scripted replay") && reportFile("# R", { mode: "simulation", simSource: "recorded" }).startsWith("> SIMULATION: replay of a recorded live run") && reportFile("# R", { mode: "live" }) === "# R");
  check("exports", "RFC 4180 quoting: commas, quotes and line breaks", csvField('a,"b"') === '"a,""b"""' && csvField("x\ny") === '"x\ny"' && csvField("plain") === "plain" && csvField(null) === "");
  const { analyses } = analyseWorld(D.WORLD, ratesOf(D.FX), { clusters: [D.REFERENCE_CASES.cases["SC-CONSULT"].cluster] });
  for (const id of [D.REFERENCE_CASES.cases["SC-GLOVES"].group_id, "CL-01", D.REFERENCE_CASES.cases["SC-PALLETS"].group_id]) {
    const a = analyses.find((x) => x.id === id);
    const text = groupAnalysisCsv(D.WORLD, a, { ratesLabel: D.FX.label });
    const rows = parseCsv(text);
    const head = text.replace(/^﻿/, "").split("\r\n")[0].split(",");
    const lines = rows.filter((r) => r.status === "included");
    const ok = text.startsWith("﻿") && JSON.stringify(head) === JSON.stringify(ANALYSIS_COLUMNS) && !/[^\r]\n/.test(text.replace(/"[^"]*"/g, ""))
      && lines.length === a.lines.length && rows.length === a.lines.length + a.excluded.length
      && lines.every((r) => { const l = a.lines.find((x) => x.id === r.line_id); return l && Math.abs(Number(r.normalised_price_eur_per_base_unit) - l.price) <= 1e-9 && Math.abs(Number(r.gap_eur) - l.gap) <= 1e-6 && Math.abs(Number(r.unexplained_eur) - l.unexplained) <= 1e-6 && r.group_id === a.id; })
      && Math.abs(lines.reduce((x, r) => x + Number(r.unexplained_eur || 0), 0) - a.unexplained) <= 1e-6;
    check("exports", `the analysis of ${id} as CSV: header, one row per line and exclusion, figures equal to the engine's`, ok, `${lines.length}/${a.lines.length}`);
  }
  const before = groupAnalysisCsv(D.WORLD, analyses[0], { compared: false });
  check("exports", "before the engine compares a group, its CSV leaves the benchmark and the gaps empty", parseCsv(before).every((r) => r.status === "excluded" || (r.gap_eur === "" && r.benchmark_price_eur_per_base_unit === "")));
  // The audit export of a run, built as the page builds it, valid against AuditExport.
  const { bus } = await mod("js/events.js");
  const audit = await mod("js/audit.js");
  audit.resetAudit();
  bus.beginRun({ run_id: "run-unit-1", mode: "live" });
  bus.emit("run_start", { run_id: "run-unit-1", mode: "live", entry: "scenario", title: "Scenario 1", scenario_id: "SC-GLOVES", model: "claude-sonnet-5-5", parameters: { ...DEFAULTS, materiality_eur: 4000 }, parameters_changed: [{ name: "materiality_eur", default: 5000, value: 4000 }] });
  bus.emit("tool_result", { call_id: "t1", name: "open_ecb_rate", ok: true, summary: "rate", result: { ok: true, currency: "GBP", date: "2026-11-19", per_eur: 0.84, rate_to_eur: 1 / 0.84, source: "ECB via Frankfurter" } });
  bus.emit("option_decision", { options_seq: 1, option_id: "H", decision: "approved", by: "user" });
  bus.emit("action_decision", { action_id: "act-1", decision: "approved", by: "user" });
  bus.emit("run_end", { status: "done" });
  bus.endRun();
  const doc = JSON.parse(audit.buildAuditExport());
  const good = validate(doc, "AuditExport", { defs: SCHEMAS });
  check("exports", "a run's audit export validates against AuditExport", good.ok, formatErrors(good.errors).join("; "));
  check("exports", "the export records the parameters in effect, those changed and the rate fetched in the run",
    doc.parameters.in_effect.materiality_eur === 4000 && doc.parameters.changed_from_defaults[0]?.name === "materiality_eur" && doc.rates.fetched_in_run[0]?.currency === "GBP" && doc.decisions.length === 2 && doc.decisions.every((d) => d.reviewer));
  check("exports", "the audit file is named after the run and its mode", audit.auditFileName() === "price-variance-run-unit-1-LIVE-audit.json", audit.auditFileName());
  const planted = [
    ["the AI disclosure missing", (d) => { delete d.ai_disclosure; }, /ai_disclosure/],
    ["a mode that is not live or simulation", (d) => { d.mode = "LIVE"; }, /mode/],
    ["a version that is not x.y.z", (d) => { d.app_version = "1.0"; }, /app_version/],
    ["a negative parameter", (d) => { d.parameters.in_effect.urgent_allowance = -0.1; }, /urgent_allowance/],
    ["an unknown parameter", (d) => { d.parameters.in_effect.extra = 1; }, /extra/],
    ["an event without its time", (d) => { delete d.events[0].ts; }, /events\[0\]/],
    ["an event of an unknown type", (d) => { d.events[0].type = "telemetry"; }, /events\[0\]\.type/],
    ["a decision without its reviewer", (d) => { delete d.decisions[0].reviewer; }, /decisions\[0\]/],
    ["a fetched rate without ok", (d) => { delete d.rates.fetched_in_run[0].ok; }, /fetched_in_run\[0\]/]
  ];
  for (const [what, spoil, where] of planted) {
    const bad = JSON.parse(JSON.stringify(doc));
    spoil(bad);
    const r = validate(bad, "AuditExport", { defs: SCHEMAS });
    check("exports", `the validator refuses an export with ${what}`, !r.ok && where.test(formatErrors(r.errors).join(" ")), formatErrors(r.errors).join("; ").slice(0, 200));
  }
  audit.resetAudit();
}

for (const f of failures) console.log(`FAIL  ${f}`);
if (failures.length) { console.log(`\nUNIT FAILED: ${failures.length} of ${checks} checks in ${chosen.join(" ")}`); process.exit(1); }
console.log(`UNIT OK: ${chosen.join(" ")} (${checks} checks)`);
