// The price board (brief §9), where Rebate Hunter shows its rebate board: two views and their tables.
//   Group      the price ladder of the group in focus (js/board_ladder.js): neutral while the agent
//              reads its lines, with the benchmark, the gaps and the euros a year once pv_compare has
//              shown the group; a proposed cluster shows as its candidate lines until a person confirms it
//   Portfolio  the flagged groups by opportunity and the value pipeline (js/board_portfolio.js)
// A table of the same numbers is one click away in both views. The board follows the run events only
// (tool results, board_update, kpi_update); it never asks which producer runs. Figures come from the
// engine's results (pv_compare carries its full analysis for the board), so the ladder equals them.

import { bus } from "./events.js";
import { h, clear } from "./dom.js";
import { icon } from "./icons.js";
import { eur, pct, unitPrice } from "./format.js";
import { ladderModel, portfolioModel } from "./board_data.js";
import { renderLadder } from "./board_ladder.js";
import { renderPortfolio } from "./board_portfolio.js";
import { renderGroupTable, renderPortfolioTable } from "./board_table.js";
import { openPop, closePop, normalisationContent, pairContent } from "./board_pop.js";
import { indexOf } from "./erp.js";

/**
 * deps: { world, analyse(groupId, clusters) → analysis|null (the engine, for a group before its
 * pv_compare), pipeline (the value pipeline of the world's value log) }
 */
