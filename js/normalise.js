// A line's normalisation (brief §6.3 and §10): euros per base unit, delivered.
//
//   normalised price = net price / price unit / (base units per order unit) × rate to EUR × (1 + logistics uplift)
//
// Every step is returned under the brief's names, so the screen can show why a price that looks cheap
// is not. A line that cannot be normalised (an order unit without a conversion, a currency without a
// rate, a rule that is not in Incoterms 2020) is excluded from every figure and carries its reason.
// Hours and days convert through the person-day parameter, never through SAP's 24-hour day.
// Pure module: no DOM, no storage, no network.

import { DEFAULTS } from "./params.js";
import { unitPrice } from "./format.js";

export const METHOD_VERSION = "1.0.0";

/** The eleven Incoterms 2020 rules and their groups (E, F, C, D). */
export const INCOTERM_GROUPS = Object.freeze({
  EXW: "E", FCA: "F", FAS: "F", FOB: "F",
  CPT: "C", CIP: "C", CFR: "C", CIF: "C",
  DAP: "D", DPU: "D", DDP: "D"
});

/** Incoterms groups whose prices leave the main carriage unpaid, so they get the logistics uplift. */
export const UPLIFT_GROUPS = Object.freeze(["E", "F"]);

/** Time units: hours, days and person-days. A day of a service is a person-day. */
export const TIME_UNITS = Object.freeze(["H", "DAY", "PD"]);

/** The step names of brief §10, in order. */
export const STEP_NAMES = Object.freeze([
  "price_per_order_unit", "base_units_per_order_unit", "price_per_base_unit", "currency", "rate_to_eur",
  "price_per_base_unit_eur", "incoterm", "logistics_uplift", "normalised_price_eur"
]);

const hoursOf = (unit, params) => (unit === "H" ? 1 : params.person_day_hours);

/**
 * Base units per order unit: the time rule for hours, days and person-days (through the person-day
 * parameter), then the material's conversions, then 1 for the base unit itself; null when none applies.
 */
export function baseUnitsPerOrderUnit(orderUnit, unit, params = DEFAULTS) {
  const base = unit?.base_unit;
  if (!orderUnit || !base) return null;
  if (TIME_UNITS.includes(orderUnit) && TIME_UNITS.includes(base)) return hoursOf(orderUnit, params) / hoursOf(base, params);
  const factor = unit.conversions?.[orderUnit];
  if (Number.isFinite(factor) && factor > 0) return factor;
  if (orderUnit === base) return 1;
  return null;
}

/** The logistics uplift of an Incoterms rule: { uplift } or { error } for a rule outside Incoterms 2020. */
export function upliftOf(incoterm, params = DEFAULTS) {
  if (incoterm === null || incoterm === undefined || incoterm === "") return { uplift: 0 };
  const group = INCOTERM_GROUPS[String(incoterm).toUpperCase()];
  if (!group) return { error: `unknown Incoterms rule ${incoterm}` };
  return { uplift: UPLIFT_GROUPS.includes(group) ? params.logistics_uplift : 0, group };
}

/**
 * One line's normalisation.
 * line: { id, quantity, order_unit, net_price, price_unit, currency, incoterm, cancelled? }
 * unit: { group, base_unit, conversions, display_quantity } (the material master or a confirmed cluster)
 * ctx:  { rates: { [currency]: rate to EUR }, params }
 * Returns { line, group, steps, display, excluded, reason?, method_version, order_unit, base_unit,
 * display_quantity, quantity_base }: steps carry exactly the brief's names; an excluded line keeps
 * every step it could compute and null for the rest.
 */
export function normaliseLine(line, unit, ctx = {}) {
  const params = ctx.params || DEFAULTS;
  const rates = ctx.rates || { EUR: 1 };
  const steps = Object.fromEntries(STEP_NAMES.map((k) => [k, null]));
  const result = {
    line: line?.id ?? null,
    group: unit?.group ?? null,
    steps,
    display: null,
    excluded: true,
    method_version: METHOD_VERSION,
    order_unit: line?.order_unit ?? null,
    base_unit: unit?.base_unit ?? null,
    display_quantity: unit?.display_quantity ?? 1,
    quantity_base: null
  };
  const exclude = (reason) => Object.assign(result, { reason });
  if (!line || !unit) return exclude("no comparable group");
  if (line.cancelled) return exclude("cancelled");

  steps.currency = line.currency ?? null;
  steps.incoterm = line.incoterm ?? null;
  const net = Number(line.net_price);
  const per = Number(line.price_unit ?? 1);
  if (!Number.isFinite(net) || net < 0) return exclude("no valid net price");
  if (!Number.isFinite(per) || per <= 0) return exclude("no valid price unit");
  steps.price_per_order_unit = net / per;

  const factor = baseUnitsPerOrderUnit(line.order_unit, unit, params);
  if (factor === null) return exclude(`no conversion from ${line.order_unit} to ${unit.base_unit}`);
  steps.base_units_per_order_unit = factor;
  steps.price_per_base_unit = steps.price_per_order_unit / factor;
  const quantity = Number(line.quantity);
  if (Number.isFinite(quantity)) result.quantity_base = quantity * factor;

  const rate = rates[line.currency];
  if (!Number.isFinite(rate) || rate <= 0) return exclude(`no exchange rate for ${line.currency}`);
  steps.rate_to_eur = rate;
  steps.price_per_base_unit_eur = steps.price_per_base_unit * rate;

  const lift = upliftOf(line.incoterm, params);
  if (lift.error) return exclude(lift.error);
  steps.logistics_uplift = lift.uplift;
  steps.normalised_price_eur = steps.price_per_base_unit_eur * (1 + lift.uplift);

  if (!Number.isFinite(quantity) || quantity <= 0) return exclude("no positive quantity");
  result.excluded = false;
  result.display = unitPrice(steps.normalised_price_eur, result.display_quantity, unit.base_unit);
  return result;
}
