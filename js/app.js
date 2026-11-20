// The presenter: five steps over one case. The simulation plays the case's script at once through the
// agent's live tools (js/simulation.js at full speed); Start agent offers it again or a live run with
// Claude on the visitor's key (js/live.js, loaded on demand). Both emit the same events, which js/run.js
// digests, js/story.js words and js/view.js draws. Keys: ← → and 1 to 5; links: ?case=gloves&step=gap.

import { bus, newRunId } from "./events.js";
import { createSimulationPlayer } from "./simulation.js";
import { DEFAULTS } from "./params.js";
import { MODELS, DEFAULT_MODEL } from "./config.js";
import { digest, STEP_IDS } from "./run.js";
import { story } from "./story.js";
import { renderStep, renderLog, h } from "./view.js";
import { playHeadless, estimateCost } from "./estimate.js";
import { money } from "./plain.js";

const W = window.WORLD;
const FX = window.FX;
const CASES = window.SCENARIOS;
const SCRIPTS = window.SIM_RUNS;
const slug = (c) => c.short.toLowerCase();
const $ = (id) => document.getElementById(id);
// The data calls the gloves case "Gloves at three sites", but its orders come from four plants, as step 1
// says; the page names it by what the visitor sees. The data stays as 1.0.0 wrote it (tests/fingerprint.mjs).
const TITLES = { "SC-GLOVES": "Gloves at four plants" };
const title = (c) => TITLES[c.id] || c.title;
const modelName = (id) => MODELS.find((m) => m.id === id)?.label || id;

const player = createSimulationPlayer({ getSpeed: () => Infinity, getWorld: () => W, getFx: () => FX, getParams: () => DEFAULTS });
const estimates = new Map();
const S = { scenario: null, step: 0, mode: "simulation", model: DEFAULT_MODEL, runId: null, events: [], view: null, clock: { start: null, stop: null }, live: null, follow: false, frame: 0 };

export async function start() {
  const q = new URLSearchParams(location.search);
  const first = CASES.find((c) => slug(c) === q.get("case")) || CASES.find((c) => c.start_here) || CASES[0];
  const at = STEP_IDS.indexOf(q.get("step"));
  bus.onAny((ev) => { if (ev.run_id && ev.run_id === S.runId) { S.events.push(ev); schedule(); } });
  buildCaseMenu();
  bindKeys();
  $("next").addEventListener("click", () => go(S.step + 1));
  $("start").addEventListener("click", openStart);
  $("start-sim").addEventListener("click", () => { $("start-dialog").close(); openCase(S.scenario, 0); });
  $("key-form").addEventListener("submit", (e) => { e.preventDefault(); startLive(); });
  $("stop").addEventListener("click", () => S.live?.abort("Stopped by you."));
  document.querySelectorAll("#steps .vc-step__button").forEach((b, i) => b.addEventListener("click", () => go(i)));
  const guide = $("guide");
  if (guide.open) guide.addEventListener("vc:guideclose", () => { if (!S.clock.start) S.clock.start = Date.now(); }, { once: true });
  setInterval(tick, 1000);
  const status = $("boot-status");
  if (status) status.textContent = `Comparing the ${first.short.toLowerCase()}' prices…`;
  await fillGuide();
  await openCase(first, 0, { keepClock: true });
  await rested();
  render();
  // A link to a later step opens it once the run has played up to it, or the furthest step it reached.
  if (at > 0) go(Math.min(at, S.view.steps.findLastIndex((st) => st.ready)), { focus: false });
  if (!guide.open) S.clock.start = Date.now();
}

/** Resolves once the run waits for the person or has ended, so the first screen shows every figure. */
function rested(limit = 10000) {
  const t0 = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      const r = digest(S.events);
      if (r.options || (r.confirmation && !r.confirmed) || r.end || Date.now() - t0 > limit) resolve();
      else setTimeout(check, 20);
    };
    check();
  });
}

