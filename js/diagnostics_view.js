// Diagnostics dialog: self-tests from this browser ("Run all tests"), the golden cases and the scripts
// with their checks, and the method's parameters read-only (they are edited only in the Method panel,
// and locked in Simulation). A failed rate host is remembered for the session: the agent then keeps
// the bundled rates at once.

import { h, clear } from "./dom.js";
import { icon } from "./icons.js";
import { openModal } from "./modal.js";
import { TESTS, runAll, runTest, memory } from "./diagnostics.js";
import { APP } from "./config.js";
import { PARAMETERS } from "./params.js";
import { eur, pct } from "./format.js";

const STATUS_TEXT = { pass: "Pass", fail: "Fail", warn: "Check", skip: "Skipped", running: "Testing", idle: "Not run" };
const STATUS_ICON = { pass: "check", fail: "x", warn: "alert", skip: "info", idle: "info" };
const STATUS_TAG = { pass: "vc-tag--success", fail: "vc-tag--danger", warn: "vc-tag--warning", running: "vc-tag--info", skip: "", idle: "" };

export function openDiagnostics({ params } = {}) {
  const rows = new Map();
  const remembered = memory();
  const tbody = h("tbody");
  for (const t of TESTS) {
    const statusCell = h("td", { class: "status" });
    const msCell = h("td", { class: "ms vc-tabular" }, "");
    const detailCell = h("td", { class: "detail" }, t.purpose);
    tbody.appendChild(h("tr", { dataset: { test: t.id } }, h("td", {}, h("strong", {}, t.label), h("span", { class: "host" }, t.host)), statusCell, msCell, detailCell));
    rows.set(t.id, { statusCell, msCell, detailCell });
    const prev = remembered[t.id];
    setRow(t.id, prev ? { status: prev.status, detail: `${prev.detail} (earlier this session)` } : { status: "idle" });
  }
  const checkList = h("ul", { class: "world-checks" });

  function setRow(id, r) {
    const row = rows.get(id);
    if (!row) return;
    const s = r.status || "idle";
    clear(row.statusCell).appendChild(h("span", { class: ["vc-tag", STATUS_TAG[s] || "", "diag-status"], dataset: { s } },
      s === "running" ? h("span", { class: "vc-spinner vc-spinner--sm", "aria-hidden": "true" }) : icon(STATUS_ICON[s] || "info", 16), STATUS_TEXT[s] || s));
    row.msCell.textContent = r.ms ? `${r.ms} ms` : "";
    if (r.detail) row.detailCell.textContent = r.detail;
    if (r.checks) {
      for (const c of r.checks.filter((x) => !x.ok).slice(0, 12)) {
        checkList.appendChild(h("li", { dataset: { ok: "false" } }, h("span", { class: "vc-tag vc-tag--danger world-mark" }, icon("x", 14), "Fail"), h("span", {}, `${c.name}${c.detail ? ` — ${c.detail}` : ""}`)));
      }
    }
  }

  const runBtn = h("button", { class: "vc-button", type: "button", autofocus: true }, icon("pulse", 18), "Run all tests");
  runBtn.addEventListener("click", async () => {
    if (runBtn.getAttribute("aria-disabled") === "true") return;
    runBtn.setAttribute("aria-disabled", "true");
    clear(checkList);
    await runAll(setRow);
    runBtn.setAttribute("aria-disabled", "false");
  });

  const p = params || {};
  const shown = (x) => (x.unit === "share" ? pct(p[x.key]) : x.unit === "€" || x.unit === "€ a year" ? eur(p[x.key]) : `${p[x.key]} ${x.unit}`);
  const modal = openModal({
    title: "Diagnostics",
    intro: "Tests the services this page reaches, the engine's golden cases and the simulation scripts, from this browser. A failed rate host is remembered for this session: the agent then keeps the bundled rates.",
    size: "wide",
    body: [
      h("div", { class: "vc-table-wrap diag-wrap" },
        h("table", { class: "vc-table diag-table" },
          h("thead", {}, h("tr", {}, h("th", {}, "Test"), h("th", {}, "Status"), h("th", {}, "Time"), h("th", {}, "Details"))),
          tbody)),
      checkList,
      h("details", { class: "diag-section diag-params" }, h("summary", {}, icon("info", 16), "The method's parameters (read-only, all assumptions)"),
        h("table", { class: "vc-table vc-table--compact" },
          h("tbody", {}, PARAMETERS.map((x) => h("tr", {}, h("th", { scope: "row" }, x.label), h("td", { class: "num vc-tabular" }, shown(x)))))))
    ],
    footer: [
      h("span", { class: "dialog-note" }, `${APP.name} ${APP.version}. Run this on the presentation laptop and network before going on stage.`),
      runBtn
    ]
  });
  runTest("golden").then((r) => setRow("golden", r));
  runTest("privacy").then((r) => setRow("privacy", r));
  return modal;
}
