// The presenter: five steps over one case. The simulation plays the case's script at once through the
// agent's live tools (js/simulation.js at full speed); Start agent offers it again or a live run with
// Claude on the visitor's key (js/live.js, loaded on demand). Both emit the same events, which js/run.js
// digests, js/story.js words and js/view.js draws. Play walks the steps by itself, each for its reading
// time, and stops where the person acts. Keys: Space plays or pauses; ← → (a clicker's PageUp and
// PageDown) and 1 to 5 step by hand. Links: ?case=gloves&step=gap opens a step, paused.

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
/** Play: on, the frame it asked for, the time spent reading the step, the step it timed. */
const P = { on: false, raf: 0, at: 0, last: 0, step: -1 };

export async function start() {
  const q = new URLSearchParams(location.search);
  const first = CASES.find((c) => slug(c) === q.get("case")) || CASES.find((c) => c.start_here) || CASES[0];
  const at = STEP_IDS.indexOf(q.get("step"));
  bus.onAny((ev) => { if (ev.run_id && ev.run_id === S.runId) { S.events.push(ev); schedule(); } });
  buildCaseMenu();
  bindKeys();
  // Next goes on at once and keeps Play going; a step chosen in the bar or by key hands over the controls.
  $("next").addEventListener("click", () => go(S.step + 1, { keep: true }));
  $("play").addEventListener("click", () => (P.on ? pause() : play()));
  $("start").addEventListener("click", openStart);
  $("start-sim").addEventListener("click", () => { $("start-dialog").close(); openCase(S.scenario, 0); play(); });
  $("key-form").addEventListener("submit", (e) => { e.preventDefault(); startLive(); });
  $("stop").addEventListener("click", () => S.live?.abort("Stopped by you."));
  document.querySelectorAll("#steps .vc-step__button").forEach((b, i) => b.addEventListener("click", () => go(i)));
  for (const t of ["pointerdown", "keydown", "wheel"]) document.addEventListener(t, nudge, { capture: true, passive: true });
  // The guide opens by itself on a new tab; closing it starts the clock and Play, unless a link asked
  // for a step. Start on a guide opened later plays the case.
  const guide = $("guide");
  let firstClose = guide.open;
  guide.addEventListener("vc:guideclose", (e) => {
    const done = e.detail?.returnValue === "done";
    if (firstClose) {
      firstClose = false;
      if (!S.clock.start) S.clock.start = Date.now();
      if (at < 0) play();
    } else if (done) play();
    if (done && P.on) $("play").focus({ preventScroll: true });
  });
  setInterval(tick, 1000);
  const status = $("boot-status");
  if (status) status.textContent = `Comparing the ${first.short.toLowerCase()}' prices…`;
  await fillGuide();
  await openCase(first, 0, { keepClock: true });
  await rested();
  render();
  // A link to a step opens it, paused, once the run has played up to it, or the furthest step it reached.
  if (at >= 0) go(Math.min(at, S.view.steps.findLastIndex((st) => st.ready)), { focus: false });
  if (!guide.open) {
    S.clock.start = Date.now();
    if (at < 0) play();
  }
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
  Object.assign(P, { step, at: 0 });
  fill(0);
  // A case opened on the page starts from its tip, and the address says which case (at boot it already does).
  if (!keepClock) {
    const url = new URL(location.href);
    url.searchParams.set("case", slug(scenario));
    url.searchParams.delete("step");
    history.replaceState(null, "", url);
    $("announce").textContent = `${title(scenario)}. Step 1 of 5: The tip.`;
  }
  schedule();
}

function stopRun() {
  if (player.isActive()) player.abort("Another case was opened.");
  if (S.live?.isActive()) S.live.abort("Back to the simulation.");
  S.live = null;
  bus.endRun();
}

/** Shows step i. A step the presenter chooses pauses Play (keep: Next and Play itself go on playing). */
function go(i, { focus = true, keep = false } = {}) {
  if (!keep) pause();
  S.step = Math.max(0, Math.min(STEP_IDS.length - 1, i));
  if (P.step !== S.step) Object.assign(P, { step: S.step, at: 0 });
  // In a live run the page follows the agent's step until the presenter looks back.
  if (S.mode === "live") S.follow = S.step >= digest(S.events).reached;
  const url = new URL(location.href);
  url.searchParams.set("case", slug(S.scenario));
  url.searchParams.set("step", STEP_IDS[S.step]);
  history.replaceState(null, "", url);
  render();
  const shown = S.view.steps[S.step];
  $("announce").textContent = `Step ${S.step + 1} of 5: ${shown.label}.${shown.turn ? ` Your turn: ${shown.turn}` : ""}`;
  fill(0);
  nudge();
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
  // One primary action a step: Next, or where the step waits for the person, their own click (the
  // Your turn callout points at it) and no Next at all.
  const nextButton = $("next");
  nextButton.hidden = !next || step.waits;
  nextButton.disabled = !next || !next.ready;
  $("next-text").textContent = next ? `Next: ${next.label}` : "Next";
  renderStep(step, { approve, accept, draft, confirm });
  renderLog(S.step >= 3 ? view.log : []);
  const alert = $("story-alert");
  alert.hidden = !view.ended;
  alert.textContent = view.ended ? `The live run stopped. ${view.ended.text}` : "";
  kpis(view, run);
  document.body.dataset.step = step.id;
  drawPlay();
  drawFoot();
}

