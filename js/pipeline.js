// The value pipeline (brief §6.7): identified, approved, implemented and realised value, each from its
// own evidence, and the leakage of an implemented option.
//
//   identified   the opportunity of the flagged groups (€ a year), from this run's engine results
//   approved     the savings a year of the options a person approved, in this session or before
//                (value_log), with bundle discounts as their own part; the session's approvals of
//                earlier runs come from js/session.js (review R13)
//   implemented  the approved savings of options with an implementation day
//   realised     for an implemented option: Σ quantity × (baseline − paid price) over every line of its
//                plant and group after the implementation day, whichever supplier it went to; the
//                baseline is the volume-weighted mean price paid to the old supplier in the 365 days
//                before implementation (days −365 to −1 relative to it); lines on the implementation day
//                count on neither side
//   leakage      lines after implementation that went to another supplier than the new one, each with
//                what it missed against the new price
// Prices are normalised prices (€ per base unit, delivered), so a baseline in pounds or per box compares
// with a later price in euros or per piece. Pure module: no DOM, no storage, no network.

import { DEFAULTS } from "./params.js";
import { normaliseLine } from "./normalise.js";

/** The baseline covers this many days before the implementation day (brief §6.7). */
export const BASELINE_DAYS = 365;

/**
 * Realised value and leakage of one implemented value-log entry.
 * entry:  { id, group, plant, old_supplier, new_supplier, new_price, implemented_day, ... }
 * lines:  order lines (all of the world or a selection)
 * unitOf: line → the unit of its comparable group ({ group, base_unit, conversions, display_quantity })
 *         or null when the line belongs to no group
 * ctx:    { rates, params }
 */
export function realisedValue(entry, lines, unitOf, ctx = {}) {
  const day = entry.implemented_day;
  const result = {
    entry: entry.id ?? null,
    group: entry.group,
    plant: entry.plant,
    old_supplier: entry.old_supplier,
    new_supplier: entry.new_supplier,
    new_price: entry.new_price,
    implemented_day: day ?? null,
    base_unit: null,
    display_quantity: 1,
    baseline: null,
    baseline_lines: [],
    baseline_quantity: 0,
    after: [],
    realised: 0,
    leakage: [],
    leakage_quantity: 0,
    missed: 0,
    excluded: [],
    warnings: []
  };
  if (day === null || day === undefined) {
    result.warnings.push("Not implemented: nothing can be realised yet.");
    return result;
  }
  const mine = [];
  for (const line of lines) {
    if (line.cancelled || line.plant !== entry.plant) continue;
    const unit = unitOf(line);
    if (!unit || unit.group !== entry.group) continue;
    const n = normaliseLine(line, unit, ctx);
    result.base_unit = unit.base_unit;
    result.display_quantity = unit.display_quantity ?? 1;
    if (n.excluded) { result.excluded.push({ id: line.id, reason: n.reason }); continue; }
    mine.push({ id: line.id, supplier: line.supplier, order_day: line.order_day, quantity: n.quantity_base, price: n.steps.normalised_price_eur });
  }

  const before = mine.filter((l) => l.supplier === entry.old_supplier && l.order_day >= day - BASELINE_DAYS && l.order_day <= day - 1);
  const baseQuantity = before.reduce((s, l) => s + l.quantity, 0);
  result.baseline_lines = before.map((l) => l.id);
  result.baseline_quantity = baseQuantity;
  if (!(baseQuantity > 0)) {
    result.warnings.push("No baseline: the plant bought nothing from the old supplier in the 365 days before implementation.");
    return result;
  }
  const baseline = before.reduce((s, l) => s + l.quantity * l.price, 0) / baseQuantity;
  result.baseline = baseline;

  const after = mine.filter((l) => l.order_day > day);
  result.after = after.map((l) => ({ ...l, realised: l.quantity * (baseline - l.price) }));
  result.realised = result.after.reduce((s, l) => s + l.realised, 0);
  result.leakage = after.filter((l) => l.supplier !== entry.new_supplier)
    .map((l) => ({ ...l, missed: l.quantity * (l.price - entry.new_price) }));
  result.leakage_quantity = result.leakage.reduce((s, l) => s + l.quantity, 0);
  result.missed = result.leakage.reduce((s, l) => s + l.missed, 0);
  if (!after.length) result.warnings.push("No order lines after implementation yet: nothing is realised to date.");
  return result;
}

/**
 * The four stages.
 * valueLog:   the value log (approved options, with implemented_day when implemented)
 * approvals:  this session's approvals: [{ group, option, savings, bundle }], savings with the bundle part
 * identified: the opportunity of the flagged groups this run's engine results show (€ a year)
 * lines, unitOf, ctx: as realisedValue
 */
export function valuePipeline({ valueLog = [], approvals = [], identified = 0, lines = [], unitOf = () => null, ctx = {} } = {}) {
  const logged = valueLog.map((e) => ({ savings: e.approved_savings_eur || 0, bundle: e.bundle_part_eur || 0 }));
  const session = approvals.map((x) => ({ savings: x.savings || 0, bundle: x.bundle || 0 }));
  const all = [...logged, ...session];
  const implementedEntries = valueLog.filter((e) => e.implemented_day !== null && e.implemented_day !== undefined);
  const realised = implementedEntries.map((e) => realisedValue(e, lines, unitOf, ctx));
  return {
    identified,
    approved: all.reduce((s, x) => s + x.savings, 0),
    approved_bundle: all.reduce((s, x) => s + x.bundle, 0),
    approved_options: all.length,
    implemented: implementedEntries.reduce((s, e) => s + (e.approved_savings_eur || 0), 0),
    implemented_options: implementedEntries.length,
    realised: realised.reduce((s, r) => s + r.realised, 0),
    leakage_lines: realised.reduce((s, r) => s + r.leakage.length, 0),
    leakage_missed: realised.reduce((s, r) => s + r.missed, 0),
    cases: realised,
    params_used: { baseline_days: BASELINE_DAYS, window_days: (ctx.params || DEFAULTS).window_days }
  };
}
