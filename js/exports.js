// Exports (brief §9): the report as Markdown, the group analysis as CSV and the audit log as JSON
// (js/audit.js builds that one). Every file name starts with "price-variance-", then the run's id and
// its mode in capitals, so a simulation's file never passes for a live one. Pure module apart from the
// world's indexes: the page and the tests share it.

import { indexOf } from "./erp.js";
import { unitPrice, isoOfDay } from "./format.js";
import { METHOD_VERSION } from "./normalise.js";

const MODE_TAG = { simulation: "SIMULATION", live: "LIVE" };

/** A safe part of a file name: letters, digits, dots and dashes ("MPN:Brekholt:BH-7730-S3" → "MPN-Brekholt-BH-7730-S3"). */
export const fileSlug = (text) => String(text || "").replace(/[^A-Za-z0-9.-]+/g, "-").replace(/^-+|-+$/g, "") || "x";

/**
 * The file name of an export. kind: "report" | "analysis" | "audit"; runId and mode of the run (both
 * may be null outside a run); groupId for the analysis.
 */
export function exportFileName(kind, { runId = null, mode = null, groupId = null } = {}) {
  const parts = ["price-variance"];
  if (runId) parts.push(fileSlug(runId));
  if (MODE_TAG[mode]) parts.push(MODE_TAG[mode]);
  if (kind === "analysis") parts.push(fileSlug(groupId), "analysis");
  else parts.push(kind);
  const ext = { report: "md", analysis: "csv", audit: "json" }[kind];
  return `${parts.join("-")}.${ext}`;
}

/** The report as a file: a simulation's carries its banner first, so a replay never reads as live. */
export function reportFile(markdown, { mode = null, simSource = null } = {}) {
  if (mode !== "simulation") return markdown;
  const banner = simSource === "recorded"
    ? "> SIMULATION: replay of a recorded live run, not a live analysis. The engine recalculated every figure at playback."
    : "> SIMULATION: scripted replay, not a live analysis. The engine recalculated every figure at playback; the texts are authored.";
  return `${banner}\n\n${markdown}`;
}

/** The columns of the group analysis, in order (one row per order line of the group, excluded ones too). */
export const ANALYSIS_COLUMNS = [
  "group_id", "group_label", "base_unit", "display_quantity", "line_id", "status", "excluded_reason",
  "order_date", "plant", "plant_city", "supplier", "supplier_name", "pair", "quantity_base_units",
  "currency", "incoterm", "order_unit", "net_price", "price_unit", "urgent", "urgent_reason", "contract",
  "normalised_price_eur_per_base_unit", "normalised_price", "pair_price_eur_per_base_unit", "pair_share",
  "benchmark_pair", "benchmark_price_eur_per_base_unit", "gap_eur", "justified_eur", "unexplained_eur",
  "method_version", "rates"
];

/** A number as the engine has it, rounded to 1e-9 so floating-point noise never shows ("0.1" not "0.10000000000000002"). */
const num = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? "" : String(Math.round(Number(v) * 1e9) / 1e9));
/** RFC 4180: a field with a comma, a quote or a line break is quoted, its quotes doubled. */
export const csvField = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, "\"\"")}"` : s;
};

/**
 * The group analysis as CSV: the engine's analysis of one comparable group (a GroupAnalysis), one row
 * per line with its normalisation, its pair and its gap split; excluded lines with their reason. The
 * figures are the engine's, unrounded beyond 1e-9; a UTF-8 byte order mark lets spreadsheets read "€".
 * compared: false leaves the benchmark and the gaps empty, as the board does before pv_compare.
 */
export function groupAnalysisCsv(world, a, { compared = true, ratesLabel = "" } = {}) {
  const ix = indexOf(world);
  const pairs = new Map(a.pairs.map((p) => [p.id, p]));
  const rows = [];
  const base = (l, raw) => ({
    group_id: a.id, group_label: a.label, base_unit: a.base_unit, display_quantity: a.display_quantity,
    line_id: l.id, order_date: raw ? isoOfDay(raw.order_day) : "",
    plant: raw?.plant ?? "", plant_city: raw ? ix.plant.get(String(raw.plant))?.city || "" : "",
    supplier: raw?.supplier ?? "", supplier_name: raw ? ix.supplier.get(String(raw.supplier))?.name || "" : "",
    currency: raw?.currency ?? "", incoterm: raw?.incoterm ?? "", order_unit: raw?.order_unit ?? "",
    net_price: raw?.net_price ?? "", price_unit: raw?.price_unit ?? "",
    urgent: raw ? String(!!raw.urgent) : "", urgent_reason: raw?.urgent_reason || "", contract: raw?.contract || "",
    method_version: METHOD_VERSION, rates: ratesLabel
  });
  const lines = a.lines.slice().sort((x, y) => x.pair.localeCompare(y.pair) || x.order_day - y.order_day || x.id.localeCompare(y.id));
  for (const l of lines) {
    const raw = ix.po_line.get(l.id);
    const p = pairs.get(l.pair);
    rows.push({
      ...base(l, raw), status: "included", excluded_reason: "",
      pair: l.pair, quantity_base_units: num(l.quantity),
      normalised_price_eur_per_base_unit: num(l.price), normalised_price: unitPrice(l.price, a.display_quantity, a.base_unit),
      pair_price_eur_per_base_unit: num(p?.price), pair_share: num(p?.share),
      benchmark_pair: compared ? a.benchmark?.pair || "" : "", benchmark_price_eur_per_base_unit: compared ? num(a.benchmark?.price) : "",
      gap_eur: compared ? num(l.gap) : "", justified_eur: compared ? num(l.justified) : "", unexplained_eur: compared ? num(l.unexplained) : ""
    });
  }
  for (const e of a.excluded.slice().sort((x, y) => x.id.localeCompare(y.id))) {
    const raw = ix.po_line.get(e.id);
    rows.push({ ...base({ id: e.id }, raw), status: "excluded", excluded_reason: e.reason, pair: e.plant && e.supplier ? `${e.plant} / ${e.supplier}` : "" });
  }
  const text = [ANALYSIS_COLUMNS.join(","), ...rows.map((r) => ANALYSIS_COLUMNS.map((c) => csvField(r[c] ?? "")).join(","))].join("\r\n");
  return `﻿${text}\r\n`;
}

/** Parses this module's CSV back into rows of { column: text } (for the tests and Diagnostics). */
export function parseCsv(text) {
  const src = text.replace(/^﻿/, "");
  const records = [];
  let field = "";
  let record = [];
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === "\"" && src[i + 1] === "\"") { field += "\""; i++; }
      else if (c === "\"") quoted = false;
      else field += c;
    } else if (c === "\"") quoted = true;
    else if (c === ",") { record.push(field); field = ""; }
    else if (c === "\r" && src[i + 1] === "\n") { record.push(field); records.push(record); record = []; field = ""; i++; }
    else if (c === "\n") { record.push(field); records.push(record); record = []; field = ""; }
    else field += c;
  }
  if (field !== "" || record.length) { record.push(field); records.push(record); }
  const [head, ...body] = records;
  return body.filter((r) => r.length > 1 || r[0] !== "").map((r) => Object.fromEntries(head.map((h, k) => [h, r[k] ?? ""])));
}
