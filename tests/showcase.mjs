// The presenter in a browser, against the engine's own figures (computed here in Node, not read from
// the page's code). Cases, each runnable alone:
//   steps    five steps by click, the arrow keys, the number keys, Next and ?step=; the current step is
//            marked; the address follows; at most 12 controls on the first screen
//   kpis     four tiles marked data-vc-kpi, filled before anything happens with the engine's figures;
//            after the recommended option is approved: what is left, the approval, the clock stopped
//   decide   every way out of the gloves case: each option approved, the gap accepted with a reason;
//            the drafts each allows, one approved and one rejected, the outcome
//   cases    all six cases from the case menu and from ?case=, through every step, the consultants'
//            confirmation and the boxes' honest negative included: the engine's figure on the tile, no
//            unit codes, pair ids, line numbers, cluster ids or option letters, no em dash, no error
//   guide    opens by itself once per tab; every chapter fits 1280×720 and 1366×768 without scrolling;
//            the key figures' rows and the talk track carry the engine's figures; Vici's own browser
//            test of the guide (check-guide-render.mjs) passes against the page over http
//   layout   1920×1080, 1366×768 and 1280×720, light and dark, every step of the gloves case: no page
//            scroll, no panel that must scroll, nothing wider than its box, every target at least 24 px
// Usage: node tests/showcase.mjs [case…] [--require-vici]
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { APP_ROOT, wanted, launchBrowser, serveStatic, outDir, NETWORK_NOISE, REQUIRE_VICI, viciDir } from "./lib/harness.mjs";
import { analyseWorld, ratesOf } from "../js/world.js";
import { DRAFTS_BY_OPTION, DRAFT_LABELS } from "../js/drafts.js";

const OUT = await outDir("showcase");
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const f of ["fx.js", "world.js", "scenarios.js"]) vm.runInContext(readFileSync(path.join(APP_ROOT, "data", f), "utf8"), sandbox);
const { WORLD, FX, SCENARIOS } = sandbox.window;
const A = Object.fromEntries(analyseWorld(WORLD, ratesOf(FX)).analyses.map((a) => [a.id, a]));
const eur0 = (x) => `€${Math.round(x).toLocaleString("en-GB")}`;
const slug = (c) => c.short.toLowerCase();
const GLOVES = A["20001001"];

const server = await serveStatic(APP_ROOT, 8700 + Math.floor(Math.random() * 200));
const browser = await launchBrowser();
const failures = [];
let checks = 0;
const expect = (name, what, ok, detail = "") => { checks += 1; if (!ok) failures.push(`${name}: ${what}${detail !== "" ? ` (${String(detail).slice(0, 240)})` : ""}`); };

async function open(query = "", { size = [1600, 900], theme = "light", guide = false } = {}) {
  const context = await browser.newContext({ viewport: { width: size[0], height: size[1] }, colorScheme: theme });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort("blockedbyclient"));
  await context.addInitScript((t) => { try { localStorage.setItem("vc-theme", t); } catch { /* blocked */ } }, theme);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !NETWORK_NOISE.test(m.text())) errors.push(m.text()); });
  const sep = query ? "&" : "";
  await page.goto(`${server.base}?${query}${guide ? "" : `${sep}guide=0`}`);
  await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
  await settle(page);
  return { context, page, errors };
}
/** A child process run to its end without blocking this one: { status, stdout, stderr }. */
function run(cmd, args, opts, limit) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, opts);
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });
    const timer = setTimeout(() => child.kill("SIGKILL"), limit);
    child.on("close", (status) => { clearTimeout(timer); resolve({ status, stdout, stderr }); });
  });
}
/** Waits until the run has reached a step, after a person's answer lets it go on. */
const opened = (page, id) => page.waitForSelector(`#steps .vc-step[data-step="${id}"] .vc-step__button:not([disabled])`, { timeout: 15000 });
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const text = (page, sel) => page.locator(sel).innerText().then((t) => t.replace(/\s+/g, " ").trim());
const current = (page) => page.evaluate(() => document.querySelector("#steps .vc-step--current")?.dataset.step);
async function key(page, k) { await page.keyboard.press(k); await settle(page); }
async function approveRecommended(page) {
  await key(page, "4");
  await page.click(".option[data-recommended='true'] .option-approve");
  await settle(page);
}
/** Step 5: waits until every draft the decision allows is written, then decides them in order. */
async function decideDrafts(page, optionId, decisions = []) {
  await key(page, "5");
  const expected = DRAFTS_BY_OPTION[optionId].length;
  await page.waitForFunction((n) => document.querySelectorAll(".draft").length >= n, expected, { timeout: 15000 });
  for (let k = 0; k < 6; k++) {
    const pending = await page.locator(".draft[data-status='pending']").count();
    if (!pending) break;
    const reject = decisions[k] === "rejected";
    await page.locator(`.draft[data-status='pending'] .draft-actions .vc-button${reject ? ".vc-button--ghost" : ":not(.vc-button--ghost)"}`).first().click();
    await page.waitForFunction((n) => document.querySelectorAll(".draft[data-status='pending']").length < n, pending);
  }
  await settle(page);
}

