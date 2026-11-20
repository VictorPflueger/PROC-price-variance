// Agent console of version 0.1.0: the progress rail (Spot, Check, Calculate, Propose, Prepare) as the
// plan's preview, what this version holds, and the six scenarios, each a button that chooses it.
// Version 0.2.0 adds the run's log: the plain sentence above each tool call, guardrail lines, the run facts.

import { h } from "./dom.js";
import { icon } from "./icons.js";
import { createProgressRail } from "./progress.js";

export function createConsole(root, { scenarios, onPick }) {
  const rail = createProgressRail();
  rail.reset();
  const list = h("ol", { class: "scenario-list" }, scenarios.map((s) =>
    h("li", {}, h("button", { class: "scenario-pick", type: "button", dataset: { scenario: s.id }, on: { click: () => onPick(s.id) } },
      h("span", { class: "scenario-num" }, String(s.number)),
      h("span", { class: "scenario-text" }, h("strong", {}, s.title), h("span", {}, `“${s.seed}”`))))));
  root.append(
    h("div", { class: "console-head" }, h("div", { class: "console-title" }, h("h2", {}, "Agent console"))),
    rail.el,
    h("div", { class: "log log-idle" },
      h("div", { class: "vc-alert vc-alert--neutral version-note", role: "note" },
        icon("info", 20),
        h("div", { class: "vc-alert__body" },
          h("p", { class: "vc-alert__title" }, "Version 0.1.0: the engine, the world and the shell"),
          h("p", {}, "The live agent, the price ladder and the six scenarios as simulations arrive in version 0.2.0. Until then the board shows the engine's check of the world."))),
      h("h3", { class: "scenario-head" }, "Six tips to start from"),
      list));
  return {
    mark(scenarioId) {
      for (const b of list.querySelectorAll(".scenario-pick")) b.setAttribute("aria-pressed", String(b.dataset.scenario === scenarioId));
    }
  };
}
