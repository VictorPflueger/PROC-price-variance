// Acceptance checks of the key's lifecycle and the honesty rules around it (AC-08), and of the exports
// (AC-16):
//   key      the key is asked for only in Live (Simulation never asks); it is checked with the free
//            GET /v1/models call; a rejected key is not kept; it lives in this tab's session storage
//            under pv.anthropic.key and never in local storage, the audit export, a recording, the
//            console or the page; Forget key removes it; the key dialog refuses to work inside a frame;
//            the live audit export validates against its schema
//   exports  a simulated run's report (.md), group analysis (.csv) and audit log (.json), downloaded:
//            their names, their content, the figures against the engine, the JSON against AuditExport
//            with the app's own validator, and a broken copy refused
// Usage: node tests/accept.mjs [case…]
import path from "node:path";
import { readFile } from "node:fs/promises";
import { createFakeClaude } from "./lib/fake-claude.mjs";
import { APP_ROOT, ONLY, outDir, wanted, launchBrowser, serveStatic, CORS, MOCK_KEY, NETWORK_NOISE, SKIP_INTRO, KEYS } from "./lib/harness.mjs";
import { MODELS } from "../js/config.js";
import { validate, formatErrors } from "../js/schema.js";
import { SCHEMAS } from "../js/schemas.js";
import { parseCsv, ANALYSIS_COLUMNS } from "../js/exports.js";
import { analyseWorld, ratesOf } from "../js/world.js";
import { DEFAULTS } from "../js/params.js";
import vm from "node:vm";

const OUT = await outDir("accept");
const CASES = ["key", "exports"];
const unknownCases = ONLY.filter((c) => !CASES.includes(c));
if (unknownCases.length) { console.error(`Unknown case(s): ${unknownCases.join(", ")}. Cases: ${CASES.join(", ")}`); process.exit(2); }
const PORT = 8773;
const { base: BASE, close } = await serveStatic(APP_ROOT, PORT);
const browser = await launchBrowser();
let checks = 0;
const failures = [];
const expect = (name, what, ok, detail = "") => { checks += 1; if (!ok) failures.push(`${name}: ${what}${detail !== "" ? `: ${String(detail).slice(0, 300)}` : ""}`); };
const KEY_RE = /sk-ant-(?!\[REDACTED\])[A-Za-z0-9_-]{8,}/;

async function newPage(fake, { models = "ok", extra = null } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
  await context.addInitScript(SKIP_INTRO);
  const log = { pageErrors: [], consoleErrors: [], console: [], models: 0, external: [] };
  if (extra) await context.route(`${BASE}${extra.path}`, (route) => route.fulfill({ status: 200, headers: { "content-type": "text/html; charset=utf-8" }, body: extra.body }));
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (u.host === "api.anthropic.com") {
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { ...CORS, "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST" } });
      if (u.pathname === "/v1/models") {
        log.models += 1;
        if (models === "reject") return route.fulfill({ status: 401, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }) });
        return route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify({ data: MODELS.map((m) => ({ id: m.id })) }) });
      }
      if (u.pathname === "/v1/messages" && fake) {
        const out = fake.handle(req.postData() || "{}", req.headers());
        return route.fulfill({ status: out.status, headers: { ...CORS, ...out.headers }, body: out.body }).catch(() => {});
      }
    }
    log.external.push(u.host);
    return route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => log.pageErrors.push(String(e.message || e)));
  page.on("console", (m) => { log.console.push(m.text()); if (m.type() === "error" && !NETWORK_NOISE.test(m.text())) log.consoleErrors.push(m.text()); });
  return { context, page, log };
}

const storage = (page) => page.evaluate(() => ({
  session: Object.fromEntries(Object.keys(sessionStorage).map((k) => [k, sessionStorage.getItem(k)])),
  local: Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]))
}));
const statusText = (page) => page.$eval(".status-pill .text", (e) => e.textContent);

