// Benchmark, gap and opportunity (brief §6.4) for one comparable group, the scan over all groups and the
// portfolio index. Full precision throughout; only js/format.js turns a figure into text.
//
//   pair          one plant buying from one supplier in the group: quantity in base units, the volume-
//                 weighted mean normalised price, its share of the group's quantity
//   benchmark     the lowest pair price among the pairs with at least the minimum share (10 %)
//   gap           quantity × (price − benchmark) when a line's price exceeds the benchmark by more than
//                 1e-9 per unit, otherwise 0
//   justified     an urgent line with a recorded reason: quantity × min(gap per unit, allowance × benchmark)
//   unexplained   gap − justified; the group's opportunity is their sum (€ a year at the current volume)
//   spend         Σ quantity × normalised price; index = unexplained / spend
//   spread        (highest pair price − benchmark) / benchmark
//   flagged       opportunity ≥ €5,000 a year and spread ≥ 5 %
// Pure module: no DOM, no storage, no network.

import { DEFAULTS } from "./params.js";
import { normaliseLine, METHOD_VERSION } from "./normalise.js";
import { computeOptions } from "./options.js";

/** Prices closer than this per base unit count as equal (brief §6.4). */
export const PRICE_EPSILON = 1e-9;
/** Thresholds compare with this tolerance, so floating-point noise never flips a flag. */
const FLAG_EPSILON = 1e-9;

export const pairId = (plant, supplier) => `${plant} / ${supplier}`;

const byId = (a, b) => String(a).localeCompare(String(b), "en", { numeric: true });
const hasReason = (line) => line.urgent === true && typeof line.urgent_reason === "string" && line.urgent_reason.trim() !== "";

/** The unit a line of the group converts with: its material's master, or the group's own (a cluster). */
export function unitFor(group, line) {
  const own = (line.material && group.units?.[line.material]) || group.units?.[group.id] || {};
  return {
    group: group.id,
    base_unit: group.base_unit,
    display_quantity: group.display_quantity ?? own.display_quantity ?? 1,
    conversions: own.conversions || {}
  };
}

/**
 * The analysis of one comparable group.
 * group: { id, kind, label?, material_group?, base_unit, display_quantity, units, lines }
 * ctx:   { rates, params, plants, suppliers }
 */
