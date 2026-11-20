// The live agent against a scripted stand-in for the Anthropic Messages API (lib/fake-claude.mjs) and
// for Frankfurter (lib/fake-rates.mjs). The fake streams realistic SSE and checks every request against
// the protocol (headers, the sixteen strict tools, assistant turns echoed unchanged, every tool_use
// answered). The tools run for real in the browser, so the expectations read their actual results.
//   guard    AC-09: every refusal in code shows a Guardrail line: a comparison across groups (a material
//            group, lines of another group), an unconfirmed cluster, an input that breaks its schema, an
//            alert without three normalised lines of the benchmark and the highest pair, an alert without
//            the contract lookup, options outside the latest pv_compare, a stale decision, a draft the
//            option does not allow, a report before the Outbox is decided; then the run completes
//   rates    AC-10: a failing and a blocked rate request leave the bundled rates and say so; a refreshed
//            rate shows as a labelled sensitivity and the tiles keep the window's rate
//   caps     AC-11: never a 41st model call; none once €3 is spent; the cost meter equals usage × price
//            within 1e-9; a 400 that names strict drops it once, logged
//   record   G14: Save run as simulation gives a recorded script without the key that the checker
//            accepts and the player replays
//   entries  G15: Live sweep starts from pv_scan without a tip (the portfolio equals the engine's scan);
//            Custom what-if passes the person's words; both are Live only
//   marks    review R1: the agent cannot mark pairs approved or accepted (only a person's decision does),
//            nor mark "above" what the comparison does not put above the benchmark; each refusal a
//            Guardrail line
//   params   M3-2: a parameter changed in the Method dialog before a live run is the one that run's engine
//            uses; the audit export records it; the run cannot be saved as a simulation
// Usage: node tests/live.mjs [case…]
import path from "node:path";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { createFakeClaude } from "./lib/fake-claude.mjs";
import { frankfurterRoute } from "./lib/fake-rates.mjs";
import { APP_ROOT, ONLY, outDir, wanted, launchBrowser, serveStatic, CORS, MOCK_KEY, NETWORK_NOISE, SKIP_INTRO } from "./lib/harness.mjs";
import { analyseWorld, ratesOf } from "../js/world.js";
import { scan } from "../js/variance.js";
import { MODELS, FX_USD_EUR } from "../js/config.js";
import { usageCostUsd } from "../js/cost.js";
import { DEFAULTS } from "../js/params.js";

const OUT = await outDir("live");
const PORT = 8771;
const { base: BASE, close } = await serveStatic(APP_ROOT, PORT);
const browser = await launchBrowser();
const D = await loadData(["fx.js", "world.js", "scenarios.js", "sim_runs.js"]);
const W = D.WORLD;
const SCEN = Object.fromEntries(D.SCENARIOS.map((s) => [s.id, s]));
const { analyses } = analyseWorld(W, ratesOf(D.FX));
const A = Object.fromEntries(analyses.map((a) => [a.id, a]));
const results = [];
let checks = 0;

async function loadData(files) {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  for (const f of files) vm.runInContext(await readFile(path.join(APP_ROOT, "data", f), "utf8"), sandbox);
  return sandbox.window;
}

const usage = (o = {}) => ({ input_tokens: 700, cache_creation_input_tokens: 0, cache_read_input_tokens: 8000, output_tokens: 400, ...o });
const tool = (id, name, input) => ({ type: "tool_use", id, name, input });
const text = (t) => ({ type: "text", text: t });
const lastResults = (req) => {
  const last = req.messages[req.messages.length - 1];
  return Array.isArray(last?.content) ? last.content.filter((b) => b.type === "tool_result").map((b) => ({ id: b.tool_use_id, isError: b.is_error === true, json: safeJson(b.content), raw: b.content })) : [];
};
const safeJson = (s) => { try { return JSON.parse(s); } catch { return null; } };
const pairLine = (a, pair, k = 0) => a.pairs.find((p) => p.id === pair).lines[k];

async function newPage(fake, { rates = { mode: "ok" }, routeData = null } = {}) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, acceptDownloads: true });
  await context.addInitScript(SKIP_INTRO);
  await context.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  const log = { pageErrors: [], consoleErrors: [], consoleAll: [], external: [], rates: [], models: 0 };
  if (routeData) await context.route(`${BASE}data/sim_runs.js`, (route) => route.fulfill({ status: 200, headers: { "content-type": "text/javascript; charset=utf-8" }, body: routeData }));
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (u.host === "api.anthropic.com") {
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { ...CORS, "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST" } });
      if (u.pathname === "/v1/models") {
        log.models += 1;
        return route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify({ data: MODELS.map((m) => ({ id: m.id })) }) });
      }
      if (u.pathname === "/v1/messages") {
        const out = fake.handle(req.postData() || "{}", req.headers());
        if (out.delayMs) await new Promise((r) => setTimeout(r, out.delayMs));
        return route.fulfill({ status: out.status, headers: { ...CORS, ...out.headers }, body: out.body }).catch(() => {});
      }
    }
    if (u.host === "api.frankfurter.dev") return frankfurterRoute({ ...rates, log: log.rates })(route);
    log.external.push(`${req.method()} ${u.host}${u.pathname}`);
    return route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => log.pageErrors.push(String(e.message || e)));
  page.on("console", (m) => { log.consoleAll.push(m.text()); if (m.type() === "error" && !NETWORK_NOISE.test(m.text()) && !/live run failed/.test(m.text())) log.consoleErrors.push(m.text()); });
  return { context, page, log };
}

