// The six scenarios as simulations in the browser, offline and without a key (AC-12, AC-10, AC-15).
//   paths         every scenario along approve the recommendation, reject it then approve another,
//                 and accept the variance with a reason; scenario 4 ends with nothing to propose. Each
//                 run: no key asked, no request to another host, the SIMULATION tape, the tiles and the
//                 ladder equal to the engine's figures, the report's outcome following the decision
//   confirmation  scenario 2's cluster dialog with the confirmed, split and rejected answers: "Your
//                 confirmation" in merlot on the furthest step reached (Check), the status tag
//                 "Awaiting your confirmation", and the rail never moving back
//   words         in every state of every path played, no tile, card or label reads "saved", and
//                 "realised" only as realised to date of the past case; approved savings read "a year"
//   timing        for AC-21: the demo's scenario (the one marked "Start here") played at ×1, a person
//                 answering at once: the decision within 45 s and the end within 150 s of Start, so the
//                 five-minute demo of DEMO_SCRIPT.md leaves the rest of its time for the room
// Usage: node tests/sims.mjs [case…]
import path from "node:path";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { APP_ROOT, ONLY, wanted, launchBrowser, serveStatic, NETWORK_NOISE, SKIP_INTRO } from "./lib/harness.mjs";
import { analyseWorld, ratesOf } from "../js/world.js";
import { eur, unitPrice } from "../js/format.js";

const PORT = 8772;
const { base: BASE, close } = await serveStatic(APP_ROOT, PORT);
const browser = await launchBrowser();
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const f of ["fx.js", "world.js", "scenarios.js", "reference_cases.js"]) vm.runInContext(await readFile(path.join(APP_ROOT, "data", f), "utf8"), sandbox);
const D = sandbox.window;
const REF = D.REFERENCE_CASES.cases;
const { analyses } = analyseWorld(D.WORLD, ratesOf(D.FX), { clusters: [REF["SC-CONSULT"].cluster] });
const A = Object.fromEntries(analyses.map((a) => [a.id, a]));
let checks = 0;
const failures = [];
const expect = (name, what, ok, detail = "") => { checks += 1; if (!ok) failures.push(`${name}: ${what}${detail !== "" ? `: ${String(detail).slice(0, 300)}` : ""}`); };

async function newPage() {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await context.addInitScript(SKIP_INTRO);
  await context.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(e.violatedDirective));
    // The rail's furthest step over time (it must never move back) and every text the tiles, cards and
    // labels showed (for the words check).
    window.__rail = [];
    window.__texts = new Set();
    const order = ["spot", "check", "calculate", "propose", "prepare"];
    const snap = () => {
      const steps = [...document.querySelectorAll(".rail .rail-step")];
      if (steps.length) {
        const reached = steps.reduce((m, s, i) => (["done", "active", "yours", "stopped"].includes(s.dataset.state) ? Math.max(m, i) : m), -1);
        const yours = steps.find((s) => s.dataset.state === "yours");
        window.__rail.push({ reached, yours: yours ? `${yours.dataset.step}:${yours.textContent}` : null });
      }
      for (const el of document.querySelectorAll(".kpi, .option-card, .action-card .action-meta, .bar-row, .board-caption, .ladder .row-value, .status-pill, .alert-card .alert-sev")) window.__texts.add(el.textContent.replace(/\s+/g, " ").trim());
      void order;
    };
    new MutationObserver(snap).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-state"] });
  });
  const log = { pageErrors: [], consoleErrors: [], external: [] };
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => { log.external.push(route.request().url()); return route.abort("blockedbyclient"); });
  const page = await context.newPage();
  page.on("pageerror", (e) => log.pageErrors.push(String(e.message || e)));
  page.on("console", (m) => { if (m.type() === "error" && !NETWORK_NOISE.test(m.text())) log.consoleErrors.push(m.text()); });
  await page.goto(BASE);
  await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
  return { context, page, log };
}

const status = (page) => page.$eval(".status-pill .text", (e) => e.textContent);
async function waitEnd(page, ms = 90000) {
  await page.waitForFunction(() => /Done|Aborted|Error|Stopped/.test(document.querySelector(".status-pill .text")?.textContent || ""), null, { timeout: ms });
  return status(page);
}

