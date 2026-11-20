// Popovers of the price board: a line's normalisation step by step (brief §6.3: price per order unit,
// per base unit, in euros, delivered), and a pair's lines and contract. A toggletip in Vici's popover
// look, owned by this module: it opens beside what was clicked, closes on Escape or a click elsewhere,
// and gives focus back.

import { h } from "./dom.js";
import { icon } from "./icons.js";
import { unitPrice, qty, pct, shortDate, int } from "./format.js";
import { indexOf, buyerRole } from "./erp.js";
import { INCOTERM_GROUPS } from "./normalise.js";

let open = null;
document.addEventListener("pointerdown", (e) => { if (open && !open.el.contains(e.target) && !open.anchor.contains(e.target)) closePop(); }, true);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && open) { const a = open.anchor; closePop(); a?.focus?.(); } });
window.addEventListener("resize", () => closePop());

export function closePop() {
  if (!open) return;
  open.el.remove();
  open = null;
}

/** Opens a popover beside `anchor` with a title and content. */
export function openPop(anchor, title, content) {
  closePop();
  const heading = h("strong", { class: "pop-title", tabindex: "-1" }, title);
  const close = h("button", { class: "vc-icon-button pop-close", type: "button", "aria-label": "Close" }, icon("x", 16));
  const el = h("div", { class: "vc-popover board-pop", role: "dialog", "aria-label": title }, h("div", { class: "pop-head" }, heading, close), content);
  close.addEventListener("click", () => { closePop(); anchor?.focus?.(); });
  document.body.appendChild(el);
  const r = anchor.getBoundingClientRect();
  const w = Math.min(380, window.innerWidth - 24);
  el.style.width = `${w}px`;
  el.style.left = `${Math.max(12, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 12))}px`;
  const below = r.bottom + 8;
  const height = el.offsetHeight;
  el.style.top = `${below + height > window.innerHeight - 12 ? Math.max(12, r.top - height - 8) : below}px`;
  open = { el, anchor };
  heading.focus();
  return el;
}

const symbol = (cur) => (cur === "EUR" ? "€" : cur === "GBP" ? "£" : `${cur} `);
const money = (v, cur, dq = 1, unit = "") => {
  const n = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.round(v * dq * 1e9) / 1e9);
  return `${symbol(cur)}${n} per ${dq === 1 ? "" : `${int(dq)} `}${unit}`;
};
const groupOf = (incoterm) => Object.entries(INCOTERM_GROUPS).find(([, rules]) => rules.includes(incoterm))?.[0] || null;

/**
 * A line's normalisation as a definition list, with the line's facts. onBack: returns to its pair's
 * lines (a button at the top of the popover).
 */
export function normalisationContent(world, analysis, lineId, { onBack = null } = {}) {
  const ix = indexOf(world);
  const line = analysis.lines.find((l) => l.id === lineId);
  const raw = ix.po_line.get(lineId);
  const n = line?.normalisation;
  const back = onBack ? h("button", { class: "vc-button vc-button--ghost button-compact pop-back", type: "button", on: { click: onBack } }, icon("chevronLeft", 16), "Back to the pair's lines") : null;
  if (!line || !n || !raw) return h("div", { class: "pop-body" }, back, h("p", {}, "No normalisation for this line."));
  const s = n.steps;
  const dq = analysis.display_quantity;
  const bu = analysis.base_unit;
  const g = groupOf(s.incoterm);
  const rows = [
    ["Price per order unit", money(s.price_per_order_unit, s.currency, 1, n.order_unit), raw.price_unit > 1 ? `net price ${new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2 }).format(raw.net_price)} per ${raw.price_unit} ${raw.order_unit}` : null],
    ["Base units per order unit", `${int(s.base_units_per_order_unit)} ${bu} per ${n.order_unit}`, null],
    ["Price per base unit", money(s.price_per_base_unit, s.currency, dq, bu), null],
    ["Rate to EUR", s.currency === "EUR" ? "euro, no conversion" : `1 ${s.currency} = ${s.rate_to_eur.toLocaleString("en-GB", { maximumFractionDigits: 4 })} EUR`, s.currency === "EUR" ? null : "the window's mean ECB rate"],
    ["In euros", unitPrice(s.price_per_base_unit_eur, dq, bu), null],
    ["Delivery terms", s.incoterm ? `${s.incoterm} (group ${g})` : "none (a service)", s.logistics_uplift ? `main carriage unpaid: + ${pct(s.logistics_uplift)} logistics uplift (an assumption)` : s.incoterm ? "delivered: no uplift" : null]
  ];
  return h("div", { class: "pop-body" },
    back,
    h("dl", { class: "norm-steps" }, rows.map(([k, v, note]) => [h("dt", {}, k), h("dd", {}, v, note ? h("span", { class: "norm-note" }, note) : null)])),
    h("p", { class: "norm-result" }, h("span", {}, "Normalised, delivered: "), h("strong", { class: "vc-tabular", dataset: { display: n.display } }, n.display)),
    h("p", { class: "norm-facts" },
      `${shortDate(raw.order_day)} · ${int(raw.quantity)} ${raw.order_unit} · ${raw.contract ? `contract ${raw.contract}` : "no contract"}`,
      raw.buyer ? ` · ${buyerRole(world, raw.buyer)}` : "",
      raw.urgent && raw.urgent_reason ? h("span", { class: "norm-urgent", lang: /[àâçéèêëîïôûùüÿœ]|\b(urgent|commande)\b/i.test(raw.urgent_reason) ? "fr" : "de" }, ` · urgent: “${raw.urgent_reason}”`) : null));
}