// ---- steps ------------------------------------------------------------------------------------------
if (wanted("steps")) {
  const { context, page, errors } = await open("case=gloves");
  const controls = await page.evaluate(() => {
    const shown = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      const inView = r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
      return r.width > 1 && r.height > 1 && inView && s.visibility !== "hidden" && !el.closest("dialog:not([open]), [popover]:not(:popover-open)");
    };
    return [...document.querySelectorAll("button, a[href], input, select, textarea, [role=button], [role=menuitem]")].filter(shown).map((e) => (e.getAttribute("aria-label") || e.textContent).trim().replace(/\s+/g, " ").slice(0, 30));
  });
  expect("steps", "at most 12 controls on the first screen", controls.length <= 12, `${controls.length}: ${controls.join(" | ")}`);
  const ids = ["tip", "compare", "gap", "decide"];
  for (const [i, id] of ids.entries()) {
    await page.click(`#steps .vc-step[data-step="${id}"] .vc-step__button`);
    await settle(page);
    const aria = await page.getAttribute(`#steps .vc-step[data-step="${id}"] .vc-step__button`, "aria-current");
    expect("steps", `a click shows step ${i + 1} and marks it`, (await current(page)) === id && aria === "step");
    expect("steps", `the address names step ${i + 1}`, new URL(page.url()).searchParams.get("step") === id, page.url());
    expect("steps", `step ${i + 1}'s title takes the focus`, await page.evaluate(() => document.activeElement?.id === "story-title"));
  }
  // Next cannot pass an open decision: the drafts stay closed until the person decides.
  expect("steps", "at the open decision, Next and the drafts are closed and the decision's marker is merlot", (await page.isDisabled("#next")) && (await page.isDisabled('#steps .vc-step[data-step="drafts"] .vc-step__button')) && (await page.getAttribute('#steps .vc-step[data-step="decide"]', "data-waits")) === "true");
  await key(page, "5");
  expect("steps", "the 5 key stops at the open decision", (await current(page)) === "decide");
  await page.click(".option[data-recommended='true'] .option-approve");
  await settle(page);
  expect("steps", "the decision opens the drafts", !(await page.isDisabled('#steps .vc-step[data-step="drafts"] .vc-step__button')) && !(await page.isDisabled("#next")));
  await page.click('#steps .vc-step[data-step="drafts"] .vc-step__button');
  await settle(page);
  expect("steps", "a click shows step 5", (await current(page)) === "drafts");
  await key(page, "1");
  expect("steps", "the 1 key shows the tip", (await current(page)) === "tip");
  await key(page, "ArrowRight");
  expect("steps", "→ moves to Like for like", (await current(page)) === "compare");
  await key(page, "ArrowLeft");
  expect("steps", "← moves back to the tip", (await current(page)) === "tip");
  await page.click("#next");
  await settle(page);
  expect("steps", "Next moves on", (await current(page)) === "compare");
  expect("steps", "Next names the step it leads to", /Next: The gap/.test(await text(page, "#next")), await text(page, "#next"));
  await key(page, "3");
  expect("steps", "step 3 shows the gap at once", /€14,146 a year that no reason explains/.test(await text(page, "#story-title")), await text(page, "#story-title"));
  await context.close();
  const direct = await open("case=gloves&step=gap");
  expect("steps", "?step=gap opens on the gap", (await current(direct.page)) === "gap");
  const early = await open("case=gloves&step=drafts");
  expect("steps", "?step=drafts before a decision opens the decision", (await current(early.page)) === "decide");
  await early.context.close();
  expect("steps", "no error", !errors.length && !direct.errors.length, [...errors, ...direct.errors].join(" | "));
  await direct.context.close();
}

