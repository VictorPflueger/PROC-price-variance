// Draws one step of js/story.js into the page: the stage on the left (what to look at) and the story on
// the right (what it means, the agent's words, the decision log). Every number comes in as text. Lilac
// marks what the agent wrote or suggested: its words, its recommendation, its drafts.

import { ACCEPT_REASONS } from "./options.js";

const STAGE_TITLES = {
  booked: "Prices as booked", normalise: "Like for like", gap: "Each plant against the best price",
  options: "Ways to close the gap", drafts: "Drafts for your approval", confirm: "The lines the agent found", wait: "", empty: ""
};
const eur0 = (x) => `€${Math.round(x).toLocaleString("en-GB")}`;

/** A tiny element builder: h("p", { class: "x" }, "text", child). */
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid instanceof Node ? kid : String(kid));
  return el;
}
const icon = (name) => h("span", { class: `vc-icon vc-icon--${name}`, "aria-hidden": "true" });

let drawn = "";

/** Draws a step; a step that reads as it did is left as it is, so focus and selection stay put. */
export function renderStep(step, act) {
  const key = JSON.stringify(step);
  if (key === drawn) return;
  drawn = key;
  const stage = document.getElementById("stage-body");
  document.getElementById("stage-title").textContent = STAGE_TITLES[step.stage.kind] || "";
  document.getElementById("stage-title").hidden = !STAGE_TITLES[step.stage.kind];
  stage.replaceChildren(...(STAGES[step.stage.kind] || STAGES.empty)(step.stage, act));
  stage.dataset.kind = step.stage.kind;

  document.getElementById("story-title").textContent = step.title;
  document.getElementById("story-lead").textContent = step.lead;
  const working = document.getElementById("story-working");
  working.hidden = !step.working;
  document.getElementById("story-working-text").textContent = step.working || "";
  const said = [...step.agent, ...(step.recommendation ? [step.recommendation] : [])];
  document.getElementById("agent").hidden = !said.length;
  document.getElementById("agent-text").replaceChildren(...said.map((t) => h("p", {}, ...labelled(t))));
}

