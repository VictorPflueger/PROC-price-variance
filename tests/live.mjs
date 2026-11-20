// A live run on the presenter, against a scripted stand-in for the Anthropic Messages API
// (lib/fake-claude.mjs, which streams real SSE and checks every request against the protocol: headers,
// the sixteen strict tools, assistant turns echoed unchanged, every tool_use answered). The tools run for
// real in the browser. The agent, its guardrails and its caps are 1.0.0's files (tests/fingerprint.mjs);
// tests/engine.mjs checks the guardrails in Node. This suite checks what the presenter makes of a run:
//   happy   Start agent asks simulation or live, with the AI notice; the key is checked once; LIVE in the
//           header, the notice beside Start agent while it runs, the agent's words marked live; the steps
//           unlock as the agent reaches them and the page follows it; the engine's figures on the tiles;
//           the person approves the option and both drafts; the outcome, the decision log, the measured
//           session cost (usage × price, in euros); the key never in localStorage, the field emptied
//   key     a malformed key is refused before any request; a key Anthropic rejects (401) says so and starts
//           nothing; Run the simulation goes back to SIMULATION
//   stop    Stop the live run ends it and says so; another case opens in the simulation
//   caps    never a 41st model call, and the page says the step limit stopped the run; no call once €3 is
//           spent, and the page says the cost cap stopped it
//   offline api.anthropic.com unreachable mid-run: the page says so in its own words (no Diagnostics)
// Usage: node tests/live.mjs [case…]
import path from "node:path";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { createFakeClaude } from "./lib/fake-claude.mjs";
import { frankfurterRoute } from "./lib/fake-rates.mjs";
import { APP_ROOT, outDir, wanted, launchBrowser, serveStatic, CORS, MOCK_KEY, NETWORK_NOISE } from "./lib/harness.mjs";
import { analyseWorld, ratesOf } from "../js/world.js";
import { MODELS, FX_USD_EUR, DEFAULT_MODEL } from "../js/config.js";
import { usageCostUsd } from "../js/cost.js";
import { money } from "../js/plain.js";

const OUT = await outDir("live");
const { base: BASE, close } = await serveStatic(APP_ROOT, 8771 + Math.floor(Math.random() * 100));
const browser = await launchBrowser();
const D = await loadData(["fx.js", "world.js", "scenarios.js"]);
const { analyses } = analyseWorld(D.WORLD, ratesOf(D.FX));
const A = Object.fromEntries(analyses.map((a) => [a.id, a]));
const SONNET = MODELS.find((m) => m.id === DEFAULT_MODEL);
const eur0 = (x) => `€${Math.round(x).toLocaleString("en-GB")}`;
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
const pairLine = (a, pair, k = 0) => a.pairs.find((p) => p.id === pair).lines[k];
function expect(name, what, ok, detail = "") {
  checks += 1;
  if (!ok) results.push(`${name}: ${what}${detail !== "" ? ` (${String(detail).slice(0, 300)})` : ""}`);
}

async function newPage(fake, { models = 200, offline = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  await context.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  const log = { pageErrors: [], consoleErrors: [], external: [], models: 0, messages: 0 };
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (u.host === "api.anthropic.com") {
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { ...CORS, "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST" } });
      if (u.pathname === "/v1/models") {
        log.models += 1;
        if (models !== 200) return route.fulfill({ status: models, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }) });
        return route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify({ data: MODELS.map((m) => ({ id: m.id })) }) });
      }
      if (u.pathname === "/v1/messages") {
        log.messages += 1;
        if (offline && log.messages > 1) return route.abort("internetdisconnected");
        const out = fake.handle(req.postData() || "{}", req.headers());
        if (out.delayMs) await new Promise((r) => setTimeout(r, out.delayMs));
        return route.fulfill({ status: out.status, headers: { ...CORS, ...out.headers }, body: out.body }).catch(() => {});
      }
    }
    if (u.host === "api.frankfurter.dev") return frankfurterRoute({ mode: "ok", log: [] })(route);
    log.external.push(`${req.method()} ${u.host}${u.pathname}`);
    return route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => log.pageErrors.push(String(e.message || e)));
  page.on("console", (m) => { if (m.type() === "error" && !NETWORK_NOISE.test(m.text()) && !/live run failed/.test(m.text())) log.consoleErrors.push(m.text()); });
  await page.goto(`${BASE}?case=gloves&guide=0`);
  await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
  return { context, page, log };
}