// ---- Play: the steps go by themselves and stop where the person acts ------------------------------

/** The story is over: the last step, with nothing left for the person to do. */
const finished = () => !!S.view && S.step === STEP_IDS.length - 1 && !S.view.steps[S.step].waits;
/** A dialog or the case menu covers the page: Play holds its time until it closes. */
function covered() {
  if (document.querySelector("dialog[open]")) return true;
  try { return $("case-menu").matches(":popover-open"); } catch { return false; }
}

function play() {
  if (S.mode === "live") return;
  // Replay: the case again from the tip, with its decision open again.
  if (finished()) openCase(S.scenario, 0);
  P.on = true;
  P.last = 0;
  $("next").classList.remove("vc-attention");
  drawPlay();
  drawFoot();
  if (!P.raf) P.raf = requestAnimationFrame(frame);
}

function pause() {
  if (!P.on) return;
  P.on = false;
  cancelAnimationFrame(P.raf);
  P.raf = 0;
  drawPlay();
  drawFoot();
  nudge();
}

function frame(now) {
  P.raf = 0;
  if (!P.on) return;
  // Time away from the tab (or a slow frame) does not count.
  const dt = P.last ? Math.min(now - P.last, 100) : 0;
  P.last = now;
  if (S.view) {
    if (P.step !== S.step) Object.assign(P, { step: S.step, at: 0 });
    const step = S.view.steps[S.step];
    const next = S.view.steps[S.step + 1];
    const total = step.read;
    if (step.waits) {
      // The person's turn: Play waits; once they have acted, the step's new words get their reading time.
      P.at = 0;
    } else if (!next) {
      fill(0);
      pause();
      return;
    } else if (next.ready && !covered()) {
      P.at += dt;
      if (P.at >= total) {
        go(S.step + 1, { focus: false, keep: true });
        P.raf = requestAnimationFrame(frame);
        return;
      }
    }
    fill(step.waits ? 0 : P.at / total);
    drawFoot();
  }
  P.raf = requestAnimationFrame(frame);
}

/** How far the current step is read: the line to the next step and the bar in Next fill with it. */
function fill(p) {
  const v = Math.max(0, Math.min(1, p)).toFixed(4);
  document.querySelectorAll("#steps .vc-step").forEach((li, i) => li.style.setProperty("--vc-step-fill", i === S.step ? v : "0"));
  $("next").style.setProperty("--fill", v);
}

/** Play, Pause or Replay; in a live run the page follows the agent, so Stop takes Play's place. */
function drawPlay() {
  const b = $("play");
  b.hidden = S.mode === "live";
  const state = P.on ? "pause" : finished() ? "replay" : "play";
  if (b.dataset.state === state) return;
  b.dataset.state = state;
  b.querySelector(".vc-icon").className = `vc-icon vc-icon--${state === "pause" ? "pause" : state === "replay" ? "refresh" : "play"}`;
  $("play-text").textContent = state === "pause" ? "Pause" : state === "replay" ? "Replay" : "Play";
}

/** Beside Next, in words: when Play moves on, or that the move is the person's while it is paused. */
function drawFoot() {
  const note = $("foot-note");
  const next = $("next");
  const shown = !next.hidden && !next.disabled && S.view;
  const left = shown && P.on ? Math.max(1, Math.ceil((S.view.steps[S.step].read - P.at) / 1000)) : 0;
  const words = !shown ? "" : P.on ? `Plays on in ${left} s` : "Your move";
  if (note.textContent !== words) note.textContent = words;
  note.dataset.tone = shown && !P.on ? "move" : "";
}

/** Paused, Next draws the eye after six seconds without a click, a key or a scroll (Vici's vc-attention). */
let idle = 0;
function nudge() {
  clearTimeout(idle);
  $("next").classList.remove("vc-attention");
  idle = setTimeout(() => {
    const next = $("next");
    if (!P.on && !next.hidden && !next.disabled && !covered()) next.classList.add("vc-attention");
  }, 6000);
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
  $("case-menu").replaceChildren(...CASES.map((c) => h("button", { type: "button", class: "vc-menu__item", role: "menuitemradio", "aria-checked": "false", dataset: { case: c.id }, onclick: () => { $("case-menu").hidePopover?.(); openCase(c, 0); play(); } },
    h("span", { class: "case-item" }, h("span", { class: "case-item-title" }, title(c)), h("span", { class: "case-item-tip" }, c.seed)))));
}

function bindKeys() {
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || document.querySelector("dialog[open]") || e.target.closest?.("input, select, textarea, [popover]")) return;
    // Space plays or pauses, unless it presses the button that has the focus.
    if (e.key === " ") {
      if (e.target.closest?.("button, a, summary, [role=button]")) return;
      e.preventDefault();
      if (!e.repeat) (P.on ? pause() : play());
      return;
    }
    const n = Number(e.key);
    // A clicker sends the arrow keys or PageDown and PageUp.
    if (e.key === "ArrowRight" || e.key === "PageDown") go(S.step + 1);
    else if (e.key === "ArrowLeft" || e.key === "PageUp") go(S.step - 1);
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
  pause();
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
