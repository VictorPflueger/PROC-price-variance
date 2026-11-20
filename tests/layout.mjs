// Layout checks for a room and a laptop (AC-17), in both themes:
//   viewports  at 1920×1080, 1600×900, 1536×864, 1366×768 and 1280×720, in every main state (idle; a
//              decision waiting with the drawer open; the full ladder with a pair's lines and a line's
//              normalisation open; the outbox; the run's end with the report; the tables, the drawer open
//              and hidden; scenario 2's cluster dialog; the portfolio after a sweep; the Method dialog;
//              scenario 5's decision and its tender approved): no horizontal overflow, and nothing on the
//              board or the tiles scrolling sideways; nothing on the board or the tiles cut to an ellipsis
//              or a clamp; the ladder's texts inside the ladder, its row labels clear of the plot and its
//              values clear of the marks; the header's badges clear of the tiles, the header within 140 px
//              and the control bar on one row; at a decision, the recommended Approve in view and every
//              showing card's actions with it; in the cluster dialog, the evidence, the base unit and the
//              buttons in view (the review's R7 to R10)
//   targets    every visible interactive element at least 40 px high and wide at 1920×1080 and
//              1280×720, in every state above plus the intro, the scenario menu, the mode and key
//              dialogs, the audit tab and Diagnostics (a checkbox inside its label counts as the label;
//              a link inside a sentence is part of the prose)
//   controls   the negative control: a planted overflow, a planted ellipsis on the board, a planted small
//              target, a table scrolling sideways on the board, a decision and the cluster dialog's
//              evidence pushed out of view are each caught by the same measurements
// Usage: node tests/layout.mjs [case…]
import path from "node:path";
import { writeFile } from "node:fs/promises";
import { APP_ROOT, ONLY, outDir, wanted, launchBrowser, serveStatic, NETWORK_NOISE, SKIP_INTRO } from "./lib/harness.mjs";

const CASES = ["viewports", "targets", "controls"];
const unknown = ONLY.filter((c) => !CASES.includes(c));
if (unknown.length) { console.error(`Unknown case(s): ${unknown.join(", ")}. Cases: ${CASES.join(", ")}`); process.exit(2); }

const OUT = await outDir("layout");
const { base: BASE, close } = await serveStatic(APP_ROOT, 8774);
const browser = await launchBrowser();
const VIEWPORTS = [[1920, 1080], [1600, 900], [1536, 864], [1366, 768], [1280, 720]];
let checks = 0;
const failures = [];
const check = (what, ok, detail = "") => { checks += 1; if (!ok) failures.push(`${what}${detail ? `: ${String(detail).slice(0, 600)}` : ""}`); };

async function newPage({ width = 1920, height = 1080, theme = "light" } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme });
  await context.addInitScript(SKIP_INTRO);
  await context.addInitScript((t) => { try { localStorage.setItem("vc-theme", t); } catch { /* none */ } }, theme);
  const outside = [];
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => { outside.push(route.request().url()); route.abort("blockedbyclient"); });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  page.on("console", (m) => { if (m.type() === "error" && !NETWORK_NOISE.test(m.text())) errors.push(m.text()); });
  await page.goto(BASE);
  await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
  // Measure with the page's own fonts, not a fallback still on screen while they load.
  await page.evaluate(() => document.fonts.ready);
  return { context, page, errors, outside };
}
async function done(s, label) {
  check(`${label}: no page error`, s.errors.length === 0, s.errors.join(" | "));
  check(`${label}: no request to another host`, s.outside.length === 0, s.outside.join(" | "));
  await s.context.close();
}

/** Waits until entrance animations and transitions have settled. */
async function settle(page, ms = 350) {
  await page.waitForTimeout(ms);
  await page.waitForFunction(() => document.getAnimations().filter((a) => a.effect?.getComputedTiming?.().iterations !== Infinity).every((a) => a.playState !== "running"), null, { timeout: 4000 }).catch(() => {});
}

