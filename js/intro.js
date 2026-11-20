// Intro window: what the Price Variance Agent does, how it works, why it pays off and how it would run
// in production, readable in about a minute. It opens by itself on a visitor's first visit (remembered
// in this browser's local storage) and any time from the "How it works" button in the header.

import { h } from "./dom.js";
import { icon } from "./icons.js";
import { openModal } from "./modal.js";
import { STORAGE } from "./config.js";

// The five steps are the same as the progress rail above the console, on Vici's stepper. Their
// hexagons use the tones the app uses for the same moments: danger for a finding, fjord (info) for
// checking, warning for a gap a reason may explain, ink for your decision (merlot never sits among the
// state colours) and success for a resolved state.
const STEPS = [
  { tone: "spot", title: "Spot", text: "Picks up a price tip and finds the comparable group of order lines it is about." },
  { tone: "check", title: "Check", text: "Makes the prices comparable: per base unit, in euros, delivered. Only the same item counts." },
  { tone: "calculate", title: "Calculate", text: "Sets the benchmark from GlobalCorp's own best price at volume and splits every gap into justified and unexplained." },
  { tone: "propose", title: "Propose", text: "Offers two or three costed options next to accepting the variance. You decide." },
  { tone: "prepare", title: "Prepare", text: "Drafts the change request, notice or brief for your approval. Nothing is sent." }
];

const VALUE = [
  { title: "Like for like", text: "Prices are compared only after units, currencies and delivery terms are made equal." },
  { title: "Every figure checked", text: "Figures come from a deterministic engine, and the agent's texts are checked against them." },
  { title: "People stay in charge", text: "The agent prepares, you decide, and every step is logged." }
];

// How the same agent would run in production: GlobalCorp's systems and the products around it (also
// shown at the end of the Method dialog).
export const PRODUCTION_PATH = [
  { title: "SAP S/4HANA or Ariba", text: "Order, requisition, invoice, contract and supplier data" },
  { title: "Microsoft Fabric", text: "Data Factory, OneLake, SQL, Spark or dbt: the variance analytics run here" },
  { title: "AI agents", text: "Azure OpenAI and Copilot Studio" },
  { title: "Power BI", text: "Reporting and opportunity tracking" },
  { title: "Action", text: "Power Automate and Teams: alerts, approvals, tasks; SAP executes what people approved" }
];

/** True once this browser has seen the intro (closed it at least once). */
export function introSeen() {
  try { return localStorage.getItem(STORAGE.introSeen) === "1"; } catch { return false; }
}

function markIntroSeen() {
  try { localStorage.setItem(STORAGE.introSeen, "1"); } catch { /* storage blocked: it opens again next time */ }
}

/**
 * Opens the intro window. With `onStart`, its main button starts the usual run flow (mode choice
 * first) under `startLabel`; without it there is only Close. Resolves "start" or null.
 */
export function openIntro({ startLabel = "Start agent", onStart = null } = {}) {
  return new Promise((resolve) => {
    let modal;
    const steps = h("ol", { class: "vc-stepper intro-steps" }, STEPS.map((s, i) =>
      h("li", { class: "vc-step intro-step", dataset: { tone: s.tone } },
        h("span", { class: "vc-step__marker intro-num", "aria-hidden": "true" }, String(i + 1)),
        h("strong", { class: "vc-step__label intro-step-title" }, s.title),
        h("span", { class: "vc-step__hint intro-step-text" }, s.text))));
    const value = h("ul", { class: "intro-value" }, VALUE.map((v) =>
      h("li", {}, h("strong", {}, v.title), h("span", {}, v.text))));
    const path = h("ol", { class: "intro-path", "aria-label": "Production path" }, PRODUCTION_PATH.map((p) =>
      h("li", {}, h("strong", {}, p.title), h("span", {}, p.text))));

    const footer = onStart
      ? [
        h("span", { class: "dialog-note" }, "Try it for free: press ", h("strong", {}, startLabel), " and choose ", h("strong", {}, "Simulation"), ". No key needed."),
        h("button", { class: "vc-button vc-button--ghost", type: "button", on: { click: () => modal.close(null) } }, "Close"),
        h("button", { class: "vc-button", type: "button", autofocus: true, on: { click: () => modal.close("start") } }, icon("play", 18), startLabel)
      ]
      : [h("button", { class: "vc-button", type: "button", autofocus: true, on: { click: () => modal.close(null) } }, "Close")];

    modal = openModal({
      title: "How the Price Variance Agent works",
      intro: "The Price Variance Agent is an AI agent for procurement prices. It finds where GlobalCorp pays different prices for the same item or service, makes the prices comparable, separates what a reason explains from what nothing explains, and proposes what to do about it.",
      className: "intro-modal",
      size: "intro",
      body: [
        h("h3", {}, "How it works"),
        steps,
        h("h3", {}, "Why it pays off"),
        value,
        h("h3", {}, "In production"),
        path,
        h("p", { class: "intro-note" }, "This prototype stands in for all of it in one browser page. GlobalCorp SE, its plants, suppliers, materials and prices are fictional; the exchange rates are the European Central Bank's.")
      ],
      footer,
      onClose: (result) => {
        markIntroSeen();
        resolve(result || null);
        if (result === "start") onStart?.();
      }
    });
  });
}
