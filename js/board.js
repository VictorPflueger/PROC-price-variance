// The price board of version 0.1.0: the engine's check of the world. Every comparable group of the
// last 365 days at the default parameters and the bundled rates, as js/variance.js ranks them (flagged
// first, then by opportunity), with the scenario in focus framed in ink. Version 0.2.0 replaces it with
// the board's two views, the price ladder of a group and the portfolio, each with its table.

import { h } from "./dom.js";
import { icon } from "./icons.js";
import { eur, pct, qty, unitPrice } from "./format.js";

export function createBoard(root, { rows, scenarios, fx, params }) {
  const rowOf = new Map();
  const sub = (text) => h("span", { class: "cell-sub" }, text);
  const body = h("tbody", {}, rows.map((r) => {
    const tr = h("tr", { dataset: { group: r.id, flagged: String(r.flagged) } },
      h("th", { scope: "row", class: "group-cell" }, h("span", { class: "group-name" }, r.label || r.id), sub(r.kind === "mpn" ? `${r.id}, two material numbers` : r.id)),
      h("td", { class: "num" }, unitPrice(r.benchmark, r.display_quantity, r.base_unit), sub(qty(r.quantity, r.base_unit))),
      h("td", { class: "num" }, eur(r.spend), sub(`${r.lines} lines`)),
      h("td", { class: "num" }, pct(r.spread), sub(`index ${pct(r.index)}`)),
      h("td", { class: "num" }, eur(r.opportunity)),
      h("td", { class: "flag-cell" }, r.flagged
        ? h("span", { class: "vc-tag vc-tag--danger" }, icon("error", 14), "Flagged")
        : h("span", { class: "quiet" }, "No")));
    rowOf.set(r.id, tr);
    return tr;
  }));
  const flagged = rows.filter((r) => r.flagged).length;
  const note = h("p", { class: "board-note" });
  root.append(
    h("div", { class: "board-head" },
      h("div", {},
        h("h2", { class: "board-title" }, "Price board: engine check"),
        h("p", { class: "board-sub" },
          `Every comparable group of GlobalCorp's last ${params.window_days} days at the default parameters: flagged when the opportunity is at least ${eur(params.materiality_eur)} a year and the spread at least ${pct(params.materiality_spread)}. `,
          `Exchange rates: ${fx.label}.`)),
      h("span", { class: "vc-tag board-count" }, `${flagged} of ${rows.length} groups flagged`)),
    note,
    h("div", { class: "board-scroll" },
      h("table", { class: "vc-table engine-table" },
        h("caption", { class: "vc-visually-hidden" }, "Every comparable group with the engine's figures"),
        h("thead", {}, h("tr", {},
          h("th", { scope: "col" }, "Comparable group"),
          h("th", { scope: "col", class: "num" }, "Benchmark", sub("quantity")),
          h("th", { scope: "col", class: "num" }, "Spend", sub("€, 365 days")),
          h("th", { scope: "col", class: "num" }, "Spread", sub("and index")),
          h("th", { scope: "col", class: "num" }, "Opportunity", sub("€ a year")),
          h("th", { scope: "col" }, "Flagged"))),
        body)));

  return {
    /** Frames the scenario's group in ink, or says why it has none (scenario 2 before a confirmation). */
    focus(scenarioId) {
      const s = scenarios.find((x) => x.id === scenarioId);
      for (const tr of rowOf.values()) tr.dataset.focus = "false";
      const tr = s?.group_id ? rowOf.get(s.group_id) : null;
      if (tr) {
        tr.dataset.focus = "true";
        note.textContent = `Scenario ${s.number}, "${s.title}": its group is framed below.`;
        tr.scrollIntoView({ block: "nearest" });
      } else if (s) {
        note.textContent = `Scenario ${s.number}, "${s.title}": its lines are free text and form a group only once a person confirms the cluster the agent proposes, so no row stands for it yet.`;
      }
    }
  };
}
