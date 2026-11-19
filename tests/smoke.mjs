// Smoke test of version 0.1.0 in Chromium: the page boots from the data files with no page error, no
// policy violation and no request to another host; the engine runs in the page (the engine check lists
// every comparable group, the four planted ones flagged, and the approved-savings tile shows the value
// log's stages); the scenarios, the intro, the drawer and the keyboard work; every storage key is the
// app's own; and a missing data file is named on the boot screen.
// Usage: node tests/smoke.mjs            (all cases)
//        node tests/smoke.mjs boot intro (only these cases)
import { APP_ROOT, ONLY, wanted, launchBrowser, serveStatic, NETWORK_NOISE, SKIP_INTRO } from "./lib/harness.mjs";

const CASES = ["boot", "engine", "scenarios", "intro", "drawer", "keyboard", "storage", "missing"];
const unknown = ONLY.filter((c) => !CASES.includes(c));
if (unknown.length) { console.error(`Unknown case(s): ${unknown.join(", ")}. Cases: ${CASES.join(", ")}`); process.exit(2); }

let checks = 0;
const failures = [];
const check = (what, ok, detail = "") => { checks += 1; if (!ok) failures.push(`${what}${detail ? `: ${detail}` : ""}`); };

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

try {
  if (wanted("boot")) {
    const s = await open();
    await s.page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
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
    await close(s, "boot");
  }

  if (wanted("engine")) {
    const s = await open();
    await s.page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
    const t = await s.page.evaluate(() => ({
      rows: document.querySelectorAll(".engine-table tbody tr").length,
      flagged: [...document.querySelectorAll('.engine-table tbody tr[data-flagged="true"]')].map((r) => r.dataset.group),
      gloves: [...document.querySelectorAll('.engine-table tr[data-group="20001001"] > *')].map((c) => c.textContent),
      approved: document.querySelector("#kpi-approved-value")?.textContent,
      approvedSub: document.querySelector("#kpi-approved-sub")?.textContent,
      identified: document.querySelector("#kpi-identified-value")?.textContent,
      groups: window.WORLD && window.FX ? true : false
    }));
    check("engine: the engine check lists every comparable group", t.rows >= 60, `${t.rows}`);
    check("engine: the four planted groups are flagged, pallets first", JSON.stringify(t.flagged) === JSON.stringify(["20001006", "20001001", "20001003", "MPN:Brekholt:BH-7730-S3"]), t.flagged.join(", "));
    check("engine: the gloves at the benchmark €6.90 per 100 EA, spread 42.0 %", /€6\.90 per 100 EA/.test(t.gloves.join(" ")) && /42\.0%/.test(t.gloves.join(" ")), t.gloves.join(" | "));
    check("engine: approved savings a year, implemented and realised to date, from the value log", t.approved === "€11,400 a year" && t.approvedSub === "€8,000 implemented · €2,100 realised to date", `${t.approved} / ${t.approvedSub}`);
    check("engine: nothing is identified before a run", t.identified === "—", t.identified);
    await close(s, "engine");
  }

  if (wanted("scenarios")) {
    const s = await open();
    await s.page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
    const focus = () => s.page.evaluate(() => [...document.querySelectorAll('.engine-table tr[data-focus="true"]')].map((r) => r.dataset.group));
    check("scenarios: scenario 1 is chosen at the start and its group framed", JSON.stringify(await focus()) === JSON.stringify(["20001001"]));
    await s.page.selectOption("#scenario", "SC-PALLETS");
    check("scenarios: choosing pallets frames the pallets", JSON.stringify(await focus()) === JSON.stringify(["20001006"]));
    await s.page.click('.scenario-pick[data-scenario="SC-CONSULT"]');
    const note = await s.page.textContent(".board-note");
    check("scenarios: scenario 2 has no group before a person confirms the cluster, and says so",
      (await focus()).length === 0 && /confirms the cluster/.test(note) && (await s.page.inputValue("#scenario")) === "SC-CONSULT", note);
    const pressed = await s.page.evaluate(() => [...document.querySelectorAll('.scenario-pick[aria-pressed="true"]')].map((b) => b.dataset.scenario));
    check("scenarios: the console marks the chosen tip", JSON.stringify(pressed) === JSON.stringify(["SC-CONSULT"]), pressed.join(", "));
    const start = await s.page.evaluate(() => document.getElementById("btn-start").getAttribute("aria-disabled"));
    check("scenarios: Start agent waits for version 0.2.0", start === "true");
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
    await s.page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
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
    await s.page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
    const reached = new Set();
    for (let i = 0; i < 40; i += 1) {
      await s.page.keyboard.press("Tab");
      const id = await s.page.evaluate(() => document.activeElement?.id || document.activeElement?.dataset?.scenario || document.activeElement?.className || "");
      reached.add(id);
    }
    check("keyboard: Tab reaches the scenario chooser, How it works, the tips and the drawer's tabs",
      ["scenario", "btn-about", "SC-GLOVES", "SC-SHOES", "tab-options"].every((x) => [...reached].some((r) => String(r).includes(x))), [...reached].join(", "));
    await s.page.focus('.scenario-pick[data-scenario="SC-HOSES"]');
    await s.page.keyboard.press("Enter");
    check("keyboard: Enter on a tip chooses it", (await s.page.inputValue("#scenario")) === "SC-HOSES");
    await close(s, "keyboard");
  }

  if (wanted("storage")) {
    const s = await open({ intro: true });
    await s.page.waitForSelector(".intro-modal", { timeout: 20000 });
    await s.page.keyboard.press("Escape");
    await s.page.click(".theme-toggle");
    const keys = await s.page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)]);
    check("storage: every key the page writes is pv.* or Vici's vc-theme", keys.length >= 2 && keys.every((k) => k.startsWith("pv.") || k === "vc-theme"), keys.join(", "));
    await close(s, "storage");
  }

  if (wanted("missing")) {
    server.blockLocal.add("/data/fx.js");
    const s = await open();
    await s.page.waitForSelector('#boot[data-state="failed"]', { timeout: 20000 });
    const detail = await s.page.textContent("#boot-detail");
    check("missing: a missing data file is named on the boot screen", /data\/fx\.js/.test(detail), detail);
    server.blockLocal.delete("/data/fx.js");
    s.errors.length = 0; // the failed start-up logs its error on purpose
    await close(s, "missing");
  }
} finally {
  await server.close();
  await browser.close();
}

for (const f of failures) console.log(`FAIL  ${f}`);
if (failures.length) { console.log(`\nSMOKE FAILED: ${failures.length} of ${checks} checks`); process.exit(1); }
console.log(`SMOKE OK: ${ONLY.length ? ONLY.join(" ") : CASES.join(" ")} (${checks} checks)`);
