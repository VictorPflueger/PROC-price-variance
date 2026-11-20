// UI orchestrator of version 0.1.0: builds the header tiles, the control bar, the price board's engine
// check, the console and the drawer, from the world, the rates and the engine running in the page.
// Version 0.2.0 adds the run producers (the live agent and the simulation player) and their events.

import { createKpis } from "./kpi.js";
import { createControls } from "./controls.js";
import { createBoard } from "./board.js";
import { createConsole } from "./console.js";
import { createDrawer } from "./drawer.js";
import { openIntro, introSeen } from "./intro.js";
import { scanWorld, worldPipeline } from "./world.js";
import { DEFAULTS } from "./params.js";
import { UI } from "./config.js";
import { h, withTooltip } from "./dom.js";
import { icon } from "./icons.js";

export function initUI() {
  const world = window.WORLD;
  const fx = window.FX;
  const scenarios = window.SCENARIOS || [];
  const { rows } = scanWorld(world, fx);
  const pipeline = worldPipeline(world, fx);

  createKpis(document.getElementById("kpis"), { pipeline });
  const board = createBoard(document.getElementById("board"), { rows, scenarios, fx, params: DEFAULTS });
  let consoleUI = null;
  const pick = (id) => { board.focus(id); consoleUI?.mark(id); };
  const controls = createControls(document.getElementById("controls"), { scenarios, initial: UI.defaultScenario, onScenario: pick });
  consoleUI = createConsole(document.getElementById("console"), { scenarios, onPick: (id) => controls.setScenario(id) });
  pick(UI.defaultScenario);

  const drawer = createDrawer(document.getElementById("drawer"));
  const empty = (title, text) => h("div", { class: "drawer-empty" }, h("p", { class: "drawer-empty-title" }, title), h("p", {}, text));
  drawer.panel("options").append(empty("No options yet", "The options appear here once the agent has calculated a group: savings a year, one-off cost, days to the first saving and the variance left. The agent arrives in version 0.2.0."));
  drawer.panel("outbox").append(empty("Draft. Nothing is sent.", "Drafts appear here only after you approve an option, and wait for your approval. Nothing ever leaves this page."));
  drawer.panel("audit").append(empty("No run recorded", "Every event of a run, every model call and every decision is logged here and exports as JSON."));

  // "How it works" in the header, beside the mode badge; on small laptops it keeps only its icon, and
  // its tooltip names it.
  const aboutBtn = h("button", {
    class: "vc-button vc-button--secondary about-btn", type: "button", id: "btn-about",
    title: "What the Price Variance Agent does, how it works and why it pays off"
  }, icon("info", 18), h("span", { class: "btn-text" }, "How it works"));
  aboutBtn.addEventListener("click", () => openIntro());
  document.getElementById("mode-badge").after(withTooltip(aboutBtn, "How it works", { below: true }));
  return {
    introOnFirstVisit() { if (!introSeen()) openIntro(); }
  };
}

/** A banner at the top of the page: a Vici alert in the tone of its level, dismissible. */
export function showBanner({ level = "info", title = "", text = "", timeout = 0 } = {}) {
  const stack = document.getElementById("banners");
  if (!stack) return null;
  const close = h("button", { class: "vc-icon-button", type: "button" }, icon("x", 18));
  const tone = level === "error" ? "vc-alert--danger" : level === "warn" ? "vc-alert--warning" : "";
  const el = h("div", { class: ["vc-alert", tone, "banner"], dataset: { level }, role: level === "error" ? "alert" : "status" },
    icon(level === "info" ? "info" : "alert", 22),
    h("div", { class: "vc-alert__body banner-text" }, title ? h("p", { class: "vc-alert__title" }, title) : null, h("p", {}, text)),
    withTooltip(close, "Dismiss", { below: true }));
  close.addEventListener("click", () => el.remove());
  stack.appendChild(el);
  if (timeout) setTimeout(() => el.remove(), timeout);
  return el;
}