async function startLive(page, { scenario = "SC-GLOVES", entry = "scenario", custom = "", reload = true } = {}) {
  if (reload) {
    await page.goto(BASE);
    await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
  }
  if (entry === "sweep") await page.click("#btn-scan");
  else {
    if (entry === "custom") {
      await page.click("#dd-scenario");
      await page.click('.vc-menu__item[data-id="custom"]');
      await page.fill("#custom-scenario", custom);
      await page.click('button:has-text("Use this scenario")');
    } else await page.click(`.scenario-pick__item[data-id="${scenario}"]`);
    await page.click("#btn-start");
    await page.waitForSelector(".mode-card");
    if (entry === "custom") {
      const blocked = await page.$eval('.mode-card[data-mode="simulation"]', (c) => c.getAttribute("aria-disabled"));
      expect("entries", "Custom what-if: Simulation is not offered (Live only)", blocked === "true", blocked);
    }
    await page.click('.mode-card[data-mode="live"] .mode-cta button');
  }
  await page.waitForSelector("#api-key-input");
  await page.fill("#api-key-input", MOCK_KEY);
  await page.click('button:has-text("Check key and continue")');
}

function expect(name, what, ok, detail = "") {
  checks += 1;
  if (!ok) results.push({ name, failure: `${what}${detail !== "" ? `: ${String(detail).slice(0, 300)}` : ""}` });
}

async function waitEnd(page, ms = 60000) {
  await page.waitForFunction(() => /Done|Aborted|Error|Stopped/.test(document.querySelector(".status-pill .text")?.textContent || ""), null, { timeout: ms });
  return page.$eval(".status-pill .text", (e) => e.textContent);
}

async function finish(name, t, fake) {
  const csp = await t.page.evaluate(() => window.__csp || []).catch(() => []);
  expect(name, "no protocol violation", !fake || fake.violations.length === 0, fake?.violations.join(" | "));
  expect(name, "no page error", t.log.pageErrors.length === 0, t.log.pageErrors.join(" | "));
  expect(name, "no console error", t.log.consoleErrors.length === 0, t.log.consoleErrors.join(" | "));
  expect(name, "no policy violation", csp.length === 0, csp.join(" | "));
  expect(name, "no request to another host", t.log.external.length === 0, t.log.external.join(" | "));
  await t.context.close();
}

const guardLines = (page) => page.$$eval("#console .entry[data-guard]", (els) => els.map((e) => e.textContent.replace(/\s+/g, " ")));
const approveAllDrafts = async (page) => {
  for (const b of await page.$$('.action-card[data-status="pending"] [data-action="approve"]')) await b.click().catch(() => {});
};