// ---- kpis -------------------------------------------------------------------------------------------
if (wanted("kpis")) {
  const { context, page, errors } = await open("case=gloves");
  const names = await page.$$eval("[data-vc-kpi]", (els) => els.map((e) => e.dataset.vcKpi));
  expect("kpis", "four tiles marked data-vc-kpi", names.join("|") === "Unexplained a year|Highest vs best price|Tip → decision|Session cost", names.join("|"));
  const values = await page.$$eval("[data-vc-kpi] .vc-stat__value", (els) => els.map((e) => e.innerText.replace(/\s+/g, " ").trim()));
  expect("kpis", "no tile is empty before anything happens", values.every((v) => v && !/^[—…-]$/.test(v)), values.join(" | "));
  expect("kpis", "Unexplained a year is the engine's opportunity", values[0] === eur0(GLOVES.opportunity), values[0]);
  expect("kpis", "Highest vs best price is the engine's spread", values[1] === `+${Math.round(GLOVES.spread * 100)} %`, values[1]);
  expect("kpis", "the unexplained gap shows in coral before a decision", (await page.getAttribute("#kpi-unexplained", "data-tone")) === "gap");
  expect("kpis", "the clock says it runs", (await text(page, "#kpi-clock-note")) === "running since the tip", await text(page, "#kpi-clock-note"));
  expect("kpis", "Session cost is an estimate between €0.01 and €1", /^≈ €0\.(0[1-9]|[1-9]\d)$/.test(values[3]), values[3]);
  const t0 = await text(page, "#kpi-clock-value");
  await page.waitForTimeout(2100);
  expect("kpis", "the clock runs from the tip", (await text(page, "#kpi-clock-value")) !== t0, t0);
  await approveRecommended(page);
  const H = GLOVES.options.H;
  const tile = await text(page, "#kpi-unexplained .vc-stat__value");
  expect("kpis", "after the approval: from the opportunity to what is left", tile.includes(eur0(GLOVES.opportunity)) && tile.endsWith(eur0(H.residual)), tile);
  expect("kpis", "the note says what was approved", (await text(page, "#kpi-unexplained-note")) === `${eur0(H.savings)} a year approved` && (await page.getAttribute("#kpi-unexplained", "data-tone")) === "done", await text(page, "#kpi-unexplained-note"));
  expect("kpis", "the decision log names it, with its time", /^Decision log: 1 entry$/.test(await text(page, "#log-summary")) && /\d\d:\d\d:\d\d You approved “Move Lyon and Duisburg to the contract supplier”/.test(await page.locator("#log-list").textContent()), await page.locator("#log").textContent());
  const stopped = await text(page, "#kpi-clock-value");
  await page.waitForTimeout(1600);
  expect("kpis", "the clock stops at the approval", (await text(page, "#kpi-clock-value")) === stopped && (await page.getAttribute("#kpi-clock", "data-tone")) === "done" && (await text(page, "#kpi-clock-note")) === "until your decision", stopped);
  expect("kpis", "no error", !errors.length, errors.join(" | "));
  await context.close();
}

