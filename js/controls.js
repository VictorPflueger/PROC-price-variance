// Control bar of version 0.1.0: Start agent (the agent arrives in 0.2.0), the six scenarios and the run
// status. Version 0.2.0 adds Live sweep, the model, the replay speed, Abort, Reset and Diagnostics.

import { h, setDisabled, withTooltip } from "./dom.js";
import { icon } from "./icons.js";
import { runStateLabel } from "./handover.js";

export function createControls(root, { scenarios, initial, onScenario }) {
  const start = h("button", { class: "vc-button", type: "button", id: "btn-start" }, icon("play", 18), h("span", { class: "btn-text" }, "Start agent"));
  setDisabled(start, true);
  const startAnchor = withTooltip(start, "Start agent: the agent arrives in version 0.2.0", { below: true });
  const select = h("select", { class: "vc-select scenario-select", id: "scenario", "aria-label": "Scenario" },
    scenarios.map((s) => h("option", { value: s.id, ...(s.id === initial ? { selected: true } : {}) }, `${s.number}. ${s.title}`)));
  select.addEventListener("change", () => onScenario(select.value));
  const pill = h("div", { class: "vc-tag status-pill", role: "status", "aria-live": "polite", dataset: { tone: "idle" } },
    h("span", { class: "dot", "aria-hidden": "true" }), h("span", { class: "text" }, runStateLabel("idle")));
  root.append(
    startAnchor,
    h("label", { class: "control-field" }, h("span", { class: "control-label" }, "Scenario"), select),
    h("span", { class: "spacer" }),
    pill
  );
  return {
    setScenario(id) { select.value = id; onScenario(id); }
  };
}