/** The decision log under the agent's words: who approved what, and when. Closed until opened. */
export function renderLog(entries) {
  const log = document.getElementById("log");
  log.hidden = !entries.length;
  if (!entries.length) return;
  const time = (at) => (at ? new Date(at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "");
  document.getElementById("log-summary").textContent = `Decision log: ${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;
  document.getElementById("log-list").replaceChildren(...entries.map((e) => h("li", {}, e.at ? h("time", { datetime: e.at }, time(e.at)) : null, ` ${e.who} ${e.what}`)));
}

/** "Hypothesis: …" shows its label in bold, as the agent writes it. */
function labelled(t) {
  const m = /^(Hypothesis|Revised|Check|Finding|Recommended|Recommendation):\s/.exec(t);
  return m ? [h("strong", {}, `${m[1]}:`), ` ${t.slice(m[0].length)}`] : [t];
}

const STAGES = {
  wait: () => [h("p", { class: "stage-empty" }, h("span", { class: "vc-spinner vc-spinner--sm", "aria-hidden": "true" }), " The agent is working on it.")],
  empty: (s) => [h("p", { class: "stage-empty" }, s.text || "")],

  booked: (s) => [h("div", { class: "vc-table-wrap" }, h("table", { class: "vc-table vc-table--compact booked" },
    h("caption", { class: "vc-visually-hidden" }, "Every price of the item as its orders book it"),
    h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "Plant and supplier"), h("th", { scope: "col" }, "As booked"), h("th", { scope: "col", class: "vc-num" }, "Orders"))),
    h("tbody", {}, s.rows.map((r) => h("tr", {},
      h("th", { scope: "row" }, r.who, r.contract ? h("span", { class: "vc-tag vc-tag--sm vc-tag--success tag-contract" }, "contract") : null, r.text ? h("span", { class: "cell-note" }, r.text) : null),
      h("td", {}, r.booked, r.freight ? h("span", { class: "cell-note" }, "freight not included") : null),
      h("td", { class: "vc-num" }, String(r.orders)))))))],

  normalise: (s) => [h("div", { class: "normalise" },
    s.card ? h("figure", { class: "conv" },
      h("figcaption", {}, "One order, step by step", h("span", { class: "cell-note" }, s.card.who)),
      h("ol", { class: "conv-steps" }, s.card.rows.map((r, i) => h("li", { dataset: { last: String(i === s.card.rows.length - 1) } },
        h("span", { class: "conv-label" }, r.label), h("span", { class: "conv-value vc-tabular" }, r.value), r.note ? h("span", { class: "conv-note" }, r.note) : null)))) : null,
    h("div", { class: "vc-table-wrap" }, h("table", { class: "vc-table vc-table--compact like" },
      h("caption", { class: "vc-visually-hidden" }, "Every plant and supplier, as booked and like for like"),
      h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "Plant and supplier"), h("th", { scope: "col", class: "vc-num" }, "Like for like"))),
      h("tbody", {}, s.rows.map((r) => h("tr", {}, h("th", { scope: "row" }, r.who), h("td", { class: "vc-num" }, r.comparable))))))),
    s.excluded ? h("p", { class: "stage-note" }, `${s.excluded === 1 ? "One order is" : `${s.excluded} orders are`} booked in a unit with no conversion and stay${s.excluded === 1 ? "s" : ""} out of every figure.`) : null],

  gap: (s) => {
    const scale = s.max * 1.08;
    const at = (x) => `${(x / scale) * 100}%`;
    const rows = s.bars.map((b) => {
      const over = s.bar !== null ? Math.max(0, b.value - s.bar) : 0;
      const just = b.justified + b.unexplained > 0 ? b.justified / (b.justified + b.unexplained) : 0;
      const base = h("span", { class: "bar-base" });
      const j = h("span", { class: "bar-justified" });
      const u = h("span", { class: "bar-unexplained" });
      const mark = h("span", { class: "bar-mark" });
      base.style.width = at(over ? s.bar : b.value);
      j.style.width = at(over * just);
      u.style.width = at(over * (1 - just));
      if (s.bar !== null) mark.style.left = at(s.bar);
      const year = b.best ? "the best price at volume" : b.small ? `${Math.round(b.share * 1000) / 10} % of the volume: too small to set the bar` : b.unexplained + b.justified > 0
        ? `${eur0(b.unexplained)} a year unexplained${b.justified > 0 ? `, ${eur0(b.justified)} justified` : ""}` : "at or below the best price";
      return h("li", { class: "bar", dataset: { best: String(!!b.best), small: String(!!b.small) } },
        h("span", { class: "bar-who" }, b.who),
        h("span", { class: "bar-track", "aria-hidden": "true" }, base, j, u, s.bar !== null ? mark : null),
        h("span", { class: "bar-price vc-tabular" }, b.label),
        h("span", { class: "bar-year vc-tabular" }, year));
    });
    return [h("div", { class: "gap-chart" },
      h("p", { class: "bar bar-head", "aria-hidden": "true" }, h("span", {}, "Plant and supplier"), h("span", {}, `${s.unit}, from zero`), h("span", { class: "bar-price" }, "Price"), h("span", {}, "A year")),
      h("ul", { class: "bars", "aria-label": `Each plant and supplier's price in ${s.unit}` }, rows)),
      h("ul", { class: "legend", "aria-label": "Legend" },
        h("li", {}, h("span", { class: "legend-mark legend-mark--best" }), `best price at volume${s.best ? `, ${s.best}` : ""}`),
        h("li", {}, h("span", { class: "legend-mark legend-mark--unexplained" }), "no reason explains it"),
        h("li", {}, h("span", { class: "legend-mark legend-mark--justified" }), "an urgent order with a recorded reason"))];
  },

  options: (s, act) => {
    const accept = s.cards.find((c) => c.id === "accept");
    const select = h("select", { class: "vc-select vc-select--sm", id: "accept-reason", "aria-label": "Reason for accepting the gap", disabled: accept?.status !== "open" },
      h("option", { value: "" }, "Choose a reason"), ...(accept?.reasons || ACCEPT_REASONS).map((r) => h("option", { value: r }, r.replace(/^./, (c) => c.toUpperCase()))));
    return [h("ul", { class: "options" }, s.cards.filter((c) => c.id !== "accept").map((c) => h("li", { class: "option", dataset: { option: c.id, status: c.status, recommended: String(c.recommended) } },
      h("div", { class: "option-text" },
        h("p", { class: "option-title" }, c.title, c.recommended ? h("span", { class: "vc-tag vc-tag--sm vc-tag--feature" }, icon("sparkle"), "Recommended") : null),
        c.risk ? h("p", { class: "option-risk" }, c.risk) : null),
      h("dl", { class: "option-figures vc-tabular" },
        h("div", {}, h("dt", {}, "Savings a year"), h("dd", {}, eur0(c.savings))),
        h("div", {}, h("dt", {}, "One-off cost"), h("dd", {}, eur0(c.oneOff))),
        h("div", {}, h("dt", {}, "First saving"), h("dd", {}, c.days === null || c.days === undefined ? "none" : `after ${c.days} days`))),
      c.status === "approved" ? h("p", { class: "option-state" }, icon("check"), "Approved")
        : h("button", { type: "button", class: `vc-button${c.recommended ? "" : " vc-button--outline"} option-approve`, disabled: c.status !== "open", onclick: () => act.approve(c.id) }, "Approve")))),
    accept ? h("div", { class: "option option--accept", dataset: { status: accept.status } },
      h("div", { class: "option-text" }, h("p", { class: "option-title" }, "Accept the gap"), h("p", { class: "option-risk" }, `Nothing changes; ${eur0(accept.residual)} a year stays unexplained.`)),
      select,
      accept.status === "approved" ? h("p", { class: "option-state" }, icon("check"), "Accepted")
        : h("button", { type: "button", class: "vc-button vc-button--ghost", disabled: accept.status !== "open", onclick: () => select.value ? act.accept(select.value) : select.focus() }, "Accept")) : null];
  },

  drafts: (s, act) => [h("ul", { class: "drafts" }, s.drafts.map((d) => h("li", { class: "draft", dataset: { status: d.status } },
    h("div", { class: "draft-head" },
      h("span", { class: "vc-tag vc-tag--sm vc-tag--feature" }, icon("sparkle"), "Draft"),
      h("span", { class: "draft-kind" }, d.label),
      h("span", { class: "draft-status" }, d.status === "pending" ? "waits for you" : d.status === "approved" ? "approved, not sent" : "rejected")),
    h("p", { class: "draft-to" }, `To: ${d.to}`),
    h("p", { class: "draft-subject" }, d.subject),
    h("div", { class: "draft-body" }, d.body.split(/\n{2,}/).map((p) => h("p", {}, p))),
    d.status === "pending" ? h("div", { class: "draft-actions" },
      h("button", { type: "button", class: "vc-button vc-button--sm", onclick: () => act.draft(d.id, "approved") }, icon("check"), "Approve"),
      h("button", { type: "button", class: "vc-button vc-button--sm vc-button--ghost", onclick: () => act.draft(d.id, "rejected") }, "Reject")) : null))),
  s.outcome ? h("p", { class: "outcome" }, icon("check"), s.outcome) : null],

  confirm: (s, act) => {
    const groups = new Map();
    for (const r of s.rows) {
      const k = `${r.plant}|${r.text}|${r.booked}`;
      groups.set(k, { ...r, orders: (groups.get(k)?.orders || 0) + 1 });
    }
    return [h("div", { class: "vc-table-wrap" }, h("table", { class: "vc-table vc-table--compact confirm" },
      h("caption", { class: "vc-visually-hidden" }, "The free-text orders the agent proposes as one service"),
      h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "Plant"), h("th", { scope: "col" }, "What the order says"), h("th", { scope: "col" }, "As booked"), h("th", { scope: "col", class: "vc-num" }, "Orders"))),
      h("tbody", {}, [...groups.values()].map((r) => h("tr", {}, h("th", { scope: "row" }, r.plant), h("td", {}, r.text), h("td", {}, r.booked), h("td", { class: "vc-num" }, String(r.orders))))))),
    h("div", { class: "confirm-actions" },
      h("button", { type: "button", class: "vc-button", onclick: () => act.confirm(true) }, icon("check"), "Same service"),
      h("button", { type: "button", class: "vc-button vc-button--outline", onclick: () => act.confirm(false) }, "Not the same"))];
  }
};
