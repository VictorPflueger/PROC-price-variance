// Design rules of this prototype that its own charts must keep, checked in its files and in the rendered
// app in both themes:
//   series  no chart uses merlot, fjord, lilac, honey or a state colour as a series colour (AC-14). Every
//           bar of the portfolio chart and of the value pipeline is filled with one of the series colours
//           this app draws with (Vici's teal and apricot, then its greys: --vc-data-2, -3, -7 and -8), and
//           no stylesheet or script names another data colour. Planted bars in each forbidden family must
//           be caught, or the check proves nothing.
// Usage: node tests/design.mjs           (all cases)
//        node tests/design.mjs series    (only this case)
import fs from "node:fs";
import path from "node:path";
import { APP_ROOT, ONLY, wanted, launchBrowser, serveStatic, NETWORK_NOISE, SKIP_INTRO } from "./lib/harness.mjs";

const CASES = ["series"];
const unknown = ONLY.filter((c) => !CASES.includes(c));
if (unknown.length) { console.error(`Unknown case(s): ${unknown.join(", ")}. Cases: ${CASES.join(", ")}`); process.exit(2); }

let checks = 0;
const failures = [];
const check = (what, ok, detail = "") => { checks += 1; if (!ok) failures.push(`${what}${detail ? `: ${String(detail).slice(0, 400)}` : ""}`); };

/** The series colours the app may fill a chart with, and the colours no chart may use as a series. */
const ALLOWED = ["data-2", "data-3", "data-7", "data-8"];
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
// merlot (the person's), fjord (checking, money spent), lilac (the AI's), honey (warning), and the state
// families behind danger (coral) and success (sage), every step of each.
const FAMILIES = ["merlot", "fjord", "lilac", "honey", "coral", "sage"];
const STATE_TOKENS = [
  "accent", "accent-hover", "accent-pressed", "accent-soft", "accent-soft-hover", "accent-text", "focus",
  ...["info", "success", "warning", "danger", "feature"].flatMap((s) => [`${s}-bg`, `${s}-border`, `${s}-text`, `${s}-solid`])
];
const FORBIDDEN = [...FAMILIES.flatMap((f) => STEPS.map((n) => `${f}-${n}`)), ...STATE_TOKENS];

const browser = await launchBrowser();
const server = await serveStatic(APP_ROOT, 8700 + Math.floor(Math.random() * 60));

