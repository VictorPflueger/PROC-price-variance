// AI label: Vici's feature tag (lilac, the sparkle and "AI") on content an AI system wrote, which opens
// a short explanation on click: a toggletip in Vici's popover look that stays open until you click
// elsewhere or press Escape (this module owns it; it has no popover attribute for vici.js to bind).
// Used where the agent's words reach a person: the alert, the proposed cluster, the options, each
// draft and the report. Lilac is the AI's colour throughout; merlot stays with the person's decisions.

import { bus } from "./events.js";
import { h } from "./dom.js";
import { icon } from "./icons.js";

let run = { mode: null, model: null, recorded: false };
bus.on("run_start", (ev) => {
  const p = ev.payload || {};
  run = { mode: p.mode, model: p.model_label || p.model || null, recorded: p.sim_source === "recorded", recordedModel: p.recorded_model || null };
});

// What the code guarantees, stated exactly: card and tile figures are engine output; free text is
// checked against the figures the tools returned (js/figures.js).
const ENGINE = "The figures on the cards, the board and the tiles come from the deterministic engine, not from the model.";
const CHECKED = "Every figure in this text was checked in code against the figures the tools returned; a figure no tool returned is refused, or shown with an Unchecked tag.";

function author() {
  if (run.mode === "live") return `Written by the live agent${run.model ? ` (Claude ${run.model})` : ""} during this run.`;
  if (run.recorded) return `Recorded from an earlier live run${run.recordedModel ? ` (Claude ${run.recordedModel})` : ""} and replayed. No model was called now.`;
  return "Authored replay: written in advance for the simulation. No model was called; the engine recalculated every figure.";
}

const KINDS = {
  alert: () => ({
    heading: "AI-raised alert",
    lines: [author(), "Code let the alert through only with this run's evidence: the comparison, three normalised lines (the benchmark pair and the highest pair among them) and the benchmark supplier's contract.", CHECKED]
  }),
  cluster: () => ({
    heading: "AI-proposed cluster",
    lines: [author(), "Similar texts never make lines comparable on their own. These lines count as one group only if you confirm them, with the base unit you choose.", CHECKED]
  }),
  options: () => ({
    heading: "AI-proposed options",
    lines: [author(), "The agent chose which of the engine's options to show and wrote their descriptions.", ENGINE, "Nothing happens until you decide."]
  }),
  draft: () => ({
    heading: "AI-drafted message",
    lines: [author(), CHECKED, "Check names, plants and dates before you approve.", "Approving only marks the draft as cleared: the Price Variance Agent has no email or ERP connection, so nothing is sent or changed."]
  }),
  report: () => ({
    heading: "AI-written report",
    lines: [author(), CHECKED, "The audit export holds every model call and tool result, with the method, world and exchange-rate versions."]
  })
};

let openTip = null;
function closeOpen() { openTip?.close(); }
document.addEventListener("pointerdown", (e) => { if (openTip && !openTip.contains(e.target)) closeOpen(); }, true);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && openTip) { const btn = openTip.button; closeOpen(); btn?.focus(); } });
// Close when the presenter moves the page (not when the log scrolls itself as entries arrive).
window.addEventListener("resize", closeOpen);
for (const type of ["wheel", "touchmove"]) document.addEventListener(type, closeOpen, { capture: true, passive: true });

let counter = 0;

/** An AI label for `kind` ("alert" | "cluster" | "options" | "draft" | "report"). The explanation reflects the current run. */
export function aiLabel(kind) {
  const id = `ai-tip-${++counter}`;
  const button = h("button", {
    class: "ai-label", type: "button", "aria-expanded": "false", "aria-controls": id,
    "aria-label": `AI-generated content: what this means`, title: "AI-generated: click for details"
  }, h("span", { class: "vc-tag vc-tag--feature ai-label-chip", "aria-hidden": "true" }, icon("spark", 14), "AI"));
  const tip = h("div", { class: "vc-popover ai-tip", id, role: "note", hidden: true });
  const wrap = h("span", { class: "ai-label-wrap" }, button, tip);
  wrap.button = button;

  wrap.close = () => {
    tip.hidden = true;
    button.setAttribute("aria-expanded", "false");
    if (openTip === wrap) openTip = null;
  };

  button.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!tip.hidden) return wrap.close();
    closeOpen();
    const { heading, lines } = KINDS[kind]();
    tip.replaceChildren(h("strong", {}, heading), ...lines.map((l) => h("p", {}, l)));
    tip.hidden = false;
    // Fixed position next to the label, kept on screen; no clipping inside scrolling panels.
    const r = button.getBoundingClientRect();
    const w = Math.min(340, window.innerWidth - 24);
    tip.style.width = `${w}px`;
    tip.style.left = `${Math.max(12, Math.min(r.right - w, window.innerWidth - w - 12))}px`;
    const below = r.bottom + 6;
    const height = tip.offsetHeight;
    tip.style.top = `${below + height > window.innerHeight - 12 ? Math.max(12, r.top - height - 6) : below}px`;
    button.setAttribute("aria-expanded", "true");
    openTip = wrap;
  });
  return wrap;
}