/**
 * Plays a scenario. plan: { option: "recommended" | "reject-then-approve" | "accept", confirm: "confirmed" | "split" | "rejected" }.
 * Returns { page, context, log, outcome, keyAsked, seen }.
 */
async function play(scenario, plan, name) {
  const t = await newPage();
  const { page } = t;
  let keyAsked = false;
  await page.click(`.scenario-pick__item[data-id="${scenario}"]`);
  await page.click("button[aria-label='Replay speed ×4']");
  await page.click("#btn-start");
  await page.click('.mode-card[data-mode="simulation"] .mode-cta button');
  expect(name, "the SIMULATION tape is shown", await page.$eval("#mode-badge", (e) => e.textContent === "SIMULATION") && await page.$eval(".sim-watermark", (e) => !e.hidden));
  const seen = { confirmation: null, options: false };
  const t0 = Date.now();
  let rejected = false;
  for (;;) {
    await page.waitForTimeout(250);
    if (await page.$("#api-key-input")) keyAsked = true;
    if (await page.$(".cluster-modal")) {
      seen.confirmation = await page.evaluate(() => ({
        pill: document.querySelector(".status-pill .text")?.textContent,
        yours: [...document.querySelectorAll(".rail .rail-step")].filter((s) => s.dataset.state === "yours").map((s) => ({ step: s.dataset.step, text: s.textContent, bg: getComputedStyle(s.querySelector(".rail-turn"), "::before").backgroundColor })),
        accent: (() => { const p = document.createElement("span"); p.style.color = "var(--vc-accent)"; document.body.appendChild(p); const c = getComputedStyle(p).color; p.remove(); return c; })()
      }));
      if (plan.confirm === "rejected") await page.click('.cluster-modal [data-action="reject"]');
      else if (plan.confirm === "split") {
        for (const box of await page.$$('.cluster-col[data-plant="3010"] input[type="checkbox"]')) await box.uncheck();
        await page.click('.cluster-modal [data-action="split"]');
      } else await page.click('.cluster-modal [data-action="confirm"]');
    }
    const rec = await page.$('.option-card[data-recommended="true"][data-status=""] [data-action="approve"]');
    if (rec) {
      seen.options = true;
      if (plan.option === "accept") {
        await page.selectOption(".accept-reason", { index: 1 });
        await page.click('.option-card[data-kind="accept"] [data-action="accept"]');
      } else if (plan.option === "reject-then-approve" && !rejected) {
        rejected = true;
        await page.click('.option-card[data-recommended="true"] [data-action="reject"]');
        await page.waitForSelector('.option-card[data-recommended="true"][data-status="rejected"]', { timeout: 10000 });
        const other = await page.$('.option-card[data-recommended="false"][data-kind="option"][data-status=""] [data-action="approve"]');
        await other.click();
      } else await rec.click();
    }
    for (const b of await page.$$('.action-card[data-status="pending"] [data-action="approve"]')) await b.click().catch(() => {});
    const st = await status(page);
    if (/Done|Error|Aborted|Stopped/.test(st)) break;
    if (Date.now() - t0 > 120000) { expect(name, "the run finishes within two minutes", false, st); break; }
  }
  const outcome = await page.evaluate(async () => { const m = await import("./js/audit.js"); const doc = JSON.parse(m.buildAuditExport()); return [...doc.events].reverse().find((e) => e.type === "report")?.payload?.outcome || null; });
  return { ...t, outcome, keyAsked, seen, end: await status(page) };
}

async function done(name, t) {
  const csp = await t.page.evaluate(() => window.__csp).catch(() => []);
  expect(name, "no key asked", !t.keyAsked);
  expect(name, "fully offline: no request to another host", t.log.external.length === 0, t.log.external.join(" | "));
  expect(name, "no page error", t.log.pageErrors.length === 0, t.log.pageErrors.join(" | "));
  expect(name, "no console error", t.log.consoleErrors.length === 0, t.log.consoleErrors.join(" | "));
  expect(name, "no policy violation", csp.length === 0, csp.join(" | "));
  const texts = await t.page.evaluate(() => [...window.__texts]);
  await t.context.close();
  return texts;
}

const SCENARIOS = D.SCENARIOS.map((s) => s.id);
const groupOf = (id) => (id === "SC-CONSULT" ? "CL-01" : REF[id].group_id);
const allTexts = [];

