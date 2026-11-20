// The price board's view models: pure geometry and labels from the engine's results, no DOM, so the
// tests can check in Node that the ladder and the portfolio chart show exactly the engine's figures.
//
//   ladderModel     one row per plant–supplier pair, sorted by price: the pair's hexagon at its
//                   normalised price (sized by quantity), its lines as small hexagons, the benchmark
//                   line, the unexplained part from the benchmark to the pair (danger) and the
//                   justified part (warning, hatched), the euros a year at the row's end
//   portfolioModel  the flagged groups as bars of opportunity (from zero, sorted), and the value
//                   pipeline's four stages as bars, each with its definition

import { unitPrice, eur, pct, qty } from "./format.js";
import { indexOf } from "./erp.js";
import { INCOTERM_GROUPS } from "./normalise.js";

const groupOf = (incoterm) => Object.entries(INCOTERM_GROUPS).find(([, rules]) => rules.includes(incoterm))?.[0] || null;
const city = (world, id) => (indexOf(world).plant.get(String(id))?.city || String(id)).replace(" am Main", "");

/** Nice axis ticks for a range: about `count` ticks at 1, 2 or 5 times a power of ten. */
export function niceTicks(lo, hi, count = 5) {
  const span = hi - lo;
  if (!(span > 0)) return [lo];
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || 10 * mag;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Math.round(v / step) * step);
  return out;
}

/**
 * The ladder of one group.
 * analysis: an analyseGroup result; compared: the run's pv_compare has shown it (benchmark and gaps
 * appear only then); marks: { lines: Map id -> state, pairs: Map id -> state }; size: { width, height,
 * compact }.
 */
export function ladderModel(world, analysis, { compared = false, marks = { lines: new Map(), pairs: new Map() }, size = {} } = {}) {
  const width = Math.max(420, size.width || 900);
  const compact = !!size.compact;
  const labelW = Math.round(Math.min(300, Math.max(170, width * 0.27)));
  const valueW = compact ? 150 : 176;
  const left = labelW + 12;
  const right = width - valueW - 12;
  const top = 46;
  const ix = indexOf(world);
  const dq = analysis.display_quantity;
  const bu = analysis.base_unit;
  const linesById = new Map(analysis.lines.map((l) => [l.id, l]));
  const pairs = analysis.pairs.slice().sort((a, b) => a.price - b.price || a.id.localeCompare(b.id));
  const prices = [...analysis.lines.map((l) => l.price), ...pairs.map((p) => p.price)];
  let lo = Math.min(...prices);
  let hi = Math.max(...prices);
  if (!(hi > lo)) { lo *= 0.95; hi *= 1.05; }
  const pad = (hi - lo) * 0.07;
  lo = Math.max(0, lo - pad);
  hi += pad;
  const x = (price) => left + ((price - lo) / (hi - lo)) * (right - left);
  const rowH = compact ? Math.max(30, Math.min(44, ((size.height || 360) - top - 24) / Math.max(1, pairs.length))) : Math.max(46, Math.min(78, ((size.height || 480) - top - 30) / Math.max(1, pairs.length)));
  const qMax = Math.max(...pairs.map((p) => p.quantity));
  const bench = analysis.benchmark;
  const rows = pairs.map((p, i) => {
    const lines = p.lines.map((id) => linesById.get(id)).filter(Boolean);
    const orig = lines.map((l) => ix.po_line.get(l.id)).filter(Boolean);
    const contract = orig.length && orig.every((l) => l.contract);
    const currencies = [...new Set(orig.map((l) => l.currency).filter((c) => c && c !== "EUR"))];
    const terms = [...new Set(orig.map((l) => l.incoterm).filter((t) => ["E", "F"].includes(groupOf(t))))];
    const urgent = orig.filter((l) => l.urgent && l.urgent_reason).length;
    const cy = top + rowH * i + rowH / 2;
    const above = compared && bench && p.price > bench.price + 1e-9;
    const gapUnit = above ? p.price - bench.price : 0;
    const justifiedShare = above && p.gap > 0 ? p.justified / p.gap : 0;
    const xb = bench ? x(bench.price) : null;
    const xp = x(p.price);
    const xSplit = above ? xb + (xp - xb) * (1 - justifiedShare) : null;
    const state = marks.pairs.get(p.id) || null;
    const tags = [
      contract ? "contract" : "off contract",
      ...currencies.map((c) => (c === "GBP" ? "£" : c)),
      ...terms,
      urgent ? `${urgent} urgent` : null
    ].filter(Boolean);
    return {
      id: p.id, plant: p.plant, supplier: p.supplier, cy,
      city: city(world, p.plant), supplierName: ix.supplier.get(String(p.supplier))?.name || p.supplier,
      tags, quantity: p.quantity, price: p.price, share: p.share, gap: p.gap, justified: p.justified, unexplained: p.unexplained,
      isBenchmark: !!bench && bench.pair === p.id,
      isHighest: analysis.highest?.pair === p.id,
      x: xp, r: 6 + 10 * Math.sqrt(p.quantity / qMax),
      above, gapUnit, xb, xSplit,
      priceText: unitPrice(p.price, dq, bu), quantityText: qty(p.quantity, bu), shareText: pct(p.share),
      unexplainedText: eur(p.unexplained), justifiedText: eur(p.justified),
      state,
      lines: lines.map((l, k) => ({
        id: l.id, price: l.price, x: x(l.price), y: cy + (compact ? 0 : [0, -9, 9, -4.5, 4.5][k % 5]),
        urgent: !!l.urgent, unexplained: l.unexplained, justified: l.justified, mark: marks.lines.get(l.id) || null,
        priceText: unitPrice(l.price, dq, bu)
      }))
    };
  });
  const ticks = niceTicks(lo * dq, hi * dq, width < 700 ? 4 : 5).filter((t) => t / dq >= lo - 1e-12 && t / dq <= hi + 1e-12).map((t) => ({
    x: x(t / dq),
    label: tickLabel(t, hi * dq - lo * dq)
  }));
  return {
    width, height: top + rowH * pairs.length + 26, compact, left, right, top, rowH,
    compared, groupId: analysis.id, label: analysis.label, baseUnit: bu, displayQuantity: dq,
    axisUnit: `€ per ${dq === 1 ? "" : `${dq} `}${bu}`,
    benchmark: compared && bench ? { x: x(bench.price), price: bench.price, pair: bench.pair, text: unitPrice(bench.price, dq, bu) } : null,
    rows, ticks,
    excluded: analysis.excluded,
    totals: { opportunity: analysis.opportunity, spread: analysis.spread, index: analysis.index, spend: analysis.spend, quantity: analysis.quantity, flagged: analysis.flagged }
  };
}

