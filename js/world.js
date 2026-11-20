// The world as the engine sees it: indexes over the data products, the engine's context at the bundled
// rates, the scan of every comparable group and the value pipeline. Pure module (no DOM, no storage, no
// network): the page, the tools and the tests share it.

import { DEFAULTS } from "./params.js";
import { buildGroups, groupIndex, unitOfLine } from "./groups.js";
import { analyseGroup, scan, portfolioIndex } from "./variance.js";
import { valuePipeline } from "./pipeline.js";

/** The bundled rates of data/fx.js: { currency: rate to EUR }. */
export const ratesOf = (fx) => Object.fromEntries(Object.entries(fx.currencies).map(([c, v]) => [c, v.rate_to_eur]));

/** The engine's context: rates, parameters, today's day number and the plants and suppliers by id. */
export function contextOf(world, rates, params = DEFAULTS) {
  return {
    rates,
    params,
    today: 0,
    plants: Object.fromEntries(world.plant.map((p) => [p.id, p])),
    suppliers: Object.fromEntries(world.supplier.map((s) => [s.id, s]))
  };
}

/** Every comparable group analysed at a set of rates (with confirmed clusters when given). */
export function analyseWorld(world, rates, { clusters = [], params = DEFAULTS } = {}) {
  const ctx = contextOf(world, rates, params);
  const groups = buildGroups(world, ctx, { clusters });
  return { ctx, analyses: groups.map((g) => analyseGroup(g, ctx)) };
}

/** The scan of the world: the groups ranked as js/variance.js ranks them, and the portfolio index. */
export function scanWorld(world, fx, { clusters = [], params = DEFAULTS } = {}) {
  const { ctx, analyses } = analyseWorld(world, ratesOf(fx), { clusters, params });
  return { ctx, analyses, rows: scan(analyses), portfolio: portfolioIndex(analyses) };
}

/** The value pipeline of the world's value log; identified comes from a run's engine results. */
export function worldPipeline(world, fx, { identified = 0, approvals = [], clusters = [], params = DEFAULTS } = {}) {
  const index = groupIndex(world, { clusters });
  const ctx = contextOf(world, ratesOf(fx), params);
  return valuePipeline({ valueLog: world.value_log, approvals, identified, lines: world.po_line, unitOf: (l) => unitOfLine(index, l), ctx });
}
