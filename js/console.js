// Agent console: renders the run-event stream as a logbook (time · mark · entry). Taken from the
// Timetable Translator, the newest sister, with this app's entries: the cluster confirmation, the
// sensitivity at a refreshed rate, and a Guardrail line for every refusal in code (an alert without its
// evidence, a comparison across groups, an unconfirmed cluster, an input that breaks its schema …).
// Narration paragraphs that start with a label (Hypothesis:, Check:, Confirmed:, Not confirmed:,
// Revised:, Finding:, Recommendation:) get distinct styling; "Revised: old → new" is rendered as an
// amended entry with the superseded part struck through.
// Written for an audience: a tool call reads as one plain sentence, with the tool's name, arguments
// and result one click away under "Details"; the only phase lines are the hand-overs to the person;
// an alert keeps its sources and a summary its full text one click away.

import { bus } from "./events.js";
import { h, clear, prefersReducedMotion } from "./dom.js";
import { icon } from "./icons.js";
import { renderInline, renderMarkdown } from "./md.js";
import { clock } from "./format.js";
import { auditRows } from "./audit.js";
import { computeRunFacts, describeRunFacts } from "./run_facts.js";
import { createProgressRail } from "./progress.js";
import { aiLabel } from "./ai_label.js";
import { runStateLabel } from "./handover.js";
import { LABELS, splitParagraphs } from "./labels.js";
import { STORAGE } from "./config.js";
import { DRAFT_LABELS } from "./drafts.js";
import { eur, pct, unitPrice } from "./format.js";

// The rail and the status pill show the agent's step; the log only marks when it is the person's turn.
const PHASES = new Set(["awaiting_approval"]);

/**
 * scenarios: the preset scenarios (data/scenarios.js). onPickScenario(id) chooses one (as the menu
 * does); onRunScenario(id) chooses one and starts a run of it (the mode dialog comes first).
 */