export function analyseGroup(group, ctx = {}) {
  const params = ctx.params || DEFAULTS;
  const lines = [];
  const excluded = [];
  const cancelled = [];
  for (const line of group.lines || []) {
    if (line.cancelled) { cancelled.push(line.id); continue; }
    const n = normaliseLine(line, unitFor(group, line), ctx);
    if (n.excluded) { excluded.push({ id: line.id, plant: line.plant, supplier: line.supplier, reason: n.reason }); continue; }
    const price = n.steps.normalised_price_eur;
    lines.push({
      id: line.id,
      plant: line.plant,
      supplier: line.supplier,
      pair: pairId(line.plant, line.supplier),
      material: line.material ?? null,
      order_day: line.order_day ?? null,
      contract: line.contract ?? null,
      urgent: line.urgent === true,
      urgent_reason: hasReason(line) ? line.urgent_reason : null,
      quantity: n.quantity_base,
      price,
      spend: n.quantity_base * price,
      gap: 0,
      justified: 0,
      unexplained: 0,
      normalisation: n
    });
  }

  // Pairs: quantity, volume-weighted mean price, share.
  const quantity = lines.reduce((s, l) => s + l.quantity, 0);
  const pairMap = new Map();
  for (const l of lines) {
    const p = pairMap.get(l.pair) || { id: l.pair, plant: l.plant, supplier: l.supplier, quantity: 0, spend: 0, lines: [] };
    p.quantity += l.quantity;
    p.spend += l.spend;
    p.lines.push(l.id);
    pairMap.set(l.pair, p);
  }
  const pairs = [...pairMap.values()].map((p) => ({
    ...p,
    price: p.spend / p.quantity,
    share: quantity > 0 ? p.quantity / quantity : 0,
    gap: 0,
    justified: 0,
    unexplained: 0
  }));
  for (const p of pairs) p.eligible = p.share >= params.benchmark_min_share - FLAG_EPSILON;
  pairs.sort((x, y) => x.price - y.price || y.quantity - x.quantity || byId(x.plant, y.plant) || byId(x.supplier, y.supplier));

  // Benchmark: GlobalCorp's own best price at volume; a one-off bargain never sets it.
  const best = pairs.find((p) => p.eligible) || null;
  const benchmark = best ? { pair: best.id, plant: best.plant, supplier: best.supplier, price: best.price, share: best.share } : null;
  const highest = pairs.length ? pairs.reduce((h, p) => (p.price > h.price ? p : h), pairs[0]) : null;

  // Every line's gap, justified and unexplained part.
  if (benchmark) {
    const cap = params.urgent_allowance * benchmark.price;
    for (const l of lines) {
      const perUnit = l.price - benchmark.price;
      if (perUnit > PRICE_EPSILON) {
        l.gap = l.quantity * perUnit;
        l.justified = l.urgent_reason ? l.quantity * Math.min(perUnit, cap) : 0;
        l.unexplained = l.gap - l.justified;
      }
    }
  }
  const pairOf = new Map(pairs.map((p) => [p.id, p]));
  for (const l of lines) {
    const p = pairOf.get(l.pair);
    p.gap += l.gap; p.justified += l.justified; p.unexplained += l.unexplained;
  }

  const total = (k) => lines.reduce((s, l) => s + l[k], 0);
  const spend = total("spend");
  const gap = total("gap");
  const justified = total("justified");
  const unexplained = total("unexplained");
  const spread = benchmark && highest ? (highest.price - benchmark.price) / benchmark.price : 0;
  const opportunityOk = unexplained >= params.materiality_eur - FLAG_EPSILON;
  const spreadOk = spread >= params.materiality_spread - FLAG_EPSILON;

  const analysis = {
    id: group.id,
    kind: group.kind || "material",
    label: group.label ?? null,
    material_group: group.material_group ?? null,
    base_unit: group.base_unit,
    display_quantity: group.display_quantity ?? 1,
    method_version: METHOD_VERSION,
    lines,
    excluded,
    cancelled,
    pairs,
    quantity,
    benchmark,
    highest: highest ? { pair: highest.id, plant: highest.plant, supplier: highest.supplier, price: highest.price } : null,
    spend,
    gap,
    justified,
    unexplained,
    opportunity: unexplained,
    index: spend > 0 ? unexplained / spend : 0,
    spread,
    materiality: { opportunity_eur: params.materiality_eur, spread: params.materiality_spread, opportunity_ok: opportunityOk, spread_ok: spreadOk },
    flagged: Boolean(benchmark) && opportunityOk && spreadOk,
    warnings: benchmark ? [] : ["No pair buys the minimum share of the group's quantity, so the group has no benchmark."]
  };
  analysis.options = computeOptions(analysis, ctx);
  return analysis;
}

/**
 * The scan: every group's headline figures, ranked by opportunity (flagged first, then the rest).
 * analyses: the results of analyseGroup.
 */
export function scan(analyses) {
  const rows = analyses.map((a) => ({
    id: a.id,
    kind: a.kind,
    label: a.label,
    material_group: a.material_group,
    base_unit: a.base_unit,
    display_quantity: a.display_quantity,
    lines: a.lines.length,
    excluded: a.excluded.length,
    pairs: a.pairs.length,
    quantity: a.quantity,
    benchmark: a.benchmark ? a.benchmark.price : null,
    spend: a.spend,
    opportunity: a.opportunity,
    index: a.index,
    spread: a.spread,
    flagged: a.flagged
  }));
  rows.sort((x, y) => Number(y.flagged) - Number(x.flagged) || y.opportunity - x.opportunity || byId(x.id, y.id));
  return rows;
}

/**
 * The portfolio's price variance index, and its projection after approvals (brief §6.4):
 * (Σ unexplained − approved savings on unexplained parts) / (Σ spend − approved savings, bundles included).
 * approvals: [{ savings, bundle }], savings including the bundle part.
 */
export function portfolioIndex(analyses, approvals = []) {
  const unexplained = analyses.reduce((s, a) => s + a.unexplained, 0);
  const spend = analyses.reduce((s, a) => s + a.spend, 0);
  const approved = approvals.reduce((s, x) => s + (x.savings || 0), 0);
  const onUnexplained = approvals.reduce((s, x) => s + (x.savings || 0) - (x.bundle || 0), 0);
  return {
    unexplained,
    spend,
    index: spend > 0 ? unexplained / spend : 0,
    projected: approvals.length && spend - approved > 0 ? (unexplained - onUnexplained) / (spend - approved) : null
  };
}