// ---- paths: AC-12 ----------------------------------------------------------------------------------
if (wanted("paths")) {
  let runs = 0;
  for (const sc of SCENARIOS) {
    const plans = sc === "SC-BOXES" ? ["recommended"] : ["recommended", "reject-then-approve", "accept"];
    for (const option of plans) {
      const name = `paths ${sc} ${option}`;
      const t = await play(sc, { option, confirm: "confirmed" }, name);
      runs += 1;
      const a = A[groupOf(sc)];
      expect(name, "the run completes", /Done/.test(t.end), t.end);
      const want = sc === "SC-BOXES" ? "nothing_found" : option === "accept" ? "variance_accepted" : "option_approved";
      expect(name, `the report's outcome is ${want}`, t.outcome === want, t.outcome);
      expect(name, "options were on screen (or none for the honest negative)", t.seen.options === (sc !== "SC-BOXES"));
      // Figures recomputed at playback equal the engine's: the tile, the board's caption, every pair.
      const tile = await t.page.$eval("#kpi-identified-value", (e) => e.textContent);
      expect(name, "the identified tile equals the engine's opportunity", tile.startsWith(a.flagged ? eur(a.opportunity) : "€0"), `${tile} vs ${eur(a.opportunity)}`);
      const ladder = await t.page.$$eval(".ladder .ladder-row", (els) => els.map((e) => ({ pair: e.dataset.pair, price: Number(e.dataset.price), unexplained: Number(e.dataset.unexplained) })));
      const pairsOk = ladder.length === a.pairs.length && ladder.every((r) => { const p = a.pairs.find((x) => x.id === r.pair); return p && Math.abs(p.price - r.price) <= 1e-9 && Math.abs(p.unexplained - r.unexplained) <= 1e-9; });
      expect(name, "the ladder equals the engine's pairs", pairsOk, JSON.stringify(ladder).slice(0, 200));
      if (a.benchmark) expect(name, "the board names the engine's benchmark", await t.page.$eval(".board-sub", (e, s) => e.textContent.includes(s), unitPrice(a.benchmark.price, a.display_quantity, a.base_unit)));
      allTexts.push(...await done(name, t));
    }
  }
  console.log(`paths: ${runs} runs`);
  global.__runs = runs;
}

// ---- confirmation: AC-10 ------------------------------------------------------------------------------
if (wanted("confirmation")) {
  for (const confirm of ["confirmed", "split", "rejected"]) {
    const name = `confirmation ${confirm}`;
    const t = await play("SC-CONSULT", { option: "recommended", confirm }, name);
    const c = t.seen.confirmation;
    expect(name, "the cluster dialog opened", !!c);
    expect(name, "the status tag says Awaiting your confirmation", c?.pill === "Awaiting your confirmation", c?.pill);
    expect(name, "Your confirmation sits on the furthest step reached, Check", c?.yours.length === 1 && c.yours[0].step === "check" && /Your confirmation/.test(c.yours[0].text), JSON.stringify(c?.yours));
    expect(name, "the turn is merlot (Vici's accent: the person in charge)", !!c?.yours[0] && c.yours[0].bg === c.accent, `${c?.yours[0]?.bg} vs ${c?.accent}`);
    const rail = await t.page.evaluate(() => window.__rail);
    const back = rail.findIndex((r, i) => i > 0 && r.reached < rail[i - 1].reached && r.reached !== -1);
    expect(name, "the rail never moves back", back === -1, back >= 0 ? JSON.stringify(rail.slice(Math.max(0, back - 2), back + 1)) : "");
    expect(name, "the run completes", /Done/.test(t.end), t.end);
    const want = confirm === "rejected" ? "stopped" : "option_approved";
    expect(name, `the outcome follows the answer (${want})`, t.outcome === want, t.outcome);
    if (confirm === "split") {
      const lines = await t.page.evaluate(async () => { const m = await import("./js/audit.js"); return JSON.parse(m.buildAuditExport()).events.find((e) => e.type === "confirmation_decision")?.payload?.line_ids?.length; });
      expect(name, "the split confirms only the lines still ticked", lines === REF["SC-CONSULT"].cluster.line_ids.length - 3, lines);
    }
    allTexts.push(...await done(name, t));
  }
}