// ---- decide -----------------------------------------------------------------------------------------
if (wanted("decide")) {
  for (const way of ["H", "R", "B", "accept"]) {
    const { context, page, errors } = await open("case=gloves");
    await key(page, "4");
    if (way === "accept") {
      await page.selectOption("#accept-reason", "supply security");
      await page.click(".option--accept .vc-button");
    } else {
      const titles = await page.$$eval(".option:not(.option--accept) .option-title", (els) => els.map((e) => e.firstChild.textContent));
      expect(`decide ${way}`, "three options on screen", titles.length === 3, titles.join(" | "));
      await page.click(`.option[data-option="${way}"] .option-approve`);
    }
    await settle(page);
    await decideDrafts(page, way, ["approved", "rejected"]);
    const kinds = await page.$$eval(".draft .draft-kind", (els) => els.map((e) => e.textContent));
    const allowed = DRAFTS_BY_OPTION[way].map((t) => DRAFT_LABELS[t]);
    expect(`decide ${way}`, "the drafts are the ones the decision allows", kinds.join("|") === allowed.join("|"), kinds.join("|"));
    const statuses = await page.$$eval(".draft", (els) => els.map((e) => e.dataset.status));
    expect(`decide ${way}`, "a draft takes an approval and the next a rejection", statuses[0] === "approved" && (statuses.length === 1 || statuses[1] === "rejected"), statuses.join(","));
    await page.waitForSelector(".outcome", { timeout: 10000 }).catch(() => {});
    const outcome = await page.locator(".outcome").innerText().catch(() => "");
    expect(`decide ${way}`, "the outcome follows the decision and nothing was sent", /^Report filed: .*Nothing was sent\.$/.test(outcome.trim()) && (way === "accept" ? /accepted/.test(outcome) : /approved/.test(outcome)), outcome);
    const log = await page.$$eval("#log-list li", (els) => els.map((e) => e.textContent.trim()));
    const kinds2 = statuses.length > 1 ? [`approved the ${kinds[0].toLowerCase()}`, `rejected the ${kinds[1].toLowerCase()}`] : [`approved the ${kinds[0].toLowerCase()}`];
    expect(`decide ${way}`, "the decision log has the decision and every draft, in order, with times", log.length === 1 + kinds2.length && log.every((l) => /^\d\d:\d\d:\d\d You /.test(l)) && kinds2.every((k, i) => log[i + 1].endsWith(k)) && (way === "accept" ? /accepted the gap: supply security$/.test(log[0]) : /approved “/.test(log[0])), log.join(" | "));
    const all = await page.evaluate(() => document.body.innerText);
    expect(`decide ${way}`, "nothing on screen calls an approval saved", !/\b(saved|saves|realised savings)\b/i.test(all.replace(/nothing was sent/gi, "")), (all.match(/.{20}\b(saved|saves)\b.{20}/i) || [])[0]);
    expect(`decide ${way}`, "no error", !errors.length, errors.join(" | "));
    await context.close();
  }
}

// ---- cases ------------------------------------------------------------------------------------------
if (wanted("cases")) {
  const FORBIDDEN = [[/—/, "an em dash"], [/\b\d{4} \/ \d{5}\b/, "a pair id"], [/\bper (100 |1,000 )?(EA|PD)\b/, "a unit code"], [/\b4500\d{6}-\d{5}\b/, "a line number"], [/\b(CL|CAND)-\d+\b/, "a cluster id"], [/\b[Oo]ption [HRB]\b/, "an option letter"]];
  for (const sc of SCENARIOS) {
    const name = `case ${slug(sc)}`;
    const { context, page, errors } = await open(`case=${slug(sc)}`);
    const seen = [];
    for (const k of ["1", "2"]) { await key(page, k); seen.push(await page.locator(".workspace").innerText()); }
    const confirm = await page.locator(".confirm-actions .vc-button").count();
    expect(name, sc.id === "SC-CONSULT" ? "the person confirms the cluster in step 2" : "no confirmation", sc.id === "SC-CONSULT" ? confirm === 2 : confirm === 0);
    if (confirm) {
      await page.locator(".confirm-actions .vc-button").first().click();
      await opened(page, "gap");
      seen.push(await page.locator(".workspace").innerText());
    }
    await key(page, "3");
    seen.push(await page.locator(".workspace").innerText());
    const title = await text(page, "#story-title");
    const group = sc.group_id ? A[sc.group_id] : null;
    if (group) {
      expect(name, "the gap is the engine's opportunity", title.includes(eur0(group.opportunity)), title);
      expect(name, "Unexplained a year on the tile is the engine's", (await text(page, "#kpi-unexplained-value")) === eur0(group.opportunity), await text(page, "#kpi-unexplained-value"));
      expect(name, group.flagged ? "a flagged gap" : "the honest negative says nothing is worth acting on", group.flagged ? /no reason explains/.test(title) : /^Nothing worth acting on/.test(title), title);
    } else expect(name, "the confirmed cluster's gap is in euros a year", /€[\d,]+ a year/.test(title), title);
    await key(page, "4");
    if (await page.locator(".option[data-recommended='true'] .option-approve").count()) {
      const id = await page.getAttribute(".option[data-recommended='true']", "data-option");
      await page.click(".option[data-recommended='true'] .option-approve");
      await settle(page);
      seen.push(await page.locator(".workspace").innerText());
      await decideDrafts(page, id);
    } else {
      seen.push(await page.locator(".workspace").innerText());
      await key(page, "5");
    }
    seen.push(await page.locator(".workspace").innerText(), await page.locator(".app-header").innerText());
    const all = seen.join("\n");
    for (const [re, what] of FORBIDDEN) expect(name, `no ${what} on screen`, !re.test(all), (all.match(new RegExp(`.{0,30}${re.source}.{0,30}`)) || [])[0]);
    expect(name, "no error", !errors.length, errors.join(" | "));
    await context.close();
  }
  // The case menu opens a case at its first step.
  const { context, page } = await open("case=gloves&step=gap");
  await page.click("#case-button");
  await page.click('#case-menu [data-case="SC-HOSES"]');
  await settle(page);
  expect("cases", "the case menu opens a case at the tip", (await current(page)) === "tip" && /Express is not a reason/.test(await text(page, "#case-name")), await text(page, "#case-name"));
  await context.close();
}