/** Start agent → Live run: the key, then Check key and start. */
async function startLive(page, key = MOCK_KEY) {
  await page.click("#start");
  await page.waitForSelector("#start-dialog[open]");
  await page.fill("#live-key", key);
  await page.click("#live-start");
}
const mode = (page) => page.$eval("#mode-text", (e) => e.textContent);
const steps = (page) => page.$$eval("#steps .vc-step__button", (bs) => bs.map((b) => (b.disabled ? "-" : "+")).join(""));
/** The story's alert once the page shows it (the render after the run's end), or "" if it never does. */
const alertText = (page) => page.waitForFunction(() => { const a = document.getElementById("story-alert"); return !a.hidden && a.textContent.trim() && a.getBoundingClientRect().height > 0 ? a.textContent : null; }, null, { timeout: 5000 }).then((h) => h.jsonValue()).catch(() => "");
const waitEnded = (page, ms = 60000) => page.waitForFunction(() => document.getElementById("stop").hidden && document.getElementById("mode-text").textContent === "LIVE", null, { timeout: ms });

async function finish(name, t, fake) {
  const csp = await t.page.evaluate(() => window.__csp || []).catch(() => []);
  expect(name, "no protocol violation", !fake || fake.violations.length === 0, fake?.violations.join(" | "));
  expect(name, "no page error", t.log.pageErrors.length === 0, t.log.pageErrors.join(" | "));
  expect(name, "no console error", t.log.consoleErrors.length === 0, t.log.consoleErrors.join(" | "));
  expect(name, "no policy violation", csp.length === 0, csp.join(" | "));
  expect(name, "no request to another host", t.log.external.length === 0, t.log.external.join(" | "));
  await t.page.screenshot({ path: path.join(OUT, `${name}.png`) }).catch(() => {});
  await t.context.close();
}

