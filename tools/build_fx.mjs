// Builds data/fx.js, the data product fx_rate (brief §6.3 and §8.1): one rate per currency for the whole
// analysis, rate to EUR = 1 / the mean of the ECB's daily reference quotes of that currency per euro over
// the last 365 days, with the first and last date of the window.
//
// The ECB Data Portal's daily series (EXR.D.<CUR>.EUR.SP00.A) is the source; every day is cross-checked
// against Frankfurter's v1 time series, which serves the ECB's reference rates, and any difference or
// missing day fails the build. Neither host answers from the environment that wrote this tool, so it runs
// in the workflow .github/workflows/fx-snapshot.yml, which pushes the result to a review branch.
//
// Usage:
//   node tools/build_fx.mjs                       the last 365 days up to today (UTC), from both hosts
//   node tools/build_fx.mjs --end 2026-11-19      the 365 days up to that date
//   node tools/build_fx.mjs --fallback            the labelled fallback: Rebate Hunter's observed rate of
//                                                 14 Oct 2026, one day's rate, until a snapshot exists
//   node tools/build_fx.mjs --files <ecb.csv> <frankfurter.json> [--end …]   offline, from saved responses
// Currencies: every currency of data/world.js other than EUR (GBP if the world is not built yet).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const WINDOW_DAYS = 365;
export const ECB_URL = (cur, first, last) => `https://data-api.ecb.europa.eu/service/data/EXR/D.${cur}.EUR.SP00.A?startPeriod=${first}&endPeriod=${last}&format=csvdata`;
export const FRANKFURTER_URL = (cur, first, last) => `https://api.frankfurter.dev/v1/${first}..${last}?base=EUR&symbols=${cur}`;
export const FALLBACK = Object.freeze({ date: "2026-10-14", per_eur: { GBP: 0.84385 } });

const iso = (d) => d.toISOString().slice(0, 10);
/** The window's first and last date: the last 365 days up to `end` (UTC), both included. */
export function windowOf(end = iso(new Date())) {
  const last = new Date(`${end}T00:00:00Z`);
  const first = new Date(last.getTime() - (WINDOW_DAYS - 1) * 86400000);
  return { first: iso(first), last: iso(last) };
}

/** The ECB Data Portal's CSV (format=csvdata): Map(date → quote per euro). */
export function parseEcbCsv(text) {
  const rows = String(text).trim().split(/\r?\n/).map(splitCsv);
  const head = rows.shift() || [];
  const t = head.indexOf("TIME_PERIOD");
  const v = head.indexOf("OBS_VALUE");
  if (t < 0 || v < 0) throw new Error("ECB CSV without TIME_PERIOD and OBS_VALUE columns");
  const out = new Map();
  for (const r of rows) {
    if (!r[t] || r[v] === "" || r[v] === undefined) continue;
    const x = Number(r[v]);
    if (!Number.isFinite(x) || x <= 0) throw new Error(`ECB CSV: bad value ${r[v]} on ${r[t]}`);
    out.set(r[t], x);
  }
  return out;
}
function splitCsv(line) {
  const out = [];
  let cur = ""; let q = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i += 1; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

/** Frankfurter's v1 time series ({ rates: { date: { CUR: x } } }): Map(date → quote per euro). */
export function parseFrankfurter(json, currency) {
  const data = typeof json === "string" ? JSON.parse(json) : json;
  if (data.base !== "EUR" || !data.rates) throw new Error("Frankfurter: not a time series against EUR");
  const out = new Map();
  for (const [date, rates] of Object.entries(data.rates)) {
    const x = rates?.[currency];
    if (Number.isFinite(x)) out.set(date, x);
  }
  return out;
}

/** Every day of the ECB series must be in Frankfurter's with the same quote, and the other way round. */
export function crossCheck(ecb, frankfurter, currency) {
  const problems = [];
  for (const [d, x] of ecb) {
    if (!frankfurter.has(d)) problems.push(`${d}: ECB ${x}, Frankfurter none`);
    else if (Math.abs(frankfurter.get(d) - x) > 1e-9) problems.push(`${d}: ECB ${x}, Frankfurter ${frankfurter.get(d)}`);
  }
  for (const [d, x] of frankfurter) if (!ecb.has(d)) problems.push(`${d}: Frankfurter ${x}, ECB none`);
  if (problems.length) throw new Error(`${currency}: the sources differ on ${problems.length} day(s): ${problems.slice(0, 5).join("; ")}`);
}

/** The rate of one currency over the window. */
export function rateOf(quotes, { first, last }) {
  const days = [...quotes.keys()].filter((d) => d >= first && d <= last).sort();
  if (days.length < 200) throw new Error(`only ${days.length} daily quotes between ${first} and ${last}`);
  const mean = days.reduce((s, d) => s + quotes.get(d), 0) / days.length;
  return { mean_per_eur: mean, rate_to_eur: 1 / mean, observations: days.length, first: days[0], last: days[days.length - 1] };
}

const DATE_LABEL = (d) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

/** The text of data/fx.js. */
export function fxFileText(fx) {
  return `/*
 * PRICE VARIANCE AGENT: exchange rates, the data product fx_rate (written by tools/build_fx.mjs).
 *
 * One rate per currency for the whole analysis: rate_to_eur = 1 / the mean of the ECB's daily reference
 * quotes of that currency per euro over the window, with its first and last date (brief section 6.3).
 * A rate fetched in a live run is only ever a labelled sensitivity beside these rates.
 * status "snapshot": built from the ECB Data Portal and cross-checked day by day against Frankfurter.
 * status "fallback": one day's rate, labelled as such, until the snapshot workflow has run.
 */
window.FX = ${JSON.stringify(fx, null, 2)};
`;
}

/** The fallback: Rebate Hunter's observed ECB rate of 14 Oct 2026, one day's rate, labelled. */
export function fallbackFx() {
  const d = FALLBACK.date;
  const currencies = { EUR: { rate_to_eur: 1 } };
  for (const [cur, per] of Object.entries(FALLBACK.per_eur)) {
    currencies[cur] = { mean_per_eur: per, rate_to_eur: 1 / per, observations: 1, first: d, last: d };
  }
  return {
    version: `fx-fallback-${d}`,
    status: "fallback",
    source: "European Central Bank euro reference rate of 14 Oct 2026 (1 EUR = 0.84385 GBP), as Rebate Hunter's TECH_NOTES section 4 observed it through Frankfurter's v1 API; not a window mean",
    label: `ECB reference rate of ${DATE_LABEL(d)}, one day's rate (fallback until the window's mean is built)`,
    built: d,
    window: { first: null, last: null, days: WINDOW_DAYS },
    currencies
  };
}

/** The snapshot from the two sources' quotes: { [currency]: { ecb: Map, frankfurter: Map } }. */
export function snapshotFx(byCurrency, win) {
  const currencies = { EUR: { rate_to_eur: 1 } };
  let lastSeen = win.first;
  for (const [cur, { ecb, frankfurter }] of Object.entries(byCurrency)) {
    crossCheck(ecb, frankfurter, cur);
    currencies[cur] = { ...rateOf(ecb, win), source: "ECB" };
    if (currencies[cur].last > lastSeen) lastSeen = currencies[cur].last;
  }
  return {
    version: `fx-${lastSeen}`,
    status: "snapshot",
    source: "European Central Bank, euro foreign exchange reference rates (daily series EXR.D.<currency>.EUR.SP00.A, ECB Data Portal), every day cross-checked against Frankfurter's v1 time series",
    label: `mean of the ECB's daily reference rates, ${DATE_LABEL(win.first)} to ${DATE_LABEL(win.last)}`,
    built: win.last,
    window: { first: win.first, last: win.last, days: WINDOW_DAYS },
    currencies
  };
}

function worldCurrencies() {
  const file = path.join(ROOT, "data", "world.js");
  if (!existsSync(file)) return ["GBP"];
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(file, "utf8"), sandbox);
  const set = new Set((sandbox.window.WORLD?.po_line || []).map((l) => l.currency).filter((c) => c && c !== "EUR"));
  return set.size ? [...set].sort() : ["GBP"];
}