// ---- words: AC-15 ----------------------------------------------------------------------------------
if (wanted("words")) {
  if (!allTexts.length) {
    for (const sc of SCENARIOS) {
      const t = await play(sc, { option: "recommended", confirm: "confirmed" }, `words ${sc}`);
      allTexts.push(...await done(`words ${sc}`, t));
    }
    const t = await play("SC-GLOVES", { option: "accept", confirm: "confirmed" }, "words accept");
    allTexts.push(...await done("words accept", t));
  }
  const texts = [...new Set(allTexts)];
  const saved = texts.filter((x) => /\bsaved\b|\bsavings? (?:achieved|realised)\b/i.test(x));
  expect("words", "no tile, card or label reads saved", saved.length === 0, saved.slice(0, 3).join(" | "));
  const realised = texts.filter((x) => /\brealis/i.test(x) && !/realised to date/i.test(x) && !/^Realised\b/.test(x));
  expect("words", "realised appears only as realised to date (the past case's later order lines)", realised.length === 0, realised.slice(0, 3).join(" | "));
  const approvedTiles = texts.filter((x) => /^Approved savings/.test(x));
  expect("words", "the approved savings tile always reads a year and realised to date", approvedTiles.length > 0 && approvedTiles.every((x) => /a year/.test(x) && /realised to date/.test(x)), approvedTiles.slice(0, 2).join(" | "));
  const cards = texts.filter((x) => /Savings a year/.test(x));
  expect("words", "option cards state savings a year", cards.length > 0);
  checks += texts.length > 0 ? 0 : 0;
}

// ---- timing: AC-21 -----------------------------------------------------------------------------------
if (wanted("timing")) {
  const demo = D.SCENARIOS.find((x) => x.start_here);
  expect("timing", "exactly one scenario is marked as the demo's start", D.SCENARIOS.filter((x) => x.start_here).length === 1 && !!demo);
  const t = await newPage();
  const { page } = t;
  await page.click(`.scenario-pick__item[data-id="${demo.id}"]`);
  const tag = await page.$eval(`.scenario-pick__item[data-id="${demo.id}"]`, (e) => e.textContent);
  expect("timing", "the console marks it Start here", /Start here/.test(tag), tag);
  await page.click("button[aria-label='Replay speed ×1']");
  await page.click("#btn-start");
  const t0 = Date.now();
  await page.click('.mode-card[data-mode="simulation"] .mode-cta button');
  await page.waitForSelector('.option-card[data-recommended="true"] [data-action="approve"]', { timeout: 120000 });
  const atDecision = (Date.now() - t0) / 1000;
  await page.click('.option-card[data-recommended="true"] [data-action="approve"]');
  for (let i = 0; i < 20; i += 1) {
    if (/Done/.test(await status(page))) break;
    const b = await page.waitForSelector('.action-card[data-status="pending"] [data-action="approve"]', { timeout: 60000 }).catch(() => null);
    if (b) await b.click().catch(() => {});
    await page.waitForTimeout(300);
  }
  const end = await waitEnd(page, 180000);
  const atEnd = (Date.now() - t0) / 1000;
  expect("timing", "the run completes at ×1", /Done/.test(end), end);
  expect("timing", `the decision waits within 45 s of Start (${atDecision.toFixed(1)} s)`, atDecision <= 45, atDecision.toFixed(1));
  expect("timing", `the run ends within 150 s of Start (${atEnd.toFixed(1)} s)`, atEnd <= 150, atEnd.toFixed(1));
  console.log(`timing: ${demo.id} at ×1: decision after ${atDecision.toFixed(1)} s, Done after ${atEnd.toFixed(1)} s`);
  await done("timing", t);
}

await browser.close();
await close();
for (const f of failures) console.log(`FAIL  ${f}`);
const label = ONLY.length ? ONLY.join(" ") : "paths confirmation words timing";
if (failures.length) { console.log(`SIMS FAILED: ${failures.length} of ${checks} checks`); process.exit(1); }
console.log(ONLY.length === 1 && ONLY[0] === "paths" ? `SIMS OK: paths (${global.__runs} runs, ${checks} checks)` : `SIMS OK: ${label} (${checks} checks)`);
