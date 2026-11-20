// The board's numbers as tables, one click away in both views (Vici's data-visualisation guideline):
// the group's pairs with their price, share, gap, justified and unexplained parts, its lines and its
// exclusions; the portfolio's flagged groups and the value pipeline. The same figures as the charts.

import { h } from "./dom.js";
import { eur, pct, qty, unitPrice, shortDate } from "./format.js";
import { indexOf } from "./erp.js";

const city = (world, id) => (indexOf(world).plant.get(String(id))?.city || String(id)).replace(" am Main", "");
const th = (text, num = false) => h("th", { scope: "col", class: num ? "num" : null }, text);
const td = (text, num = false) => h("td", { class: num ? "num vc-tabular" : null }, text);

/** The group's tables. compared: the benchmark and the gaps are shown only after pv_compare. */
export function renderGroupTable(world, a, { compared = true } = {}) {
  const ix = indexOf(world);
  const dq = a.display_quantity;
  const bu = a.base_unit;
  const pairs = a.pairs.slice().sort((x, y) => x.price - y.price || x.id.localeCompare(y.id));
  const wrap = h("div", { class: "board-tables" });
  wrap.append(h("table", { class: "vc-table vc-table--compact board-table", dataset: { table: "pairs" } },
    h("caption", {}, `${a.label}: pairs${compared && a.benchmark ? `, benchmark ${unitPrice(a.benchmark.price, dq, bu)} (${a.benchmark.pair})` : ""}`),
    h("thead", {}, h("tr", {}, th("Plant"), th("Supplier"), th("Quantity", true), th("Normalised price", true), th("Share", true), th("Gap", true), th("Justified", true), th("Unexplained, a year", true))),
    h("tbody", {}, pairs.map((p) => h("tr", { dataset: { pair: p.id, price: p.price, unexplained: p.unexplained } },
      h("th", { scope: "row" }, `${city(world, p.plant)} (${p.plant})`),
      td(`${ix.supplier.get(p.supplier)?.name || p.supplier} (${p.supplier})`),
      td(qty(p.quantity, bu), true),
      td(unitPrice(p.price, dq, bu), true),
      td(pct(p.share), true),
      td(compared ? eur(p.gap) : "—", true),
      td(compared ? eur(p.justified) : "—", true),
      td(compared ? eur(p.unexplained) : "—", true)))),
    compared ? h("tfoot", {}, h("tr", {},
      h("th", { scope: "row", colspan: 2 }, `Group: spread ${pct(a.spread)}, index ${pct(a.index)}`),
      td(qty(a.quantity, bu), true), td(`spend ${eur(a.spend)}`, true), td("", true), td(eur(a.gap), true), td(eur(a.justified), true), td(eur(a.unexplained), true))) : null));
  wrap.append(h("table", { class: "vc-table vc-table--compact board-table", dataset: { table: "lines" } },
    h("caption", {}, `Lines (${a.lines.length})`),
    h("thead", {}, h("tr", {}, th("Line"), th("Pair"), th("Day"), th("Quantity", true), th("Normalised price", true), th("Unexplained", true))),
    h("tbody", {}, a.lines.slice().sort((x, y) => x.pair.localeCompare(y.pair) || x.order_day - y.order_day).map((l) => h("tr", { dataset: { line: l.id, price: l.price } },
      h("th", { scope: "row" }, l.id), td(l.pair), td(shortDate(l.order_day)), td(qty(l.quantity, bu), true), td(unitPrice(l.price, dq, bu), true), td(compared ? eur(l.unexplained) : "—", true))))));
  if (a.excluded.length) {
    wrap.append(h("p", { class: "board-excluded" }, `Excluded from every figure: ${a.excluded.map((e) => `${e.id} (${e.reason})`).join("; ")}.`));
  }
  return wrap;
}

/** The portfolio's tables: flagged groups and the value pipeline. */
export function renderPortfolioTable(model) {
  return h("div", { class: "board-tables" },
    h("table", { class: "vc-table vc-table--compact board-table", dataset: { table: "flagged" } },
      h("caption", {}, "Flagged groups"),
      h("thead", {}, h("tr", {}, th("Group"), th("Opportunity, a year", true), th("Spread", true), th("Index", true))),
      h("tbody", {}, model.bars.length ? model.bars.map((b) => h("tr", { dataset: { group: b.id, value: b.value } }, h("th", { scope: "row" }, `${b.label} (${b.id})`), td(eur(b.value), true), td(b.spreadText, true), td(b.indexText, true)))
        : h("tr", {}, h("td", { colspan: 4 }, model.swept ? "No group is flagged." : "No sweep in this run yet.")))),
    h("table", { class: "vc-table vc-table--compact board-table", dataset: { table: "pipeline" } },
      h("caption", {}, "Value pipeline"),
      h("thead", {}, h("tr", {}, th("Stage"), th("Value", true), th("Definition"))),
      h("tbody", {}, model.stages.map((s) => h("tr", { dataset: { stage: s.key, value: s.value ?? "" } }, h("th", { scope: "row" }, s.label), td(s.valueText, true), td(s.definition))))));
}