export function createBoard(root, { world, analyse, pipeline }) {
  const st = {
    view: "portfolio",
    table: false,
    focus: null,
    groups: new Map(),      // group id -> { analysis, compared }
    clusters: [],
    candidate: null,        // { id, lines, state }
    marks: { lines: new Map(), pairs: new Map() },
    scanRows: null,
    pipeline: { ...pipeline, identified: null },
    sensitivity: null,
    lastMatch: null
  };

  const title = h("strong", { class: "board-title", id: "board-title" }, "Price board");
  const sub = h("span", { class: "board-sub" }, "");
  const note = h("span", { class: "board-note", role: "status" }, "");
  const groupBtn = h("button", { type: "button", "aria-pressed": "false", dataset: { view: "group" } }, icon("trendDown", 16), h("span", { class: "btn-text" }, "Group"));
  const portBtn = h("button", { type: "button", "aria-pressed": "true", dataset: { view: "portfolio" } }, icon("list", 16), h("span", { class: "btn-text" }, "Portfolio"));
  const tableBtn = h("button", { class: "vc-button vc-button--outline button-compact table-toggle", type: "button", "aria-pressed": "false", title: "Show the same numbers as a table" }, h("span", { class: "btn-text" }, "Table"));
  groupBtn.addEventListener("click", () => setView("group"));
  portBtn.addEventListener("click", () => setView("portfolio"));
  tableBtn.addEventListener("click", () => { st.table = !st.table; render(); });
  const canvas = h("div", { class: "board-canvas", tabindex: "-1" });
  root.append(
    h("div", { class: "board-head" },
      h("div", { class: "board-caption" }, title, sub, note),
      h("div", { class: "board-tools" }, h("div", { class: "segmented", role: "group", "aria-label": "Board view" }, groupBtn, portBtn), tableBtn)),
    canvas);

  function setView(view) {
    if (view === "group" && !st.focus && !st.candidate) return;
    st.view = view;
    render();
  }

  const ensureGroup = (id) => {
    if (!id || st.groups.has(id)) return !!st.groups.get(id);
    const a = analyse(id, st.clusters);
    if (!a) return false;
    st.groups.set(id, { analysis: a, compared: false });
    return true;
  };

  // ---- run events ---------------------------------------------------------------------------
  bus.on("run_start", () => reset({ keepPipeline: true }));

  bus.on("tool_result", (ev) => {
    const p = ev.payload;
    if (!p.ok) return;
    if (p.name === "pv_compare" && p.detail?.analysis) {
      const a = p.detail.analysis;
      st.groups.set(a.id, { analysis: a, compared: true });
      st.focus = a.id;
      st.candidate = null;
      st.view = "group";
      if (p.detail.sensitivity) st.sensitivity = { ...p.detail.sensitivity, group_id: a.id };
      render();
    } else if (p.name === "pv_scan") {
      st.scanRows = p.result.rows || [];
      st.pipeline = { ...st.pipeline, ...p.result.pipeline };
      st.view = "portfolio";
      render();
    } else if (p.name === "pv_match") {
      st.lastMatch = p.result;
    } else if (p.name === "ui_confirm_cluster" && p.result?.cluster_id) {
      st.clusters.push({ id: p.result.cluster_id, base_unit: p.result.base_unit, line_ids: p.result.line_ids, label: null });
      st.candidate = null;
      st.groups.delete(p.result.cluster_id);
      if (ensureGroup(p.result.cluster_id)) { st.focus = p.result.cluster_id; st.view = "group"; }
      render();
    } else if (p.name === "ui_confirm_cluster" && p.result?.decision === "rejected") {
      if (st.candidate) st.candidate.state = "rejected";
      render();
    }
  });

  bus.on("board_update", (ev) => {
    const p = ev.payload;
    if (p.view === "portfolio") { st.view = "portfolio"; render(); return; }
    if (p.view === "candidate") {
      const cand = (st.lastMatch?.candidates || []).find((c) => c.candidate_id === (p.candidate_id || p.group_id)) || null;
      if (cand) { st.candidate = { id: cand.candidate_id, lines: cand.lines, state: "proposed" }; st.view = "group"; render(); }
      return;
    }
    const gid = p.focus || p.group_id || null;
    if (gid && ensureGroup(gid)) { st.focus = gid; st.view = "group"; }
    if (p.state === "checking") {
      // The newest lines the agent reads pulse; earlier ones keep a still fjord outline.
      for (const [id, s] of st.marks.lines) if (s === "checking") st.marks.lines.set(id, "checked");
    }
    for (const id of p.line_ids || []) st.marks.lines.set(id, p.state);
    for (const id of p.pair_ids || []) st.marks.pairs.set(id, p.state);
    render();
  });

  bus.on("kpi_update", (ev) => {
    const p = ev.payload;
    st.pipeline = {
      ...st.pipeline,
      identified: p.identified_eur ?? st.pipeline.identified,
      approved: p.approved_eur ?? st.pipeline.approved,
      approved_bundle: p.approved_bundle_eur ?? st.pipeline.approved_bundle,
      implemented: p.implemented_eur ?? st.pipeline.implemented,
      realised: p.realised_eur ?? st.pipeline.realised,
      leakage_lines: p.leakage_lines ?? st.pipeline.leakage_lines,
      leakage_missed: p.leakage_missed_eur ?? st.pipeline.leakage_missed
    };
    if (st.view === "portfolio") render();
  });

  bus.on("fx_sensitivity", (ev) => { st.sensitivity = ev.payload; render(); });

  // ---- render -------------------------------------------------------------------------------
  function caption() {
    if (st.view === "portfolio") {
      title.textContent = "Portfolio";
      sub.textContent = st.scanRows ? `${st.scanRows.filter((r) => r.flagged).length} flagged groups, ranked by unexplained variance; the value pipeline below` : "The value pipeline; a Live sweep ranks every comparable group";
      note.textContent = "";
      return;
    }
    if (st.candidate) {
      title.textContent = "Proposed cluster (not comparable yet)";
      sub.textContent = st.candidate.state === "rejected" ? "You rejected it: these lines stay incomparable" : `${st.candidate.lines.length} free-text lines; they count only if you confirm them`;
      note.textContent = "";
      return;
    }
    const g = st.groups.get(st.focus);
    if (!g) return;
    const a = g.analysis;
    title.textContent = a.label;
    sub.textContent = g.compared && a.benchmark
      ? `Benchmark ${unitPrice(a.benchmark.price, a.display_quantity, a.base_unit)} (${a.benchmark.pair}) · spread ${pct(a.spread)} · ${eur(a.opportunity)} a year unexplained${a.flagged ? "" : " · below materiality"}`
      : `${a.pairs.length} plant–supplier pairs at their normalised prices; the benchmark appears when the engine compares the group`;
    const s = st.sensitivity && st.sensitivity.group_id === a.id ? st.sensitivity : null;
    note.textContent = s ? `Sensitivity ${s.label}: ${eur(s.opportunity)} a year unexplained (the figures above keep the window's rate)` : "";
  }

  function render() {
    closePop();
    groupBtn.setAttribute("aria-pressed", String(st.view === "group"));
    portBtn.setAttribute("aria-pressed", String(st.view === "portfolio"));
    groupBtn.setAttribute("aria-disabled", String(!st.focus && !st.candidate));
    tableBtn.setAttribute("aria-pressed", String(st.table));
    root.dataset.view = st.view;
    root.dataset.table = String(st.table);
    caption();
    clear(canvas);
    if (st.view === "portfolio") {
      const model = portfolioModel(st.scanRows, st.pipeline);
      canvas.append(st.table ? renderPortfolioTable(model) : renderPortfolio(model, { onGroup: (id) => { if (ensureGroup(id)) { st.focus = id; st.view = "group"; render(); } } }));
      return;
    }
    if (st.candidate) { canvas.append(candidateView(st.candidate)); return; }
    const g = st.groups.get(st.focus);
    if (!g) return;
    if (st.table) { canvas.append(renderGroupTable(world, g.analysis, { compared: g.compared })); return; }
    const rect = canvas.getBoundingClientRect();
    const compact = rect.height > 0 && rect.height < 300;
    const model = ladderModel(world, g.analysis, { compared: g.compared, marks: st.marks, size: { width: Math.max(420, rect.width - 8), height: Math.max(220, rect.height - 8), compact } });
    canvas.append(renderLadder(model, {
      onLine: (id, el) => openPop(el, `Line ${id}: its normalisation`, normalisationContent(world, g.analysis, id)),
      onPair: (id, el) => openPop(el, `Pair ${id}`, pairContent(world, g.analysis, id))
    }));
    if (g.analysis.excluded.length) {
      canvas.append(h("p", { class: "board-excluded" }, icon("alert", 16), `Excluded from every figure: ${g.analysis.excluded.map((e) => `line ${e.id} (${e.reason})`).join("; ")}.`));
    }
    if (g.compared && !compact) canvas.append(legend());
  }

  function legend() {
    return h("ul", { class: "ladder-legend", "aria-label": "Legend" },
      h("li", {}, h("span", { class: "key key-bench", "aria-hidden": "true" }), "benchmark: the best price at volume"),
      h("li", {}, h("span", { class: "key key-above", "aria-hidden": "true" }), "✕ unexplained"),
      h("li", {}, h("span", { class: "key key-justified", "aria-hidden": "true" }), "justified (urgent, with a reason)"),
      h("li", {}, h("span", { class: "key key-checking", "aria-hidden": "true" }), "read by the agent"));
  }

  function candidateView(c) {
    const ix = indexOf(world);
    const byPlant = new Map();
    for (const l of c.lines) { if (!byPlant.has(l.plant)) byPlant.set(l.plant, []); byPlant.get(l.plant).push(l); }
    return h("div", { class: "candidate-view", dataset: { state: c.state } },
      h("p", { class: "candidate-lead" }, h("span", { class: "vc-tag vc-tag--feature" }, c.state === "rejected" ? "Rejected" : "Proposed by the agent"), ` ${c.id}: similar texts never make lines comparable on their own.`),
      h("div", { class: "candidate-cols" }, [...byPlant.entries()].map(([plant, lines]) => h("section", { class: "candidate-col" },
        h("h4", {}, (ix.plant.get(plant)?.city || plant).replace(" am Main", "")),
        h("ul", {}, [...new Set(lines.map((l) => l.short_text))].map((t) => h("li", {}, `“${t}”`))),
        h("p", { class: "candidate-sum" }, `${lines.length} line${lines.length === 1 ? "" : "s"} in ${[...new Set(lines.map((l) => l.order_unit))].join(" and ")}, ${[...new Set(lines.map((l) => l.currency))].join(" and ")}`)))));
  }

  if (typeof ResizeObserver === "function") {
    let last = 0;
    new ResizeObserver(() => {
      const w = Math.round(canvas.getBoundingClientRect().width / 8);
      if (w !== last) { last = w; if (st.view === "group" && !st.table) render(); }
    }).observe(canvas);
  }

  function reset({ keepPipeline = false } = {}) {
    st.focus = null;
    st.groups.clear();
    st.clusters = [];
    st.candidate = null;
    st.marks = { lines: new Map(), pairs: new Map() };
    st.scanRows = null;
    st.sensitivity = null;
    st.lastMatch = null;
    if (!keepPipeline) st.pipeline = { ...pipeline, identified: null };
    else st.pipeline = { ...pipeline, identified: null };
    st.view = "portfolio";
    st.table = false;
    render();
  }

  render();
  return {
    reset: () => reset(),
    invalidate: () => render(),
    /** For the tests: what the board shows now. */
    state: () => ({ view: st.view, table: st.table, focus: st.focus, candidate: st.candidate?.id || null })
  };
}