/**
 * A pair's lines and contract. Every line is a button (at least 40 px) that opens its normalisation:
 * onLine(lineId). marks: the run's marks on lines (the agent read them: "checking" or "checked").
 */
export function pairContent(world, analysis, pairId, { onLine = null, marks = new Map() } = {}) {
  const ix = indexOf(world);
  const p = analysis.pairs.find((x) => x.id === pairId);
  if (!p) return h("p", {}, "Unknown pair.");
  const materials = [...new Set(analysis.lines.map((l) => l.material).filter(Boolean))];
  const contracts = (world.contract || []).filter((c) => c.supplier === p.supplier && materials.includes(c.material));
  const dq = analysis.display_quantity;
  const bu = analysis.base_unit;
  const lines = analysis.lines.filter((l) => l.pair === pairId).sort((a, b) => a.order_day - b.order_day || a.id.localeCompare(b.id));
  const read = (id) => ["checking", "checked"].includes(marks.get(id));
  return h("div", { class: "pop-body" },
    h("p", {}, `${qty(p.quantity, bu)} at ${unitPrice(p.price, dq, bu)} (volume-weighted), ${pct(p.share)} of the group's quantity.`),
    h("p", {}, contracts.length
      ? `Contract ${contracts.map((c) => `${c.id}: ${symbol(c.currency)}${new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2 }).format(c.price)} per ${c.price_unit > 1 ? `${c.price_unit} ` : ""}${c.order_unit}, ${c.incoterm || "no Incoterms"}`).join("; ")}.`
      : "No contract with this supplier for the item."),
    h("p", { class: "pop-lines-head" }, `${lines.length} line${lines.length === 1 ? "" : "s"}: open one for its normalisation`),
    h("ul", { class: "pop-lines", "aria-label": `Lines of pair ${pairId}` }, lines.map((l) => h("li", {},
      h("button", {
        class: "pop-line", type: "button", dataset: { line: l.id, read: String(read(l.id)) },
        "aria-label": `Line ${l.id}, ${shortDate(l.order_day)}, ${unitPrice(l.price, dq, bu)}${l.urgent ? ", urgent with a reason" : ""}${read(l.id) ? ", read by the agent" : ""}: open its normalisation`,
        on: { click: () => onLine?.(l.id) }
      },
      h("span", { class: "pop-line-id" }, l.id),
      h("span", { class: "pop-line-day" }, shortDate(l.order_day)),
      h("span", { class: "pop-line-price vc-tabular" }, unitPrice(l.price, dq, bu)),
      read(l.id) ? h("span", { class: "vc-tag vc-tag--info pop-line-read" }, "read by the agent") : null,
      icon("chevronRight", 16))))),
    h("p", { class: "norm-note" }, `Supplier ${p.supplier}: ${ix.supplier.get(p.supplier)?.name || ""}`));
}