// ---- happy: the gloves case, live ------------------------------------------------------------------
if (wanted("happy")) {
  const a = A["20001001"];
  const bench = pairLine(a, a.benchmark.pair);
  const high = pairLine(a, a.highest.pair);
  const options = [
    { id: "H", title: "Move Lyon and Duisburg to the contract supplier", description: "Order at the benchmark under Frankfurt's contract.", residual_risk: "Birmingham stays as it is." },
    { id: "R", title: "Renegotiate above the benchmark", description: "Ask the suppliers to match the benchmark.", residual_risk: "They may not agree." }
  ];
  const script = [
    { usage: usage(), stop: "tool_use", delayMs: 1500, blocks: [
      { type: "thinking", thinking: "The tip is a lead. First the overview and the material.", signature: "SIG-1==" },
      text("Hypothesis: Lyon buys the same gloves off contract at a higher price."),
      tool("t01", "erp_get_overview", {}),
      tool("t02", "erp_query", { product: "material", filters: [{ field: "description", op: "contains", value: "nitrile" }] })
    ] },
    { usage: usage(), stop: "tool_use", blocks: [tool("t03", "pv_compare", { group_id: "20001001" })] },
    { usage: usage(), stop: "tool_use", delayMs: 600, blocks: [
      text("Revised: the prices are booked in different units and currencies, so I normalise them first."),
      tool("t04", "pv_normalise", { line_id: bench }), tool("t05", "pv_normalise", { line_id: pairLine(a, "2010 / 80001") }),
      tool("t06", "pv_normalise", { line_id: pairLine(a, a.benchmark.pair, 1) }), tool("t07", "pv_normalise", { line_id: high })
    ] },
    { usage: usage(), stop: "tool_use", blocks: [tool("t08", "erp_query", { product: "contract", filters: [{ field: "supplier", op: "eq", value: a.benchmark.supplier }] })] },
    { usage: usage(), stop: "tool_use", blocks: [tool("t09", "ui_report_alert", { compare_id: "CMP-1", title: "Lyon pays €9.80 per 100 EA for gloves Frankfurt buys at €6.90 per 100 EA", summary: `Unexplained: ${eur0(a.opportunity)} a year, spread 42.0%.` })] },
    { usage: usage(), stop: "tool_use", blocks: [tool("t10", "ui_propose_options", { compare_id: "CMP-1", options, recommended: "H", reason: "Highest savings less one-off cost." })] },
    { usage: usage(), stop: "tool_use", blocks: [
      tool("t11", "ui_draft_action", { type: "change_request", recipient: "Procurement master data", subject: "Change request: gloves to supplier 30024", body: "Move plant 3010's gloves to supplier 30024 at €6.90 per 100 EA." }),
      tool("t12", "ui_draft_action", { type: "buyer_notice", recipient: "Buyers at Lyon and Duisburg", subject: "Gloves: a new source of supply", body: "From next month, order the nitrile gloves under Frankfurt's contract." })
    ], expect: (req, { check }) => {
      const last = req.messages.at(-1);
      const r = JSON.parse(last.content.find((b) => b.type === "tool_result").content);
      check(r.decision === "approved" && r.option_id === "H", `the person's approval reaches the agent (got ${JSON.stringify(r).slice(0, 120)})`);
    } },
    { usage: usage(), stop: "tool_use", blocks: [tool("t13", "ui_await_approvals", {})] },
    { usage: usage(), stop: "tool_use", blocks: [tool("t14", "ui_final_report", { outcome: "option_approved", markdown: "## Gloves\n\nOption H was approved: harmonise to the contract supplier. Both drafts were decided; nothing was sent." })] },
    { usage: usage(), stop: "end_turn", blocks: [text("The report is published.")] }
  ];
  const fake = createFakeClaude(script);
  const t = await newPage(fake);
  const { page } = t;
  await page.click("#start");
  await page.waitForSelector("#start-dialog[open]");
  const dialog = await page.$eval("#start-dialog", (d) => d.innerText.replace(/\s+/g, " "));
  expect("happy", "Start agent asks: the simulation or a live run", /Simulation/.test(dialog) && /Run the simulation/.test(dialog) && /Live run/.test(dialog) && /Check key and start/.test(dialog), dialog.slice(0, 200));
  expect("happy", "the live card says it is an AI", /You are interacting with an AI system/.test(dialog));
  const models = await page.$$eval("#live-model option", (os) => os.map((o) => o.textContent));
  expect("happy", "every model shows what this case would cost", models.length === MODELS.length && models.every((m) => /: about €\d+\.\d\d for this case$/.test(m)), models.join(" | "));
  await page.fill("#live-key", MOCK_KEY);
  await page.click("#live-start");
  await page.waitForFunction(() => document.getElementById("mode-text").textContent === "LIVE", null, { timeout: 15000 });
  expect("happy", "the key is checked once, with Anthropic's free models call", t.log.models === 1, t.log.models);
  expect("happy", "while it runs: LIVE, Stop, the AI notice beside Start agent, the agent's words marked live", (await page.isVisible("#stop")) && (await page.isVisible(".talk .ai-notice")) && (await page.getAttribute("#mode-tag", "data-mode")) === "live" && (await page.textContent("#agent-note")) === `live, Claude ${SONNET.label}`, await page.textContent("#agent-note"));
  expect("happy", "at the start only the tip is open", (await steps(page)) === "+----", await steps(page));
  await page.waitForSelector('.option[data-option="H"] .option-approve', { timeout: 30000 });
  expect("happy", "the page follows the agent to its options", (await page.evaluate(() => document.body.dataset.step)) === "decide");
  expect("happy", "the steps the agent reached are open, the drafts not yet", (await steps(page)) === "++++-", await steps(page));
  expect("happy", "Unexplained a year is the engine's, from the live comparison", (await page.textContent("#kpi-unexplained-value")) === eur0(a.opportunity), await page.textContent("#kpi-unexplained-value"));
  expect("happy", "Highest vs best price is the engine's", (await page.textContent("#kpi-highest-value")).replace(/\s/g, " ") === `+${Math.round(a.spread * 100)} %`);
  expect("happy", "the agent's words are in plain words", !/\b(EA|3010|30024)\b/.test(await page.textContent("#agent-text")), await page.textContent("#agent-text"));
  await page.click('.option[data-option="H"] .option-approve');
  await page.waitForFunction(() => document.querySelectorAll(".draft").length >= 2, null, { timeout: 30000 });
  expect("happy", "the page follows the agent to the drafts", (await page.evaluate(() => document.body.dataset.step)) === "drafts");
  const shown = await page.$eval(".drafts", (e) => e.innerText);
  expect("happy", "the drafts show names, not codes", /Chroma MRO AG/.test(shown) && /Lyon/.test(shown) && !/\b(EA|3010|30024)\b/.test(shown), shown.slice(0, 300));
  for (let k = 0; k < 2; k++) {
    await page.locator(".draft[data-status='pending'] .draft-actions .vc-button:not(.vc-button--ghost)").first().click();
    await page.waitForFunction((n) => document.querySelectorAll(".draft[data-status='pending']").length <= n, 1 - k);
  }
  await waitEnded(page);
  const outcome = await page.textContent(".outcome").catch(() => "");
  expect("happy", "the outcome follows the decision and nothing was sent", /^Report filed: move Lyon and Duisburg to the contract supplier, approved\. Nothing was sent\.$/.test(outcome.trim()), outcome);
  expect("happy", "every scripted request was used", fake.remaining() === 0, fake.remaining());
  const log = await page.$$eval("#log-list li", (els) => els.map((e) => e.textContent.trim()));
  expect("happy", "the decision log has the option and both drafts", log.length === 3 && /You approved “Move Lyon and Duisburg to the contract supplier”$/.test(log[0]) && /You approved the change request$/.test(log[1]) && /You approved the buyer notice$/.test(log[2]), log.join(" | "));
  const cost = fake.requests.reduce((s, _r, i) => s + usageCostUsd(SONNET.id, script[i].usage) * FX_USD_EUR, 0);
  expect("happy", "Session cost is measured: usage × price, in euros", (await page.textContent("#kpi-cost-value")) === money(cost) && (await page.textContent("#kpi-cost-note")) === `measured, ${SONNET.label}`, `${await page.textContent("#kpi-cost-value")} vs ${money(cost)}`);
  expect("happy", "the clock stopped at the decision", (await page.getAttribute("#kpi-clock", "data-tone")) === "done");
  const stored = await page.evaluate(() => ({ local: JSON.stringify(localStorage), field: document.getElementById("live-key").value }));
  expect("happy", "the key is never in localStorage, and the field is emptied", !/sk-ant-/.test(stored.local) && stored.field === "", stored.local.slice(0, 120));
  await finish("happy", t, fake);
}