// ---- guide ------------------------------------------------------------------------------------------
if (wanted("guide")) {
  for (const size of [[1280, 720], [1366, 768]]) {
    const { context, page, errors } = await open("", { size, guide: true });
    expect(`guide ${size[0]}`, "the guide opens by itself on a new tab", await page.evaluate(() => document.getElementById("guide").open));
    const chapters = await page.$$eval("#guide .vc-guide__chapter", (els) => els.length);
    for (let i = 0; i < chapters; i++) {
      const fit = await page.evaluate(() => {
        const ch = [...document.querySelectorAll("#guide .vc-guide__chapter")].find((c) => !c.hidden && c.offsetParent !== null);
        const box = ch.closest(".vc-guide__chapters") || ch.parentElement;
        const dlg = document.getElementById("guide").getBoundingClientRect();
        return { id: ch.dataset.vcChapter, scroll: box.scrollHeight - box.clientHeight, inside: dlg.top >= 0 && dlg.bottom <= innerHeight };
      });
      expect(`guide ${size[0]}`, `chapter "${fit.id}" fits without scrolling`, fit.scroll <= 1 && fit.inside, JSON.stringify(fit));
      await page.screenshot({ path: path.join(OUT, `guide-${size[0]}-${i + 1}.png`) });
      if (i < chapters - 1) { await page.click("#guide [data-vc-guide-next]"); await settle(page); }
    }
    const how = await page.$$eval('#guide [data-vc-chapter="how"] tbody tr', (rows) => rows.map((r) => r.innerText.replace(/\s+/g, " ")));
    expect(`guide ${size[0]}`, "How it works explains the four figures with the engine's values", how.length === 4 && how[0].includes(eur0(GLOVES.opportunity)) && how[0].includes(eur0(GLOVES.options.H.residual)) && how[1].includes(`+${Math.round(GLOVES.spread * 100)} %`), how.join(" | "));
    const say = await page.$$eval('#guide [data-vc-chapter="present"] .vc-guide__path li', (els) => els.map((e) => e.innerText.replace(/\s+/g, " ")));
    expect(`guide ${size[0]}`, "the talk track has five timed steps with the engine's figures", say.length === 5 && say.every((s) => /1 min/.test(s)) && say[2].includes(eur0(GLOVES.opportunity)) && say[3].includes(eur0(GLOVES.options.H.savings)), say.join(" | "));
    await page.click("#guide [data-vc-guide-next]");
    await settle(page);
    expect(`guide ${size[0]}`, "Start on the last chapter closes the guide", !(await page.evaluate(() => document.getElementById("guide").open)));
    await page.reload();
    await page.waitForSelector('html[data-boot="ready"]');
    expect(`guide ${size[0]}`, "a reload in the same tab leaves it closed", !(await page.evaluate(() => document.getElementById("guide").open)));
    expect(`guide ${size[0]}`, "no error", !errors.length, errors.join(" | "));
    await context.close();
  }
  // Vici's own browser test of the guide, against this page over http.
  const vici = viciDir();
  if (!vici) expect("guide", "a ViciDesign checkout for check-guide-render.mjs (VICI_DIR or ../ViciDesign)", !REQUIRE_VICI);
  else {
    // Asynchronous, so this process keeps serving the page while Vici's test drives it.
    const r = await run(process.execPath, [path.join(vici, "scripts", "check-guide-render.mjs"), server.base], { cwd: vici, env: process.env }, 240000);
    expect("guide", "Vici's check-guide-render.mjs passes against the page", r.status === 0 && /GUIDE BEHAVIOUR OK/.test(r.stdout), `exit ${r.status}: ${(r.stdout + r.stderr).split("\n").filter((l) => l.trim()).slice(-8).join(" | ")}`);
  }
}

