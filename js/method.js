// The Method dialog (brief §9), opened from the control bar: how the engine makes prices comparable and
// what it counts; the method's parameters, each an assumption (TECH_NOTES §2); the exchange rates with
// their dates; and the production path. The parameters can be changed between runs: a live run uses
// them, a simulation always runs at the defaults its script was written for, and every change is a
// param_change event in the audit log while the next run records the values it used. Every number shown
// comes from the parameters or the rate snapshot through js/format.js.

import { h } from "./dom.js";
import { icon } from "./icons.js";
import { openModal } from "./modal.js";
import { PARAMETERS, DEFAULTS } from "./params.js";
import { PIPELINE_DEFINITIONS } from "./board_data.js";
import { PRODUCTION_PATH } from "./intro.js";
import { eur, pct, int, shortDate } from "./format.js";

/** A parameter's value as a person reads it: shares as percentages, days, hours and euros. */
export function paramText(p, v) {
  if (p.unit === "share") return pct(v);
  if (p.unit === "€ a year") return `${eur(v)} a year`;
  if (p.unit === "€") return eur(v);
  return `${int(v)} ${p.unit === "days" && v === 1 ? "day" : p.unit === "hours" && v === 1 ? "hour" : p.unit}`;
}
/** The value an input shows: a share as a percentage number, anything else as it is. */
const inputValue = (p, v) => (p.unit === "share" ? String(Math.round(v * 1000) / 10) : String(v));
const fromInput = (p, text) => {
  const n = Number(String(text).replace(",", ".").trim());
  if (!Number.isFinite(n)) return NaN;
  return p.unit === "share" ? Math.round(n * 10) / 1000 : n;
};

/**
 * Opens the dialog. deps: { params (js/params.js createParams), isRunning(), onChange(change) for the
 * audit, fx (window.FX), fetched: rates fetched in the current run [{ currency, date, per_eur, rate_to_eur, source }] }.
 */
