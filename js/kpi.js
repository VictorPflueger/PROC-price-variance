// Header tiles: Opportunity identified (€ a year, the flagged groups below), Price variance index (the
// portfolio's; the projected index below after an approval), Approved savings (€ a year; implemented
// and realised to date below) and the sisters' Session cost. Identified and the index fill from a run's
// own engine results (PLAN.md P-4), so before a run they wait; approved savings show the value log
// from the start, because it is history. Version 0.1.0 has no runs yet: the first two tiles wait.

import { h } from "./dom.js";
import { eur, eurCents } from "./format.js";

export function createKpis(container, { pipeline }) {
  // Vici's stat card; a tile that shows a state takes that state's tone (css/style.css).
  const make = (id, label, value, unit, sub, tone = "muted", wide = false) => {
    const valueEl = h("div", { class: "vc-stat__value kpi-value", id: `kpi-${id}-value` }, value, unit ? h("span", { class: "kpi-unit" }, unit) : null);
    const subEl = h("div", { class: "vc-stat__note kpi-sub", id: `kpi-${id}-sub`, title: sub }, sub);
    const el = h("div", { class: ["vc-stat", "kpi", wide ? "kpi--wide" : ""], dataset: { tone }, role: "group", "aria-label": label },
      h("div", { class: "vc-stat__label kpi-label" }, label), valueEl, subEl);
    container.appendChild(el);
    return el;
  };
  make("identified", "Opportunity identified", "—", "", "no run yet");
  make("index", "Price variance index", "—", "", "this run");
  make("approved", "Approved savings", eur(pipeline.approved), " a year",
    `${eur(pipeline.implemented)} implemented · ${eur(pipeline.realised)} realised to date`, "", true);
  make("cost", "Session cost", eurCents(0), "", "no model calls yet");
}
