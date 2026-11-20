// UI orchestrator: builds the components, wires the controls and dialogs, starts the run producers (the
// live agent and the simulation player) and turns run events into drawer and state changes. The board,
// the console, the tiles and the drawer follow the run events themselves; the UI never branches on which
// producer is running, and only the mode badge reads the mode (Rebate Hunter's orchestration).

import { bus, newRunId } from "./events.js";
import { getState, setState, subscribe, isRunning, isFinished } from "./state.js";
import { createBoard } from "./board.js";
import { createConsole } from "./console.js";
import { createKpis } from "./kpi.js";
import { createDrawer } from "./drawer.js";
import { createOptionsPanel } from "./options_panel.js";
import { createOutbox } from "./outbox.js";
import { createAuditPanel } from "./audit_panel.js";
import { resetAudit, auditEvents } from "./audit.js";
import { openMethod } from "./method.js";
import { createControls } from "./controls.js";
import { chooseMode, askApiKey, askCustomScenario, showReport } from "./dialogs.js";
import { openClusterDialog } from "./cluster.js";
import { openDiagnostics } from "./diagnostics_view.js";
import { openIntro, introSeen } from "./intro.js";
import { createSimulationPlayer } from "./simulation.js";
import { createLiveAgent } from "./agent.js";
import { sessionApprovals } from "./session.js";
import { hasKey, forgetKey } from "./keystore.js";
import { worldPipeline, contextOf, ratesOf } from "./world.js";
import { buildGroups } from "./groups.js";
import { analyseGroup } from "./variance.js";
import { createParams, DEFAULTS, PARAMETERS } from "./params.js";
import { indexOf } from "./erp.js";
import { MODELS } from "./config.js";
import { h, withTooltip } from "./dom.js";
import { icon } from "./icons.js";
import { dateWithYear } from "./format.js";

const modelLabel = (id) => MODELS.find((m) => m.id === id)?.label || id || null;

