// The options for a group (brief §6.5): H harmonise to the benchmark supplier, R renegotiate to the
// benchmark, B bundle the group's volume in one tender, and accepting the variance. Every figure comes
// from the group's analysis (js/variance.js) and the parameters; nothing here formats or rounds.
//
// For each option: savings a year (B's bundle discount as its own part), one-off cost, savings less
// one-off cost, days to first saving, the residual unexplained variance, the price variance index after
// (residual / (normalised spend − savings)), the plants and suppliers it touches, and its warnings.
// Pure module: no DOM, no storage, no network.

import { DEFAULTS } from "./params.js";

export const OPTION_IDS = Object.freeze(["H", "R", "B", "accept"]);

/** The reasons a person may give for accepting a variance (brief §6.5). */
export const ACCEPT_REASONS = Object.freeze([
  "specification differs", "supply security", "local requirement", "price change within the window", "volume tier", "other"
]);

export const OPTION_TITLES = Object.freeze({
  H: "Harmonise to the benchmark supplier",
  R: "Renegotiate to the benchmark",
  B: "Bundle the group's volume in one tender",
  accept: "Accept the variance"
});

const uniqueSorted = (xs) => [...new Set(xs)].sort((a, b) => String(a).localeCompare(String(b), "en", { numeric: true }));
const sum = (xs, f) => xs.reduce((s, x) => s + f(x), 0);
const indexAfter = (residual, spend, savings) => (spend - savings > 0 ? residual / (spend - savings) : 0);
const listing = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

function option(id, fields) {
  const o = {
    id,
    title: OPTION_TITLES[id],
    applicable: true,
    savings: 0,
    bundle: 0,
    one_off: 0,
    net: 0,
    residual: 0,
    index_after: 0,
    days_to_first_saving: null,
    plants: [],
    suppliers: [],
    warnings: [],
    ...fields
  };
  o.net = o.savings - o.one_off;
  return o;
}

/**
 * The four options of a group analysis.
 * a:   the analysis (lines with plant, supplier, quantity, price, gap, justified, unexplained; quantity,
 *      spend, unexplained; benchmark { supplier, price } or null)
 * ctx: { params, plants: { id: { country } }, suppliers: { id: { delivers_to } } }
 */
export function computeOptions(a, ctx = {}) {
  const p = ctx.params || DEFAULTS;
  const plants = ctx.plants || {};
  const suppliers = ctx.suppliers || {};
  const above = a.lines.filter((l) => l.gap > 0);
  const accept = option("accept", {
    residual: a.unexplained,
    index_after: a.spend > 0 ? a.unexplained / a.spend : 0,
    reasons: [...ACCEPT_REASONS],
    warnings: ["Accepting the variance needs a reason."]
  });

  if (!a.benchmark) {
    const why = "Not applicable: no pair buys enough of the group's quantity to set a benchmark.";
    const none = (id) => option(id, { applicable: false, residual: a.unexplained, index_after: accept.index_after, warnings: [why] });
    return { H: { ...none("H"), supplier: null, plants_moved: [], plants_not_covered: [], lines_moved: [], quantity_moved: 0, share_after: 0 }, R: none("R"), B: none("B"), accept };
  }
  const b = a.benchmark.supplier;

  // H: move the lines above the benchmark at the plants supplier b delivers to; the rest stay.
  const deliversTo = suppliers[b]?.delivers_to || [];
  const covered = (plant) => deliversTo.includes(plants[plant]?.country);
  const moved = above.filter((l) => covered(l.plant));
  const plantsMoved = uniqueSorted(moved.map((l) => l.plant));
  const notCovered = uniqueSorted(above.filter((l) => !covered(l.plant)).map((l) => l.plant));
  const hSavings = sum(moved, (l) => l.unexplained);
  const quantityMoved = sum(moved.filter((l) => l.supplier !== b), (l) => l.quantity);
  const ownQuantity = sum(a.lines.filter((l) => l.supplier === b), (l) => l.quantity);
  const hWarnings = [];
  if (!moved.length) {
    hWarnings.push(above.length
      ? `Not applicable: ${b} delivers to no plant above the benchmark (${listing(notCovered)}).`
      : "Not applicable: no line is above the benchmark.");
  } else if (notCovered.length) {
    hWarnings.push(`${b} does not deliver to plant${notCovered.length > 1 ? "s" : ""} ${listing(notCovered)}; ${notCovered.length > 1 ? "their" : "its"} lines stay above the benchmark.`);
  }
  if (moved.some((l) => l.justified > 0)) hWarnings.push("Urgent orders with a recorded reason move too; their justified part is not counted as savings.");
  const hResidual = a.unexplained - hSavings;
  const H = option("H", {
    applicable: moved.length > 0,
    supplier: b,
    savings: hSavings,
    one_off: p.harmonise_days_per_plant * plantsMoved.length * p.day_rate_eur,
    residual: hResidual,
    index_after: indexAfter(hResidual, a.spend, hSavings),
    days_to_first_saving: p.lead_time_harmonise_days,
    plants: plantsMoved,
    suppliers: uniqueSorted([b, ...moved.map((l) => l.supplier)]),
    plants_moved: plantsMoved,
    plants_not_covered: notCovered,
    lines_moved: moved.map((l) => l.id),
    quantity_moved: quantityMoved,
    share_after: a.quantity > 0 ? (ownQuantity + quantityMoved) / a.quantity : 0,
    warnings: hWarnings
  });

  // R: every supplier above the benchmark, counted once however many plants it sells to.
  const rSuppliers = uniqueSorted(above.map((l) => l.supplier));
  const R = option("R", {
    applicable: rSuppliers.length > 0,
    savings: a.unexplained,
    one_off: p.renegotiate_days_per_supplier * rSuppliers.length * p.day_rate_eur,
    residual: 0,
    index_after: indexAfter(0, a.spend, a.unexplained),
    days_to_first_saving: p.lead_time_renegotiate_days,
    plants: uniqueSorted(above.map((l) => l.plant)),
    suppliers: rSuppliers,
    warnings: rSuppliers.length
      ? [`Depends on every supplier above the benchmark agreeing to its price: ${listing(rSuppliers)}.`]
      : ["Not applicable: no line is above the benchmark."]
  });
  if (!R.applicable) Object.assign(R, { savings: 0, net: 0, residual: a.unexplained, index_after: accept.index_after });

  // B: one tender for the whole group, with the bundle discount on its quantity at the benchmark.
  const bundle = p.bundle_discount * a.quantity * a.benchmark.price;
  const bSavings = a.unexplained + bundle;
  const B = option("B", {
    applicable: a.quantity > 0,
    savings: bSavings,
    bundle,
    one_off: p.tender_days * p.day_rate_eur,
    residual: 0,
    index_after: indexAfter(0, a.spend, bSavings),
    days_to_first_saving: p.lead_time_tender_days,
    plants: uniqueSorted(a.lines.map((l) => l.plant)),
    suppliers: uniqueSorted(a.lines.map((l) => l.supplier)),
    warnings: ["The bundle discount is an assumption; a tender's result is known only when the bids are in."]
  });

  return { H, R, B, accept };
}