/** Starts a case in the simulation, at a step. */
async function openCase(scenario, step = 0, { keepClock = false } = {}) {
  stopRun();
  S.scenario = scenario;
  S.mode = "simulation";
  S.step = step;
  S.events = [];
  if (!keepClock) S.clock = { start: Date.now(), stop: null };
  $("case-name").textContent = title(scenario);
  document.querySelectorAll("#case-menu .vc-menu__item").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.case === scenario.id)));
  setMode();
  S.runId = newRunId();
  bus.beginRun({ run_id: S.runId, mode: "simulation" });
  bus.emit("run_start", { run_id: S.runId, mode: "simulation", entry: "scenario", scenario_id: scenario.id, title: scenario.title, seed: scenario.seed, sim_source: SCRIPTS[scenario.id].source });
  player.play(SCRIPTS[scenario.id], { scenario });
  estimateFor(scenario).then(() => schedule());
  schedule();
}

function stopRun() {
  if (player.isActive()) player.abort("Another case was opened.");
  if (S.live?.isActive()) S.live.abort("Back to the simulation.");
  S.live = null;
  bus.endRun();
}

function go(i, { focus = true } = {}) {
  S.step = Math.max(0, Math.min(STEP_IDS.length - 1, i));
  // In a live run the page follows the agent's step until the presenter looks back.
  if (S.mode === "live") S.follow = S.step >= digest(S.events).reached;
  const url = new URL(location.href);
  url.searchParams.set("case", slug(S.scenario));
  url.searchParams.set("step", STEP_IDS[S.step]);
  history.replaceState(null, "", url);
  render();
  $("announce").textContent = `Step ${S.step + 1} of 5: ${S.view.steps[S.step].label}`;
  // The step's title takes the focus, so a screen reader reads where the presenter is.
  if (focus) $("story-title").focus({ preventScroll: true });
}

function schedule() {
  if (S.frame) return;
  S.frame = requestAnimationFrame(() => { S.frame = 0; render(); });
}

function render() {
  const run = digest(S.events);
  const view = story({ world: W, scenario: S.scenario, run, mode: S.mode, params: DEFAULTS });
  S.view = view;
  if (S.mode === "live" && S.follow && S.step < run.reached) S.step = run.reached;
  // The clock stops at the person's decision, or at the agent's answer when there is nothing to decide.
  if (!S.clock.stop && S.clock.start && (run.decision || (run.report && !run.options))) S.clock.stop = Date.now();
  view.steps.forEach((st, i) => {
    const li = document.querySelector(`#steps .vc-step[data-step="${st.id}"]`);
    li.classList.toggle("vc-step--current", i === S.step);
    li.classList.toggle("vc-step--done", i < S.step);
    const b = li.querySelector("button");
    if (i === S.step) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
    b.disabled = !st.ready;
    li.dataset.waits = String(!!st.waits);
  });
  const step = view.steps[S.step];
  const next = view.steps[S.step + 1];
  // One primary action a step: Next, unless the step waits for the person's own click.
  const nextButton = $("next");
  nextButton.hidden = !next;
  nextButton.disabled = !next || !next.ready;
  nextButton.classList.toggle("vc-button--secondary", !!step.waits);
  $("next-text").textContent = next ? `Next: ${next.label}` : "Next";
  renderStep(step, { approve, accept, draft, confirm });
  renderLog(S.step >= 3 ? view.log : []);
  const alert = $("story-alert");
  alert.hidden = !view.ended;
  alert.textContent = view.ended ? `The live run stopped. ${view.ended.text}` : "";
  kpis(view, run);
  document.body.dataset.step = step.id;
}

// ---- the person's decisions, on the bus as the old console sent them -----------------------------

function approve(optionId) {
  const o = digest(S.events).options;
  if (!o) return;
  bus.emit("option_decision", { options_seq: o.options_seq, option_id: optionId, option_label: o.options.find((x) => x.id === optionId)?.title, decision: "approved", by: "user" });
}
function accept(reason) {
  const o = digest(S.events).options;
  if (o) bus.emit("option_decision", { options_seq: o.options_seq, option_id: "accept", option_label: "Accept the variance", decision: "approved", reason, by: "user" });
}
function draft(actionId, decision) {
  bus.emit("action_decision", { action_id: actionId, decision, by: "user" });
}
function confirm(same) {
  const c = digest(S.events).confirmation;
  if (c) bus.emit("confirmation_decision", same ? { request_id: c.request_id, decision: "confirmed", base_unit: c.proposed_base_unit } : { request_id: c.request_id, decision: "rejected" });
}