if (wanted("key")) {
  // 1. Simulation never asks for a key.
  {
    const t = await newPage(null);
    await t.page.goto(BASE);
    await t.page.waitForSelector('html[data-boot="ready"]');
    await t.page.click("#btn-start");
    await t.page.click('.mode-card[data-mode="simulation"] .mode-cta button');
    await t.page.waitForSelector('.option-card[data-recommended="true"] [data-action="approve"]', { timeout: 60000 });
    expect("key", "Simulation runs without asking for a key", !(await t.page.$("#api-key-input")) && t.log.models === 0);
    const s = await storage(t.page);
    expect("key", "no key is stored by a Simulation", !(KEYS.apiKey in s.session) && !Object.values(s.local).some((v) => KEY_RE.test(v || "")));
    await t.page.click("#btn-abort");
    await t.context.close();
  }
  // 2. A rejected key is not kept.
  {
    const t = await newPage(null, { models: "reject" });
    await t.page.goto(BASE);
    await t.page.waitForSelector('html[data-boot="ready"]');
    await t.page.click("#btn-start");
    await t.page.click('.mode-card[data-mode="live"] .mode-cta button');
    await t.page.fill("#api-key-input", MOCK_KEY);
    await t.page.click('button:has-text("Check key and continue")');
    await t.page.waitForFunction(() => /rejected this key \(401\)/.test(document.querySelector("#api-key-msg")?.textContent || ""));
    const s = await storage(t.page);
    expect("key", "the key is checked with GET /v1/models", t.log.models === 1, t.log.models);
    expect("key", "a rejected key is not stored", !(KEYS.apiKey in s.session));
    await t.context.close();
  }
  // 3. Live: the key is checked, kept in this tab only, and never leaves it.
  {
    const script = [
      { usage: { input_tokens: 900, output_tokens: 200 }, stop: "tool_use", blocks: [{ type: "text", text: "Check: the overview first." }, { type: "tool_use", id: "k1", name: "erp_get_overview", input: {} }] },
      { usage: { input_tokens: 900, output_tokens: 200 }, stop: "tool_use", blocks: [{ type: "tool_use", id: "k2", name: "ui_final_report", input: { outcome: "nothing_found", markdown: "## Gloves\n\nThis test run stops after the overview, without options." } }] },
      { usage: { input_tokens: 900, output_tokens: 50 }, stop: "end_turn", blocks: [{ type: "text", text: "Done." }] }
    ];
    const fake = createFakeClaude(script);
    const t = await newPage(fake);
    await t.page.goto(BASE);
    await t.page.waitForSelector('html[data-boot="ready"]');
    await t.page.click("#btn-start");
    await t.page.click('.mode-card[data-mode="live"] .mode-cta button');
    expect("key", "the key is asked for when a live run starts", !!(await t.page.waitForSelector("#api-key-input", { timeout: 5000 }).catch(() => null)));
    await t.page.fill("#api-key-input", MOCK_KEY);
    await t.page.click('button:has-text("Check key and continue")');
    await t.page.waitForFunction(() => /Done|Error|Aborted/.test(document.querySelector(".status-pill .text")?.textContent || ""), null, { timeout: 30000 });
    expect("key", "the live run completes", /Done/.test(await statusText(t.page)), await statusText(t.page));
    expect("key", "the key was checked with GET /v1/models once", t.log.models === 1, t.log.models);
    expect("key", "the key went only to api.anthropic.com", fake.requests.length === 3 && fake.requests.every((r) => r.headers["x-api-key"] === MOCK_KEY) && t.log.external.length === 0, t.log.external.join(","));
    const s = await storage(t.page);
    expect("key", "the key sits in this tab's session storage under pv.anthropic.key", s.session[KEYS.apiKey] === MOCK_KEY);
    expect("key", "no other storage entry holds the key", !Object.entries(s.session).some(([k, v]) => k !== KEYS.apiKey && KEY_RE.test(v || "")) && !Object.values(s.local).some((v) => KEY_RE.test(v || "")), JSON.stringify(s.local).slice(0, 200));
    expect("key", "every storage key is pv. or vc-theme", [...Object.keys(s.session), ...Object.keys(s.local)].every((k) => k.startsWith("pv.") || k === "vc-theme"), [...Object.keys(s.session), ...Object.keys(s.local)].join(","));
    // The audit export (downloaded as the person would) and the page and console never show it.
    await t.page.click('#drawer [role="tab"]:has-text("Audit")').catch(() => {});
    await t.page.waitForTimeout(300);
    const [download] = await Promise.all([t.page.waitForEvent("download"), t.page.click('button:has-text("Export JSON")')]);
    const file = path.join(OUT, download.suggestedFilename());
    await download.saveAs(file);
    const exported = await readFile(file, "utf8");
    expect("key", "the audit export is named price-variance-…-LIVE-audit.json", /^price-variance-run-.*-LIVE-audit\.json$/.test(download.suggestedFilename()), download.suggestedFilename());
    expect("key", "the audit export never holds the key", !exported.includes(MOCK_KEY) && !KEY_RE.test(exported));
    expect("key", "the audit export shows model, usage, rates and cost", /"model": \{/.test(exported) && /"usage": \{/.test(exported) && /"rates": \{/.test(exported) && /"cost": \{/.test(exported));
    const liveCheck = validate(JSON.parse(exported), "AuditExport", { defs: SCHEMAS });
    expect("key", "the live audit export validates against AuditExport with the app's validator (AC-16)", liveCheck.ok, formatErrors(liveCheck.errors).join("; "));
    const [rec] = await Promise.all([t.page.waitForEvent("download"), t.page.click('#console button:has-text("Save run as simulation")')]);
    const recText = await readFile(await rec.path(), "utf8");
    expect("key", "a recording never holds the key", !recText.includes(MOCK_KEY) && !KEY_RE.test(recText));
    expect("key", "the console never shows the key", !t.log.console.some((m) => m.includes(MOCK_KEY)));
    expect("key", "the page never shows the key", !(await t.page.evaluate((k) => document.body.innerText.includes(k) || document.body.innerHTML.includes(k), MOCK_KEY)));
    // Forget key: from the mode dialog's footer, through the key dialog.
    await t.page.click("#btn-start");
    await t.page.click("#btn-manage-key");
    await t.page.click('button:has-text("Forget key")');
    await t.page.waitForFunction(() => /Key removed/.test(document.querySelector("#api-key-msg")?.textContent || ""));
    const after = await storage(t.page);
    expect("key", "Forget key removes it from this tab", !(KEYS.apiKey in after.session));
    expect("key", "no protocol violation", fake.violations.length === 0, fake.violations.join(" | "));
    expect("key", "no page error", t.log.pageErrors.length === 0, t.log.pageErrors.join(" | "));
    await t.context.close();
  }
  // 4. Inside a frame the key dialog refuses to work (clickjacking).
  {
    const t = await newPage(null, { extra: { path: "frame-test.html", body: `<!doctype html><title>frame</title><iframe src="${BASE}" width="1500" height="950"></iframe>` } });
    await t.page.goto(`${BASE}frame-test.html`);
    const frame = await (await t.page.waitForSelector("iframe")).contentFrame();
    await frame.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
    await frame.click("#btn-start");
    await frame.click('.mode-card[data-mode="live"] .mode-cta button');
    await frame.waitForSelector("#api-key-input");
    const state = await frame.evaluate(() => ({ disabled: document.querySelector("#api-key-input").disabled, msg: document.querySelector("#api-key-msg").textContent }));
    expect("key", "in a frame the key input is disabled and the dialog says why", state.disabled && /inside another page/.test(state.msg), JSON.stringify(state));
    await frame.click('button:has-text("Check key and continue")').catch(() => {});
    await t.page.waitForTimeout(300);
    expect("key", "in a frame no key is checked or stored", t.log.models === 0 && !(await frame.evaluate((k) => sessionStorage.getItem(k), KEYS.apiKey)));
    await t.context.close();
  }
}


if (wanted("exports")) {
  // AC-16: the three exports of a simulated run of scenario 1, downloaded as a person would: the report
  // as Markdown, the group analysis as CSV and the audit log as JSON, each named price-variance-…, each
  // with its stated content, the figures equal to the engine's, the JSON valid against its schema.
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  for (const f of ["fx.js", "world.js", "reference_cases.js"]) vm.runInContext(await readFile(path.join(APP_ROOT, "data", f), "utf8"), sandbox);
  const D = sandbox.window;
  const gid = D.REFERENCE_CASES.cases["SC-GLOVES"].group_id;
  const a = analyseWorld(D.WORLD, ratesOf(D.FX)).analyses.find((x) => x.id === gid);
  const t = await newPage(null);
  const { page } = t;
  await page.goto(BASE);
  await page.waitForSelector('html[data-boot="ready"]');
  await page.click('.scenario-pick__item[data-id="SC-GLOVES"]');
  await page.click("button[aria-label='Replay speed ×4']");
  await page.click("#btn-start");
  await page.click('.mode-card[data-mode="simulation"] .mode-cta button');
  await page.waitForSelector('.option-card[data-recommended="true"] [data-action="approve"]', { timeout: 90000 });
  await page.click('.option-card[data-recommended="true"] [data-action="approve"]');
  for (let i = 0; i < 12; i += 1) {
    const b = await page.waitForSelector('.action-card[data-status="pending"] [data-action="approve"]', { timeout: 5000 }).catch(() => null);
    if (!b) break;
    await b.click().catch(() => {});
    await page.waitForTimeout(250);
  }
  await page.waitForFunction(() => /Done/.test(document.querySelector(".status-pill .text")?.textContent || ""), null, { timeout: 60000 });
  const runId = await page.evaluate(async () => (await import("./js/state.js")).getState().runId);
  const save = async (download) => { const f = path.join(OUT, download.suggestedFilename()); await download.saveAs(f); return { name: download.suggestedFilename(), text: await readFile(f, "utf8") }; };

  // The report.
  await page.click('#console button:has-text("Open the report")');
  await page.waitForSelector(".report-modal");
  const report = await save((await Promise.all([page.waitForEvent("download"), page.click('.report-modal button:has-text("Download .md")')]))[0]);
  await page.keyboard.press("Escape");
  expect("exports", "the report is named price-variance-<run>-SIMULATION-report.md", report.name === `price-variance-${runId}-SIMULATION-report.md`, report.name);
  expect("exports", "the report opens with the SIMULATION banner and keeps the authored footer", /^> SIMULATION: scripted replay, not a live analysis\./.test(report.text) && report.text.includes("Simulated run (authored script)"), report.text.slice(0, 160));
  expect("exports", "the report names the engine's opportunity and benchmark", report.text.includes("€14,146") && report.text.includes("€6.90 per 100 EA"), report.text.slice(0, 300));

  // The group analysis.
  await page.click(".drawer-toggle").catch(() => {});
  await page.click('.board-tools button[data-view="group"]').catch(() => {});
  await page.waitForSelector(".csv-download:not([hidden])", { timeout: 5000 });
  const csv = await save((await Promise.all([page.waitForEvent("download"), page.click(".csv-download")]))[0]);
  expect("exports", "the analysis is named price-variance-<run>-SIMULATION-<group>-analysis.csv", csv.name === `price-variance-${runId}-SIMULATION-${gid}-analysis.csv`, csv.name);
  const rows = parseCsv(csv.text);
  const header = csv.text.replace(/^\uFEFF/, "").split("\r\n")[0].split(",");
  expect("exports", "the CSV starts with a byte order mark and its header, lines end with CRLF", csv.text.startsWith("\uFEFFgroup_id,") && JSON.stringify(header) === JSON.stringify(ANALYSIS_COLUMNS) && csv.text.endsWith("\r\n"));
  const included = rows.filter((r) => r.status === "included");
  const excluded = rows.filter((r) => r.status === "excluded");
  expect("exports", "one row per line of the group and one per excluded line", included.length === a.lines.length && excluded.length === a.excluded.length, `${included.length}/${a.lines.length}, ${excluded.length}/${a.excluded.length}`);
  const bad = included.filter((r) => { const l = a.lines.find((x) => x.id === r.line_id); return !l || Math.abs(Number(r.normalised_price_eur_per_base_unit) - l.price) > 1e-9 || Math.abs(Number(r.unexplained_eur) - l.unexplained) > 1e-6 || Math.abs(Number(r.justified_eur) - l.justified) > 1e-6 || r.pair !== l.pair; });
  expect("exports", "every line's normalised price, pair and gap split equal the engine's", bad.length === 0, JSON.stringify(bad[0] || {}).slice(0, 200));
  const sum = included.reduce((x, r) => x + Number(r.unexplained_eur || 0), 0);
  expect("exports", "the lines' unexplained euros add up to the engine's opportunity", Math.abs(sum - a.unexplained) < 1e-6, `${sum} vs ${a.unexplained}`);
  expect("exports", "every row names the method's version and the rates' basis", rows.every((r) => r.method_version && /ECB/.test(r.rates)), rows[0]?.rates);

  // The audit log.
  await page.click("#tab-audit");
  const audit = await save((await Promise.all([page.waitForEvent("download"), page.click('#panel-audit button:has-text("Export JSON")')]))[0]);
  expect("exports", "the audit log is named price-variance-<run>-SIMULATION-audit.json", audit.name === `price-variance-${runId}-SIMULATION-audit.json`, audit.name);
  const doc = JSON.parse(audit.text);
  const v = validate(doc, "AuditExport", { defs: SCHEMAS });
  expect("exports", "the audit export validates against AuditExport with the app's own validator", v.ok, formatErrors(v.errors).join("; "));
  expect("exports", "the audit export says it is a simulation and documents an AI system", doc.mode === "simulation" && /^SIMULATION/.test(doc.mode_statement) && /AI system/.test(doc.ai_disclosure) && /Fictional company, no client data/.test(doc.company_note));
  expect("exports", "the audit export records the parameters in effect (the defaults for a simulation)", JSON.stringify(doc.parameters.in_effect) === JSON.stringify(DEFAULTS) && doc.parameters.changed_from_defaults.length === 0);
  expect("exports", "the audit export records the person's decisions with reviewer and time", doc.decisions.some((d) => d.type === "option_decision" && d.decision === "approved" && d.reviewer && d.ts) && doc.decisions.filter((d) => d.type === "action_decision").length >= 1);
  expect("exports", "the audit export records the versions of the app, method, world and rates", doc.versions.app === doc.app_version && doc.versions.method && doc.versions.world && doc.versions.fx === D.FX.version);
  // The validator is not a rubber stamp: a broken copy of this very export is refused.
  const broken = JSON.parse(audit.text);
  delete broken.ai_disclosure;
  broken.mode = "LIVE?";
  broken.events[0].ts = 5;
  expect("exports", "a broken copy of the export is refused, each fault named", (() => { const r = validate(broken, "AuditExport", { defs: SCHEMAS }); const m = formatErrors(r.errors).join(" "); return !r.ok && /ai_disclosure/.test(m) && /mode/.test(m) && /events\[0\]\.ts/.test(m); })());
  expect("exports", "every export's name starts with price-variance-", [report, csv, audit].every((f) => f.name.startsWith("price-variance-")));
  expect("exports", "no page error, no request to another host", t.log.pageErrors.length === 0 && t.log.external.length === 0, [...t.log.pageErrors, ...t.log.external].join(" | "));
  await t.context.close();
}

await browser.close();
await close();
for (const f of failures) console.log(`FAIL  ${f}`);
const label = ONLY.length ? ONLY.join(" ") : "key exports";
if (failures.length) { console.log(`ACCEPT FAILED: ${failures.length} of ${checks} checks`); process.exit(1); }
console.log(`ACCEPT OK: ${label} (${checks} checks)`);
