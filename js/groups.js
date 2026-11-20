// Comparable groups (brief §6.2): the only sets of order lines the engine may compare.
//
//   material   the same material number; the group's id is the material number
//   mpn        the same manufacturer and manufacturer part number across different material numbers,
//              id "MPN:<manufacturer>:<part number>"; its materials are not analysed again on their own
//   cluster    free-text lines a person confirmed together with a base unit ("CL-01", "CL-02" …);
//              similar descriptions never make lines comparable on their own
//
// Lines that count: the analysis window (the last N days, days −(N−1) to 0), not cancelled, and for a
// group with an implemented option only the lines after its implementation day, so the sweep never
// flags it again for prices it has already fixed. Pure module: no DOM, no storage, no network.

import { DEFAULTS } from "./params.js";

export const mpnId = (manufacturer, mpn) => `MPN:${manufacturer}:${mpn}`;

/**
 * The group definitions of a world, without lines: which group each material and each confirmed
 * free-text line belongs to, and the unit each group converts to.
 * world:    { material: [...] }
 * clusters: confirmed clusters [{ id, base_unit, line_ids, material_group?, label? }]
 */
export function groupIndex(world, { clusters = [] } = {}) {
  const defs = new Map();
  const groupOfMaterial = new Map();
  const groupOfLine = new Map();
  const warnings = [];
  const materials = world.material || [];

  const byMpn = new Map();
  for (const m of materials) {
    if (!m.manufacturer || !m.mpn) continue;
    const key = mpnId(m.manufacturer, m.mpn);
    byMpn.set(key, [...(byMpn.get(key) || []), m]);
  }
  for (const [id, ms] of byMpn) {
    if (ms.length < 2) continue;
    if (new Set(ms.map((m) => m.base_unit)).size > 1) {
      warnings.push(`${id}: the materials ${ms.map((m) => m.id).join(", ")} have different base units, so they stay separate groups.`);
      continue;
    }
    defs.set(id, {
      id,
      kind: "mpn",
      label: ms[0].description,
      material_group: ms[0].material_group,
      base_unit: ms[0].base_unit,
      display_quantity: ms[0].display_quantity ?? 1,
      materials: ms.map((m) => m.id),
      units: Object.fromEntries(ms.map((m) => [m.id, m]))
    });
    for (const m of ms) groupOfMaterial.set(m.id, id);
  }
  for (const m of materials) {
    if (groupOfMaterial.has(m.id)) continue;
    defs.set(m.id, {
      id: m.id,
      kind: "material",
      label: m.description,
      material_group: m.material_group,
      base_unit: m.base_unit,
      display_quantity: m.display_quantity ?? 1,
      materials: [m.id],
      units: { [m.id]: m }
    });
    groupOfMaterial.set(m.id, m.id);
  }
  for (const c of clusters) {
    defs.set(c.id, {
      id: c.id,
      kind: "cluster",
      label: c.label ?? c.id,
      material_group: c.material_group ?? null,
      base_unit: c.base_unit,
      display_quantity: 1,
      materials: [],
      units: { [c.id]: { id: c.id, base_unit: c.base_unit, conversions: { [c.base_unit]: 1 }, display_quantity: 1 } },
      line_ids: [...c.line_ids]
    });
    for (const id of c.line_ids) groupOfLine.set(id, c.id);
  }
  return { defs, groupOfMaterial, groupOfLine, warnings };
}

/** The id of the comparable group a line belongs to, or null (free text outside any confirmed cluster). */
export function groupIdOf(index, line) {
  if (line.material) return index.groupOfMaterial.get(line.material) ?? null;
  return index.groupOfLine.get(line.id) ?? null;
}

/** The unit a line converts with ({ group, base_unit, conversions, display_quantity }), or null. */
export function unitOfLine(index, line) {
  const id = groupIdOf(index, line);
  if (!id) return null;
  const def = index.defs.get(id);
  const own = (line.material && def.units[line.material]) || def.units[def.id] || {};
  return { group: id, base_unit: def.base_unit, conversions: own.conversions || {}, display_quantity: def.display_quantity };
}

/** Is a day inside the analysis window (days −(N−1) to today)? */
export function inWindow(day, params = DEFAULTS, today = 0) {
  return Number.isFinite(day) && day <= today && day >= today - (params.window_days - 1);
}

/**
 * The comparable groups with the lines that count.
 * world: { material, po_line, value_log }
 * ctx:   { params, today }
 * Returns groups { id, kind, label, material_group, base_unit, display_quantity, materials, units, lines,
 * implemented_day, left_out: { outside_window, before_implementation, cancelled } }.
 */
export function buildGroups(world, ctx = {}, { clusters = [], valueLog = world.value_log || [] } = {}) {
  const params = ctx.params || DEFAULTS;
  const today = ctx.today ?? 0;
  const index = groupIndex(world, { clusters });
  const implemented = new Map();
  for (const e of valueLog) {
    if (e.implemented_day === null || e.implemented_day === undefined) continue;
    implemented.set(e.group, Math.max(implemented.get(e.group) ?? -Infinity, e.implemented_day));
  }
  const groups = new Map();
  for (const def of index.defs.values()) {
    groups.set(def.id, {
      ...def,
      implemented_day: implemented.get(def.id) ?? null,
      lines: [],
      left_out: { outside_window: 0, before_implementation: 0, cancelled: 0 }
    });
  }
  for (const line of world.po_line || []) {
    const id = groupIdOf(index, line);
    if (!id) continue;
    const g = groups.get(id);
    if (line.cancelled) { g.left_out.cancelled += 1; continue; }
    if (!inWindow(line.order_day, params, today)) { g.left_out.outside_window += 1; continue; }
    if (g.implemented_day !== null && !(line.order_day > g.implemented_day)) { g.left_out.before_implementation += 1; continue; }
    g.lines.push(line);
  }
  return [...groups.values()].filter((g) => g.lines.length > 0);
}