export function openMethod({ params, isRunning = () => false, onChange = () => {}, fx = globalThis.FX, fetched = [] } = {}) {
  const P = () => params.get();
  const v = (key) => paramText(PARAMETERS.find((p) => p.key === key), P()[key]);
  const locked = isRunning();

  const section = (id, title, ...body) => h("section", { class: "method-section", "aria-labelledby": `method-${id}` }, h("h3", { id: `method-${id}` }, title), ...body);
  const list = (...items) => h("ul", { class: "method-list" }, items.map((t) => h("li", {}, t)));

  const method = [
    section("comparable", "Comparable groups",
      h("p", {}, "The engine compares only order lines of one comparable group: the same material number; the same manufacturer and part number across material numbers; or free-text service lines a person confirmed as one cluster (", h("em", {}, "Your confirmation"), "). Similar names never make lines comparable on their own.")),
    section("normalise", "A comparable price",
      h("p", {}, "Every line is brought to euros per base unit, delivered, in four steps:"),
      h("ol", { class: "method-list" },
        h("li", {}, "Price per order unit: the net price over its price unit (€690 per 100 boxes is €6.90 per box)."),
        h("li", {}, `Price per base unit: through the material's unit conversion; for services a person-day is ${v("person_day_hours")}, never a calendar day.`),
        h("li", {}, "In euros at the window's mean ECB reference rate of the line's currency (the rates are below)."),
        h("li", {}, `Delivered: Incoterms® 2020 groups E and F leave the main carriage unpaid, so they get a logistics uplift of ${v("logistics_uplift")}; groups C and D are delivered as priced. A service carries no Incoterms rule.`)),
      h("p", {}, "A line that cannot be converted (no unit conversion, a rule outside Incoterms 2020) is excluded from every figure, with its reason.")),
    section("benchmark", "The benchmark",
      h("p", {}, `GlobalCorp's own best price at volume: the lowest normalised price among the pairs (one plant buying from one supplier) that buy at least ${v("benchmark_min_share")} of the group's quantity in the analysis window of ${v("window_days")}. A one-off bargain never sets it. Ties go to the larger quantity, then the lower plant and supplier ids.`)),
    section("gaps", "Justified and unexplained",
      h("p", {}, `A line's gap is its quantity times its price above the benchmark. An urgent line with a recorded reason may pay up to ${v("urgent_allowance")} of the benchmark price more: that part of its gap is justified. Everything else is unexplained. The opportunity is the unexplained variance of the window, read as euros a year at the current volume (an assumption).`)),
    section("index", "Spread, index and materiality",
      list(
        "Spread: the highest pair's price above the benchmark, as a share of the benchmark.",
        "Price variance index: the unexplained variance over the normalised spend (quantity times normalised price).",
        `Flagged: an opportunity of at least ${v("materiality_eur")} and a spread of at least ${v("materiality_spread")}.`)),
    section("options", "The options",
      list(
        `H, harmonise: move the lines above the benchmark, at the plants the benchmark supplier delivers to, to that supplier at the benchmark price. One-off cost ${v("harmonise_days_per_plant")} per moved plant at a day rate of ${v("day_rate_eur")}; first saving after ${v("lead_time_harmonise_days")}.`,
        `R, renegotiate: ask every supplier above the benchmark to match it. One-off cost ${v("renegotiate_days_per_supplier")} per supplier; first saving after ${v("lead_time_renegotiate_days")}.`,
        `B, one tender for the group's whole volume, with a bundle discount of ${v("bundle_discount")} on its quantity at the benchmark price (an assumption). One-off cost ${v("tender_days")}; first saving after ${v("lead_time_tender_days")}.`,
        "Accept the variance, with a reason: nothing changes, and nothing counts as approved savings."),
      h("p", {}, "The recommended option has the highest savings a year less its one-off cost. A person decides; every draft then waits for its own approval, and nothing is sent.")),
    section("pipeline", "The value pipeline",
      h("dl", { class: "method-defs" }, ["identified", "approved", "implemented", "realised"].flatMap((k) => [h("dt", {}, k[0].toUpperCase() + k.slice(1)), h("dd", {}, PIPELINE_DEFINITIONS[k])])),
      h("p", {}, "Approval is a decision, not a saving: approved savings read “a year”, and only later order lines make value realised, “to date”."))
  ];

  // ---- the parameters ----------------------------------------------------------------------------------
  const status = h("p", { class: "method-param-status", role: "status", "aria-live": "polite" }, "");
  const rows = new Map();
  const changedCount = () => PARAMETERS.filter((p) => P()[p.key] !== DEFAULTS[p.key]).length;
  const resetBtn = h("button", { class: "vc-button vc-button--outline button-compact method-reset", type: "button" }, icon("reset", 16), "Reset to the defaults");
  const refresh = () => {
    for (const p of PARAMETERS) {
      const r = rows.get(p.key);
      const value = P()[p.key];
      r.input.value = inputValue(p, value);
      r.row.dataset.changed = String(value !== DEFAULTS[p.key]);
      r.def.textContent = value === DEFAULTS[p.key] ? "default" : `default ${paramText(p, DEFAULTS[p.key])}`;
    }
    resetBtn.disabled = locked || changedCount() === 0;
  };
  const apply = (p, input) => {
    const to = fromInput(p, input.value);
    if (!Number.isFinite(to) || to < 0) {
      input.setAttribute("aria-invalid", "true");
      status.textContent = `${p.label}: enter a number of at least 0.`;
      return;
    }
    input.removeAttribute("aria-invalid");
    if (to === P()[p.key]) { refresh(); return; }
    const r = params.set(p.key, to);
    if (r.error) { input.setAttribute("aria-invalid", "true"); status.textContent = r.error; return; }
    onChange(r.change);
    status.textContent = `${p.label}: ${paramText(p, r.change.from)} → ${paramText(p, r.change.to)}. The next live run uses it; it is in the audit log.`;
    refresh();
  };
  const table = h("table", { class: "vc-table vc-table--compact method-params" },
    h("caption", {}, "Each value is an assumption of the method."),
    h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "Parameter"), h("th", { scope: "col", class: "num" }, "Value"), h("th", { scope: "col" }, "Unit"), h("th", { scope: "col" }, "Default"))),
    h("tbody", {}, PARAMETERS.map((p) => {
      const id = `param-${p.key}`;
      const input = h("input", {
        class: "vc-input method-input", id, type: "text", inputmode: "decimal", autocomplete: "off",
        "aria-describedby": `${id}-unit`, disabled: locked, dataset: { param: p.key }
      });
      input.addEventListener("change", () => apply(p, input));
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); apply(p, input); } });
      const def = h("span", { class: "method-default" }, "");
      const row = h("tr", { dataset: { param: p.key } },
        h("th", { scope: "row" }, h("label", { for: id }, p.label)),
        h("td", { class: "num" }, input),
        h("td", { id: `${id}-unit` }, p.unit === "share" ? "%" : p.unit),
        h("td", {}, def));
      rows.set(p.key, { row, input, def });
      return row;
    })));
  resetBtn.addEventListener("click", () => {
    if (locked) return;
    for (const p of PARAMETERS) {
      if (P()[p.key] === DEFAULTS[p.key]) continue;
      const r = params.set(p.key, DEFAULTS[p.key]);
      if (r.change) onChange(r.change);
    }
    status.textContent = "Back to the defaults; the next live run uses them.";
    refresh();
  });
  refresh();
  const paramsSection = section("params", "Parameters",
    h("p", { class: "method-param-note" }, locked
      ? "Locked while the agent runs: a run keeps the values it started with."
      : "Change a value and press Enter. A live run uses these values; a simulation always runs at the defaults its script was written for. Every change goes into the audit log, and the next run records the values it used."),
    table, h("div", { class: "method-param-actions" }, resetBtn, status));

  // ---- the exchange rates --------------------------------------------------------------------------------
  const cur = Object.entries(fx?.currencies || {}).filter(([c]) => c !== "EUR");
  const ratesSection = section("rates", "Exchange rates",
    h("p", {}, `One rate per currency for the whole analysis: the ${fx?.label || "bundled rate"}. Source: ${fx?.source || "not given"}.`),
    h("table", { class: "vc-table vc-table--compact method-rates" },
      h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "Currency"), h("th", { scope: "col", class: "num" }, "Mean per euro"), h("th", { scope: "col", class: "num" }, "Rate to EUR"), h("th", { scope: "col" }, "Window"), h("th", { scope: "col", class: "num" }, "Daily quotes"))),
      h("tbody", {}, cur.map(([c, r]) => h("tr", { dataset: { currency: c } },
        h("th", { scope: "row" }, c),
        h("td", { class: "num vc-tabular" }, r.mean_per_eur !== undefined ? r.mean_per_eur.toLocaleString("en-GB", { maximumFractionDigits: 5 }) : "—"),
        h("td", { class: "num vc-tabular" }, r.rate_to_eur.toLocaleString("en-GB", { maximumFractionDigits: 5 })),
        h("td", {}, r.first && r.last ? `${shortDate(r.first)} to ${shortDate(r.last)}` : "—"),
        h("td", { class: "num vc-tabular" }, r.observations ? int(r.observations) : "—"))))),
    fetched.length
      ? h("p", { class: "method-fetched" }, `Fetched in this run, a labelled sensitivity only: ${fetched.map((r) => `1 EUR = ${r.per_eur} ${r.currency} on ${shortDate(r.date)}${/\((representative|recorded)\)$/.test(r.source || "") ? ` ${r.source.match(/\((representative|recorded)\)$/)[0]}` : ""}`).join("; ")}. The figures keep the window's rate.`)
      : h("p", { class: "method-fetched" }, "A live run may fetch today's ECB rate through Frankfurter; it then shows as a labelled sensitivity, and the figures keep the window's rate."));

  // ---- the production path -----------------------------------------------------------------------------
  const pathSection = section("production", "In production",
    h("ol", { class: "intro-path method-path", "aria-label": "Production path" }, PRODUCTION_PATH.map((p) => h("li", {}, h("strong", {}, p.title), h("span", {}, p.text)))),
    h("p", { class: "intro-note" }, "This prototype stands in for all of it in one browser page."));

  let modal = null;
  modal = openModal({
    title: "Method",
    intro: "How the engine makes prices comparable and what it counts. The agent explains; every figure comes from this method.",
    className: "method-modal",
    size: "wide",
    body: [h("div", { class: "method-body" }, ...method, paramsSection, ratesSection, pathSection)],
    footer: [h("button", { class: "vc-button", type: "button", autofocus: true, on: { click: () => modal?.close(null) } }, "Close")]
  });
  return modal;
}