// ---- key figures ------------------------------------------------------------------------------------

function kpis(view, run) {
  const k = view.kpis;
  const u = k.unexplained;
  $("kpi-unexplained-from").hidden = !u?.after;
  $("kpi-unexplained-to").hidden = !u?.after;
  $("kpi-unexplained-from").textContent = u?.after ? u.value : "";
  $("kpi-unexplained-value").textContent = u ? (u.after || u.value) : k.empty;
  $("kpi-unexplained-note").textContent = u ? u.note : k.waiting || "the agent is checking";
  $("kpi-unexplained").dataset.tone = u?.tone || "";
  $("kpi-highest-value").textContent = k.highest ? k.highest.value : k.empty;
  $("kpi-highest-note").textContent = k.highest ? k.highest.note : k.waiting || "the agent is checking";
  $("kpi-clock-note").textContent = k.clockNote;
  $("kpi-clock").dataset.tone = S.clock.stop ? "done" : "";
  tick();
  const est = estimates.get(S.scenario.id);
  if (S.mode === "live") {
    $("kpi-cost-value").textContent = money(run.cost?.eur || 0);
    $("kpi-cost-note").textContent = `measured, ${modelName(S.model)}`;
  } else {
    $("kpi-cost-value").textContent = est ? `≈ ${money(est.sonnet.eur)}` : "…";
    $("kpi-cost-note").textContent = "estimated for a live run";
  }
}

function tick() {
  const { start, stop } = S.clock;
  const s = start ? Math.floor(((stop || Date.now()) - start) / 1000) : 0;
  $("kpi-clock-value").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

async function estimateFor(scenario) {
  if (estimates.has(scenario.id)) return estimates.get(scenario.id);
  const events = await playHeadless({ world: W, fx: FX, params: DEFAULTS, def: SCRIPTS[scenario.id] });
  const per = Object.fromEntries(MODELS.map((m) => [m.id, estimateCost({ events, world: W, fx: FX, params: DEFAULTS, scenario, modelId: m.id })]));
  const e = { per, sonnet: per[DEFAULT_MODEL], events };
  estimates.set(scenario.id, e);
  return e;
}

// ---- the guide's figures: the gloves case, from the engine -------------------------------------------

async function fillGuide() {
  const gloves = CASES.find((c) => c.start_here) || CASES[0];
  const e = await estimateFor(gloves);
  const v = story({ world: W, scenario: gloves, run: digest(e.events), params: DEFAULTS });
  const a = digest(e.events).compare;
  const s2 = v.steps[1].stage;
  const rec = v.steps[3].stage.cards?.find((c) => c.recommended);
  const figs = {
    tip: `“${gloves.seed}”`, orders: String(a.lines.length + a.excluded.length), plants: String(new Set(a.pairs.map((p) => p.plant)).size),
    unexplained: v.kpis.unexplained.value, left: v.kpis.unexplained.after || "", spread: v.kpis.highest.value,
    "highest-plant": v.kpis.highest.note.split(" ")[0], options: String((v.steps[3].stage.cards || []).length - 1),
    cost: money(e.sonnet.eur),
    "world-plants": String(W.plant.length), "world-suppliers": W.supplier.length.toLocaleString("en-GB"), "world-orders": W.po_line.length.toLocaleString("en-GB"),
    booked: s2.card?.rows[1].value || "", delivered: s2.card?.rows.at(-1).value || "",
    best: money(a.benchmark.price * a.display_quantity), highest: money(a.highest.price * a.display_quantity),
    savings: rec ? `€${Math.round(rec.savings).toLocaleString("en-GB")}` : "", days: rec ? String(rec.days) : ""
  };
  document.querySelectorAll("#guide [data-fig]").forEach((el) => { if (figs[el.dataset.fig] !== undefined) el.textContent = figs[el.dataset.fig]; });
}

// ---- cases, keys, mode -------------------------------------------------------------------------------

function buildCaseMenu() {
  $("case-menu").replaceChildren(...CASES.map((c) => h("button", { type: "button", class: "vc-menu__item", role: "menuitemradio", "aria-checked": "false", dataset: { case: c.id }, onclick: () => { $("case-menu").hidePopover?.(); openCase(c, 0); } },
    h("span", { class: "case-item" }, h("span", { class: "case-item-title" }, title(c)), h("span", { class: "case-item-tip" }, c.seed)))));
}

function bindKeys() {
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || document.querySelector("dialog[open]") || e.target.closest?.("input, select, textarea, [popover]")) return;
    const n = Number(e.key);
    if (e.key === "ArrowRight") go(S.step + 1);
    else if (e.key === "ArrowLeft") go(S.step - 1);
    else if (n >= 1 && n <= 5) go(n - 1);
    else return;
    if (!S.view.steps[S.step].ready) go(S.view.steps.findLastIndex((st) => st.ready));
    e.preventDefault();
  });
}