// ---- key: a malformed key and a rejected key ----------------------------------------------------------
if (wanted("key")) {
  const fake = createFakeClaude([]);
  const t = await newPage(fake, { models: 401 });
  await startLive(t.page, "not-a-key");
  await t.page.waitForFunction(() => document.getElementById("live-msg").textContent.length > 0);
  expect("key", "a malformed key is refused before any request", /starts with sk-ant-/.test(await t.page.textContent("#live-msg")) && t.log.models === 0, await t.page.textContent("#live-msg"));
  await t.page.fill("#live-key", MOCK_KEY);
  await t.page.click("#live-start");
  await t.page.waitForFunction(() => /401/.test(document.getElementById("live-msg").textContent), null, { timeout: 10000 });
  expect("key", "a key Anthropic rejects says so and starts nothing", t.log.models === 1 && t.log.messages === 0 && (await mode(t.page)) === "SIMULATION" && (await t.page.evaluate(() => document.getElementById("start-dialog").open)));
  await t.page.click("#start-sim");
  await t.page.waitForFunction(() => !document.getElementById("start-dialog").open);
  expect("key", "Run the simulation goes back to SIMULATION at the tip", (await mode(t.page)) === "SIMULATION" && (await t.page.evaluate(() => document.body.dataset.step)) === "tip");
  await finish("key", t, null);
}