export function createConsole(panel, { scenarios = [], onPickScenario, onRunScenario, onOpenOptions, onOpenOutbox, onOpenReport, onSaveSimulation, onOpenConfirmation } = {}) {
  const count = h("span", { class: "count vc-tabular" }, "");
  const jumpBtn = h("button", { class: "vc-button vc-button--outline button-compact", type: "button", hidden: true }, icon("chevronDown", 16), "Jump to latest");
  // Larger text for projectors, remembered per browser (a convenience; storage may be unavailable).
  // A toggle the app owns (aria-pressed): Vici shows any pressed vc-button in its pressed look.
  const sizeBtn = h("button", { class: "vc-button vc-button--ghost button-compact text-size", type: "button", "aria-pressed": "false", title: "Larger console text for projectors" }, "Larger text");
  const applySize = (large) => {
    panel.dataset.text = large ? "large" : "standard";
    sizeBtn.setAttribute("aria-pressed", String(large));
    pin();
  };
  sizeBtn.addEventListener("click", () => {
    const large = panel.dataset.text !== "large";
    applySize(large);
    try { localStorage.setItem(STORAGE.consoleText, large ? "large" : "standard"); } catch { /* storage unavailable */ }
  });
  const SCRIPTED = "Authored replay. No model calls; the engine recalculates every figure.";
  const watermarkText = h("span", {}, SCRIPTED);
  const watermark = h("div", { class: "sim-watermark", hidden: true, role: "note" }, "SIMULATION", watermarkText);
  const log = h("div", { class: "log", role: "log", "aria-live": "polite", "aria-relevant": "additions" });
  // The agent's plan and progress, above the log (agentic UX: show the plan, show the hand-over).
  const rail = createProgressRail();
  rail.reset();

  panel.append(
    h("div", { class: "console-head" },
      h("div", { class: "console-title" }, h("h2", {}, "Agent console"), count),
      h("div", { class: "console-head-actions" }, jumpBtn, sizeBtn)),
    rail.el,
    watermark,
    log
  );

  const byMsg = new Map();
  const byCall = new Map();
  let entries = 0;
  let lastPhase = null;
  let runMeta = null;
  let sawReport = false;
  let optionsSeq = null; // the set of options on screen: a click on an older set is not logged as a decision
  // Auto-follow: the log stays pinned to the newest entry until the presenter scrolls up. Only
  // user input (wheel, touch, keys, scrollbar drag) can unpin it, so programmatic scrolling and
  // layout changes (the drawer opening) never stop the follow.
  let follow = true;
  let userIntentUntil = 0;
  const noteIntent = () => { userIntentUntil = performance.now() + 900; };
  for (const type of ["wheel", "touchmove", "pointerdown", "keydown"]) log.addEventListener(type, noteIntent, { passive: true });
  const atBottom = () => log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  // The empty log (the scenarios to pick from) reads from its top; a log with entries follows its end.
  const pin = () => { if (follow && entries > 0) log.scrollTop = log.scrollHeight; };

  log.addEventListener("scroll", () => {
    if (atBottom()) {
      follow = true;
      jumpBtn.hidden = true;
    } else if (performance.now() < userIntentUntil) {
      follow = false;
      if (entries > 0) jumpBtn.hidden = false;
    }
  });
  if (typeof ResizeObserver === "function") new ResizeObserver(pin).observe(log);
  jumpBtn.addEventListener("click", () => {
    follow = true;
    jumpBtn.hidden = true;
    log.scrollTo({ top: log.scrollHeight, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  });

  // The scenarios, in plain view: with no run on screen the empty log lists every scenario (a visitor
  // who never opens the Scenario menu still sees that there are several), and after a run it offers the
  // others. The chosen one is marked; the menu and this list choose the same thing.
  let chosen = null;
  let pickList = null;

  function scenarioPick() {
    const items = scenarios.map((s) => {
      const b = h("button", { class: "scenario-pick__item", type: "button", dataset: { id: s.id }, "aria-current": String(s.id === chosen), title: s.seed || s.title },
        h("span", { class: "num-badge", "aria-hidden": "true" }, String(s.number)),
        h("span", { class: "scenario-pick__text" },
          h("span", { class: "scenario-pick__title" }, h("span", { class: "vc-visually-hidden" }, `Scenario ${s.number}: `), s.title),
          h("span", { class: "scenario-pick__hint" }, s.category)),
        // The scenario of the five-minute demonstration, as the menu marks it.
        s.start_here ? h("span", { class: "vc-tag vc-tag--accent" }, "Start here") : null);
      b.addEventListener("click", () => onPickScenario?.(s.id));
      return h("li", {}, b);
    });
    return h("ul", { class: "scenario-pick", "aria-label": "Scenarios" }, items);
  }

  function showEmpty() {
    clear(log);
    pickList = scenarios.length ? scenarioPick() : null;
    log.appendChild(h("div", { class: "log-empty" },
      h("h3", {}, "Pick a scenario, then start the agent"),
      scenarios.length ? h("p", { class: "scenario-pick__lead" }, `${countWord(scenarios.length)} tips, each a different reason why prices differ.`) : null,
      pickList,
      h("p", { class: "scenario-pick__plan" }, "The five steps above are its plan.")));
    count.textContent = "";
    log.scrollTop = 0;
  }

  /** The scenario chosen now (the menu or this list): the idle list marks it. */
  function setScenario(id) {
    chosen = id;
    if (!pickList || !pickList.isConnected) return;
    for (const b of pickList.querySelectorAll("button[data-id]")) b.setAttribute("aria-current", String(b.dataset.id === id));
  }

  /**
   * After a run: the other scenarios, one click from a new run of each (the mode dialog comes first).
   * An entry of its own just above the run's last line, so the console still ends on the run's end.
   */
  function nextScenarios(doneId) {
    const others = scenarios.filter((s) => s.id !== doneId);
    if (!others.length) return null;
    return entry("next", null, "list", h("div", { class: "run-next" },
      h("p", {}, h("strong", {}, doneId ? "Try another scenario" : "Try a scenario"), ", each a different reason why prices differ:"),
      h("ul", { class: "scenario-next", "aria-label": "Start a run of another scenario" }, others.map((s) => {
        const b = h("button", { class: "vc-button vc-button--outline button-compact scenario-next__item", type: "button", dataset: { id: s.id }, title: `Start a run of scenario ${s.number}: ${s.title}` },
          h("span", { class: "num-badge", "aria-hidden": "true" }, String(s.number)),
          h("span", {}, h("span", { class: "vc-visually-hidden" }, `Scenario ${s.number}: `), s.short || s.title));
        b.addEventListener("click", () => onRunScenario?.(s.id));
        return h("li", {}, b);
      }))));
  }

  function add(el) {
    if (entries === 0) clear(log);
    log.appendChild(el);
    entries++;
    count.textContent = `${entries} ${entries === 1 ? "entry" : "entries"}`;
    if (follow) pin();
    else jumpBtn.hidden = false;
    return el;
  }

  function entry(type, t, mark, body, data = {}) {
    return h("div", { class: "entry", dataset: { type, ...data } },
      h("div", { class: "entry-time" }, t !== null && t !== undefined ? clock(t) : ""),
      h("div", { class: "entry-mark" }, mark ? icon(mark, 18) : null),
      h("div", { class: "entry-body" }, body));
  }

  // ---- event handlers ---------------------------------------------------------------------------

  bus.on("run_start", (ev) => {
    const p = ev.payload;
    reset(false);
    runMeta = p;
    const recorded = p.mode === "simulation" && p.sim_source === "recorded";
    watermark.hidden = p.mode !== "simulation";
    watermarkText.textContent = recorded
      ? `Replay of a live run recorded${p.recorded_on ? ` on ${p.recorded_on}` : ""}${p.recorded_model ? ` (${p.recorded_model})` : ""}. Not live data, no model calls.`
      : SCRIPTED;
    log.dataset.sim = String(p.mode === "simulation");
    const meta = p.mode === "simulation"
      ? recorded ? "Simulation: replay of a recorded live run, no API key, no cost." : "Simulation: authored replay through the live tools, no API key, no cost."
      : `Live agent on ${p.model_label || p.model || "Claude"}. Real model reasoning and real tool calls.`;
    add(entry("run", ev.t, "play", [
      h("div", { class: "run-title" }, p.title || "Agent run"),
      h("div", {}, meta),
      p.seed ? h("div", { class: "seed" }, renderInline(p.seed, h("span"))) : null
    ]));
  });

  bus.on("state_change", (ev) => {
    const s = ev.payload.state;
    rail.update(s);
    if (!PHASES.has(s)) return;
    // Awaiting your decision, then later awaiting your approval: the same state, two hand-overs.
    const label = runStateLabel(s);
    if (label === lastPhase) return;
    lastPhase = label;
    add(entry("phase", ev.t, null, h("span", { class: "phase" }, `Phase: ${label}`)));
  });

  bus.on("narration", (ev) => {
    const { msg_id: id, text, done } = ev.payload;
    let el = byMsg.get(id);
    if (!el) {
      el = add(entry("narration", ev.t, "pulse", h("div", { class: "narration" })));
      byMsg.set(id, el);
    }
    const body = el.querySelector(".narration");
    clear(body);
    for (const para of splitParagraphs(text)) body.appendChild(renderParagraph(para));
    el.classList.toggle("streaming", !done);
    // Screen readers wait for the finished paragraph instead of announcing every partial update.
    if (done) el.removeAttribute("aria-busy"); else el.setAttribute("aria-busy", "true");
    pin();
  });

  bus.on("reasoning", (ev) => {
    const { msg_id: id, text } = ev.payload;
    let el = byMsg.get(`r:${id}`);
    if (!el) {
      const details = h("details", { class: "reasoning" },
        h("summary", {}, icon("chevronRight", 14), "Reasoning summary"),
        h("div", { class: "reasoning-text" }));
      el = add(entry("reasoning", ev.t, null, details));
      byMsg.set(`r:${id}`, el);
    }
    el.querySelector(".reasoning-text").textContent = text || "";
  });

  bus.on("tool_call", (ev) => {
    const p = ev.payload;
    if (isUiTool(p.name)) return; // ui_* tools are shown by their effect (alert, cluster, options, outbox, report)
    const line = h("div", { class: "tool-line" }, h("span", { class: "tool-name" }, p.name), h("span", { class: "tool-args" }, argsSummary(p.name, p.input)));
    // What the call does in one plain sentence, written by code (js/tool_plain.js), above the tool's own name.
    const plainText = p.plain || null;
    if (!plainText) {
      byCall.set(p.call_id, add(entry("tool_call", ev.t, "gear", line)));
      return;
    }
    const result = h("div", { class: "result", dataset: { open: "false" } });
    const toggle = h("button", { class: "result-toggle", type: "button", "aria-expanded": "false", title: `Show the tool call (${p.name}) and its result` },
      icon("chevronRight", 14), h("span", { class: "result-label" }, "Details"));
    toggle.addEventListener("click", () => {
      const open = result.dataset.open !== "true";
      result.dataset.open = String(open);
      toggle.setAttribute("aria-expanded", String(open));
    });
    result.append(toggle, h("div", { class: "tool-detail" }, line));
    const el = add(entry("tool_call", ev.t, p.name.startsWith("open_") ? "globe" : "gear", [h("div", { class: "tool-plain" }, plainText), result], { plain: "true", tool: p.name }));
    byCall.set(p.call_id, el);
  });

  bus.on("tool_result", (ev) => {
    const p = ev.payload;
    // A refusal in code is a guardrail at work: show it, so the room sees why the agent tries again.
    const guardLine = () => {
      const why = String(p.result?.error || p.summary || "").replace(/^(Error|Refused):\s*/, "");
      add(entry("notice", ev.t, "shield", h("span", {}, h("strong", {}, "Guardrail: "), `${GUARD_LABEL[p.name] || `${p.name} was`} refused. `, why), { level: "warn", guard: p.guard || p.name }));
    };
    if (isUiTool(p.name)) {
      if (p.ok === false) guardLine();
      return;
    }
    const el = byCall.get(p.call_id) || add(entry("tool_call", ev.t, "gear", h("div", { class: "tool-line" }, h("span", { class: "tool-name" }, p.name))));
    const detail = el.querySelector(".tool-detail") || el.querySelector(".entry-body");
    detail.append(h("div", { class: "result-summary", dataset: { ok: String(p.ok !== false) } }, p.summary || (p.ok === false ? "Tool error" : "Result")));
    if (p.ok === false) el.dataset.failed = "true";
    const box = el.querySelector(".result");
    if (box) box.append(h("pre", { class: "result-body" }, formatJson(p.result)));
    if (p.ok === false && p.guard) guardLine();
    pin();
  });

  bus.on("alert", (ev) => {
    const p = ev.payload;
    // What the run actually checked, from the tool results: the card adds it, the agent cannot.
    const checked = Array.isArray(p.checked) && p.checked.length
      ? h("p", { class: "alert-evidence" }, h("strong", {}, "Checked in this run: "), p.checked.join("; "), ".")
      : null;
    const buyers = Array.isArray(p.buyers) && p.buyers.length
      ? h("p", { class: "alert-owners" }, h("strong", {}, "Owners of the affected lines: "), p.buyers.join("; "), ".")
      : null;
    // A Vici alert in the danger tone: paid above the benchmark without a reason, with its word.
    const card = h("div", { class: ["vc-alert", "vc-alert--danger", "alert-card"], dataset: { group: p.group_id } }, h("div", { class: "vc-alert__body" },
      h("div", { class: "alert-sev" }, icon("x", 14), `Unexplained price variance · group ${p.group_id}`, aiLabel("alert")),
      h("h3", {}, p.title || "Price variance"),
      p.summary ? renderInline(p.summary, h("div")) : null,
      Array.isArray(p.unchecked) && p.unchecked.length ? h("span", { class: "vc-tag vc-tag--warning" }, "Unchecked") : null,
      h("details", { class: "alert-more", open: true }, h("summary", {}, icon("chevronRight", 14), "Checks and owners"), checked, buyers,
        h("p", {}, `${(p.line_ids || []).length} affected lines; the benchmark is ${p.benchmark ? unitPrice(p.benchmark.price, p.display_quantity, p.base_unit) : "—"} (${p.benchmark?.pair || "no pair"}).`))));
    add(entry("alert", ev.t, "alert", card));
  });

  bus.on("confirmation_request", (ev) => {
    const p = ev.payload;
    const plants = p.evidence?.plants?.length || 0;
    add(entry("confirm", ev.t, "user", h("div", { class: "confirm-entry" },
      h("p", {}, h("span", { class: "vc-tag vc-tag--feature" }, "Proposed cluster"), " ", aiLabel("cluster")),
      h("p", {}, `${(p.lines || []).length} free-text lines from ${countWordLower(plants)} plants, in ${(p.evidence?.order_units || []).join(" and ")}. They count as one comparable group only if you confirm them.`),
      p.note ? renderInline(p.note, h("p", { class: "confirm-note" })) : null,
      h("button", { class: "vc-button button-compact", type: "button", on: { click: () => onOpenConfirmation?.() } }, icon("user", 16), "Open the confirmation"))));
  });

  bus.on("confirmation_decision", (ev) => {
    const p = ev.payload;
    const text = p.decision === "rejected" ? "You rejected the proposed cluster: these lines stay incomparable."
      : p.decision === "split" ? `You confirmed ${countWordLower((p.line_ids || []).length)} of the lines as one group, base unit ${p.base_unit}.`
        : `You confirmed the cluster as one group, base unit ${p.base_unit}.`;
    add(entry("decision", ev.t, "user", h("p", {}, h("strong", {}, "Your confirmation: "), text), { decision: p.decision }));
  });

  bus.on("fx_sensitivity", (ev) => {
    const p = ev.payload;
    add(entry("narration", ev.t, "globe", h("div", { class: "sensitivity" },
      h("p", {}, h("strong", {}, `Sensitivity ${p.label}: `), `1 EUR = ${p.per_eur} ${p.currency}. At that rate the group's unexplained variance is ${eur(p.opportunity)} a year, spread ${pct(p.spread)}${p.flagged ? ", still material" : ", below materiality"}.`),
      h("p", { class: "sensitivity-note" }, "A labelled sensitivity: the tiles, the alert and the options keep the window's mean rate."))));
  });

  // A response that was not kept (failed and retried, or cut off and redone): its entries stay
  // visible for the record, dimmed and marked, and nothing in them counts.
  bus.on("attempt_discarded", (ev) => {
    const p = ev.payload || {};
    const els = [...(p.msg_ids || []).flatMap((id) => [byMsg.get(id), byMsg.get(`r:${id}`)]), ...(p.call_ids || []).map((id) => byCall.get(id))].filter(Boolean);
    for (const el of new Set(els)) {
      if (el.dataset.discarded === "true") continue;
      el.dataset.discarded = "true";
      el.style.opacity = "0.55";
      el.classList.remove("streaming");
      el.removeAttribute("aria-busy");
      el.querySelector(".entry-body")?.prepend(h("div", { class: "discarded-note" }, h("em", {}, "Discarded: "), p.reason || "this part of the response was not used."));
    }
  });

  bus.on("options", (ev) => {
    optionsSeq = ev.payload.options_seq ?? null;
    const n = (ev.payload.options || []).filter((o) => o.id !== "accept").length;
    add(entry("narration", ev.t, "list", h("div", {},
      h("p", {}, `${countWord(n)} costed options and accepting the variance are ready for your decision.`),
      h("button", { class: "vc-button button-compact", type: "button", on: { click: () => onOpenOptions?.() } }, "Review options"))));
  });

  bus.on("option_decision", (ev) => {
    const p = ev.payload;
    if (p.options_seq !== undefined && (p.options_seq ?? null) !== optionsSeq) return;
    if (p.option_id === "accept" && !p.reason) return;
    const approved = p.decision === "approved";
    add(entry("decision", ev.t, "user", h("p", {},
      h("strong", {}, p.option_id === "accept" ? "You accepted the variance" : approved ? "You approved " : "You rejected "),
      p.option_id === "accept" ? `: ${p.reason}.` : `${p.option_label || p.option_id}.`),
    { decision: p.decision }));
  });

  // A draft in one line: what it is and its subject (the recipient is on the draft in the Outbox; the
  // hand-over line after the last draft says it waits for your approval).
  bus.on("action_draft", (ev) => {
    const p = ev.payload;
    add(entry("narration", ev.t, DRAFT_ICON[p.type] || "memo", h("div", {},
      h("p", { title: `For ${p.recipient}` }, `Drafted the ${(DRAFT_LABELS[p.type] || "draft").toLowerCase()}: “${p.subject}”.`),
      h("button", { class: "vc-button vc-button--outline button-compact", type: "button", on: { click: () => onOpenOutbox?.() } }, "Open outbox"))));
  });

  bus.on("action_decision", (ev) => {
    const p = ev.payload;
    const what = p.kind ? `the ${p.kind.toLowerCase()}` : p.label || p.action_id;
    add(entry("decision", ev.t, "user", h("p", { title: p.kind && p.label ? p.label : null },
      h("strong", {}, p.decision === "approved" ? "You approved " : "You rejected "),
      what, p.decision === "approved" ? ". Nothing was sent." : "."), { decision: p.decision }));
  });

  bus.on("report", (ev) => {
    sawReport = true;
    const md = String(ev.payload.markdown || "");
    const heading = (md.match(/^#{1,3}\s+(.+)$/m) || [])[1] || "Report";
    const card = h("div", { class: "vc-card report-card" },
      aiLabel("report"),
      h("h3", { class: "report-head" }, heading),
      h("div", { class: "report-actions" },
        h("button", { class: "vc-button button-compact", type: "button", on: { click: () => onOpenReport?.(ev.payload.markdown) } }, icon("external", 16), "Open the report")),
      h("details", { class: "report-full" }, h("summary", {}, icon("chevronRight", 14), "Read it here"), renderMarkdown(md)));
    add(entry("report", ev.t, "check", card));
  });

  bus.on("notice", (ev) => {
    const { level = "info", text, guard } = ev.payload;
    if (guard) {
      add(entry("notice", ev.t, "shield", h("span", {}, h("strong", {}, "Guardrail: "), renderInline(String(text).replace(/^Guardrail:\s*/, ""), h("span"))), { level: "warn", guard: "decision" }));
      return;
    }
    add(entry("notice", ev.t, level === "error" ? "alert" : level === "warn" ? "alert" : "info", renderInline(text, h("span")), { level }));
  });

  bus.on("run_end", (ev) => {
    const { status, reason } = ev.payload;
    rail.finish(status);
    const text = {
      done: "Run complete.",
      aborted: "Run aborted.",
      error: "Run stopped because of an error.",
      no_findings: "Run complete: no material finding.",
      incomplete: "Run stopped before the workflow was complete."
    }[status] || "Run ended.";
    const canSave = (status === "done" || status === "no_findings") && sawReport && runMeta?.mode === "live" && runMeta?.entry === "scenario";
    // What next: the other scenarios, so a visitor who started from the intro finds them.
    const next = nextScenarios(runMeta?.entry === "scenario" ? runMeta.scenario_id : null);
    if (next) add(next);
    // Facts for completed runs (the audit has every event up to this one).
    let facts = null;
    if (["done", "no_findings", "incomplete"].includes(status)) {
      try { facts = describeRunFacts(computeRunFacts(auditRows(), ev)); } catch (e) { console.error("[Price Variance Agent] run facts failed:", e); }
    }
    add(entry("notice", ev.t, status === "done" || status === "no_findings" ? "check" : "stop", h("div", {},
      h("span", {}, h("strong", {}, text), reason ? ` ${reason}` : ""),
      // The run's facts (tool calls, checks, cost) are one click away: the audience reads "Run complete".
      facts ? h("details", { class: "run-facts" }, h("summary", {}, icon("chevronRight", 14), runMeta?.mode === "simulation" ? "Replay facts" : "Run facts"), h("p", {}, facts)) : null,
      canSave ? h("div", { class: "entry-actions" },
        h("button", { class: "vc-button vc-button--outline button-compact", type: "button", title: "Download this run as a simulation script that can replace the scripted replay of this scenario", on: { click: () => onSaveSimulation?.() } }, icon("download", 16), "Save run as simulation")) : null),
    { level: status === "error" ? "error" : "info" }));
    for (const el of byMsg.values()) { el.classList.remove("streaming"); el.removeAttribute("aria-busy"); }
  });

  function reset(empty = true) {
    byMsg.clear();
    byCall.clear();
    entries = 0;
    lastPhase = null;
    runMeta = null;
    sawReport = false;
    optionsSeq = null;
    follow = true;
    jumpBtn.hidden = true;
    watermark.hidden = true;
    log.dataset.sim = "false";
    rail.reset();
    if (empty) showEmpty(); else clear(log);
  }

  let storedSize = null;
  try { storedSize = localStorage.getItem(STORAGE.consoleText); } catch { /* storage unavailable */ }
  applySize(storedSize === "large");
  showEmpty();
  return { reset, setScenario };
}

const COUNT_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];
/** "Seven" for 7: a count at the start of a sentence, in words up to twelve. */
function countWord(n) {
  return COUNT_WORDS[n] || String(n);
}
/** "seven" for 7, inside a sentence. */
function countWordLower(n) {
  return (COUNT_WORDS[n] || String(n)).toLowerCase();
}

// ---------------------------------------------------------------------------------------------

function renderParagraph(raw) {
  let text = raw.replace(/^\*\*([^*]+?:)\*\*\s*/, "$1 ");
  for (const rule of LABELS) {
    const m = rule.re.exec(text);
    if (!m) continue;
    const rest = text.slice(m[0].length);
    const label = m[1][0].toUpperCase() + m[1].slice(1);
    const p = h("p", { class: "para", dataset: { kind: rule.kind } }, h("span", { class: "tag" }, `${label}:`));
    if (rule.kind === "revised") {
      const arrow = rest.search(/\s(→|->)\s/);
      if (arrow > 0) {
        const old = rest.slice(0, arrow);
        const after = rest.slice(arrow).replace(/^\s(→|->)\s/, "");
        p.append(renderInline(old, h("span", { class: "struck" })), h("span", { class: "arrow", "aria-label": "replaced by" }, "→"), renderInline(after, h("span", { class: "amended" })));
        return p;
      }
    }
    renderInline(rest, p);
    return p;
  }
  return renderInline(text, h("p", { class: "para" }));
}

function argsSummary(name, input) {
  if (!input || typeof input !== "object") return "";
  const parts = [];
  for (const [k, v] of Object.entries(input)) {
    if (v === null || v === undefined || v === "") continue;
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    parts.push(`${k}=${trim(s, 56)}`);
  }
  return parts.join(", ");
}

function trim(s, n) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function formatJson(value) {
  if (value === undefined) return "";
  let s;
  try {
    s = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  } catch {
    s = String(value);
  }
  return s.length > 9000 ? `${s.slice(0, 9000)}\n… (truncated for display; full result is in the audit log)` : s;
}

function isUiTool(name) {
  return String(name || "").startsWith("ui_");
}

const GUARD_LABEL = {
  ui_report_alert: "The alert was", ui_propose_options: "The options were", ui_await_decision: "The wait was",
  ui_draft_action: "The draft was", ui_await_approvals: "The wait was", ui_final_report: "The report was",
  ui_confirm_cluster: "The cluster confirmation was", ui_mark_board: "The board mark was",
  pv_compare: "The comparison was", pv_normalise: "The normalisation was", pv_match: "The candidate search was",
  erp_query: "The query was", erp_get_record: "The record lookup was", open_ecb_rate: "The rate request was"
};

const DRAFT_ICON = {
  change_request: "receipt", buyer_notice: "mail", negotiation_brief: "memo", tender_memo: "memo", variance_memo: "memo"
};

function safeUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : "#";
  } catch {
    return "#";
  }
}