/** The window in four parts of about three months. */
export function quarters({ first, last }) {
  const a = new Date(`${first}T00:00:00Z`).getTime();
  const b = new Date(`${last}T00:00:00Z`).getTime();
  const days = Math.round((b - a) / 86400000) + 1;
  const parts = [];
  for (let start = 0; start < days; start += 92) {
    const end = Math.min(days - 1, start + 91);
    parts.push({ first: iso(new Date(a + start * 86400000)), last: iso(new Date(a + end * 86400000)) });
  }
  return parts;
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { accept: "text/csv, application/json" }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

async function main(argv) {
  const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
  const out = path.join(ROOT, "data", "fx.js");
  if (argv.includes("--fallback")) {
    writeFileSync(out, fxFileText(fallbackFx()));
    console.log(`FX FALLBACK written: ${path.relative(ROOT, out)}`);
    return;
  }
  const win = windowOf(arg("--end") || undefined);
  const currencies = worldCurrencies();
  const byCurrency = {};
  if (argv.includes("--files")) {
    const i = argv.indexOf("--files");
    if (currencies.length !== 1) throw new Error("--files takes one currency's responses");
    byCurrency[currencies[0]] = { ecb: parseEcbCsv(readFileSync(argv[i + 1], "utf8")), frankfurter: parseFrankfurter(readFileSync(argv[i + 2], "utf8"), currencies[0]) };
  } else {
    for (const cur of currencies) {
      const ecb = parseEcbCsv(await fetchText(ECB_URL(cur, win.first, win.last)));
      // Frankfurter in quarters, so a long range is never thinned out.
      const frankfurter = new Map();
      for (const part of quarters(win)) {
        for (const [d, x] of parseFrankfurter(await fetchText(FRANKFURTER_URL(cur, part.first, part.last)), cur)) frankfurter.set(d, x);
      }
      byCurrency[cur] = { ecb, frankfurter };
    }
  }
  const fx = snapshotFx(byCurrency, win);
  writeFileSync(out, fxFileText(fx));
  for (const cur of currencies) {
    const c = fx.currencies[cur];
    console.log(`${cur}: mean ${c.mean_per_eur} per EUR over ${c.observations} days (${c.first} to ${c.last}); 1 ${cur} = ${c.rate_to_eur} EUR`);
  }
  console.log(`FX SNAPSHOT written: ${fx.version} -> ${path.relative(ROOT, out)}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main(process.argv.slice(2)).catch((e) => { console.error(`FX BUILD FAILED: ${e.message}`); process.exit(1); });
}