/** SIMULATION or LIVE in the header; the agent's words say whether they are replayed or live. */
function setMode() {
  const live = S.mode === "live";
  const running = live && !!S.live?.isActive();
  $("mode-text").textContent = live ? "LIVE" : "SIMULATION";
  $("mode-tag").dataset.mode = live ? "live" : "simulation";
  $("tip-mode").textContent = live
    ? `Claude ${modelName(S.model)} runs on your key; the engine computes every figure and nothing is sent without your approval.`
    : "A replay of the agent's run through its live tools: the engine computes every figure and no model is called. Start agent offers a live run.";
  $("agent-note").textContent = live ? `live, Claude ${modelName(S.model)}` : "replayed, not live";
  $("stop").hidden = !running;
}

// ---- Start agent: the simulation again, or a live run ----------------------------------------------

async function openStart() {
  const e = await estimateFor(S.scenario);
  $("live-case").textContent = `the tip of “${title(S.scenario)}”`;
  $("live-model").replaceChildren(...MODELS.map((m) => h("option", { value: m.id, selected: m.id === S.model }, `${m.label}: about ${money(e.per[m.id].eur)} for this case`)));
  $("live-facts").textContent = "Estimated from this case's prompts and replies at list price. A run stops at 40 model calls or €3.";
  $("live-msg").textContent = "";
  $("live-key").value = "";
  $("start-dialog").showModal();
  $("start-sim").focus();
}

async function startLive() {
  const msg = $("live-msg");
  const live = await import("./live.js");
  const key = $("live-key").value.trim();
  const problem = live.keyProblem(key);
  if (problem) { msg.textContent = problem; $("live-key").focus(); return; }
  $("live-start").disabled = true;
  msg.className = "vc-help";
  msg.textContent = "Checking the key with Anthropic (free, no tokens used)…";
  const check = await live.checkKey(key);
  $("live-start").disabled = false;
  msg.className = "vc-help vc-help--error";
  if (!check.ok) { msg.textContent = check.message; return; }
  $("start-dialog").close();
  $("live-key").value = "";
  stopRun();
  S.model = $("live-model").value;
  S.mode = "live";
  S.step = 0;
  S.follow = true;
  S.events = [];
  S.clock = { start: Date.now(), stop: null };
  S.runId = newRunId();
  bus.beginRun({ run_id: S.runId, mode: "live" });
  bus.emit("run_start", { run_id: S.runId, mode: "live", entry: "scenario", scenario_id: S.scenario.id, title: S.scenario.title, seed: S.scenario.seed, model: S.model });
  S.live = live.startAgent({ world: W, fx: FX, params: DEFAULTS, scenario: S.scenario, modelId: S.model, onEnd: () => { setMode(); schedule(); } });
  setMode();
  schedule();
}
