// The cluster confirmation (brief §6.2 and §9): a dialog through the shell's js/modal.js with the
// candidate lines side by side, one column per plant, each line in the language it was bought in. The
// proposed cluster is the AI's (lilac); the decision is the person's (merlot). The person confirms the
// cluster with its base unit, confirms only the lines still ticked (a split), or rejects it. Only a
// confirmation makes the lines a comparable group. While the dialog waits, the rail shows "Your
// confirmation" on the furthest step reached and the status tag "Awaiting your confirmation".

import { h } from "./dom.js";
import { icon } from "./icons.js";
import { openModal } from "./modal.js";
import { aiLabel } from "./ai_label.js";
import { renderInline } from "./md.js";
import { int } from "./format.js";

const UNIT_WORDS = { PD: "person-day", H: "hour", DAY: "day", EA: "piece", AU: "activity unit" };

/**
 * Opens the dialog for a confirmation_request payload. onAnswer({ request_id, decision, base_unit,
 * line_ids? }) is called once. Returns { close }.
 */
export function openClusterDialog(req, { onAnswer, plantName = (id) => id, personDayHours = 8 }) {
  let answered = false;
  const boxes = new Map();
  const byPlant = new Map();
  for (const l of req.lines) {
    if (!byPlant.has(l.plant)) byPlant.set(l.plant, []);
    byPlant.get(l.plant).push(l);
  }
  const columns = [...byPlant.entries()].map(([plant, lines]) => {
    const texts = [...new Set(lines.map((l) => l.short_text))];
    const qty = lines.reduce((s, l) => s + l.quantity, 0);
    const units = [...new Set(lines.map((l) => l.order_unit))];
    const supplier = [...new Set(lines.map((l) => l.supplier_name || l.supplier))].join(", ");
    const items = lines.map((l) => {
      const box = h("input", { type: "checkbox", class: "vc-checkbox", id: `cl-${l.id}`, checked: true, dataset: { line: l.id } });
      box.addEventListener("change", update);
      boxes.set(l.id, box);
      // The whole row is the checkbox's label: a target of at least 40 px.
      return h("li", { class: "cluster-line" },
        h("label", { class: "cluster-line__label", for: `cl-${l.id}` },
          box,
          h("span", { class: "cluster-line__qty vc-tabular" }, `${int(l.quantity)} ${l.order_unit}`),
          h("span", { class: "cluster-line__price vc-tabular" }, ` at ${l.currency === "EUR" ? "€" : l.currency === "GBP" ? "£" : `${l.currency} `}${Number(l.net_price).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per ${l.price_unit > 1 ? `${l.price_unit} ` : ""}${l.order_unit}`),
          h("span", { class: "vc-visually-hidden" }, `, line ${l.id}`)));
    });
    return h("section", { class: "vc-card cluster-col", dataset: { plant } },
      h("h3", { class: "cluster-col__plant" }, plantName(plant)),
      h("p", { class: "cluster-col__supplier" }, supplier),
      h("ul", { class: "cluster-col__texts", "aria-label": "Order texts as bought" }, texts.map((t) => h("li", { lang: guessLang(t) }, `“${t}”`))),
      h("p", { class: "cluster-col__sum vc-tabular" }, `${lines.length} line${lines.length === 1 ? "" : "s"}, ${int(qty)} ${units.join(" and ")}`),
      h("ul", { class: "cluster-col__lines" }, items));
  });

  const unitName = (u) => (u === "PD" ? `person-day (${personDayHours} hours)` : UNIT_WORDS[u] || u);
  const radios = req.base_units.map((u) => {
    const r = h("input", { type: "radio", class: "vc-radio", name: `cl-base-${req.request_id}`, id: `cl-base-${u}`, value: u, checked: u === req.proposed_base_unit });
    return h("label", { class: "cluster-base__option", for: `cl-base-${u}` }, r, ` ${unitName(u)}`);
  });
  const ev = req.evidence || {};
  const evidence = h("ul", { class: "cluster-evidence" },
    h("li", {}, icon("check", 16), `One material group (${ev.material_group}).`),
    h("li", {}, icon("check", 16), `Units: ${ev.conversion}.`),
    ev.shared_terms?.length ? h("li", {}, icon("check", 16), `Every text names ${ev.shared_terms.join(" ")}.`) : null,
    ev.differing_terms?.length ? h("li", { class: "cluster-evidence__diff" }, icon("alert", 16), `Words only some texts use: ${ev.differing_terms.map((d) => `${d.term} (${d.lines} of ${req.lines.length} lines)`).join(", ")}. Weigh them before you confirm.`) : null);

  const msg = h("p", { class: "vc-help field-msg", role: "status" });
  const confirmAll = h("button", { class: "vc-button", type: "button", dataset: { action: "confirm" } }, icon("check", 18), "Confirm group");
  const confirmSome = h("button", { class: "vc-button vc-button--secondary", type: "button", dataset: { action: "split" }, "aria-disabled": "true" }, "Confirm selected");
  const reject = h("button", { class: "vc-button vc-button--outline", type: "button", dataset: { action: "reject" } }, "Reject");

  function chosen() { return [...boxes.entries()].filter(([, b]) => b.checked).map(([id]) => id); }
  function baseUnit() { return radios.map((l) => l.querySelector("input")).find((r) => r.checked)?.value || req.proposed_base_unit; }
  function update() {
    const n = chosen().length;
    const all = n === boxes.size;
    confirmAll.setAttribute("aria-disabled", String(!all));
    confirmSome.setAttribute("aria-disabled", String(all || n < 2));
    msg.textContent = all ? "" : n < 2 ? "Tick at least two lines to confirm a smaller group." : `${n} of ${boxes.size} lines ticked: Confirm selected makes them the group; the rest stay out.`;
  }
  function answer(decision) {
    if (answered) return;
    if (decision === "confirmed" && confirmAll.getAttribute("aria-disabled") === "true") return;
    if (decision === "split" && confirmSome.getAttribute("aria-disabled") === "true") return;
    answered = true;
    modal.close(decision);
    onAnswer({ request_id: req.request_id, decision, ...(decision === "rejected" ? {} : { base_unit: baseUnit() }), ...(decision === "split" ? { line_ids: chosen() } : {}) });
  }
  confirmAll.addEventListener("click", () => answer("confirmed"));
  confirmSome.addEventListener("click", () => answer("split"));
  reject.addEventListener("click", () => answer("rejected"));

  const modal = openModal({
    title: "Are these the same service?",
    intro: "The agent proposes these free-text lines as one comparable group. They count only if you confirm them, with the base unit you choose.",
    size: "wide",
    className: "cluster-modal",
    dismissible: false,
    body: [
      h("div", { class: "cluster-proposal" }, h("span", { class: "vc-tag vc-tag--feature" }, "Proposed by the agent"), aiLabel("cluster")),
      req.note ? renderInline(req.note, h("p", { class: "cluster-note" })) : null,
      h("div", { class: "cluster-cols" }, columns),
      h("h3", { class: "cluster-sub" }, "Evidence"),
      evidence,
      h("fieldset", { class: "cluster-base" }, h("legend", {}, "Base unit for the comparison"), radios),
      msg
    ],
    footer: [reject, confirmSome, confirmAll]
  });
  update();
  return { close: () => { if (!answered) { answered = true; modal.close(null); } } };
}

/** The language of an order text, roughly, for the lang attribute (screen readers pronounce it right). */
function guessLang(t) {
  if (/\b(tarif|journalier|prestation|forfait|horaire|de|du|des)\b/i.test(t)) return "fr";
  if (/\b(Berater|Tagessatz|Stunden|Abrechnung|nach|Stundensatz)\b/.test(t)) return "de";
  return "en";
}
