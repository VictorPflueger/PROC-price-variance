// Smoke test of version 1.0.0 in Chromium: the page boots from the data files with no page error, no
// policy violation and no request to another host; the idle board shows the value pipeline from the
// value log; the scenarios, the intro, the drawer and the keyboard work; every storage key is the app's
// own; a missing data file is named on the boot screen; and the price board (AC-14) equals the engine:
// the ladder's pairs and lines, every line's normalisation, the tables, the sweep's portfolio chart and
// the value pipeline, each against figures this test computes itself from the data files.
// Usage: node tests/smoke.mjs              (all cases)
//        node tests/smoke.mjs board intro  (only these cases)
import path from "node:path";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { APP_ROOT, ONLY, wanted, launchBrowser, serveStatic, NETWORK_NOISE, SKIP_INTRO } from "./lib/harness.mjs";
import { analyseWorld, ratesOf, scanWorld, worldPipeline } from "../js/world.js";
import { eur, unitPrice } from "../js/format.js";

const CASES = ["boot", "idle", "scenarios", "intro", "drawer", "keyboard", "storage", "missing", "board", "keyboard-run", "motion", "names", "method"];
const unknown = ONLY.filter((c) => !CASES.includes(c));
if (unknown.length) { console.error(`Unknown case(s): ${unknown.join(", ")}. Cases: ${CASES.join(", ")}`); process.exit(2); }

let checks = 0;
const failures = [];
const check = (what, ok, detail = "") => { checks += 1; if (!ok) failures.push(`${what}${detail ? `: ${String(detail).slice(0, 400)}` : ""}`); };

// The engine's figures, computed here from the data files (not read from the page).
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const f of ["fx.js", "world.js", "scenarios.js", "reference_cases.js"]) vm.runInContext(await readFile(path.join(APP_ROOT, "data", f), "utf8"), sandbox);
const D = sandbox.window;
const SCENARIOS = D.SCENARIOS;
const close9 = (x, y) => Math.abs(Number(x) - Number(y)) <= 1e-9;
const close6 = (x, y) => Math.abs(Number(x) - Number(y)) <= 1e-6;

const browser = await launchBrowser();
const server = await serveStatic(APP_ROOT, 8400 + Math.floor(Math.random() * 300));