/** What breaks the layout on screen now (an empty list when nothing does). */
function layoutProblems() {
  const out = [];
  const shown = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden" && !el.closest("[hidden]");
  const name = (el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${el.classList?.length ? `.${[...el.classList].slice(0, 2).join(".")}` : ""}`;
  if (document.documentElement.scrollWidth > innerWidth + 1) out.push(`horizontal overflow: ${document.documentElement.scrollWidth} px in ${innerWidth} px`);
  // Nothing on the board or the tiles cut to an ellipsis or clamped.
  for (const root of [document.getElementById("board"), document.getElementById("kpis")]) {
    if (!root) continue;
    for (const el of root.querySelectorAll("*")) {
      if (el instanceof SVGElement || !shown(el)) continue;
      const cs = getComputedStyle(el);
      const ellipsis = cs.textOverflow === "ellipsis" && cs.overflowX !== "visible" && el.scrollWidth > el.clientWidth + 1;
      const clamp = cs.webkitLineClamp && cs.webkitLineClamp !== "none" && el.scrollHeight > el.clientHeight + 1;
      if (ellipsis || clamp) out.push(`${name(el)} cut (${ellipsis ? "ellipsis" : "clamp"}): "${el.textContent.trim().replace(/\s+/g, " ").slice(0, 60)}"`);
    }
  }
  // Nothing on the board or the tiles scrolls sideways: a table wider than its board hides figures behind a
  // scroll (review R8).
  for (const root of [document.getElementById("board"), document.getElementById("kpis")]) {
    if (!root) continue;
    for (const el of [root, ...root.querySelectorAll("*")]) {
      if (el instanceof SVGElement || !shown(el)) continue;
      if (/(auto|scroll)/.test(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth + 1) out.push(`${name(el)} scrolls sideways (${el.scrollWidth} px in ${el.clientWidth} px)`);
    }
  }
  // A control in view: its centre on screen and not covered by anything else.
  const inView = (el) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const x = r.left + r.width / 2; const y = r.top + r.height / 2;
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false;
    const hit = document.elementFromPoint(x, y);
    return !!hit && (hit === el || el.contains(hit));
  };
  // A decision waiting: the recommended option's Approve is in view, and so are the actions of every
  // option card that shows at all (review R9).
  const drawerBody = document.querySelector('#drawer[data-open="true"] .drawer-body');
  const optionsPanel = document.getElementById("panel-options");
  if (drawerBody && optionsPanel && shown(optionsPanel)) {
    const B = drawerBody.getBoundingClientRect();
    const pending = [...optionsPanel.querySelectorAll('.option-card[data-status=""]')];
    const rec = optionsPanel.querySelector('.option-card[data-recommended="true"][data-status=""] [data-action="approve"]');
    if (rec && !inView(rec)) out.push("decision: the recommended option's Approve is out of view");
    for (const card of pending) {
      const r = card.getBoundingClientRect();
      if (r.bottom <= B.top + 1 || r.top >= B.bottom - 1) continue;
      for (const b of card.querySelectorAll('.option-actions button, .option-actions select')) if (!inView(b)) out.push(`decision: option ${card.dataset.option} shows but its "${(b.textContent || b.getAttribute("aria-label") || "").trim().slice(0, 20)}" is out of view`);
    }
  }
  // The cluster dialog: the evidence, the base unit and the buttons are in view with the dialog's first
  // screen, before any scrolling (review R10).
  const cluster = document.querySelector(".cluster-modal");
  if (cluster && shown(cluster)) {
    for (const sel of [".cluster-evidence li:last-child", ".cluster-base .cluster-base__option:last-child", '[data-action="confirm"]', '[data-action="reject"]']) {
      const el = cluster.querySelector(sel);
      if (el && !inView(el)) out.push(`cluster dialog: ${sel} is out of view`);
    }
  }
  // The ladder: texts inside it, row labels clear of the plot, values clear of the row's marks.
  const svg = document.querySelector("#board svg.ladder");
  if (svg && shown(svg)) {
    const S = svg.getBoundingClientRect();
    const scale = S.width / (svg.viewBox.baseVal?.width || S.width);
    const plotLeft = S.left + Number(svg.dataset.plotLeft || 0) * scale;
    for (const t of svg.querySelectorAll("text")) {
      const r = t.getBoundingClientRect();
      if (!r.width) continue;
      if (r.left < S.left - 1 || r.right > S.right + 1 || r.top < S.top - 1 || r.bottom > S.bottom + 1) out.push(`ladder text outside the ladder: "${t.textContent.slice(0, 40)}"`);
    }
    for (const row of svg.querySelectorAll(".ladder-row")) {
      const label = row.querySelector(".row-label")?.getBoundingClientRect();
      const tags = row.querySelector(".row-tags")?.getBoundingClientRect();
      for (const [nm, r] of [["label", label], ["tags", tags]]) if (r && r.width && r.right > plotLeft + 1) out.push(`row ${row.dataset.pair}: its ${nm} runs into the plot (${Math.round(r.right - plotLeft)} px)`);
      const values = [...row.querySelectorAll(".row-value")].map((v) => v.getBoundingClientRect()).filter((r) => r.width);
      const marks = [...row.querySelectorAll(".pair-hex, .line-hex, .gap-unexplained, .gap-justified")].map((m) => m.getBoundingClientRect()).filter((r) => r.width);
      const marksRight = Math.max(...marks.map((r) => r.right), -Infinity);
      for (const v of values) if (v.left < marksRight - 1) out.push(`row ${row.dataset.pair}: its value overlaps its marks (${Math.round(marksRight - v.left)} px)`);
    }
  }
  // Header: badges clear of the tiles, the header within its height, the control bar on one row.
  const kpis = document.getElementById("kpis")?.getBoundingClientRect();
  if (kpis) for (const b of document.querySelectorAll(".header-badges > *")) {
    const r = b.getBoundingClientRect();
    if (r.width && r.right > kpis.left - 4 && r.bottom > kpis.top && r.top < kpis.bottom) out.push(`header: ${name(b)} overlaps the tiles`);
  }
  const header = document.querySelector(".app-header")?.getBoundingClientRect();
  if (header && header.height > 140) out.push(`header grew to ${Math.round(header.height)} px`);
  const controls = document.getElementById("controls");
  if (controls) {
    // One row: every item's vertical extent overlaps every other's, and the bar keeps its height.
    const items = [...controls.children].filter(shown).map((c) => c.getBoundingClientRect()).filter((r) => r.height);
    const oneRow = Math.max(...items.map((r) => r.top)) < Math.min(...items.map((r) => r.bottom));
    if (!oneRow || controls.getBoundingClientRect().height > 72) out.push(`control bar wraps (${Math.round(controls.getBoundingClientRect().height)} px)`);
  }
  return out;
}

/** Every visible interactive element smaller than 40 × 40 px (an empty list when there is none). */
function smallTargets() {
  const sel = 'button, a[href], input, select, textarea, summary, [role="button"], [role="tab"], [role="menuitemradio"], [role="checkbox"], [tabindex]:not([tabindex="-1"])';
  const out = [];
  for (const el of document.querySelectorAll(sel)) {
    let target = el;
    // A checkbox or radio inside its label: the label is what a person clicks.
    if (el.tagName === "INPUT" && /checkbox|radio/.test(el.type) && el.closest("label")) target = el.closest("label");
    const r = target.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = getComputedStyle(target);
    if (cs.visibility === "hidden" || cs.display === "none" || el.closest("[hidden], [inert], .vc-visually-hidden")) continue;
    if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
    // A link inside a sentence is part of the prose.
    if (el.tagName === "A" && el.closest("p, li, td, .md, .report-body, .result-body")) continue;
    // The workspace's own containers (the console, the board canvas) take focus but are not targets.
    if (el.matches("#console, .board-canvas, .log, .drawer-body, .pop-title, .modal-title, [role=\"dialog\"], [role=\"img\"]")) continue;
    if (r.height < 40 - 0.5 || r.width < 40 - 0.5) out.push(`${el.tagName.toLowerCase()}${el.getAttribute("role") ? `[${el.getAttribute("role")}]` : ""} "${(el.getAttribute("aria-label") || el.innerText || el.title || el.className?.baseVal || el.className || "").toString().trim().replace(/\s+/g, " ").slice(0, 40)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  return [...new Set(out)];
}

const measure = (page) => page.evaluate(layoutProblems);
const small = (page) => page.evaluate(smallTargets);

async function startSimulation(page, scenario) {
  await page.click(`.scenario-pick__item[data-id="${scenario}"]`);
  await page.click("button[aria-label='Replay speed ×4']");
  await page.click("#btn-start");
  await page.click('.mode-card[data-mode="simulation"] .mode-cta button');
}
async function toDecision(page) {
  await startSimulation(page, "SC-GLOVES");
  await page.waitForSelector('.option-card[data-recommended="true"] [data-action="approve"]', { timeout: 90000 });
  await page.waitForFunction(() => /Awaiting your decision/.test(document.querySelector(".status-pill .text")?.textContent || ""), null, { timeout: 30000 });
}
async function hideDrawer(page) {
  if ((await page.getAttribute("#drawer", "data-open")) === "true") await page.click(".drawer-toggle");
  await page.waitForFunction(() => {
    const h = Math.round(document.querySelector(".board-canvas")?.getBoundingClientRect().height || 0);
    const same = window.__canvasH === h; window.__canvasH = h; return same;
  }, null, { polling: 200, timeout: 5000 }).catch(() => {});
}
async function openFirstLine(page) {
  const row = await page.$(".ladder .ladder-row[data-above='true']") || await page.$(".ladder .ladder-row");
  await row.click();
  await page.waitForSelector(".board-pop .pop-line", { timeout: 5000 });
  return page;
}
async function toOutbox(page) {
  await page.click('.option-card[data-recommended="true"] [data-action="approve"]');
  await page.waitForSelector('.action-card[data-status="pending"] [data-action="approve"]', { timeout: 60000 });
  await page.waitForFunction(() => /Awaiting your approval/.test(document.querySelector(".status-pill .text")?.textContent || ""), null, { timeout: 30000 });
}
async function toEnd(page) {
  // Each approval redraws the outbox, so approve the first pending draft until none is left.
  for (let i = 0; i < 12; i += 1) {
    const b = await page.$('.action-card[data-status="pending"] [data-action="approve"]');
    if (!b) break;
    await b.click().catch(() => {});
    await page.waitForTimeout(250);
  }
  await page.waitForFunction(() => /Done/.test(document.querySelector(".status-pill .text")?.textContent || ""), null, { timeout: 60000 });
}
async function sweep(page) {
  await page.evaluate(async () => {
    const { createToolbox } = await import("./js/tools.js");
    const { bus } = await import("./js/events.js");
    const { DEFAULTS } = await import("./js/params.js");
    let phase = "scanning";
    const tb = createToolbox({
      world: window.WORLD, fx: window.FX, params: DEFAULTS, emit: (type, payload) => bus.emit(type, payload),
      waitUntil: async () => {}, takeDecision: () => null, drafts: new Map(), onPhase: (p) => { phase = p; }, getPhase: () => phase,
      isEnded: () => false, signal: new AbortController().signal, ecbRate: async () => ({ error: "offline" }), mode: "live", entry: "sweep"
    });
    await tb.call("layout-1", "pv_scan", {});
  });
  await page.waitForSelector("#board .bars:not(.pipeline) .bar-row", { timeout: 5000 });
}

/** Measures the page at every viewport (resizing it), records the problems, restores 1920 × 1080. */
async function atEveryViewport(page, label, theme) {
  for (const [w, h] of VIEWPORTS) {
    await page.setViewportSize({ width: w, height: h });
    await settle(page);
    const p = await measure(page);
    check(`${theme} ${w}×${h} ${label}`, p.length === 0, p.join("; "));
    if (p.length) await page.screenshot({ path: path.join(OUT, `fail-${theme}-${w}x${h}-${label.replace(/\W+/g, "-")}.png`) });
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await settle(page);
}

try {
  if (wanted("viewports")) {
    for (const theme of ["light", "dark"]) {
      {
        const s = await newPage({ theme });
        const { page } = s;
        await atEveryViewport(page, "idle", theme);
        await toDecision(page);
        await atEveryViewport(page, "decision (drawer open)", theme);
        await hideDrawer(page);
        await atEveryViewport(page, "full ladder", theme);
        await openFirstLine(page);
        await atEveryViewport(page, "full ladder, a pair's lines open", theme);
        await page.keyboard.press("Escape");
        await page.click("#tab-options").catch(() => {});
        await toOutbox(page);
        await atEveryViewport(page, "outbox", theme);
        await toEnd(page);
        await atEveryViewport(page, "run's end", theme);
        await page.click(".table-toggle");
        await atEveryViewport(page, "group tables", theme);
        await hideDrawer(page);
        await atEveryViewport(page, "group tables, drawer hidden", theme);
        await page.click('.board-tools button[data-view="portfolio"]');
        await atEveryViewport(page, "portfolio tables", theme);
        await page.click(".table-toggle");
        await page.click("#btn-method");
        await page.waitForSelector(".method-modal", { timeout: 5000 });
        await atEveryViewport(page, "Method dialog", theme);
        await page.keyboard.press("Escape");
        await done(s, `${theme} scenario 1`);
      }
      {
        const s = await newPage({ theme });
        await startSimulation(s.page, "SC-CONSULT");
        await s.page.waitForSelector(".cluster-modal", { timeout: 90000 });
        await atEveryViewport(s.page, "cluster dialog", theme);
        await done(s, `${theme} scenario 2`);
      }
      {
        const s = await newPage({ theme });
        await sweep(s.page);
        await atEveryViewport(s.page, "portfolio after a sweep", theme);
        await done(s, `${theme} sweep`);
      }
      {
        // A tender approved: the approved savings tile names its bundle discount (review R7).
        const s = await newPage({ theme });
        await startSimulation(s.page, "SC-PALLETS");
        await s.page.waitForSelector('.option-card[data-option="B"] [data-action="approve"]', { timeout: 90000 });
        await atEveryViewport(s.page, "scenario 5's decision (drawer open)", theme);
        await s.page.click('.option-card[data-option="B"] [data-action="approve"]');
        await s.page.waitForFunction(() => /bundle discount/.test(document.getElementById("kpi-approved-sub")?.textContent || ""), null, { timeout: 30000 });
        const sub = await s.page.$eval("#kpi-approved-sub", (e) => e.textContent);
        check(`${theme} bundle approved: the bundle discount is part of the approved figure, named before the later stages`, /^incl\. €[\d,]+ bundle discount; €[\d,]+ implemented · €[\d,]+ realised to date$/.test(sub), sub);
        await atEveryViewport(s.page, "bundle approved", theme);
        await done(s, `${theme} scenario 5`);
      }
    }
  }

  if (wanted("targets")) {
    for (const [w, h] of [[1920, 1080], [1280, 720]]) {
      const audit = async (page, label) => {
        await settle(page, 300);
        const list = await small(page);
        check(`targets ${w}×${h} ${label}`, list.length === 0, list.join("; "));
      };
      {
        const s = await newPage({ width: w, height: h });
        const { page } = s;
        await audit(page, "idle");
        await page.click("#btn-about");
        await page.waitForSelector(".intro-modal");
        await audit(page, "intro");
        await page.keyboard.press("Escape");
        await page.waitForSelector(".intro-modal", { state: "detached" });
        await page.click("#dd-scenario");
        await audit(page, "scenario menu");
        await page.keyboard.press("Escape");
        await page.click("#btn-start");
        await page.waitForSelector(".mode-card");
        await audit(page, "mode dialog");
        await page.click('.mode-card[data-mode="live"] .mode-cta button');
        await page.waitForSelector("#api-key-input");
        await audit(page, "key dialog");
        await page.keyboard.press("Escape");
        await page.waitForSelector("#api-key-input", { state: "detached" });
        await page.click("#btn-method");
        await page.waitForSelector(".method-modal");
        await audit(page, "Method dialog");
        await page.keyboard.press("Escape");
        await page.click("#tab-audit");
        await audit(page, "audit tab");
        await page.click("#btn-diagnostics");
        await page.waitForSelector(".diag-table", { timeout: 5000 });
        await audit(page, "Diagnostics");
        await page.keyboard.press("Escape");
        await page.click(".drawer-toggle").catch(() => {});
        await toDecision(page);
        await audit(page, "options");
        await hideDrawer(page);
        await audit(page, "full ladder");
        await openFirstLine(page);
        await audit(page, "a pair's lines");
        await page.click(".board-pop .pop-line");
        await page.waitForSelector(".board-pop .norm-steps", { timeout: 5000 });
        await audit(page, "a line's normalisation");
        await page.keyboard.press("Escape");
        await page.click("#tab-options").catch(() => {});
        await toOutbox(page);
        await audit(page, "outbox");
        await toEnd(page);
        await page.click('button:has-text("Open the report")');
        await page.waitForSelector(".report-modal");
        await audit(page, "report");
        await page.keyboard.press("Escape");
        await page.click(".table-toggle");
        await audit(page, "group tables");
        await page.click('.board-tools button[data-view="portfolio"]');
        await page.click(".table-toggle");
        await audit(page, "portfolio");
        await done(s, `targets ${w}×${h} scenario 1`);
      }
      {
        const s = await newPage({ width: w, height: h });
        await startSimulation(s.page, "SC-CONSULT");
        await s.page.waitForSelector(".cluster-modal", { timeout: 90000 });
        await audit(s.page, "cluster dialog");
        await done(s, `targets ${w}×${h} scenario 2`);
      }
      {
        const s = await newPage({ width: w, height: h });
        await sweep(s.page);
        await audit(s.page, "portfolio after a sweep");
        await done(s, `targets ${w}×${h} sweep`);
      }
    }
  }

  if (wanted("controls")) {
    const s = await newPage({ width: 1280, height: 720 });
    const { page } = s;
    check("controls: the page is clean before anything is planted", (await measure(page)).length === 0 && (await small(page)).length === 0, JSON.stringify([...(await measure(page)), ...(await small(page))]));
    await page.evaluate(() => { const d = document.createElement("div"); d.id = "planted-wide"; d.style.width = "1500px"; d.style.height = "4px"; document.querySelector(".controls").after(d); });
    check("controls: a planted overflow is caught", (await measure(page)).some((p) => /horizontal overflow/.test(p)));
    await page.evaluate(() => document.getElementById("planted-wide").remove());
    await page.evaluate(() => {
      const sp = document.createElement("span");
      sp.id = "planted-cut";
      sp.textContent = "A label far too long for its box on the board";
      Object.assign(sp.style, { display: "block", width: "60px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" });
      document.querySelector("#board .board-caption").appendChild(sp);
    });
    check("controls: a planted ellipsis on the board is caught", (await measure(page)).some((p) => /cut \(ellipsis\)/.test(p)));
    await page.evaluate(() => document.getElementById("planted-cut").remove());
    await page.evaluate(() => { const b = document.createElement("button"); b.id = "planted-small"; b.textContent = "x"; Object.assign(b.style, { width: "20px", height: "20px", padding: "0" }); document.querySelector(".controls").appendChild(b); });
    check("controls: a planted small target is caught", (await small(page)).some((p) => /20×20/.test(p)));
    await page.evaluate(() => document.getElementById("planted-small").remove());
    // The review's checks: a table scrolling sideways on the board, a decision out of view, the cluster
    // dialog's evidence pushed out of view.
    await page.evaluate(() => {
      const box = document.createElement("div");
      box.id = "planted-scroll";
      Object.assign(box.style, { overflowX: "auto", width: "200px" });
      const wide = document.createElement("div");
      Object.assign(wide.style, { width: "400px", height: "4px" });
      box.appendChild(wide);
      document.querySelector("#board .board-caption").appendChild(box);
    });
    check("controls: a planted table scrolling sideways on the board is caught", (await measure(page)).some((p) => /scrolls sideways/.test(p)));
    await page.evaluate(() => document.getElementById("planted-scroll").remove());
    await toDecision(page);
    await settle(page);
    check("controls: at a decision the recommended Approve is in view", !(await measure(page)).some((p) => /^decision:/.test(p)), (await measure(page)).join("; "));
    await page.evaluate(() => { document.querySelector('#drawer .drawer-body').scrollTop = 0; const pad = document.createElement("div"); pad.id = "planted-pad"; pad.style.height = "900px"; document.getElementById("panel-options").prepend(pad); });
    check("controls: a decision pushed out of view is caught", (await measure(page)).some((p) => /^decision: the recommended option's Approve is out of view/.test(p)));
    await done(s, "controls");
    const c = await newPage({ width: 1280, height: 720 });
    await startSimulation(c.page, "SC-CONSULT");
    await c.page.waitForSelector(".cluster-modal", { timeout: 90000 });
    await settle(c.page);
    check("controls: the cluster dialog shows its evidence, base unit and buttons at 1280 × 720", !(await measure(c.page)).some((p) => /^cluster dialog/.test(p)), (await measure(c.page)).join("; "));
    await c.page.evaluate(() => { const pad = document.createElement("div"); pad.style.height = "900px"; document.querySelector(".cluster-modal .cluster-proposal").before(pad); });
    check("controls: the cluster dialog's evidence pushed out of view is caught", (await measure(c.page)).some((p) => /^cluster dialog: \.cluster-evidence/.test(p)));
    await done(c, "controls (cluster)");
  }
} finally {
  await browser.close();
  await close();
}

await writeFile(path.join(OUT, "layout-results.json"), JSON.stringify({ checks, failures }, null, 2));
for (const f of failures) console.log(`FAIL  ${f}`);
if (failures.length) { console.log(`\nLAYOUT FAILED: ${failures.length} of ${checks} checks. Screenshots: ${OUT}`); process.exit(1); }
console.log(`LAYOUT OK: ${ONLY.length ? ONLY.join(" ") : CASES.join(" ")} (${checks} checks)`);