// ---- layout -----------------------------------------------------------------------------------------
if (wanted("layout")) {
  for (const size of [[1920, 1080], [1366, 768], [1280, 720]]) {
    for (const theme of ["light", "dark"]) {
      const { context, page, errors } = await open("case=gloves", { size, theme });
      for (const n of ["1", "2", "3", "4", "4+", "5"]) {
        if (n === "4+") await page.click(".option[data-recommended='true'] .option-approve");
        else if (n === "5") await decideDrafts(page, "H");
        else await key(page, n);
        await settle(page);
        const where = `${size[0]}×${size[1]} ${theme} step ${n}`;
        const m = await page.evaluate(() => {
          const over = (el) => el.scrollHeight - el.clientHeight;
          // Hidden tooltips and menus, a stepper's connectors and a toggle's spare icon are left out:
          // they widen their box's scroll width without showing anything outside it.
          const wide = [...document.querySelectorAll(".app-header *, .intro *, .talk *, .workspace *")].filter((el) => {
            const r = el.getBoundingClientRect();
            if (!r.width || el.matches(".vc-tooltip, [popover]") || el.closest(".vc-tooltip, [popover]")) return false;
            if (r.right > innerWidth + 1) return true;
            if (el.matches(".vc-tooltip-anchor, .vc-step, .vc-icon-button") || ["TABLE", "TBODY", "THEAD", "TR"].includes(el.tagName)) return false;
            return el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === "visible";
          }).map((el) => `${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]}`);
          const small = [...document.querySelectorAll("button, a[href], select, input")].filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && !el.closest("dialog:not([open]), [popover]:not(:popover-open), .vc-skip-link") && (r.width < 24 || r.height < 24);
          }).map((el) => (el.getAttribute("aria-label") || el.textContent).trim().slice(0, 20));
          return { page: document.scrollingElement.scrollHeight - innerHeight, stage: over(document.querySelector(".stage")), story: over(document.querySelector(".story")), wide: [...new Set(wide)].slice(0, 5), small: small.slice(0, 5) };
        });
        expect("layout", `${where}: no page scroll`, m.page <= 0, m.page);
        expect("layout", `${where}: the stage and the story fit`, m.stage <= 1 && m.story <= 1, `stage ${m.stage}, story ${m.story}`);
        expect("layout", `${where}: nothing wider than its box`, !m.wide.length, m.wide.join(", "));
        expect("layout", `${where}: every target at least 24 px`, !m.small.length, m.small.join(", "));
        if (theme === "light" && ["1", "3", "4+", "5"].includes(n)) await page.screenshot({ path: path.join(OUT, `layout-${size[0]}-${n.replace("+", "b")}.png`) });
      }
      expect("layout", `${size[0]}×${size[1]} ${theme}: no error`, !errors.length, errors.join(" | "));
      await context.close();
    }
  }
  // The other five cases at the smallest size, every step: nothing scrolls.
  for (const sc of SCENARIOS.filter((c) => !c.start_here)) {
    const { context, page } = await open(`case=${slug(sc)}`, { size: [1280, 720] });
    for (const n of ["1", "2", "3", "4", "5"]) {
      await key(page, n);
      if (n === "2" && await page.locator(".confirm-actions .vc-button").count()) { await page.locator(".confirm-actions .vc-button").first().click(); await opened(page, "gap"); }
      const m = await page.evaluate(() => ({ page: document.scrollingElement.scrollHeight - innerHeight, stage: document.querySelector(".stage").scrollHeight - document.querySelector(".stage").clientHeight, story: document.querySelector(".story").scrollHeight - document.querySelector(".story").clientHeight }));
      expect("layout", `1280×720 ${slug(sc)} step ${n}: nothing scrolls`, m.page <= 0 && m.stage <= 1 && m.story <= 1, JSON.stringify(m));
    }
    await context.close();
  }
}

await browser.close();
await server.close();
const ran = ["steps", "kpis", "decide", "cases", "guide", "layout"].filter(wanted);
if (failures.length) {
  console.log(failures.map((f) => `FAIL  ${f}`).join("\n"));
  console.log(`\n${failures.length} of ${checks} checks failed (${ran.join(", ")}). Screenshots: ${OUT}`);
  process.exit(1);
}
console.log(`${checks} checks passed (${ran.join(", ")}).`);
console.log(`SHOWCASE ${ran.join(" ")} OK`);