// ---- stop: the presenter stops a live run ----------------------------------------------------------------
if (wanted("stop")) {
  const script = [
    { usage: usage(), stop: "tool_use", blocks: [tool("s1", "erp_get_overview", {})] },
    { usage: usage(), stop: "tool_use", delayMs: 20000, blocks: [tool("s2", "erp_get_overview", {})] }
  ];
  const fake = createFakeClaude(script);
  const t = await newPage(fake);
  await startLive(t.page);
  await t.page.waitForFunction(() => !document.getElementById("stop").hidden, null, { timeout: 15000 });
  await t.page.waitForTimeout(800);
  await t.page.click("#stop");
  await waitEnded(t.page, 15000);
  const stopped = await alertText(t.page);
  expect("stop", "Stop ends the run and the page says so", /^The live run stopped\. Stopped by you\.$/.test(stopped), stopped);
  await t.page.click("#case-button");
  await t.page.click('#case-menu [data-case="SC-HOSES"]');
  await t.page.waitForFunction(() => document.getElementById("mode-text").textContent === "SIMULATION");
  expect("stop", "another case opens in the simulation, without the alert", (await t.page.isHidden("#story-alert")) && /Express is not a reason/.test(await t.page.textContent("#case-name")));
  await finish("stop", t, fake);
}

// ---- caps: 40 model calls, €3 ------------------------------------------------------------------------------
if (wanted("caps")) {
  {
    const script = Array.from({ length: 45 }, (_, k) => ({ usage: usage({ input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0 }), stop: "tool_use", blocks: [tool(`c${k}`, "erp_get_overview", {})] }));
    const fake = createFakeClaude(script);
    const t = await newPage(fake);
    await startLive(t.page);
    await waitEnded(t.page, 120000);
    expect("caps", "never a 41st model call", fake.requests.length === 40, fake.requests.length);
    const said = await alertText(t.page);
    expect("caps", "the page says the step limit stopped the run", /^The live run stopped\. Step limit reached \(40 model calls\)/.test(said), said);
    await finish("caps-40", t, fake);
  }
  {
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
    await waitEnded(t.page);
    const first = usageCostUsd(SONNET.id, under) * FX_USD_EUR;
    const total = first + usageCostUsd(SONNET.id, over) * FX_USD_EUR;
    expect("caps", "the test's first call stays under €3 and the second crosses it", first < 3 && total >= 3, `${first} ${total}`);
    expect("caps", "no call starts once €3 is spent", fake.requests.length === 2, fake.requests.length);
    const said = await alertText(t.page);
    expect("caps", "the page says the cost cap stopped it, and the tile shows what was spent", /^The live run stopped\. Cost cap reached/.test(said) && (await t.page.textContent("#kpi-cost-value")) === money(total), `${said} ${await t.page.textContent("#kpi-cost-value")}`);
    await finish("caps-3eur", t, fake);
  }
}

// ---- offline: the API becomes unreachable mid-run -----------------------------------------------------------
if (wanted("offline")) {
  const fake = createFakeClaude([{ usage: usage(), stop: "tool_use", blocks: [tool("o1", "erp_get_overview", {})] }]);
  const t = await newPage(fake, { offline: true });
  await startLive(t.page);
  await waitEnded(t.page, 90000);
  const said = await alertText(t.page);
  expect("offline", "the page says api.anthropic.com could not be reached, in its own words", /^The live run stopped\. /.test(said) && /api\.anthropic\.com/.test(said) && !/Diagnostics|Simulation mode/.test(said), said);
  await finish("offline", t, fake);
}

await browser.close();
await close();
const ran = ["happy", "key", "stop", "caps", "offline"].filter(wanted);
if (results.length) {
  console.log(results.map((r) => `FAIL  ${r}`).join("\n"));
  console.log(`\n${results.length} of ${checks} checks failed (${ran.join(", ")}). Screenshots: ${OUT}`);
  process.exit(1);
}
console.log(`${checks} checks passed (${ran.join(", ")}).`);
console.log("LIVE OK");