// ---- guard: AC-09 -------------------------------------------------------------------------------
if (wanted("guard")) {
  const a = A["20001001"];
  const bench = pairLine(a, a.benchmark.pair);
  const high = pairLine(a, a.highest.pair);
  const other = pairLine(a, "2010 / 80001");
  const foreign = A["20001003"].lines[0].id;
  const H = [{ id: "H", title: "Move Lyon and Duisburg to the contract supplier", description: "Order at the benchmark under Frankfurt's contract.", residual_risk: "Birmingham stays as it is." }, { id: "R", title: "Renegotiate above the benchmark", description: "Ask the suppliers to match the benchmark.", residual_risk: "They may not agree." }];
  const script = [
    { usage: usage(), stop: "tool_use", blocks: [
      { type: "thinking", thinking: "The tip is a lead. First the overview and the material.", signature: "SIG-1==" },
      text("Hypothesis: Lyon buys the same gloves off contract at a higher price."),
      tool("t01", "erp_get_overview", {}),
      tool("t02", "erp_query", { product: "material", filters: [{ field: "description", op: "contains", value: "nitrile" }] })
    ], expect: (req, { check }) => {
      check(typeof req.messages[0].content === "string" && req.messages[0].content.includes(SCEN["SC-GLOVES"].seed), "opening message carries the tip");
      check(req.tools.map((t) => t.name).join(",") === "erp_get_overview,erp_query,erp_get_record,pv_scan,pv_normalise,pv_compare,pv_match,ui_confirm_cluster,open_ecb_rate,ui_mark_board,ui_report_alert,ui_propose_options,ui_await_decision,ui_draft_action,ui_await_approvals,ui_final_report", "the sixteen tools in order");
      check(req.thinking?.type === "adaptive" && req.thinking?.display === "summarized", "thinking adaptive, summarized");
      check(req.cache_control?.type === "ephemeral", "cache_control");
      check(/Only the engine compares/.test(req.system) && /never compute a figure yourself/i.test(req.system), "the rules are in the system prompt");
    } },
    { usage: usage(), stop: "tool_use", blocks: [tool("t03", "pv_compare", { group_id: "MRO-PPE" })], expect: (req, { check }) => {
      const r = lastResults(req);
      check(r.length === 2 && r.every((x) => !x.isError) && r[1].json.rows[0].id === "20001001", "overview and material answered");
    } },
    { usage: usage(), stop: "tool_use", blocks: [tool("t04", "pv_compare", { group_id: "20001001" })], expect: (req, { check }) => {
      const r = lastResults(req)[0];
      check(r.isError && /material group, not a comparable group/.test(r.json.error), `a material group is refused (got ${r.raw})`);
    } },
    { usage: usage(), stop: "tool_use", blocks: [tool("t05", "ui_report_alert", { compare_id: "CMP-1", title: "Lyon pays more", summary: "Lyon pays above the benchmark." })], expect: (req, { check }) => {
      const r = lastResults(req)[0];
      check(!r.isError && r.json.compare_id === "CMP-1" && Math.abs(r.json.opportunity - a.opportunity) < 1e-9, "the comparison returns the engine's figures");
    } },
    { usage: usage(), stop: "tool_use", blocks: [
      tool("t06", "pv_normalise", { line_id: bench }), tool("t07", "pv_normalise", { line_id: other }), tool("t08", "pv_normalise", { line_id: pairLine(a, a.benchmark.pair, 1) }),
      tool("t09", "erp_query", { product: "po_line", limit: "ten" })
    ], expect: (req, { check }) => {
      const r = lastResults(req)[0];
      check(r.isError && /at least three of the group's lines/.test(r.json.error) && /benchmark pair/.test(r.json.error), `an alert without normalised lines is refused (got ${r.raw.slice(0, 200)})`);
    } },
    { usage: usage(), stop: "tool_use", blocks: [tool("t10", "ui_report_alert", { compare_id: "CMP-1", title: "Lyon pays more", summary: "Lyon pays above the benchmark." })], expect: (req, { check }) => {
      const r = lastResults(req);
      check(r.slice(0, 3).every((x) => !x.isError), "three lines normalised");
      check(r[3].isError && /schema/.test(r[3].json.error) && /limit: expected integer/.test(r[3].json.error), `an input that breaks its schema is refused (got ${r[3].raw.slice(0, 200)})`);
    } },
    { usage: usage(), stop: "tool_use", blocks: [tool("t11", "pv_normalise", { line_id: high })], expect: (req, { check }) => {
      const r = lastResults(req)[0];
      check(r.isError && /highest-priced pair/.test(r.json.error) && /contract/.test(r.json.error), `an alert without a line of the highest pair and without the contract is refused (got ${r.raw.slice(0, 220)})`);
    } },
    { usage: usage(), stop: "tool_use", blocks: [tool("t12", "ui_report_alert", { compare_id: "CMP-1", title: "Lyon pays more", summary: "Lyon pays above the benchmark." })] },
    { usage: usage(), stop: "tool_use", blocks: [tool("t13", "erp_query", { product: "contract", filters: [{ field: "supplier", op: "eq", value: a.benchmark.supplier }] })], expect: (req, { check }) => {
      const r = lastResults(req)[0];
      check(r.isError && /contract/.test(r.json.error) && !/highest-priced/.test(r.json.error), `an alert without the contract lookup is refused (got ${r.raw.slice(0, 200)})`);
    } },
    { usage: usage(), stop: "tool_use", blocks: [tool("t14", "pv_match", { material_group: "SRV-CON" }), tool("t15", "pv_compare", { group_id: "CAND-1" }), tool("t16", "ui_report_alert", { compare_id: "CMP-1", title: "Lyon pays more", summary: "Lyon pays above the benchmark.", line_ids: [high, foreign] })], expect: (req, { check }) => {
      check(!lastResults(req)[0].isError, "the contract lookup answered");
    } },
    { usage: usage(), stop: "tool_use", blocks: [tool("t17", "ui_report_alert", { compare_id: "CMP-1", title: "Lyon pays €9.80 per 100 EA for gloves Frankfurt buys at €6.90 per 100 EA", summary: `Unexplained: €${Math.round(a.opportunity).toLocaleString("en-GB")} a year, spread 42.0%.` })], expect: (req, { check }) => {
      const r = lastResults(req);
      check(!r[0].isError && r[0].json.candidates.length === 1, "pv_match proposes one candidate");
      check(r[1].isError && /candidate/.test(r[1].json.error), `an unconfirmed cluster is refused (got ${r[1].raw.slice(0, 160)})`);
      check(r[2].isError && /not lines of group/.test(r[2].json.error), `an alert naming a line of another group is refused (got ${r[2].raw.slice(0, 160)})`);
    } },
    { usage: usage(), stop: "tool_use", blocks: [tool("t18", "pv_compare", { group_id: "20001001" }), tool("t19", "ui_propose_options", { compare_id: "CMP-1", options: H, recommended: "H", reason: "Highest savings less one-off cost." })], expect: (req, { check }) => {
      const r = lastResults(req)[0];
      check(!r.isError && r.json.shown === true && r.json.checked.length === 3, `the verified alert passes (got ${r.raw.slice(0, 200)})`);
    } },
    { usage: usage(), stop: "tool_use", blocks: [tool("t20", "ui_propose_options", { compare_id: "CMP-2", options: H, recommended: "H", reason: "Highest savings less one-off cost." })], expect: (req, { check }) => {
      const r = lastResults(req);
      check(r[1].isError && /not the latest pv_compare/.test(r[1].json.error), `options outside the latest pv_compare are refused (got ${r[1].raw.slice(0, 160)})`);
    } },
    { usage: usage(), stop: "tool_use", blocks: [tool("t21", "ui_draft_action", { type: "tender_memo", recipient: "Category manager", subject: "Tender", body: "One tender for the gloves." }), tool("t22", "ui_draft_action", { type: "change_request", recipient: "Procurement master data", subject: "Change request: gloves to supplier 30024", body: "Move plant 3010's gloves to supplier 30024 at €6.90 per 100 EA." }), tool("t23", "ui_final_report", { outcome: "option_approved", markdown: "## Gloves\n\nOption H was approved; the change request waits in the Outbox." })], expect: (req, { check }) => {
      const r = lastResults(req)[0];
      check(!r.isError && r.json.decision === "approved" && r.json.option_id === "H", `the decision counts once, for the options on screen (got ${r.raw.slice(0, 160)})`);
    } },
    { usage: usage(), stop: "tool_use", blocks: [tool("t24", "ui_await_approvals", {})], expect: (req, { check }) => {
      const r = lastResults(req);
      check(r[0].isError && /allows only change_request/.test(r[0].json.error), `a draft the option does not allow is refused (got ${r[0].raw.slice(0, 160)})`);
      check(!r[1].isError, "the change request is drafted");
      check(r[2].isError && /waiting for approval/.test(r[2].json.error), `a report before the Outbox is decided is refused (got ${r[2].raw.slice(0, 160)})`);
    } },
    { usage: usage(), stop: "tool_use", blocks: [tool("t25", "ui_final_report", { outcome: "option_approved", markdown: "## Gloves\n\nOption H was approved: harmonise to the contract supplier. The change request was decided in the Outbox; nothing was sent." })] },
    { usage: usage(), stop: "end_turn", blocks: [text("The report is published.")] }
  ];
  const fake = createFakeClaude(script);
  const t = await newPage(fake);
  await startLive(t.page);
  // The person: a stale decision first (an earlier set), then Approve on option H.
  await t.page.waitForSelector('.option-card[data-option="H"] [data-action="approve"]', { timeout: 30000 });
  await t.page.evaluate(async () => { const { bus } = await import("./js/events.js"); bus.emit("option_decision", { option_id: "H", options_seq: 0, decision: "approved", by: "user" }); });
  await t.page.waitForTimeout(150);
  await t.page.click('.option-card[data-option="H"] [data-action="approve"]');
  await t.page.waitForSelector('.action-card[data-status="pending"]', { timeout: 20000 });
  await t.page.waitForTimeout(600);
  await approveAllDrafts(t.page);
  const end = await waitEnd(t.page);
  const lines = await guardLines(t.page);
  const has = (re) => lines.some((l) => re.test(l));
  expect("guard", "the run completes", /Done/.test(end), end);
  expect("guard", "every request was used", fake.remaining() === 0, fake.remaining());
  expect("guard", "Guardrail line: a comparison across groups (a material group)", has(/comparison was refused.*material group/));
  expect("guard", "Guardrail line: an unconfirmed cluster", has(/comparison was refused.*candidate/));
  expect("guard", "Guardrail line: an input that breaks its schema", has(/query was refused.*schema/));
  expect("guard", "Guardrail line: an alert without three normalised lines", has(/alert was refused.*at least three/));
  expect("guard", "Guardrail line: an alert without the contract lookup", has(/alert was refused.*contract/));
  expect("guard", "Guardrail line: an alert naming lines of another group", has(/alert was refused.*not lines of group/));
  expect("guard", "Guardrail line: options outside the latest pv_compare", has(/options were refused.*not the latest/));
  expect("guard", "Guardrail line: a stale decision", has(/decision ignored.*earlier set/));
  expect("guard", "Guardrail line: a draft the option does not allow", has(/draft was refused.*allows only/));
  expect("guard", "Guardrail line: a report before the Outbox is decided", has(/report was refused.*waiting for approval/));
  expect("guard", "the verified alert card says what was checked in this run", await t.page.$eval("#console .alert-card", (e) => /Checked in this run:.*contract of supplier 30024/.test(e.textContent)).catch(() => false));
  await finish("guard", t, fake);
}

// ---- rates: AC-10 -------------------------------------------------------------------------------
if (wanted("rates")) {
  const a = A["20001006"];
  const conv = (mode) => [
    { usage: usage(), stop: "tool_use", blocks: [text("Check: the pounds decide it, so I fetch today's ECB rate."), tool("r1", "pv_compare", { group_id: "20001006" }), tool("r2", "open_ecb_rate", { currency: "GBP" })] },
    { usage: usage(), stop: "tool_use", blocks: mode === "ok" ? [tool("r3", "pv_compare", { group_id: "20001006", at_rate_of: "latest" })] : [tool("r3", "open_ecb_rate", { currency: "GBP" })], expect: (req, { check }) => {
      const r = lastResults(req);
      if (mode === "ok") check(!r[1].isError && Math.abs(r[1].json.per_eur - 0.83581) < 1e-12 && r[1].json.date === "2026-11-19", `the rate is fetched (got ${r[1].raw})`);
      else check(r[1].isError && r[1].json.bundled_rate_stays === true, `a ${mode} rate request keeps the bundled rates (got ${r[1].raw})`);
    } },
    { usage: usage(), stop: "tool_use", blocks: [tool("r4", "ui_final_report", { outcome: "nothing_found", markdown: "## Pallets\n\nThe rate check is done; this test run stops here without options." })], expect: (req, { check }) => {
      const r = lastResults(req)[0];
      if (mode === "ok") check(!r.isError && r.json.sensitivity?.label?.startsWith("at the ECB rate of") && Math.abs(r.json.opportunity - a.opportunity) < 1e-9, `the sensitivity is labelled and the window's figures stay (got ${r.raw.slice(0, 200)})`);
      else check(r.isError && /skipped|failed earlier/.test(r.json.error), `a remembered failure skips the host (got ${r.raw.slice(0, 160)})`);
    } },
    { usage: usage(), stop: "end_turn", blocks: [text("Done.")] }
  ];
  for (const mode of ["fail", "blocked", "ok"]) {
    const fake = createFakeClaude(conv(mode));
    const t = await newPage(fake, { rates: { mode } });
    await startLive(t.page, { scenario: "SC-PALLETS" });
    const end = await waitEnd(t.page);
    const name = `rates (${mode})`;
    expect(name, "the run completes", /Done/.test(end), end);
    const consoleText = await t.page.$eval("#console", (e) => e.textContent);
    const tile = await t.page.$eval("#kpi-identified-value", (e) => e.textContent);
    expect(name, "the tiles keep the window's rate", tile.startsWith(`€${Math.round(a.opportunity).toLocaleString("en-GB")}`), tile);
    if (mode === "ok") {
      expect(name, "the refreshed rate shows as a labelled sensitivity", /Sensitivity at the ECB rate of .*1 EUR = 0\.83581 GBP/.test(consoleText) && /keep the window's mean rate/.test(consoleText));
      expect(name, "the board labels the sensitivity beside the window's figures", await t.page.$eval(".board-note", (e) => /Sensitivity at the ECB rate of/.test(e.textContent)));
      expect(name, "one request to the rate host", t.log.rates.length === 1 && /\/v1\/latest\?base=EUR&symbols=GBP/.test(t.log.rates[0]), t.log.rates.join(" | "));
    } else {
      expect(name, "the console says the bundled rates stay", /could not be fetched.*keeps the bundled rates/.test(consoleText));
      expect(name, "the failure is remembered: one request only", t.log.rates.length === (mode === "blocked" ? 1 : 1), t.log.rates.join(" | "));
    }
    await finish(name, t, fake);
  }
}

// ---- caps: AC-11 ---------------------------------------------------------------------------------
if (wanted("caps")) {
  // 40 model calls at most: the fake would answer a 41st.
  {
    const script = Array.from({ length: 45 }, (_, k) => ({ usage: usage({ input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0 }), stop: "tool_use", blocks: [tool(`c${k}`, "erp_get_overview", {})] }));
    const fake = createFakeClaude(script);
    const t = await newPage(fake);
    await startLive(t.page);
    const end = await waitEnd(t.page, 120000);
    expect("caps", "the run stops at the cap", /Error/.test(end) && await t.page.$eval("#console", (e) => /Step limit reached \(40 model calls\)/.test(e.textContent)), end);
    expect("caps", "never a 41st model call", fake.requests.length === 40, fake.requests.length);
    await finish("caps (40 calls)", t, fake);
  }
  // No call once €3 is spent: the first call costs just under €3, the second crosses it, no third.
  {
    const sonnet = MODELS.find((m) => m.id === "claude-sonnet-5-5");
    const under = { input_tokens: 1000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 334000 };
    const over = { input_tokens: 1000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 2000 };
    const script = [
      { usage: under, stop: "tool_use", blocks: [tool("b1", "erp_get_overview", {})] },
      { usage: over, stop: "tool_use", blocks: [tool("b2", "erp_get_overview", {})] },
      { usage: usage(), stop: "end_turn", blocks: [text("Never reached.")] }
    ];
    const fake = createFakeClaude(script);
    const t = await newPage(fake);
    await startLive(t.page);
    const end = await waitEnd(t.page);
    const first = usageCostUsd(sonnet.id, under) * FX_USD_EUR;
    const total = first + usageCostUsd(sonnet.id, over) * FX_USD_EUR;
    expect("caps", "the test's first call stays under €3 and the second crosses it", first < 3 && total >= 3, `${first} ${total}`);
    expect("caps", "no call starts once €3 is spent", fake.requests.length === 2, fake.requests.length);
    expect("caps", "the run says the cost cap stopped it", /Aborted/.test(end) && await t.page.$eval("#console", (e) => /Cost cap reached/.test(e.textContent)), end);
    // The cost meter equals usage × price within 1e-9 (the audit export carries the raw value).
    const exported = await t.page.evaluate(async () => { const m = await import("./js/audit.js"); return m.buildAuditExport(); });
    const doc = JSON.parse(exported);
    expect("caps", "the cost meter equals usage × price within 1e-9", Math.abs(doc.cost.eur - total) <= 1e-9, `${doc.cost.eur} vs ${total}`);
    expect("caps", "the audit export shows model, usage, rates and cost", doc.model?.id === sonnet.id && doc.usage?.output_tokens === under.output_tokens + over.output_tokens && doc.rates?.basis?.version === D.FX.version && typeof doc.cost?.eur === "number");
    await finish("caps (€3)", t, fake);
  }
  // A 400 that names strict drops it once (logged), and the run goes on.
  {
    const script = [
      { error: { status: 400, type: "invalid_request_error", message: "tools.0.strict: Schema is too complex for compilation" } },
      { usage: usage(), stop: "tool_use", blocks: [tool("s1", "pv_scan", {})], expect: (req, { check }) => check(req.tools.every((t) => !("strict" in t)), "strict dropped after the 400") },
      { usage: usage(), stop: "tool_use", blocks: [tool("s2", "ui_final_report", { outcome: "nothing_found", markdown: "## Sweep\n\nThis test run stops after the scan, without options." })] },
      { usage: usage(), stop: "end_turn", blocks: [text("Done.")] }
    ];
    const fake = createFakeClaude(script);
    const t = await newPage(fake);
    await startLive(t.page, { entry: "sweep" });
    const end = await waitEnd(t.page);
    expect("caps", "a 400 naming strict drops it once and the run completes", /Done/.test(end) && await t.page.$eval("#console", (e) => /refused the strict tool schemas/.test(e.textContent)), end);
    await finish("caps (strict)", t, fake);
  }
}

// ---- record: Save run as simulation ---------------------------------------------------------------
if (wanted("record")) {
  const a = A["MPN:Brekholt:BH-7730-S3"];
  const script = [
    { usage: usage(), stop: "tool_use", blocks: [text("Hypothesis: the two numbers are one shoe."), tool("m1", "erp_get_record", { product: "material", id: "20001002" }), tool("m2", "pv_compare", { group_id: a.id })] },
    { usage: usage(), stop: "tool_use", blocks: [text("Revised: the second number has a French text."), tool("m3", "pv_normalise", { line_id: pairLine(a, a.benchmark.pair) }), tool("m4", "pv_normalise", { line_id: pairLine(a, a.highest.pair) }), tool("m5", "pv_normalise", { line_id: pairLine(a, "1020 / 30135") }), tool("m6", "erp_query", { product: "contract", filters: [{ field: "supplier", op: "eq", value: a.benchmark.supplier }] })] },
    { usage: usage(), stop: "tool_use", blocks: [tool("m7", "ui_report_alert", { compare_id: "CMP-1", title: "Lyon pays €78.00 per EA for the shoe Frankfurt buys at €61.50 per EA", summary: "Same manufacturer and part number on two material numbers." })] },
    { usage: usage(), stop: "tool_use", blocks: [tool("m8", "ui_propose_options", { compare_id: "CMP-1", options: [{ id: "H", title: "Order Lyon's shoes under the contract", description: "Move Lyon to the contract supplier.", residual_risk: "Sizes and lead times." }, { id: "R", title: "Renegotiate Lyon's price", description: "Ask Lyon's supplier to match.", residual_risk: "It may refuse." }], recommended: "H", reason: "Highest savings less one-off cost." })] },
    { usage: usage(), stop: "tool_use", blocks: [tool("m9", "ui_draft_action", { type: "buyer_notice", recipient: "Buyer, MRO, Lyon", subject: "Safety shoes: order under the contract", body: "Order the safety shoe from supplier 30135 at €61.50 per EA." })] },
    { usage: usage(), stop: "tool_use", blocks: [tool("m10", "ui_await_approvals", {})] },
    { usage: usage(), stop: "tool_use", blocks: [tool("m11", "ui_final_report", { outcome: "option_approved", markdown: "## Safety shoes\n\nOption H was approved. The buyer notice was decided in the Outbox; nothing was sent." })] },
    { usage: usage(), stop: "end_turn", blocks: [text("Done.")] }
  ];
  const fake = createFakeClaude(script);
  const t = await newPage(fake);
  await startLive(t.page, { scenario: "SC-SHOES" });
  await t.page.waitForSelector('.option-card[data-option="H"] [data-action="approve"]', { timeout: 30000 });
  await t.page.click('.option-card[data-option="H"] [data-action="approve"]');
  await t.page.waitForSelector('.action-card[data-status="pending"]', { timeout: 20000 });
  await approveAllDrafts(t.page);
  const end = await waitEnd(t.page);
  expect("record", "the live run completes", /Done/.test(end), end);
  const [download] = await Promise.all([t.page.waitForEvent("download", { timeout: 15000 }), t.page.click('button:has-text("Save run as simulation")')]);
  const file = path.join(OUT, download.suggestedFilename());
  await download.saveAs(file);
  const textOut = await readFile(file, "utf8");
  expect("record", "the file is named price-variance-sim-run-…-recorded-….js", /^price-variance-sim-run-SC-SHOES-recorded-\d{8}\.js$/.test(download.suggestedFilename()), download.suggestedFilename());
  expect("record", "the recording is marked recorded and carries no key", /"source": "recorded"/.test(textOut) && !textOut.includes(MOCK_KEY) && !/sk-ant-(?!\[REDACTED\])[A-Za-z0-9_-]{8,}/.test(textOut));
  const box = { window: {} };
  vm.createContext(box);
  vm.runInContext(textOut, box);
  const def = box.window.SIM_RUNS["SC-SHOES"];
  const { checkSimRun } = await import("../js/sim_check.js");
  const chk = await checkSimRun(W, D.FX, DEFAULTS, def);
  expect("record", "the checker accepts the recording on every path", chk.errors.length === 0, chk.errors.slice(0, 2).join(" | "));
  await finish("record (live)", t, fake);
  // Replay the recording in Simulation: the page loads the authored scripts plus the recording.
  const original = await readFile(path.join(APP_ROOT, "data", "sim_runs.js"), "utf8");
  const r = await newPage(null, { routeData: `${original}\n${textOut}` });
  await r.page.goto(BASE);
  await r.page.waitForSelector('html[data-boot="ready"]');
  await r.page.click('.scenario-pick__item[data-id="SC-SHOES"]');
  await r.page.click("button[aria-label='Replay speed ×4']");
  await r.page.click("#btn-start");
  await r.page.click('.mode-card[data-mode="simulation"] .mode-cta button');
  await r.page.waitForSelector('.option-card[data-option="H"] [data-action="approve"]', { timeout: 30000 });
  expect("record", "the replay says it is a recorded live run", await r.page.$eval(".sim-watermark", (e) => /Replay of a live run recorded/.test(e.textContent)));
  await r.page.click('.option-card[data-option="H"] [data-action="approve"]');
  await r.page.waitForSelector('.action-card[data-status="pending"]', { timeout: 20000 });
  await approveAllDrafts(r.page);
  const rend = await waitEnd(r.page);
  expect("record", "the recording replays to the end", /Done/.test(rend), rend);
  expect("record", "the replay's report carries the recorded footer", await r.page.$eval("#console .report-card", (e) => /Recorded live run, replayed/.test(e.textContent)).catch(() => false));
  await finish("record (replay)", r, null);
}

// ---- entries: Live sweep and Custom what-if ------------------------------------------------------------
if (wanted("entries")) {
  const flagged = scan(analyses).filter((x) => x.flagged);
  {
    const script = [
      { usage: usage(), stop: "tool_use", blocks: [text("Check: I rank every comparable group first."), tool("w1", "pv_scan", {})], expect: (req, { check }) => {
        check(/^Live sweep:/.test(req.messages[0].content) && !D.SCENARIOS.some((s) => req.messages[0].content.includes(s.seed)), "the sweep's opening message carries no tip");
      } },
      { usage: usage(), stop: "tool_use", blocks: [tool("w2", "ui_final_report", { outcome: "nothing_found", markdown: "## Sweep\n\nThis test run stops after the scan, without options." })], expect: (req, { check }) => {
        const r = lastResults(req)[0];
        check(!r.isError && r.json.flagged === flagged.length && r.json.rows[0].id === flagged.sort((x, y) => y.opportunity - x.opportunity)[0].id, `pv_scan ranks the flagged groups (got ${r.raw.slice(0, 160)})`);
      } },
      { usage: usage(), stop: "end_turn", blocks: [text("Done.")] }
    ];
    const fake = createFakeClaude(script);
    const t = await newPage(fake);
    await t.page.goto(BASE);
    await t.page.waitForSelector('html[data-boot="ready"]');
    await t.page.click("#btn-scan");
    expect("entries", "Live sweep asks for the key, never for a mode (Live only)", !!(await t.page.waitForSelector("#api-key-input", { timeout: 5000 }).catch(() => null)) && !(await t.page.$(".mode-card")));
    await t.page.fill("#api-key-input", MOCK_KEY);
    await t.page.click('button:has-text("Check key and continue")');
    const end = await waitEnd(t.page);
    expect("entries", "the sweep completes", /Done/.test(end), end);
    const bars = await t.page.$$eval('#board .bars:not(.pipeline) .bar-row', (els) => els.map((e) => ({ id: e.dataset.group, value: Number(e.dataset.value) })));
    const want = flagged.slice().sort((x, y) => y.opportunity - x.opportunity);
    expect("entries", "the portfolio chart equals the engine's scan (flagged groups, sorted, opportunity)", bars.length === want.length && bars.every((b, k) => b.id === want[k].id && Math.abs(b.value - want[k].opportunity) <= 1e-9), JSON.stringify(bars).slice(0, 200));
    await finish("entries (sweep)", t, fake);
  }
  {
    const words = "Duisburg seems to pay more for cable ties than the other plants. Is that the same item?";
    const script = [
      { usage: usage(), stop: "tool_use", blocks: [tool("u1", "ui_final_report", { outcome: "nothing_found", markdown: "## Cable ties\n\nThis test run stops at once, without options." })], expect: (req, { check }) => {
        check(req.messages[0].content.includes(words) && /person's own words/.test(req.messages[0].content), "the custom tip is the person's words");
      } },
      { usage: usage(), stop: "end_turn", blocks: [text("Done.")] }
    ];
    const fake = createFakeClaude(script);
    const t = await newPage(fake);
    await startLive(t.page, { entry: "custom", custom: words });
    const end = await waitEnd(t.page);
    expect("entries", "the custom what-if completes", /Done/.test(end), end);
    await finish("entries (custom)", t, fake);
  }
}

// ---- marks: only a person's decision marks the board approved or accepted (review R1) ---------------
if (wanted("marks")) {
  const a = A["20001001"];
  const script = [
    { usage: usage(), stop: "tool_use", blocks: [text("Check: I compare the gloves."), tool("k1", "pv_compare", { group_id: a.id })] },
    { usage: usage(), stop: "tool_use", blocks: [
      tool("k2", "ui_mark_board", { state: "approved", group_id: a.id, pair_ids: ["3010 / 80002", "2010 / 80001"] }),
      tool("k3", "ui_mark_board", { state: "justified", group_id: a.id, pair_ids: ["1020 / 30024"] }),
      tool("k4", "ui_mark_board", { state: "above", group_id: a.id, pair_ids: [a.benchmark.pair] }),
      tool("k5", "ui_mark_board", { state: "above", group_id: a.id, pair_ids: ["3010 / 80002"] })
    ] },
    { usage: usage(), stop: "tool_use", blocks: [tool("k6", "ui_final_report", { outcome: "nothing_found", markdown: "## Gloves\n\nThis test run stops after the board marks." })], expect: (req, { check }) => {
      const r = lastResults(req);
      check(r.length === 4 && r[0].isError && /schema/.test(r[0].json.error) && r[1].isError && /schema/.test(r[1].json.error), `approved and justified are refused by the schema (got ${r.map((x) => x.raw.slice(0, 80)).join(" | ")})`);
      check(r[2]?.isError && /not above the benchmark/.test(r[2].json.error), `above on the benchmark pair is refused (got ${r[2]?.raw.slice(0, 160)})`);
      check(r[3] && !r[3].isError, `above on Lyon's pair passes (got ${r[3]?.raw.slice(0, 160)})`);
    } },
    { usage: usage(), stop: "end_turn", blocks: [text("Done.")] }
  ];
  const fake = createFakeClaude(script);
  const t = await newPage(fake);
  await startLive(t.page, { scenario: "SC-GLOVES" });
  const end = await waitEnd(t.page);
  expect("marks", "the run completes", /Done/.test(end), end);
  const lines = await guardLines(t.page);
  expect("marks", "Guardrail lines: the board marks were refused, three times", lines.filter((l) => /board mark was refused/.test(l)).length === 3, lines.join(" | "));
  const rows = await t.page.$$eval(".ladder .ladder-row", (els) => els.map((e) => ({ pair: e.dataset.pair, state: e.dataset.state, text: e.textContent })));
  expect("marks", "no row reads approved or accepted, since nobody decided", rows.length > 0 && rows.every((r) => !["approved", "justified"].includes(r.state) && !/approved|accepted/.test(r.text)), JSON.stringify(rows.map((r) => [r.pair, r.state])));
  await finish("marks", t, fake);
}

// ---- params: the Method dialog's parameters in a live run (M3-2) -------------------------------------
if (wanted("params")) {
  // The person sets the urgent allowance to 0 % before a live run: the engine's comparison in that run
  // justifies nothing, so the unexplained part equals the whole gap; the audit export records the value in
  // effect and the change; the run cannot become a simulation, whose scripts play at the defaults.
  const a = A["20001001"];
  const script = [
    { usage: usage(), stop: "tool_use", blocks: [text("Check: I compare the gloves."), tool("p1", "pv_compare", { group_id: a.id })] },
    { usage: usage(), stop: "tool_use", blocks: [tool("p2", "ui_final_report", { outcome: "nothing_found", markdown: "## Gloves\n\nThis test run stops after the comparison." })], expect: (req, { check }) => {
      const r = lastResults(req)[0];
      check(!!r && !r.isError && a.justified > 0 && Math.abs(r.json.justified) < 1e-9 && Math.abs(r.json.unexplained - a.gap) < 1e-6, `pv_compare used the person's urgent allowance of 0 % (justified ${r?.json?.justified}, unexplained ${r?.json?.unexplained}, gap ${a.gap}; ${a.justified} justified at the defaults)`);
    } },
    { usage: usage(), stop: "end_turn", blocks: [text("Done.")] }
  ];
  const fake = createFakeClaude(script);
  const t = await newPage(fake);
  await t.page.goto(BASE);
  await t.page.waitForSelector('html[data-boot="ready"]');
  await t.page.click("#btn-method");
  await t.page.fill('.method-input[data-param="urgent_allowance"]', "0");
  await t.page.press('.method-input[data-param="urgent_allowance"]', "Enter");
  await t.page.keyboard.press("Escape");
  // The parameters live in the page until it is reloaded, so the run starts on this page.
  await startLive(t.page, { scenario: "SC-GLOVES", reload: false });
  const end = await waitEnd(t.page);
  expect("params", "the live run with a changed parameter completes", /Done/.test(end), end);
  expect("params", "the model's comparison used the person's parameter", fake.violations.length === 0, fake.violations.join(" | "));
  await t.page.click('#drawer [role="tab"]:has-text("Audit")').catch(() => {});
  await t.page.waitForTimeout(300);
  const [download] = await Promise.all([t.page.waitForEvent("download"), t.page.click('#panel-audit button:has-text("Export JSON")')]);
  const doc = JSON.parse(await readFile(await download.path(), "utf8"));
  const changed = doc.parameters?.changed_from_defaults || [];
  expect("params", "the audit export records the value in effect and the change from the default",
    doc.parameters?.in_effect?.urgent_allowance === 0 && changed.length === 1 && changed[0].name === "urgent_allowance" && changed[0].value === 0 && changed[0].default === DEFAULTS.urgent_allowance
      && (doc.parameters?.changes || []).some((c) => c.name === "urgent_allowance" && c.to === 0), JSON.stringify({ changed, changes: doc.parameters?.changes }).slice(0, 600));
  const save = await t.page.$eval('#panel-audit button:has-text("Save run as simulation")', (b) => ({ disabled: b.disabled || b.getAttribute("aria-disabled") === "true", why: b.getAttribute("title") || b.closest("[title]")?.getAttribute("title") || "" }));
  expect("params", "a run with changed parameters cannot be saved as a simulation", save.disabled && /changed parameters/.test(save.why), JSON.stringify(save));
  await finish("params", t, fake);
}

await browser.close();
await close();
const failed = results.filter((r) => r.failure);
for (const f of failed) console.log(`FAIL  ${f.name}: ${f.failure}`);
const label = ONLY.length ? ONLY.join(" ") : "guard rates caps record entries marks params";
if (failed.length) { console.log(`LIVE FAILED: ${failed.length} of ${checks} checks`); process.exit(1); }
console.log(`LIVE OK: ${label} (${checks} checks)`);