/** A fresh page with the app; records page errors, policy violations and outside requests. */
async function open({ intro = false, viewport = { width: 1600, height: 900 } } = {}) {
  const context = await browser.newContext({ viewport });
  const outside = [];
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => { outside.push(route.request().url()); route.abort("blockedbyclient"); });
  if (!intro) await context.addInitScript(SKIP_INTRO);
  await context.addInitScript(() => {
    window.__violations = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__violations.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  page.on("console", (m) => { if (m.type() === "error" && !NETWORK_NOISE.test(m.text())) errors.push(m.text()); });
  await page.goto(server.base);
  return { context, page, errors, outside };
}
async function close({ context, page, errors, outside }, label) {
  const violations = await page.evaluate(() => window.__violations || []).catch(() => []);
  check(`${label}: no page error`, errors.length === 0, errors.join(" | "));
  check(`${label}: no security-policy violation`, violations.length === 0, violations.join(" | "));
  check(`${label}: no request to another host`, outside.length === 0, outside.join(" | "));
  await context.close();
}
const ready = (page) => page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
const chosenTips = (page) => page.$$eval('.scenario-pick__item[aria-current="true"]', (els) => els.map((e) => e.dataset.id));
const menuValue = (page) => page.$eval("#dd-scenario .value", (e) => e.textContent);
const shortOf = (id) => SCENARIOS.find((s) => s.id === id)?.short;
async function startSimulationFor(page, scenario) {
  await page.click(`.scenario-pick__item[data-id="${scenario}"]`);
  await page.click("button[aria-label='Replay speed ×4']");
  await page.click("#btn-start");
  await page.click('.mode-card[data-mode="simulation"] .mode-cta button');
}

/** The value pipeline's bars (or its table's rows): { stage: value|null }. */
const stagesOf = (page, sel) => page.$$eval(sel, (els) => Object.fromEntries(els.map((e) => [e.dataset.stage, e.dataset.value === "" ? null : Number(e.dataset.value)])));

try {
  if (wanted("boot")) {
    const s = await open();
    await ready(s.page);
    await s.page.waitForSelector("#boot", { state: "detached", timeout: 5000 });
    const head = await s.page.evaluate(() => ({
      name: document.querySelector(".brand-name")?.textContent,
      honesty: document.querySelector(".honesty")?.textContent,
      ai: document.querySelector(".ai-disclosure")?.textContent.replace(/\s+/g, " ").trim(),
      tiles: [...document.querySelectorAll(".kpi .kpi-label")].map((e) => e.textContent),
      rail: [...document.querySelectorAll(".rail .rail-label")].map((e) => e.textContent),
      tabs: [...document.querySelectorAll(".drawer-tab")].map((e) => e.firstChild.textContent)
    }));
    check("boot: the header names the app, the AI system and the fictional company",
      head.name === "Price Variance Agent" && head.honesty === "Fictional company, no client data" && /AI system/.test(head.ai), JSON.stringify(head));
    check("boot: four tiles in the sisters' places", JSON.stringify(head.tiles) === JSON.stringify(["Opportunity identified", "Price variance index", "Approved savings", "Session cost"]), head.tiles.join(", "));
    check("boot: the rail's five steps", JSON.stringify(head.rail) === JSON.stringify(["Spot", "Check", "Calculate", "Propose", "Prepare"]), head.rail.join(", "));
    check("boot: the drawer's three tabs", JSON.stringify(head.tabs) === JSON.stringify(["Options", "Outbox", "Audit"]), head.tabs.join(", "));
    const version = await s.page.evaluate(async () => (await import("./js/config.js")).APP.version);
    check("boot: the app is version 1.0.0", version === "1.0.0", String(version));
    await close(s, "boot");
  }

  if (wanted("idle")) {
    const s = await open();
    await ready(s.page);
    const t = await s.page.evaluate(() => ({
      view: document.getElementById("board")?.dataset.view,
      title: document.querySelector(".board-title")?.textContent,
      empty: document.querySelector(".portfolio-empty")?.textContent || "",
      groupDisabled: document.querySelector('.board-tools button[data-view="group"]')?.getAttribute("aria-disabled"),
      approved: document.querySelector("#kpi-approved-value")?.textContent,
      approvedSub: document.querySelector("#kpi-approved-sub")?.textContent,
      identified: document.querySelector("#kpi-identified-value")?.textContent,
      texts: [...document.querySelectorAll(".bars.pipeline .bar-row")].map((r) => `${r.dataset.stage}=${r.querySelector(".bar-value").textContent}`)
    }));
    check("idle: the board opens on the portfolio, the group view waiting for a run", t.view === "portfolio" && t.title === "Portfolio" && t.groupDisabled === "true", JSON.stringify(t));
    check("idle: before a sweep the chart says a Live sweep ranks the groups", /Live sweep ranks every comparable group/.test(t.empty), t.empty);
    const stages = await stagesOf(s.page, "#board .bars.pipeline .bar-row");
    const want = worldPipeline(D.WORLD, D.FX, { identified: 0 });
    check("idle: the value pipeline's bars equal the value log (identified empty before a run)",
      stages.identified === null && close6(stages.approved, want.approved) && close6(stages.implemented, want.implemented) && close6(stages.realised, want.realised),
      `${JSON.stringify(stages)} vs ${JSON.stringify({ approved: want.approved, implemented: want.implemented, realised: want.realised })}`);
    check("idle: approved a year, realised to date, in the bars' words",
      t.texts.includes(`approved=${eur(want.approved)} a year`) && t.texts.includes(`realised=${eur(want.realised)} to date`) && t.texts.includes("identified=—"), t.texts.join(", "));
    check("idle: the approved tile shows the value log's stages", t.approved === `${eur(want.approved)} a year` && t.approvedSub === `${eur(want.implemented)} implemented · ${eur(want.realised)} realised to date`, `${t.approved} / ${t.approvedSub}`);
    check("idle: nothing is identified before a run", t.identified === "—", t.identified);
    await close(s, "idle");
  }

  if (wanted("scenarios")) {
    const s = await open();
    await ready(s.page);
    const tips = await s.page.$$eval(".scenario-pick__item", (els) => els.map((e) => e.dataset.id));
    check("scenarios: the empty console lists the six tips", JSON.stringify(tips) === JSON.stringify(SCENARIOS.map((x) => x.id)), tips.join(", "));
    check("scenarios: scenario 1 is chosen at the start, in the list and the menu", JSON.stringify(await chosenTips(s.page)) === JSON.stringify(["SC-GLOVES"]) && (await menuValue(s.page)) === shortOf("SC-GLOVES"));
    await s.page.click("#dd-scenario");
    await s.page.click('.vc-menu__item[data-id="SC-PALLETS"]');
    check("scenarios: the menu chooses pallets, and the list marks it", JSON.stringify(await chosenTips(s.page)) === JSON.stringify(["SC-PALLETS"]) && (await menuValue(s.page)) === shortOf("SC-PALLETS"));
    await s.page.click('.scenario-pick__item[data-id="SC-CONSULT"]');
    check("scenarios: the list chooses scenario 2, and the menu shows it", JSON.stringify(await chosenTips(s.page)) === JSON.stringify(["SC-CONSULT"]) && (await menuValue(s.page)) === shortOf("SC-CONSULT"));
    await s.page.click("#dd-scenario");
    const custom = await s.page.$eval('.vc-menu__item[data-id="custom"]', (e) => e.textContent);
    check("scenarios: the menu offers Custom what-if, Live only", /Custom what-if/.test(custom) && /Live only/.test(custom), custom);
    await s.page.keyboard.press("Escape");
    const start = await s.page.evaluate(() => document.getElementById("btn-start").getAttribute("aria-disabled"));
    check("scenarios: Start agent is ready in version 1.0.0", start !== "true", String(start));
    await s.page.click("#btn-start");
    await s.page.waitForSelector(".mode-card", { timeout: 5000 });
    const modes = await s.page.$$eval(".mode-card", (els) => els.map((e) => e.dataset.mode));
    check("scenarios: Start agent asks for Simulation or Live", JSON.stringify(modes.slice().sort()) === JSON.stringify(["live", "simulation"]), modes.join(", "));
    await s.page.keyboard.press("Escape");
    await s.page.waitForSelector(".mode-card", { state: "detached", timeout: 5000 });
    check("scenarios: Escape closes the mode dialog without starting a run", (await s.page.$eval(".status-pill .text", (e) => e.textContent)) === "Idle");
    await close(s, "scenarios");
  }

  if (wanted("intro")) {
    const s = await open({ intro: true });
    await s.page.waitForSelector(".intro-modal", { timeout: 20000 });
    const text = await s.page.textContent(".intro-modal");
    check("intro: opens by itself on a first visit, with the five steps and the production path",
      ["Spot", "Check", "Calculate", "Propose", "Prepare", "SAP S/4HANA", "Microsoft Fabric", "Power BI"].every((w) => text.includes(w)));
    await s.page.keyboard.press("Escape");
    await s.page.waitForSelector(".intro-modal", { state: "detached", timeout: 5000 });
    const seen = await s.page.evaluate(() => localStorage.getItem("pv.introSeen"));
    check("intro: closing it remembers the visit under pv.introSeen", seen === "1", String(seen));
    await s.page.click("#btn-about");
    await s.page.waitForSelector(".intro-modal", { timeout: 5000 });
    check("intro: How it works opens it again", true);
    await s.page.keyboard.press("Escape");
    await close(s, "intro");
  }

  if (wanted("drawer")) {
    const s = await open();
    await ready(s.page);
    for (const [tab, words] of [["options", "No options yet"], ["outbox", "Draft. Nothing is sent."], ["audit", "No run recorded"]]) {
      await s.page.click(`#tab-${tab}`);
      const visible = await s.page.isVisible(`#panel-${tab}`);
      const text = await s.page.textContent(`#panel-${tab}`);
      check(`drawer: the ${tab} tab opens its panel`, visible && text.includes(words), text.slice(0, 80));
    }
    await s.page.click(".drawer-toggle");
    check("drawer: Hide closes it", (await s.page.getAttribute("#drawer", "data-open")) === "false");
    await close(s, "drawer");
  }

  if (wanted("keyboard")) {
    const s = await open();
    await ready(s.page);
    const reached = new Set();
    for (let i = 0; i < 45; i += 1) {
      await s.page.keyboard.press("Tab");
      const id = await s.page.evaluate(() => document.activeElement?.id || document.activeElement?.dataset?.id || document.activeElement?.className || "");
      reached.add(String(id));
    }
    check("keyboard: Tab reaches Start agent, the scenario menu, How it works, the tips and the drawer's tabs",
      ["btn-start", "dd-scenario", "btn-about", "SC-GLOVES", "SC-SHOES", "tab-options"].every((x) => [...reached].some((r) => r.includes(x))), [...reached].join(", "));
    await s.page.focus('.scenario-pick__item[data-id="SC-HOSES"]');
    await s.page.keyboard.press("Enter");
    check("keyboard: Enter on a tip chooses it", JSON.stringify(await chosenTips(s.page)) === JSON.stringify(["SC-HOSES"]) && (await menuValue(s.page)) === shortOf("SC-HOSES"));
    await close(s, "keyboard");
  }

  if (wanted("storage")) {
    const s = await open({ intro: true });
    await s.page.waitForSelector(".intro-modal", { timeout: 20000 });
    await s.page.keyboard.press("Escape");
    await s.page.click(".theme-toggle");
    await s.page.click("button[aria-label='Replay speed ×2']");
    const keys = await s.page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)]);
    check("storage: every key the page writes is pv.* or Vici's vc-theme", keys.length >= 2 && keys.every((k) => k.startsWith("pv.") || k === "vc-theme"), keys.join(", "));
    await close(s, "storage");
  }

  if (wanted("missing")) {
    for (const file of ["/data/fx.js", "/data/sim_runs.js"]) {
      server.blockLocal.add(file);
      const s = await open();
      await s.page.waitForSelector('#boot[data-state="failed"]', { timeout: 20000 });
      const detail = await s.page.textContent("#boot-detail");
      check(`missing: a missing ${file.slice(1)} is named on the boot screen`, detail.includes(file.slice(1)), detail);
      server.blockLocal.delete(file);
      s.errors.length = 0; // the failed start-up logs its error on purpose
      await close(s, `missing ${file.slice(1)}`);
    }
  }

  if (wanted("board")) {
    // AC-14 on scenario 1, played in Simulation to its decision (the gloves: nine pairs, one urgent).
    const gid = D.REFERENCE_CASES.cases["SC-GLOVES"].group_id;
    const { analyses } = analyseWorld(D.WORLD, ratesOf(D.FX));
    const a = analyses.find((x) => x.id === gid);
    const dq = a.display_quantity;
    const bu = a.base_unit;
    const s = await open({ viewport: { width: 1920, height: 1080 } });
    await ready(s.page);
    await s.page.click('.scenario-pick__item[data-id="SC-GLOVES"]');
    await s.page.click("button[aria-label='Replay speed ×4']");
    await s.page.click("#btn-start");
    await s.page.click('.mode-card[data-mode="simulation"] .mode-cta button');
    await s.page.waitForSelector('.option-card[data-recommended="true"] [data-action="approve"]', { timeout: 90000 });
    // The drawer opens with the options and the board keeps the group in view as a compact ladder;
    // hiding the drawer gives the ladder its full height, with every line drawn.
    await s.page.waitForSelector(`.ladder[data-group="${gid}"][data-compared="true"][data-compact="true"]`, { timeout: 10000 });
    await s.page.click(".drawer-toggle");
    const full = await s.page.waitForSelector(`.ladder[data-group="${gid}"][data-compact="false"]`, { timeout: 5000 }).catch(() => null);
    check("board: hiding the drawer draws the full ladder, its lines included", !!full);
    // The drawer slides away; the ladder is drawn again as the canvas grows, so wait until it is still.
    await s.page.waitForFunction(() => {
      const h = Math.round(document.querySelector(".board-canvas").getBoundingClientRect().height);
      const same = window.__canvasH === h;
      window.__canvasH = h;
      return same;
    }, null, { polling: 200, timeout: 5000 });

    // The ladder: every pair at the engine's price and unexplained euros, the engine's benchmark.
    const rows = await s.page.$$eval(".ladder .ladder-row", (els) => els.map((e) => ({ pair: e.dataset.pair, price: e.dataset.price, unexplained: e.dataset.unexplained, benchmark: e.dataset.benchmark, value: e.querySelector(".row-value")?.textContent || "" })));
    check("board: the ladder has the engine's pairs", rows.length === a.pairs.length && a.pairs.every((p) => rows.some((r) => r.pair === p.id)), `${rows.length} vs ${a.pairs.length}`);
    const badPairs = rows.filter((r) => { const p = a.pairs.find((x) => x.id === r.pair); return !p || !close9(p.price, r.price) || !close9(p.unexplained, r.unexplained); });
    check("board: every pair's price and unexplained euros equal the engine's", badPairs.length === 0, JSON.stringify(badPairs.slice(0, 3)));
    const bench = await s.page.$eval(".ladder .ladder-benchmark", (e) => ({ price: e.dataset.price, pair: e.dataset.pair }));
    check("board: the benchmark line is the engine's benchmark", close9(bench.price, a.benchmark.price) && bench.pair === a.benchmark.pair, JSON.stringify(bench));
    const above = a.pairs.filter((p) => p.unexplained > 0);
    const valueOk = above.every((p) => rows.find((r) => r.pair === p.id)?.value.includes(`${eur(p.unexplained)} a year`));
    check("board: every pair above the benchmark names its unexplained euros a year", valueOk, rows.map((r) => `${r.pair}: ${r.value}`).join(" | "));
    const caption = await s.page.$eval(".board-sub", (e) => e.textContent);
    check("board: the caption names the engine's benchmark, spread and opportunity",
      caption.includes(unitPrice(a.benchmark.price, dq, bu)) && caption.includes(`${eur(a.opportunity)} a year unexplained`), caption);

    // The ladder draws every line as a mark in its pair's lane; every line opens its normalisation
    // through its pair: a row opens the pair's lines (buttons of at least 40 px), a line there its
    // normalisation, with a way back. Every line by pointer, and one pair's lines by keyboard too.
    const marks = await s.page.$$eval(".ladder .ladder-line", (els) => els.map((e) => ({ id: e.dataset.line, hidden: e.getAttribute("aria-hidden"), events: getComputedStyle(e).pointerEvents })));
    check("board: the ladder draws every line of the engine's group as a mark", marks.length === a.lines.length && a.lines.every((l) => marks.some((m) => m.id === l.id)) && marks.every((m) => m.hidden === "true" && m.events === "none"), `${marks.length} vs ${a.lines.length}`);
    const wrong = [];
    const opened = new Set();
    const small = [];
    for (const p of a.pairs) {
      await s.page.click(`.ladder .ladder-row[data-pair="${p.id}"] .row-band`);
      await s.page.waitForSelector(".board-pop .pop-lines", { timeout: 3000 });
      const listed = await s.page.$$eval(".board-pop .pop-line", (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { id: e.dataset.line, w: r.width, h: r.height }; }));
      const want = a.lines.filter((l) => l.pair === p.id).map((l) => l.id).sort();
      if (JSON.stringify(listed.map((x) => x.id).sort()) !== JSON.stringify(want)) wrong.push(`pair ${p.id} lists ${listed.length} lines, the engine ${want.length}`);
      small.push(...listed.filter((x) => x.h < 40 || x.w < 40).map((x) => `${x.id} ${Math.round(x.w)}×${Math.round(x.h)}`));
      for (const id of listed.map((x) => x.id)) {
        await s.page.click(`.board-pop .pop-line[data-line="${id}"]`);
        await s.page.waitForSelector(".board-pop .norm-steps", { timeout: 3000 });
        const shown = await s.page.$eval(".board-pop", (e) => ({ title: e.querySelector(".pop-title")?.textContent || "", result: e.querySelector(".norm-result strong")?.textContent || "", steps: e.querySelectorAll(".norm-steps dt").length }));
        const l = a.lines.find((x) => x.id === id);
        if (!shown.title.includes(id) || shown.result !== l.normalisation.display || shown.steps < 6) wrong.push(`${id}: ${JSON.stringify(shown)} vs ${l.normalisation.display}`);
        else opened.add(id);
        await s.page.click(".board-pop .pop-back");
        await s.page.waitForSelector(".board-pop .pop-lines", { timeout: 3000 });
      }
      await s.page.keyboard.press("Escape");
    }
    check("board: every pair lists exactly its lines, and every line opens the engine's six steps and its normalised price", wrong.length === 0 && opened.size === a.lines.length, `${opened.size} of ${a.lines.length} opened; ${wrong.slice(0, 3).join(" | ")}`);
    check("board: every line's button is at least 40 px high and wide", small.length === 0, small.slice(0, 5).join(", "));
    // By keyboard: Tab reaches the rows; Enter opens a pair; Tab and Enter open a line; Escape returns.
    const kp = a.pairs[a.pairs.length - 1];
    await s.page.focus(`.ladder .ladder-row[data-pair="${kp.id}"]`);
    await s.page.keyboard.press("Enter");
    await s.page.waitForSelector(".board-pop .pop-lines", { timeout: 3000 });
    let reachedLine = null;
    for (let i = 0; i < 6 && !reachedLine; i += 1) {
      await s.page.keyboard.press("Tab");
      reachedLine = await s.page.evaluate(() => document.activeElement?.matches(".pop-line") ? document.activeElement.dataset.line : null);
    }
    await s.page.keyboard.press("Enter");
    const kbShown = await s.page.waitForSelector(".board-pop .norm-steps", { timeout: 3000 }).then(() => s.page.$eval(".board-pop .pop-title", (e) => e.textContent)).catch(() => "");
    await s.page.keyboard.press("Escape");
    const back = await s.page.evaluate(() => document.activeElement?.dataset?.pair || null);
    check("board: by keyboard a row opens its lines, a line its normalisation, and Escape returns to the row", !!reachedLine && kbShown.includes(reachedLine) && back === kp.id, `${reachedLine} / ${kbShown} / ${back}`);

    // The table view holds the same numbers.
    await s.page.click(".table-toggle");
    const pairRows = await s.page.$$eval('[data-table="pairs"] tbody tr', (els) => els.map((e) => ({ pair: e.dataset.pair, price: e.dataset.price, unexplained: e.dataset.unexplained, cells: [...e.children].map((c) => c.textContent) })));
    const badTable = pairRows.filter((r) => { const p = a.pairs.find((x) => x.id === r.pair); return !p || !close9(p.price, r.price) || !close9(p.unexplained, r.unexplained) || r.cells[3] !== unitPrice(p.price, dq, bu) || r.cells[7] !== eur(p.unexplained); });
    check("board: the pairs table holds the ladder's numbers", pairRows.length === a.pairs.length && badTable.length === 0, JSON.stringify(badTable.slice(0, 2)));
    const lineRows = await s.page.$$eval('[data-table="lines"] tbody tr', (els) => els.map((e) => ({ line: e.dataset.line, price: e.dataset.price, cell: e.children[4]?.textContent })));
    const badLines = lineRows.filter((r) => { const l = a.lines.find((x) => x.id === r.line); return !l || !close9(l.price, r.price) || r.cell !== unitPrice(l.price, dq, bu); });
    check("board: the lines table holds every line at the engine's normalised price", lineRows.length === a.lines.length && badLines.length === 0, JSON.stringify(badLines.slice(0, 2)));
    await s.page.click(".table-toggle");

    // The portfolio during the run: the value pipeline with this run's identified euros.
    await s.page.click('.board-tools button[data-view="portfolio"]');
    const stages = await stagesOf(s.page, "#board .bars.pipeline .bar-row");
    const pipe = worldPipeline(D.WORLD, D.FX, { identified: a.opportunity });
    check("board: the value pipeline equals the engine's (identified from this run, the rest from the value log)",
      ["identified", "approved", "implemented", "realised"].every((k) => close6(stages[k], pipe[k])), `${JSON.stringify(stages)} vs ${JSON.stringify(pipe)}`);
    await s.page.click(".table-toggle");
    const stageRows = await stagesOf(s.page, '[data-table="pipeline"] tbody tr');
    check("board: the pipeline table holds the same numbers", ["identified", "approved", "implemented", "realised"].every((k) => close6(stageRows[k], pipe[k])), JSON.stringify(stageRows));
    await close(s, "board (scenario 1)");

    // A sweep's portfolio chart: pv_scan through the live toolbox (the same events a run sends), without a model.
    const w = await open({ viewport: { width: 1920, height: 1080 } });
    await ready(w.page);
    await w.page.evaluate(async () => {
      const { createToolbox } = await import("./js/tools.js");
      const { bus } = await import("./js/events.js");
      const { DEFAULTS } = await import("./js/params.js");
      let phase = "scanning";
      const tb = createToolbox({
        world: window.WORLD, fx: window.FX, params: DEFAULTS, emit: (type, payload) => bus.emit(type, payload),
        waitUntil: async () => {}, takeDecision: () => null, drafts: new Map(), onPhase: (p) => { phase = p; }, getPhase: () => phase,
        isEnded: () => false, signal: new AbortController().signal, ecbRate: async () => ({ error: "offline" }), mode: "live", entry: "sweep"
      });
      await tb.call("smoke-1", "pv_scan", {});
    });
    await w.page.waitForSelector("#board .bars:not(.pipeline) .bar-row", { timeout: 5000 });
    const sweep = scanWorld(D.WORLD, D.FX);
    const flagged = sweep.rows.filter((r) => r.flagged).sort((x, y) => y.opportunity - x.opportunity || x.id.localeCompare(y.id));
    const bars = await w.page.$$eval("#board .bars:not(.pipeline) .bar-row", (els) => els.map((e) => ({ id: e.dataset.group, value: e.dataset.value, text: e.querySelector(".bar-value").textContent, width: parseFloat(e.querySelector(".bar-fill").style.width) })));
    check("board: the portfolio chart has the engine's flagged groups, largest first",
      bars.length === flagged.length && bars.every((b, k) => b.id === flagged[k].id && close9(b.value, flagged[k].opportunity)), `${JSON.stringify(bars.map((b) => b.id))} vs ${JSON.stringify(flagged.map((f) => f.id))}`);
    check("board: each bar says its euros a year and is drawn to scale from zero",
      bars.every((b, k) => b.text === `${eur(flagged[k].opportunity)} a year` && Math.abs(b.width - (100 * flagged[k].opportunity) / flagged[0].opportunity) < 0.01), JSON.stringify(bars.slice(0, 2)));
    const sweptStages = await stagesOf(w.page, "#board .bars.pipeline .bar-row");
    const sweptPipe = worldPipeline(D.WORLD, D.FX, { identified: flagged.reduce((t, r) => t + r.opportunity, 0) });
    check("board: after a sweep, identified is the flagged groups' sum", close6(sweptStages.identified, sweptPipe.identified), `${sweptStages.identified} vs ${sweptPipe.identified}`);
    await w.page.click(".table-toggle");
    const tableBars = await w.page.$$eval('[data-table="flagged"] tbody tr', (els) => els.map((e) => ({ id: e.dataset.group, value: e.dataset.value, cell: e.children[1]?.textContent })));
    check("board: the flagged-groups table holds the chart's numbers",
      tableBars.length === flagged.length && tableBars.every((r, k) => r.id === flagged[k].id && close9(r.value, flagged[k].opportunity) && r.cell === eur(flagged[k].opportunity)), JSON.stringify(tableBars.slice(0, 2)));
    await close(w, "board (sweep)");
  }

  if (wanted("keyboard-run")) {
    // AC-19: scenario 1 from Start agent to Done by keyboard alone, every focused control visibly so.
    const s = await open({ viewport: { width: 1920, height: 1080 } });
    const { page } = s;
    await ready(page);
    const noFocusRing = new Set();
    let stops = 0;
    /** Presses Tab until `test` holds for the focused element (at most `max` presses), checking each stop's focus indicator. */
    const tabTo = async (test, max = 260) => {
      for (let i = 0; i < max; i += 1) {
        await page.keyboard.press("Tab");
        stops += 1;
        const st = await page.evaluate((src) => {
          const el = document.activeElement;
          if (!el || el === document.body) return { name: "body", ring: true, hit: false };
          // The focus indicators the app and Vici draw: an outline or a shadow on the control; on a card's
          // link, the card's outline; on Vici's hexagonal icon button, its ::after ring in the focus colour;
          // on a ladder row, its band's stroke; or an outline or shadow on a pseudo-element.
          const visible = (() => {
            const cs = getComputedStyle(el);
            if (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 1) return true;
            if (cs.boxShadow && cs.boxShadow !== "none") return true;
            if (el.matches(".vc-card__link")) { const c = getComputedStyle(el.closest(".vc-card")); if (c.outlineStyle !== "none" && parseFloat(c.outlineWidth) >= 1) return true; }
            if (el.matches(".vc-icon-button")) { const a = getComputedStyle(el, "::after"); if (a.content !== "none" && Number(a.opacity) >= 0.9 && a.backgroundColor !== "rgba(0, 0, 0, 0)") return true; }
            if (el.matches(".ladder-row")) { const b = getComputedStyle(el.querySelector(".row-band")); return b.stroke !== "none" && parseFloat(b.strokeWidth) >= 1; }
            for (const pseudo of ["::before", "::after"]) { const p = getComputedStyle(el, pseudo); if (p.content !== "none" && ((p.outlineStyle !== "none" && parseFloat(p.outlineWidth) >= 1) || (p.boxShadow && p.boxShadow !== "none"))) return true; }
            return false;
          })();
          // eslint-disable-next-line no-new-func
          const hit = new Function("el", `return (${src})(el);`)(el);
          return { name: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${el.getAttribute("aria-label") ? `[${el.getAttribute("aria-label").slice(0, 40)}]` : ""} "${(el.innerText || "").trim().slice(0, 30)}"`, ring: visible, hit };
        }, test.toString());
        if (!st.ring) noFocusRing.add(st.name);
        if (st.hit) return true;
      }
      return false;
    };
    const reachedSpeed = await tabTo((el) => el.getAttribute("aria-label") === "Replay speed ×4");
    await page.keyboard.press("Enter");
    const reachedTip = await tabTo((el) => el.matches('.scenario-pick__item[data-id="SC-GLOVES"]'));
    await page.keyboard.press("Enter");
    const reachedStart = await tabTo((el) => el.id === "btn-start");
    await page.keyboard.press("Enter");
    await page.waitForSelector(".mode-card", { timeout: 5000 });
    const reachedSim = await tabTo((el) => !!el.closest('.mode-card[data-mode="simulation"]') && el.matches(".mode-cta button"), 20);
    await page.keyboard.press("Enter");
    await page.waitForSelector('.option-card[data-recommended="true"] [data-action="approve"]', { timeout: 90000 });
    await page.waitForFunction(() => /Awaiting your decision/.test(document.querySelector(".status-pill .text")?.textContent || ""), null, { timeout: 30000 });
    const reachedApprove = await tabTo((el) => el.matches('.option-card[data-recommended="true"] [data-action="approve"]'));
    await page.keyboard.press("Enter");
    await page.waitForSelector('.action-card[data-status="pending"] [data-action="approve"]', { timeout: 60000 });
    let drafts = 0;
    for (let i = 0; i < 8; i += 1) {
      if (!(await page.$('.action-card[data-status="pending"] [data-action="approve"]'))) break;
      const ok = await tabTo((el) => el.matches('.action-card[data-status="pending"] [data-action="approve"]'), 120);
      if (!ok) break;
      await page.keyboard.press("Enter");
      drafts += 1;
      await page.waitForTimeout(300);
    }
    await page.waitForFunction(() => /Done/.test(document.querySelector(".status-pill .text")?.textContent || ""), null, { timeout: 60000 }).catch(() => {});
    const end = await page.$eval(".status-pill .text", (e) => e.textContent);
    check("keyboard-run: Tab reaches the speed, the tip, Start agent and the Simulation card", reachedSpeed && reachedTip && reachedStart && reachedSim, JSON.stringify({ reachedSpeed, reachedTip, reachedStart, reachedSim }));
    check("keyboard-run: Tab reaches the recommended option's Approve and every draft's Approve", reachedApprove && drafts >= 1, `${reachedApprove}, ${drafts} drafts`);
    check("keyboard-run: the run ends Done by keyboard alone", /Done/.test(end), end);
    check("keyboard-run: every control Tab reached showed a visible focus indicator", noFocusRing.size === 0, [...noFocusRing].slice(0, 8).join("; "));
    check("keyboard-run: the run took a sensible number of Tab presses", stops > 10 && stops < 1200, String(stops));
    await close(s, "keyboard-run");
  }

  if (wanted("motion")) {
    // AC-19: with reduced motion, nothing pulses: no animation keeps running while the agent reads lines,
    // waits for a decision or plays at all.
    const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, reducedMotion: "reduce" });
    await context.addInitScript(SKIP_INTRO);
    const outside = [];
    await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => { outside.push(route.request().url()); route.abort("blockedbyclient"); });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e.message || e)));
    await page.goto(server.base);
    await ready(page);
    // The boot screen fades and leaves the page 400 ms after the start. Its spinner is Vici's, which keeps
    // turning under reduced motion on purpose (slowed to 2.4 s a turn, as essential progress feedback), so
    // sampling begins once the boot screen is gone: what AC-19 asks about is the run.
    await page.waitForSelector("#boot", { state: "detached", timeout: 5000 });
    const running = () => page.evaluate(() => document.getAnimations()
      .filter((x) => x.playState === "running" && (x.effect?.getComputedTiming?.().iterations === Infinity || (x.effect?.getComputedTiming?.().duration || 0) > 50))
      .map((x) => `${x.animationName || x.constructor.name} on ${x.effect?.target?.className?.baseVal ?? x.effect?.target?.className ?? "?"}`));
    await page.click('.scenario-pick__item[data-id="SC-GLOVES"]');
    await page.click("button[aria-label='Replay speed ×4']");
    await page.click("#btn-start");
    await page.click('.mode-card[data-mode="simulation"] .mode-cta button');
    const seen = new Set();
    let samples = 0;
    let sawChecking = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 60000) {
      for (const a of await running()) seen.add(a);
      samples += 1;
      if (await page.$('.ladder-line[data-mark="checking"], .ladder-row[data-state="checking"]')) sawChecking = true;
      if (await page.$('.option-card[data-recommended="true"] [data-action="approve"]')) break;
      await page.waitForTimeout(150);
    }
    for (const a of await running()) seen.add(a);
    check("motion: the agent read lines on the board while the test watched", sawChecking);
    check("motion: with reduced motion no pulse or other animation runs, sampled through the run", seen.size === 0 && samples > 20, `${[...seen].slice(0, 6).join(", ")} (${samples} samples)`);
    const pulse = await page.evaluate(() => { const el = document.querySelector(".status-pill .dot"); return el ? getComputedStyle(el).animationIterationCount : null; });
    check("motion: the status tag's dot does not repeat its pulse", pulse === null || pulse === "1", String(pulse));
    check("motion: no page error and no request to another host", errors.length === 0 && outside.length === 0, [...errors, ...outside].join(" | "));
    await context.close();
  }

  if (wanted("names")) {
    // AC-19: every marker, row and bar of the board, and every control, has an accessible name; the
    // marks the rows stand for are hidden from assistive technology.
    const s = await open({ viewport: { width: 1920, height: 1080 } });
    const { page } = s;
    await ready(page);
    const unnamed = () => page.evaluate(() => {
      const nameOf = (el) => {
        if (el.getAttribute("aria-label")) return el.getAttribute("aria-label").trim();
        const by = el.getAttribute("aria-labelledby");
        if (by) return by.split(/\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" ").trim();
        if (el.id && document.querySelector(`label[for="${el.id}"]`)) return document.querySelector(`label[for="${el.id}"]`).textContent.trim();
        if (el.closest("label")) return el.closest("label").textContent.trim();
        return (el.textContent || el.title || "").trim();
      };
      const sel = 'button, a[href], input, select, textarea, summary, [role="button"], [role="tab"], [role="group"], [role="img"], [role="menuitemradio"]';
      return [...document.querySelectorAll(sel)].filter((el) => el.getClientRects().length && !el.closest("[aria-hidden='true'], [hidden]")).filter((el) => !nameOf(el)).map((el) => `${el.tagName.toLowerCase()}.${String(el.className?.baseVal ?? el.className).split(" ")[0]}`);
    });
    await startSimulationFor(page, "SC-GLOVES");
    await page.waitForSelector('.option-card[data-recommended="true"] [data-action="approve"]', { timeout: 90000 });
    await page.click(".drawer-toggle");
    await page.waitForSelector('.ladder[data-compact="false"]', { timeout: 5000 });
    const ladder = await page.evaluate(() => ({
      svg: document.querySelector(".ladder")?.getAttribute("aria-label") || "",
      rows: [...document.querySelectorAll(".ladder .ladder-row")].map((r) => ({ role: r.getAttribute("role"), label: r.getAttribute("aria-label") || "", tab: r.getAttribute("tabindex") })),
      marksHidden: [...document.querySelectorAll(".ladder .ladder-line, .ladder .ladder-axis, .ladder .ladder-benchmark")].every((m) => m.getAttribute("aria-hidden") === "true")
    }));
    check("names: the ladder is a named group that says what its rows open", /Price ladder of .+: \d+ plant–supplier pairs/.test(ladder.svg) && /opens its lines and contract/.test(ladder.svg), ladder.svg);
    check("names: every row is a button named with its plant, supplier, price and lines", ladder.rows.length > 0 && ladder.rows.every((r) => r.role === "button" && r.tab === "0" && /,.+: €[\d.,]+ per .+ delivered, .+ of the quantity/.test(r.label) && /\d+ lines?; opens them and the contract/.test(r.label)), JSON.stringify(ladder.rows[0]));
    check("names: the line marks, the axis and the benchmark line are hidden from assistive technology (the rows and the tables carry them)", ladder.marksHidden);
    check("names: every control and group on screen has a name (the ladder in view)", (await unnamed()).length === 0, (await unnamed()).join(", "));
    await page.click('.ladder .ladder-row');
    await page.waitForSelector(".board-pop .pop-line");
    const pop = await page.evaluate(() => ({ dialog: document.querySelector(".board-pop")?.getAttribute("role"), label: document.querySelector(".board-pop")?.getAttribute("aria-label"), lines: [...document.querySelectorAll(".board-pop .pop-line")].map((b) => b.getAttribute("aria-label")) }));
    check("names: a pair's popover is a named dialog whose line buttons say what they open", pop.dialog === "dialog" && /^Pair /.test(pop.label || "") && pop.lines.every((l) => /^Line .+: open its normalisation$/.test(l)), JSON.stringify(pop).slice(0, 300));
    await page.keyboard.press("Escape");
    await page.click('.board-tools button[data-view="portfolio"]');
    const bars = await page.evaluate(() => [...document.querySelectorAll("#board .bar-row")].map((r) => (r.querySelector(".bar-label")?.textContent || "").trim() && (r.querySelector(".bar-value")?.textContent || "").trim()));
    check("names: every bar of the portfolio has its label and its value as text", bars.length >= 4 && bars.every(Boolean), JSON.stringify(bars));
    check("names: every control and group on screen has a name (the portfolio in view)", (await unnamed()).length === 0, (await unnamed()).join(", "));
    await close(s, "names");
  }

  if (wanted("method")) {
    // The Method dialog: the method, the parameters (changed between runs, logged, never applied to a
    // simulation, locked while a run is in progress), the rates with their dates, the production path.
    const s = await open({ viewport: { width: 1920, height: 1080 } });
    const { page } = s;
    await ready(page);
    await page.click("#btn-method");
    await page.waitForSelector(".method-modal", { timeout: 5000 });
    const m = await page.evaluate(() => ({
      heads: [...document.querySelectorAll(".method-modal .method-section h3")].map((h) => h.textContent),
      params: [...document.querySelectorAll(".method-params tbody tr")].map((r) => ({ key: r.dataset.param, value: r.querySelector("input").value, disabled: r.querySelector("input").disabled })),
      rates: [...document.querySelectorAll(".method-rates tbody tr")].map((r) => [...r.children].map((c) => c.textContent)),
      path: [...document.querySelectorAll(".method-modal .method-path > li strong")].map((x) => x.textContent),
      text: document.querySelector(".method-modal").textContent
    }));
    const { PARAMETERS, DEFAULTS } = await import("../js/params.js");
    const want = ["Comparable groups", "A comparable price", "The benchmark", "Justified and unexplained", "Spread, index and materiality", "The options", "The value pipeline", "Parameters", "Exchange rates", "In production"];
    check("method: the dialog explains the method in its ten sections", JSON.stringify(m.heads) === JSON.stringify(want), m.heads.join(" | "));
    check("method: every parameter is listed with its default value, editable between runs",
      m.params.length === PARAMETERS.length && m.params.every((p) => { const def = PARAMETERS.find((x) => x.key === p.key); const shown = Number(p.value); return def && !p.disabled && Math.abs((def.unit === "share" ? shown / 100 : shown) - DEFAULTS[p.key]) < 1e-12; }), JSON.stringify(m.params.slice(0, 3)));
    const gbp = D.FX.currencies.GBP;
    check("method: the rates table shows the window's mean GBP rate with its dates and quotes",
      m.rates.length === 1 && m.rates[0][0] === "GBP" && m.rates[0][1] === gbp.mean_per_eur.toLocaleString("en-GB", { maximumFractionDigits: 5 }) && m.rates[0][3].includes("20 Nov 2025") && m.rates[0][4] === String(gbp.observations), JSON.stringify(m.rates));
    check("method: the production path runs from SAP to Action", JSON.stringify(m.path) === JSON.stringify(["SAP S/4HANA or Ariba", "Microsoft Fabric", "AI agents", "Power BI", "Action"]), m.path.join(" → "));
    check("method: the figures in its text come from the parameters (e.g. the 15.0% urgent allowance, €5,000 a year materiality)", m.text.includes("15.0%") && m.text.includes("€5,000 a year") && m.text.includes("8 hours"));
    // A change between runs: logged in the audit log at once.
    await page.fill('.method-params input[data-param="materiality_eur"]', "4000");
    await page.keyboard.press("Enter");
    const status = await page.textContent(".method-param-status");
    check("method: a change is confirmed with its old and new value", /Materiality: opportunity: €5,000 a year → €4,000 a year/.test(status), status);
    await page.keyboard.press("Escape");
    await page.click("#tab-audit");
    const logged = await page.evaluate(() => [...document.querySelectorAll('.audit-table tr[data-type="param_change"] td')].map((td) => td.textContent).join(" "));
    check("method: the change is in the audit log", /materiality_eur: 5000 → 4000/.test(logged), logged);
    // A simulation runs at the defaults, and the parameters are locked while it runs.
    await page.click('.scenario-pick__item[data-id="SC-BOXES"]');
    await page.click("button[aria-label='Replay speed ×4']");
    await page.click("#btn-start");
    await page.click('.mode-card[data-mode="simulation"] .mode-cta button');
    await page.waitForFunction(() => !/Idle/.test(document.querySelector(".status-pill .text")?.textContent || ""), null, { timeout: 10000 });
    await page.click("#btn-method");
    await page.waitForSelector(".method-modal");
    const locked = await page.evaluate(() => [...document.querySelectorAll(".method-params input")].every((i) => i.disabled) && /Locked while the agent runs/.test(document.querySelector(".method-param-note").textContent));
    check("method: while a run is in progress the parameters are locked and say so", locked);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => /Done|No findings/.test(document.querySelector(".status-pill .text")?.textContent || ""), null, { timeout: 90000 });
    const audit = await page.evaluate(async () => JSON.parse((await import("./js/audit.js")).buildAuditExport()));
    check("method: the simulation ran at the defaults, whatever the person set for live runs",
      audit.parameters.in_effect.materiality_eur === 5000 && audit.parameters.changed_from_defaults.length === 0 && audit.run.mode === "simulation", JSON.stringify(audit.parameters).slice(0, 200));
    const outcome = audit.events.filter((e) => e.type === "report").pop()?.payload?.outcome;
    check("method: scenario 4 still ends with nothing to propose (a lower threshold would have flagged it)", outcome === "nothing_found", outcome);
    await page.click("#btn-method");
    await page.waitForSelector(".method-modal");
    const kept = await page.$eval('.method-params input[data-param="materiality_eur"]', (i) => ({ value: i.value, disabled: i.disabled }));
    check("method: the person's value is kept for the next live run, editable again after the run", kept.value === "4000" && !kept.disabled, JSON.stringify(kept));
    await page.click(".method-reset");
    const reset = await page.$eval('.method-params input[data-param="materiality_eur"]', (i) => i.value);
    check("method: Reset to the defaults restores them", reset === "5000", reset);
    await page.keyboard.press("Escape");
    await close(s, "method");
  }
} finally {
  await server.close();
  await browser.close();
}

for (const f of failures) console.log(`FAIL  ${f}`);
if (failures.length) { console.log(`\nSMOKE FAILED: ${failures.length} of ${checks} checks`); process.exit(1); }
console.log(`SMOKE OK: ${ONLY.length ? ONLY.join(" ") : CASES.join(" ")} (${checks} checks)`);