try {
  if (wanted("series")) {
    // 1. The files: only the four allowed data colours are named anywhere in the app's styles and scripts.
    const files = [
      ...fs.readdirSync(path.join(APP_ROOT, "css")).filter((f) => f.endsWith(".css")).map((f) => `css/${f}`),
      ...fs.readdirSync(path.join(APP_ROOT, "js")).filter((f) => f.endsWith(".js")).map((f) => `js/${f}`)
    ];
    const named = [];
    for (const f of files) {
      for (const m of fs.readFileSync(path.join(APP_ROOT, f), "utf8").matchAll(/--vc-(data-(?:pastel-)?\d+)/g)) named.push({ file: f, token: m[1] });
    }
    const stray = named.filter((n) => !ALLOWED.includes(n.token));
    check("series: the app's files name only the series colours teal, apricot and the greys", named.length > 0 && stray.length === 0,
      stray.map((n) => `${n.file}: --vc-${n.token}`).join(", "));
    const css = fs.readFileSync(path.join(APP_ROOT, "css", "board.css"), "utf8");
    const series = [1, 2, 3, 4].map((k) => css.match(new RegExp(`\\.bar-fill\\.series-${k}\\s*\\{\\s*background:\\s*var\\(--vc-([a-z0-9-]+)\\)`))?.[1]);
    check("series: the four series classes are teal, apricot and the two greys, in that order", JSON.stringify(series) === JSON.stringify(ALLOWED), JSON.stringify(series));

    // 2. The rendered charts: a sweep's portfolio chart and the value pipeline, in both themes.
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    await context.addInitScript(SKIP_INTRO);
    const outside = [];
    await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => { outside.push(route.request().url()); route.abort("blockedbyclient"); });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e.message || e)));
    page.on("console", (m) => { if (m.type() === "error" && !NETWORK_NOISE.test(m.text())) errors.push(m.text()); });
    await page.goto(server.base);
    await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
    // pv_scan through the live toolbox: the same events a sweep sends to the board, without a model.
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
      await tb.call("design-1", "pv_scan", {});
    });
    await page.waitForSelector("#board .bars:not(.pipeline) .bar-row", { timeout: 5000 });

    /** Every bar fill on the board, classified against the theme's resolved token colours. */
    const classify = (allowed, forbidden) => page.evaluate(({ allowed, forbidden }) => {
      const probe = document.createElement("span");
      document.body.appendChild(probe);
      const resolve = (token) => { probe.style.color = ""; probe.style.color = `var(--vc-${token})`; return getComputedStyle(probe).color; };
      const allowedColours = new Map(allowed.map((t) => [resolve(t), t]));
      const forbiddenColours = new Map();
      for (const t of forbidden) { const c = resolve(t); if (!forbiddenColours.has(c)) forbiddenColours.set(c, t); }
      probe.remove();
      return [...document.querySelectorAll("#board .bar-fill")].map((el) => {
        const colour = getComputedStyle(el).backgroundColor;
        const image = getComputedStyle(el).backgroundImage;
        const row = el.closest(".bar-row");
        return {
          what: row?.dataset.group || row?.dataset.stage || el.dataset.planted || "?",
          planted: !!el.dataset.planted,
          colour, image,
          series: allowedColours.get(colour) || null,
          clash: forbiddenColours.get(colour) || null
        };
      });
    }, { allowed, forbidden });

    for (const theme of ["light", "dark"]) {
      await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
      await page.waitForTimeout(100);
      const bars = await classify(ALLOWED, FORBIDDEN);
      const flagged = bars.filter((b) => !b.planted && !["identified", "approved", "implemented", "realised"].includes(b.what));
      const stages = bars.filter((b) => ["identified", "approved", "implemented", "realised"].includes(b.what));
      check(`series (${theme}): the sweep drew its bars and the pipeline its four`, flagged.length >= 4 && stages.length === 4, `${flagged.length} flagged, ${stages.length} stages`);
      const bad = bars.filter((b) => !b.series || b.clash || (b.image && b.image !== "none"));
      check(`series (${theme}): every bar is filled with a series colour, none with merlot, fjord, lilac, honey or a state colour`, bad.length === 0,
        bad.map((b) => `${b.what} ${b.colour}${b.clash ? ` = --vc-${b.clash}` : ""}`).join(", "));
      check(`series (${theme}): the flagged groups share one series colour, teal`, flagged.every((b) => b.series === "data-2"), flagged.map((b) => b.series).join(", "));
      check(`series (${theme}): the pipeline's stages are teal, apricot, grey and dark grey`, JSON.stringify(stages.map((b) => b.series)) === JSON.stringify(ALLOWED), stages.map((b) => b.series).join(", "));

      // The negative control: one planted bar in each forbidden family and state must be caught.
      const plants = ["merlot-700", "fjord-700", "lilac-600", "honey-800", "accent", "danger-solid", "warning-solid", "success-solid", "info-solid", "feature-solid"];
      await page.evaluate((plants) => {
        const list = document.querySelector("#board .bars:not(.pipeline)");
        for (const t of plants) {
          const li = document.createElement("li");
          li.className = "bar-row planted";
          const fill = document.createElement("span");
          fill.className = "bar-fill";
          fill.dataset.planted = t;
          fill.style.background = `var(--vc-${t})`;
          li.appendChild(fill);
          list.appendChild(li);
        }
      }, plants);
      const planted = (await classify(ALLOWED, FORBIDDEN)).filter((b) => b.planted);
      const missed = planted.filter((b) => !b.clash || b.series);
      check(`series (${theme}): the check catches ${plants.length} planted bars in forbidden colours`, planted.length === plants.length && missed.length === 0,
        `caught ${planted.length - missed.length}/${plants.length}; missed ${missed.map((b) => b.what).join(", ")}`);
      await page.evaluate(() => document.querySelectorAll("#board .planted").forEach((e) => e.remove()));
    }
    check("series: no page error", errors.length === 0, errors.join(" | "));
    check("series: no request to another host", outside.length === 0, outside.join(" | "));
    await context.close();
  }
} finally {
  await server.close();
  await browser.close();
}

for (const f of failures) console.log(`FAIL  ${f}`);
if (failures.length) { console.log(`\nDESIGN FAILED: ${failures.length} of ${checks} checks`); process.exit(1); }
console.log(`DESIGN OK: ${ONLY.length ? ONLY.join(" ") : CASES.join(" ")} (${checks} checks)`);
