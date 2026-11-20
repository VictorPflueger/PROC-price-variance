// Header tiles (brief §9, PLAN.md P-4): Opportunity identified (€ a year, the flagged groups below),
// Price variance index (the portfolio's after a sweep, else the compared groups'; the projected index
// below after an approval), Approved savings (€ a year; implemented and realised to date below) and the
// sisters' Session cost. Identified and the index fill from this run's own engine results (kpi_update),
// so before a run they wait; approved savings show the value log from the start, because it is history.
// Approval is a decision, not a saving: approved value always reads "a year", realised value "to date",
// and nothing reads saved.

import { bus } from "./events.js";
import { h } from "./dom.js";
import { eur, eurCents, pct } from "./format.js";
import { STORAGE } from "./config.js";

export function createKpis(container, { pipeline }) {
  const make = (id, label, wide = false) => {
    const value = h("div", { class: "vc-stat__value kpi-value", id: `kpi-${id}-value` }, "—");
    const subEl = h("div", { class: "vc-stat__note kpi-sub", id: `kpi-${id}-sub` }, "");
    const el = h("div", { class: ["vc-stat", "kpi", wide ? "kpi--wide" : ""], dataset: { tone: "muted", kpi: id }, role: "group", "aria-label": label },
      h("div", { class: "vc-stat__label kpi-label" }, label), value, subEl);
    container.appendChild(el);
    return { el, value, sub: subEl };
  };
  const identified = make("identified", "Opportunity identified");
  const index = make("index", "Price variance index");
  const approved = make("approved", "Approved savings", true);
  const cost = make("cost", "Session cost");

  let sessionBase = readSessionCost();
  let runCost = 0;
  let lastRunCost = null;
  let mode = null;
  let running = false;

  const set = (tile, value, unit, tone, sub) => {
    const text = `${value}${unit || ""}`;
    if (tile.value.textContent !== text) {
      tile.value.replaceChildren(value, unit ? h("span", { class: "kpi-unit" }, unit) : "");
      tile.value.classList.remove("flip");
      void tile.value.offsetWidth;
      tile.value.classList.add("flip");
    }
    if (tone !== undefined) tile.el.dataset.tone = tone;
    if (sub !== undefined) { tile.sub.textContent = sub; tile.sub.title = sub; }
  };

  // The bundle discount is part of the approved figure, so it comes first, on its own line, and the later
  // stages follow; the line may wrap, never be cut (review R7).
  const showApproved = (p) => {
    const implemented = `${eur(p.implemented)} implemented`;
    const realised = `${eur(p.realised)} realised to date`;
    const bundle = p.approved_bundle > 0 ? `incl. ${eur(p.approved_bundle)} bundle discount` : null;
    set(approved, eur(p.approved), " a year", "", bundle ? `${bundle}; ${implemented} · ${realised}` : `${implemented} · ${realised}`);
    // Each stage stays whole: the line breaks between stages, never inside one.
    const stages = h("span", { class: "kpi-sub-line" }, h("span", { class: "kpi-stage" }, `${implemented} ·`), " ", h("span", { class: "kpi-stage" }, realised));
    const bundleLine = bundle ? h("span", { class: "kpi-sub-line" }, `incl. ${eur(p.approved_bundle)} bundle`, h("span", { class: "kpi-bundle-word" }, " discount")) : null;
    approved.sub.replaceChildren(...(bundle ? [bundleLine, h("span", { class: "vc-visually-hidden" }, "; "), stages] : [stages]));
  };

  const renderCost = () => {
    if (mode === "simulation") { set(cost, eurCents(0), "", "muted", "simulated: no model calls"); return; }
    const total = sessionBase + runCost;
    let sub;
    if (mode === "live" && running) sub = `this run ${eurCents(runCost)}`;
    else if (lastRunCost !== null) sub = `last run ${eurCents(lastRunCost)}`;
    else sub = total > 0 ? "earlier live runs in this tab" : "no model calls yet";
    set(cost, eurCents(total), "", total > 0 ? "" : "muted", sub);
  };

  bus.on("run_start", (ev) => {
    mode = ev.payload.mode;
    running = true;
    runCost = 0;
    set(identified, "—", "", "muted", "nothing identified yet in this run");
    set(index, "—", "", "muted", "fills from the engine's results");
    renderCost();
  });

  bus.on("kpi_update", (ev) => {
    const p = ev.payload;
    if (p.identified_eur !== undefined) {
      set(identified, eur(p.identified_eur), " a year", p.flagged_groups ? "" : "muted",
        p.flagged_groups ? `${p.flagged_groups} group${p.flagged_groups === 1 ? "" : "s"} flagged` : "no group flagged");
    }
    if (p.index !== undefined && p.index !== null) {
      const scope = p.index_scope === "portfolio" ? "portfolio" : `${p.groups_in_scope} group${p.groups_in_scope === 1 ? "" : "s"} in this run`;
      const projected = p.index_projected !== null && p.index_projected !== undefined ? `projected ${pct(p.index_projected)} after approval` : null;
      set(index, pct(p.index), "", "", projected || scope);
    }
    if (p.approved_eur !== undefined) showApproved({ approved: p.approved_eur, approved_bundle: p.approved_bundle_eur || 0, implemented: p.implemented_eur, realised: p.realised_eur });
  });

  bus.on("cost_update", (ev) => {
    if (ev.payload.simulated) return;
    runCost = Number(ev.payload.eur) || 0;
    renderCost();
  });

  bus.on("run_end", () => {
    running = false;
    if (mode === "live") {
      sessionBase += runCost;
      lastRunCost = runCost;
      runCost = 0;
      writeSessionCost(sessionBase);
    }
    renderCost();
  });

  function reset() {
    mode = null;
    running = false;
    runCost = 0;
    set(identified, "—", "", "muted", "no run yet");
    set(index, "—", "", "muted", "no run yet");
    showApproved(pipeline);
    renderCost();
  }

  /** Adds a cost outside a run (a Diagnostics probe). */
  function addSessionCost(eurValue) {
    sessionBase += Number(eurValue) || 0;
    writeSessionCost(sessionBase);
    renderCost();
  }

  reset();
  return { reset, addSessionCost };
}

function readSessionCost() {
  try { return Number(sessionStorage.getItem(STORAGE.sessionCost)) || 0; } catch { return 0; }
}

function writeSessionCost(v) {
  try { sessionStorage.setItem(STORAGE.sessionCost, String(v)); } catch { /* storage unavailable */ }
}