function tickLabel(v, span) {
  const decimals = span < 20 ? 2 : 0;
  return `€${new Intl.NumberFormat("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Math.round(v * 1e9) / 1e9)}`;
}

/** Stage definitions of the value pipeline (brief §6.7), shown one click away. */
export const PIPELINE_DEFINITIONS = {
  identified: "The opportunity of the flagged groups this run's engine results show: unexplained variance over the window, read as euros a year.",
  approved: "The savings a year of the options a person approved, in this session or before (the value log), bundle discounts included as their own part.",
  implemented: "The approved savings of options with an implementation day. Nothing in the demo changes a system, so only past cases planted in the world are implemented.",
  realised: "For an implemented option: quantity × (baseline − paid price) over all later order lines of its plant and item, whichever supplier they went to. Lines that still go to another supplier are leakage."
};

/**
 * The portfolio: flagged groups by opportunity, and the value pipeline.
 * scanRows: pv_scan rows (or null before a sweep); pipeline: { identified, approved, approved_bundle,
 * implemented, realised, leakage_lines, leakage_missed }.
 */
export function portfolioModel(scanRows, pipeline) {
  const flagged = (scanRows || []).filter((r) => r.flagged).slice().sort((a, b) => b.opportunity - a.opportunity || a.id.localeCompare(b.id));
  const max = Math.max(1, ...flagged.map((r) => r.opportunity));
  const bars = flagged.map((r) => ({
    id: r.id, label: r.label, value: r.opportunity, share: r.opportunity / max,
    valueText: `${eur(r.opportunity)} a year`, spreadText: pct(r.spread), indexText: pct(r.index)
  }));
  const stages = ["identified", "approved", "implemented", "realised"].map((k) => ({ key: k, value: pipeline?.[k] ?? null }));
  const pmax = Math.max(1, ...stages.map((s) => s.value || 0));
  return {
    swept: !!scanRows,
    bars,
    stages: stages.map((s) => ({
      ...s,
      share: (s.value || 0) / pmax,
      label: { identified: "Identified", approved: "Approved", implemented: "Implemented", realised: "Realised" }[s.key],
      valueText: s.value === null ? "—" : s.key === "realised" ? `${eur(s.value)} to date` : `${eur(s.value)} a year`,
      definition: PIPELINE_DEFINITIONS[s.key]
    })),
    bundle: pipeline?.approved_bundle || 0,
    leakage: pipeline ? { lines: pipeline.leakage_lines || 0, missed: pipeline.leakage_missed || 0 } : null
  };
}