export function initUI() {
  const world = window.WORLD;
  const fx = window.FX;
  const scenarios = window.SCENARIOS || [];
  const byId = (id) => scenarios.find((s) => s.id === id);
  // The method's parameters (TECH_NOTES §2): the person edits them between runs in the Method dialog,
  // and a live run uses them; a simulation always runs at the defaults its script was written for. A
  // run's parameters are frozen at its start and stay in force until the workspace is reset.
  const params = createParams({ locked: false });
  let runParams = null;
  const activeParams = () => runParams || params.get();
  // The parameter changes a person made since the last live run started. Each is a decision of that
  // person, so the next live run's audit log carries it with the time it was made (resetting the log at
  // the run's start would otherwise drop it); a simulation plays at the defaults and leaves them pending.
  const pendingParamChanges = [];
  // Opens the options and brings the recommended card into view: on a laptop the cards sit in two rows
  // and are taller than the drawer, so its Approve could start out of sight (review R9).
  const recommendedIntoView = () => document.querySelector('#panel-options .option-card[data-recommended="true"][data-status=""]')?.scrollIntoView({ block: "nearest" });
  const showOptions = () => {
    drawer.show("options");
    requestAnimationFrame(recommendedIntoView);
  };
  // The cards reflow when the window changes size; while a decision waits, the recommended one comes back.
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (document.getElementById("drawer")?.dataset.open === "true") recommendedIntoView(); }, 150);
  });
  const engine = () => ({ world, fx, params: activeParams() });
  const analyse = (groupId, clusters = []) => {
    const ctx = contextOf(world, ratesOf(fx), activeParams());
    const g = buildGroups(world, ctx, { clusters }).find((x) => x.id === groupId);
    return g ? analyseGroup(g, ctx) : null;
  };
  // The value pipeline before a run: the value log and the session's earlier approvals (review R13).
  const pipeline = () => worldPipeline(world, fx, { approvals: sessionApprovals.list() });
  setState({ keyPresent: hasKey() });

  // ---- components ------------------------------------------------------------------------------
  const badge = document.getElementById("mode-badge");
  const board = createBoard(document.getElementById("board"), { world, analyse, pipeline });
  let confirmDialog = null;
  let openRequest = null;
  const consoleUI = createConsole(document.getElementById("console"), {
    scenarios,
    onPickScenario: (id) => pickScenario(id),
    onRunScenario: (id) => { pickScenario(id); start("scenario"); },
    onOpenOptions: () => showOptions(),
    onOpenOutbox: () => drawer.show("outbox"),
    onOpenReport: (md) => showReport(md, { mode: getState().mode, simSource: getState().simSource, runId: getState().runId }),
    onOpenConfirmation: () => { if (openRequest && !confirmDialog) showConfirmation(openRequest); },
    onSaveSimulation: async () => {
      const r = await auditPanel.saveSimulation();
      showBanner({ level: r.ok ? "info" : "warn", title: r.ok ? "Run saved as simulation" : "Could not save the run", text: r.message, timeout: r.ok ? 9000 : 0 });
    }
  });
  const kpis = createKpis(document.getElementById("kpis"), { pipeline });
  const drawer = createDrawer(document.getElementById("drawer"), { onToggle: () => setTimeout(() => board.invalidate(), 260) });
  const optionsPanel = createOptionsPanel(drawer.panel("options"), {
    onDecision: (d) => {
      if (!isRunning(getState())) return notice("warn", "This run has ended. Start a new run to take a decision.");
      bus.emit("option_decision", { ...d, by: "user" });
    },
    onCount: (n, attention) => drawer.setCount("options", n, attention)
  });
  const outbox = createOutbox(drawer.panel("outbox"), {
    onDecision: (d) => {
      if (!isRunning(getState())) return notice("warn", "This run has ended. Start a new run to approve drafts.");
      bus.emit("action_decision", { ...d, by: "user" });
    },
    onCount: (n, attention) => drawer.setCount("outbox", n, attention)
  });
  const auditPanel = createAuditPanel(drawer.panel("audit"), { onCount: (n) => drawer.setCount("audit", n), getEngine: engine });
  const player = createSimulationPlayer({ getSpeed: () => getState().speed, getWorld: () => world, getFx: () => fx, getParams: () => DEFAULTS, session: sessionApprovals });
  const agent = createLiveAgent({
    getWorld: () => world, getFx: () => fx, getParams: () => activeParams(), session: sessionApprovals,
    onKeyRejected: () => { forgetKey(); setState({ keyPresent: false }); }
  });

  const controls = createControls(document.getElementById("controls"), scenarios, {
    onStart: () => start(getState().entry === "custom" ? "custom" : "scenario"),
    onLiveScan: () => start("sweep"),
    onSelectScenario: (id) => pickScenario(id),
    onSelectCustom: async () => {
      const text = await askCustomScenario(getState().customText);
      if (text) setState({ entry: "custom", customText: text });
    },
    onSelectModel: (id) => setState({ model: id }),
    onSpeed: (n) => setState({ speed: n }),
    onAbort: () => abort("Stopped by the user."),
    // Reset starts the session again: approvals of earlier runs no longer count (review R13).
    onReset: () => { sessionApprovals.clear(); resetWorkspace(); },
    onMethod: () => openMethod({
      params,
      isRunning: () => isRunning(getState()),
      // The parameters of the run on screen (running or finished), so the method's text names the values
      // its figures were computed with (review R11).
      onScreen: () => (runParams ? { values: runParams, mode: getState().mode } : null),
      onChange: (change) => {
        const made = { ...change, at: new Date().toISOString() };
        pendingParamChanges.push(made);
        bus.emit("param_change", made);
      },
      fx,
      fetched: auditEvents().filter((e) => e.type === "tool_result" && e.payload?.name === "open_ecb_rate" && e.payload?.ok).map((e) => e.payload.result)
    }),
    onDiagnostics: () => openDiagnostics({ params: activeParams() })
  });

  function pickScenario(id) {
    setState({ scenarioId: id, entry: "scenario" });
    consoleUI.setScenario(id);
  }
  consoleUI.setScenario(getState().scenarioId);

  // ---- intro window: "How it works" in the header, and once by itself on a first visit ---------
  const aboutBtn = h("button", {
    class: "vc-button vc-button--secondary about-btn", type: "button", id: "btn-about",
    title: "What the Price Variance Agent does, how it works and why it pays off"
  }, icon("info", 18), h("span", { class: "btn-text" }, "How it works"));
  aboutBtn.addEventListener("click", () => showIntro());
  badge.after(withTooltip(aboutBtn, "How it works", { below: true }));

  function showIntro() {
    const s = getState();
    if (isRunning(s)) return openIntro({});
    return openIntro({ startLabel: isFinished(s) ? "New run" : "Start agent", onStart: () => start(getState().entry === "custom" ? "custom" : "scenario") });
  }

  // ---- state → view ----------------------------------------------------------------------------
  const render = (s) => {
    controls.update(s, { scenarioLabel: byId(s.scenarioId)?.short || "Choose" });
    badge.dataset.mode = s.mode || "none";
    badge.className = s.mode === "live" ? "vc-tag vc-tag--solid mode-badge" : "vc-tag mode-badge";
    badge.replaceChildren(...(s.mode === "live"
      ? [h("span", { class: "mode-dot", "aria-hidden": "true" }), "LIVE"]
      : s.mode === "simulation" ? ["SIMULATION"] : ["No run active"]));
    badge.title = s.mode === "live" ? "Live agent: real model calls on your API key"
      : s.mode === "simulation" ? "Simulation: authored replay, no model calls" : "Choose a mode with Start agent";
  };
  subscribe(render);
  render(getState());

  // ---- run events → UI effects -------------------------------------------------------------------
  bus.on("state_change", (ev) => setState({ runState: ev.payload.state }));
  bus.on("run_end", (ev) => {
    const st = ev.payload.status;
    setState({ runState: st === "done" || st === "no_findings" ? "done" : st === "incomplete" ? "stopped" : st });
    openRequest = null;
    confirmDialog?.close();
    confirmDialog = null;
  });
  bus.on("options", () => showOptions());
  bus.on("action_draft", () => drawer.show("outbox"));
  bus.on("confirmation_request", (ev) => { openRequest = ev.payload; showConfirmation(ev.payload); });
  bus.on("confirmation_decision", () => { openRequest = null; confirmDialog = null; });

  function showConfirmation(req) {
    const ix = indexOf(world);
    confirmDialog = openClusterDialog(req, {
      plantName: (id) => `${(ix.plant.get(id)?.city || id).replace(" am Main", "")} (${id})`,
      // The run's own value: a simulation runs at the defaults, whatever the person set for live runs (review R11).
      personDayHours: activeParams().person_day_hours,
      onAnswer: (answer) => {
        confirmDialog = null;
        if (!isRunning(getState())) return notice("warn", "This run has ended. Start a new run to confirm a cluster.");
        bus.emit("confirmation_decision", { ...answer, by: "user" });
      }
    });
  }

  // ---- run control -------------------------------------------------------------------------------
  async function start(entry) {
    const s = getState();
    if (isRunning(s)) return;
    const scenario = byId(getState().scenarioId);
    const runLabel = entry === "sweep" ? "Live sweep: every comparable group ranked, the first flagged one investigated (no tip)"
      : entry === "custom" ? `Custom what-if: ${getState().customText}`
        : `Scenario ${scenario?.number}: ${scenario?.title}`;
    let mode = "live";
    if (entry !== "sweep") {
      mode = await chooseMode({ runLabel, simBlocked: entry === "custom" ? "Custom what-ifs need the live agent: free text has no scripted replay." : null });
      if (!mode) return;
    }
    if (mode === "key") {
      const ok = await askApiKey({});
      setState({ keyPresent: hasKey() });
      if (!ok) return;
      mode = "live";
    }
    // The key is asked for only when a live run starts (AC-08).
    if (mode === "live" && !hasKey()) {
      const ok = await askApiKey({});
      setState({ keyPresent: hasKey() });
      if (!ok) return;
    }
    begin(mode, entry, scenario);
  }

  function begin(mode, entry, scenario) {
    const s = getState();
    const run_id = newRunId();
    const model = MODELS.find((m) => m.id === s.model) || MODELS[0];
    resetWorkspace({ keepMode: true, silent: true });
    // A simulation runs at the defaults, so its script stays valid; a live run at the person's values.
    runParams = mode === "simulation" ? DEFAULTS : params.get();
    const changed = PARAMETERS.filter((p) => runParams[p.key] !== DEFAULTS[p.key]).map((p) => ({ name: p.key, default: DEFAULTS[p.key], value: runParams[p.key] }));
    setState({ mode, runState: "scanning", runId: run_id });
    bus.beginRun({ run_id, mode });
    const title = entry === "sweep" ? "Live sweep for unexplained price variance" : entry === "custom" ? "Custom what-if" : `Scenario ${scenario.number}: ${scenario.title}`;
    const def = mode === "simulation" ? window.SIM_RUNS?.[scenario?.id] : null;
    const recorded = def?.source === "recorded";
    setState({ simSource: mode === "simulation" ? (recorded ? "recorded" : "authored") : null });
    bus.emit("run_start", {
      run_id, mode, entry, title,
      scenario_id: entry === "scenario" ? scenario.id : null,
      seed: entry === "scenario" ? scenario.seed : entry === "custom" ? s.customText : null,
      model: mode === "live" ? model.id : null,
      model_label: mode === "live" ? model.label : null,
      parameters: { ...runParams },
      parameters_changed: changed,
      ...(mode === "simulation" ? {
        sim_source: recorded ? "recorded" : "authored",
        ...(recorded ? { recorded_on: def.recorded?.at ? dateWithYear(def.recorded.at) : null, recorded_model: modelLabel(def.recorded?.model) } : {})
      } : {})
    });
    if (mode === "live") for (const change of pendingParamChanges.splice(0)) bus.emit("param_change", change);
    if (mode === "simulation") {
      if (!def) {
        bus.emit("notice", { level: "error", text: `No simulation script found for “${scenario?.title}”. Check that data/sim_runs.js is complete, or run Diagnostics.` });
        bus.emit("run_end", { status: "error", reason: "No simulation script for this scenario." });
        return;
      }
      player.play(def, { scenario: scenario.id });
      return;
    }
    agent.run({ entry, scenario, customText: s.customText, modelId: model.id });
  }

  function abort(reason) {
    if (player.isActive()) player.abort(reason);
    if (agent.isActive()) agent.abort(reason);
  }

  function resetWorkspace({ keepMode = false } = {}) {
    if (player.isActive()) player.abort("Reset by the user.");
    if (agent.isActive()) agent.abort("Reset by the user.");
    bus.endRun();
    confirmDialog?.close();
    confirmDialog = null;
    openRequest = null;
    consoleUI.reset();
    board.reset();
    kpis.reset();
    optionsPanel.reset();
    outbox.reset();
    runParams = null;
    resetAudit();
    auditPanel.refresh();
    drawer.setOpen(false);
    setState({ runState: "idle", runId: null, ...(keepMode ? {} : { mode: null }) });
  }

  function notice(level, text) {
    showBanner({ level, title: level === "warn" ? "Heads-up" : "Note", text, timeout: 6000 });
  }

  /** Opens the intro once per browser: called by main.js after the boot screen is gone. */
  function introOnFirstVisit() {
    if (!introSeen() && !document.querySelector("dialog[open]")) showIntro();
  }

  return { board, start, resetWorkspace, showIntro, introOnFirstVisit };
}

/** A banner under the header: a Vici alert in the tone of its level, dismissible. */
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
