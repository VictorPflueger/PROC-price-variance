// The portfolio view (brief §9): the flagged groups as a sorted bar chart of opportunity (from zero, no
// pies or donuts), each with its spread and index, and below it the value pipeline: identified,
// approved, implemented and realised as four labelled bars with their definitions one click away and
// the past case's leakage named. Series colours are teal and apricot with Vici's greys (css/board.css);
// never merlot, fjord, lilac, honey or a state colour, which mean something else here.

import { h } from "./dom.js";
import { icon } from "./icons.js";
import { eur, int } from "./format.js";

/** model: portfolioModel(); handlers: { onGroup(id) } */
export function renderPortfolio(model, { onGroup } = {}) {
  const wrap = h("div", { class: "portfolio" });
  const head = h("h3", { class: "portfolio-title" }, "Flagged groups, unexplained € a year");
  wrap.append(head);
  if (!model.swept) {
    wrap.append(h("p", { class: "portfolio-empty" }, "A Live sweep ranks every comparable group by its unexplained variance; the flagged ones appear here as bars."));
  } else if (!model.bars.length) {
    wrap.append(h("p", { class: "portfolio-empty" }, "No group is flagged at the materiality parameters."));
  } else {
    wrap.append(h("ol", { class: "bars", "aria-label": "Flagged groups by opportunity, largest first" },
      model.bars.map((b) => h("li", { class: "bar-row", dataset: { group: b.id, value: b.value } },
        h("button", { class: "bar-label", type: "button", title: `Open ${b.label} in the group view`, on: { click: () => onGroup?.(b.id) } }, b.label),
        h("span", { class: "bar-track", "aria-hidden": "true" }, h("span", { class: "bar-fill series-1", style: { width: `${(b.share * 100).toFixed(2)}%` } })),
        h("span", { class: "bar-value vc-tabular" }, b.valueText),
        h("span", { class: "bar-sub" }, `spread ${b.spreadText} · index ${b.indexText}`)))));
  }
  const defs = h("details", { class: "pipeline-defs" }, h("summary", {}, icon("info", 16), "Definitions"),
    h("dl", {}, model.stages.map((s) => [h("dt", {}, s.label), h("dd", {}, s.definition)])));
  wrap.append(
    h("div", { class: "pipeline-head" }, h("h3", { class: "portfolio-title" }, "Value pipeline"), defs),
    h("ol", { class: "bars pipeline", "aria-label": "Value pipeline: identified, approved, implemented, realised" },
      model.stages.map((s, i) => h("li", { class: "bar-row", dataset: { stage: s.key, value: s.value ?? "" } },
        h("span", { class: "bar-label bar-label--static" }, s.label),
        h("span", { class: "bar-track", "aria-hidden": "true" }, h("span", { class: `bar-fill series-${i + 1}`, style: { width: `${(s.share * 100).toFixed(2)}%` } })),
        h("span", { class: "bar-value vc-tabular" }, s.valueText),
        h("span", { class: "bar-sub" }, s.key === "approved" && model.bundle > 0 ? `of which bundle discount ${eur(model.bundle)}`
          : s.key === "realised" && model.leakage ? `leakage: ${int(model.leakage.lines)} line${model.leakage.lines === 1 ? "" : "s"} to another supplier, ${eur(model.leakage.missed)} missed`
            : s.key === "identified" && s.value === null ? "nothing identified yet in this run" : "")))));
  return wrap;
}
