// Options tab: the engine's costed options (H harmonise, R renegotiate, B bundle) that the agent put on
// screen, plus accepting the variance with a reason, and the decision gate (brief §9). Every figure on
// a card is the engine's, by option id; the agent wrote only the titles and texts. Card state follows
// option_decision events, so live and simulated runs behave alike. Approval is a decision, not a
// saving: an approved card reads "approved", never "saved".

import { bus } from "./events.js";
import { h, clear } from "./dom.js";
import { icon } from "./icons.js";
import { eur, pct } from "./format.js";
import { renderInline } from "./md.js";
import { aiLabel } from "./ai_label.js";
import { ACCEPT_REASONS } from "./options.js";

const days = (n) => (n === null || n === undefined ? "—" : `${n} day${n === 1 ? "" : "s"}`);

export function createOptionsPanel(panel, { onDecision, onCount } = {}) {
  let current = null;           // the options payload on screen
  const status = new Map();     // option id -> "approved" | "rejected" | "not_selected"
  let acceptedReason = null;
  let locked = false;           // true once a decision was approved
  let ended = false;            // the run ended before a decision
  let refocus = false;

  function empty() {
    clear(panel);
    panel.appendChild(h("div", { class: "vc-empty empty" },
      h("strong", { class: "vc-empty__title" }, "No options yet"),
      h("p", { class: "vc-empty__text" }, "Once the engine has compared a flagged group and the agent has raised its alert, the costed options and accepting the variance appear here for your decision.")));
  }

  function render() {
    clear(panel);
    if (!current) return empty();
    const options = current.options.filter((o) => o.id !== "accept");
    const accept = current.options.find((o) => o.id === "accept");
    const pending = !locked && !ended;
    const summary = h("div", { class: "options-summary" },
      h("div", { class: "options-summary-head" },
        h("h3", {}, pending ? "Decide how to close the gap" : locked ? "Decision taken" : "Run ended before a decision"),
        aiLabel("options")),
      h("p", {}, `${current.label}: ${eur(current.opportunity)} a year unexplained. Savings are a year; the one-off cost comes once. Every figure comes from the engine.`),
      h("table", { class: "vc-table vc-table--compact options-table" },
        h("caption", { class: "vc-visually-hidden" }, "The options' figures"),
        h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "Option"), h("th", { scope: "col", class: "num" }, "Savings a year"), h("th", { scope: "col", class: "num" }, "One-off"), h("th", { scope: "col", class: "num" }, "Less one-off"))),
        h("tbody", {}, options.map((o) => h("tr", { dataset: { recommended: String(!!o.recommended) } },
          h("th", { scope: "row" }, o.id, o.recommended ? h("span", { class: "vc-visually-hidden" }, " (recommended)") : null),
          h("td", { class: "num vc-tabular" }, eur(o.savings)),
          h("td", { class: "num vc-tabular" }, eur(o.one_off)),
          h("td", { class: "num vc-tabular" }, eur(o.net)))))),
      current.reason ? h("p", { class: "options-reason" }, h("strong", {}, "Recommendation: "), `option ${current.recommended}. `, renderInline(current.reason, h("span"))) : null);

    const grid = h("div", { class: "options-grid" });
    for (const o of options) grid.appendChild(optionCard(o));
    if (accept) grid.appendChild(acceptCard(accept));
    panel.appendChild(h("div", { class: "options-layout" }, summary, grid));
    if (refocus) {
      refocus = false;
      const next = panel.querySelector(".option-actions button:not([aria-disabled='true'])");
      const target = next || panel.querySelector(".option-status")?.closest(".option-card");
      if (target) {
        if (!next) target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: false });
      }
    }
  }

  function figures(o) {
    return h("dl", { class: "option-figures" },
      h("dt", {}, "Savings a year"), h("dd", { class: "vc-tabular" }, eur(o.savings), o.bundle > 0 ? h("span", { class: "option-part" }, ` of which bundle discount ${eur(o.bundle)}`) : null),
      h("dt", {}, "One-off cost"), h("dd", { class: "vc-tabular spend" }, eur(o.one_off)),
      h("dt", {}, "Savings less one-off"), h("dd", { class: "vc-tabular" }, eur(o.net)),
      h("dt", {}, "First saving after"), h("dd", { class: "vc-tabular" }, days(o.days_to_first_saving)),
      h("dt", {}, "Unexplained after"), h("dd", { class: "vc-tabular" }, `${eur(o.residual)} a year, index ${pct(o.index_after)}`),
      o.share_after !== undefined ? h("dt", {}, "Supplier's share after") : null,
      o.share_after !== undefined ? h("dd", { class: "vc-tabular" }, pct(o.share_after)) : null);
  }

  function optionCard(o) {
    const st = status.get(o.id) || (locked ? "not_selected" : ended ? "expired" : "");
    return h("article", { class: "vc-card option-card", dataset: { recommended: String(!!o.recommended), status: st, kind: "option", option: o.id }, "aria-label": `Option ${o.id}: ${o.title}` },
      h("div", { class: "option-top" },
        h("span", { class: "option-letter", "aria-hidden": "true" }, o.id),
        h("h4", { class: "option-title" }, o.title),
        o.recommended ? h("span", { class: "vc-tag vc-tag--solid" }, "Recommended") : null),
      o.description ? renderInline(o.description, h("p", { class: "option-desc" })) : null,
      figures(o),
      (o.warnings || []).length ? h("p", { class: "option-risk" }, icon("alert", 16), (o.warnings || []).join(" ")) : null,
      o.residual_risk ? h("p", { class: "option-risk" }, h("strong", {}, "Residual risk: "), o.residual_risk) : null,
      actionsFor(o, st));
  }

  function acceptCard(a) {
    const st = status.get("accept") || (locked ? "not_selected" : ended ? "expired" : "");
    const select = h("select", { class: "vc-select accept-reason", id: `accept-reason-${current.options_seq}`, "aria-label": "Reason for accepting the variance" },
      h("option", { value: "" }, "Choose a reason…"),
      ACCEPT_REASONS.map((r) => h("option", { value: r }, r)));
    const btn = h("button", { class: "vc-button vc-button--outline", type: "button", dataset: { action: "accept" }, "aria-disabled": "true" }, "Accept the variance");
    select.addEventListener("change", () => btn.setAttribute("aria-disabled", select.value ? "false" : "true"));
    btn.addEventListener("click", () => {
      if (!select.value) { select.focus(); return; }
      decide(a, "approved", select.value);
    });
    return h("article", { class: "vc-card option-card", dataset: { kind: "accept", status: st, option: "accept" }, "aria-label": "Accept the variance" },
      h("div", { class: "option-top" },
        h("span", { class: "option-letter", "aria-hidden": "true" }, "–"),
        h("h4", { class: "option-title" }, "Accept the variance")),
      h("p", { class: "option-desc" }, "Record the variance with a reason. Nothing changes for the suppliers, and nothing counts as approved savings."),
      h("dl", { class: "option-figures" },
        h("dt", {}, "Savings a year"), h("dd", { class: "vc-tabular" }, eur(0)),
        h("dt", {}, "Unexplained stays"), h("dd", { class: "vc-tabular" }, `${eur(a.residual)} a year, index ${pct(a.index_after)}`)),
      st ? actionsFor(a, st) : h("div", { class: "option-actions accept-actions" }, h("label", { class: "vc-label vc-visually-hidden", for: select.id }, "Reason"), select, btn));
  }

  function actionsFor(o, st) {
    if (st === "approved") return h("div", { class: "option-status" }, h("span", { class: "vc-tag vc-tag--success" }, icon("check", 20), o.id === "accept" ? `Variance accepted: ${acceptedReason || "with a reason"}` : "Approved"));
    if (st === "rejected") return h("div", { class: "option-status" }, h("span", { class: "vc-tag vc-tag--danger" }, icon("x", 20), "Rejected"));
    if (st === "not_selected") return h("div", { class: "option-status" }, h("span", { class: "vc-tag" }, "Not selected"));
    if (st === "expired") return h("div", { class: "option-status" }, h("span", { class: "vc-tag" }, "No decision: the run ended"));
    return h("div", { class: "option-actions" },
      // The recommended option's Approve is the one solid merlot button; the others are Vici's
      // secondary (soft merlot) buttons. Reject is a neutral decision, not an alarm.
      h("button", { class: `vc-button${o.recommended ? "" : " vc-button--secondary"}`, type: "button", dataset: { action: "approve" }, on: { click: () => decide(o, "approved") } }, icon("check", 18), "Approve"),
      h("button", { class: "vc-button vc-button--outline", type: "button", dataset: { action: "reject" }, on: { click: () => decide(o, "rejected") } }, "Reject"));
  }

  function decide(o, decision, reason = null) {
    if (locked || !current || ended) return;
    refocus = panel.contains(document.activeElement);
    onDecision?.({
      option_id: o.id,
      option_label: o.id === "accept" ? `Accept the variance (${reason})` : `Option ${o.id}: ${o.title}`,
      options_seq: current.options_seq ?? null,
      decision,
      ...(reason ? { reason } : {})
    });
  }

  bus.on("options", (ev) => {
    current = ev.payload;
    status.clear();
    acceptedReason = null;
    locked = false;
    ended = false;
    render();
    onCount?.(current.options?.length || 0, true);
  });

  bus.on("option_decision", (ev) => {
    const { option_id: id, decision, options_seq: seq, reason } = ev.payload;
    if (!current || (seq !== undefined && seq !== (current.options_seq ?? null))) return; // an older set
    if (locked) return;
    if (id === "accept" && !reason) return;
    status.set(id, decision);
    if (decision === "approved") {
      locked = true;
      if (id === "accept") acceptedReason = reason;
      for (const o of current.options) if (o.id !== id) status.set(o.id, "not_selected");
    }
    render();
    onCount?.(current.options.length, !locked);
  });

  bus.on("run_end", () => {
    if (!current || locked) return;
    ended = true;
    render();
    onCount?.(current.options.length, false);
  });

  function reset() {
    current = null;
    status.clear();
    acceptedReason = null;
    locked = false;
    ended = false;
    empty();
    onCount?.(0, false);
  }

  empty();
  return { reset };
}
