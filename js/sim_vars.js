// Placeholders for simulation scripts. Authored scripts never type a figure the engine computes: they
// write {{group.opportunity}}, {{option.H.savings}}, {{pair.3010/80002.price}} … and the player fills
// them from this run's engine results at playback, formatted exactly as the figure audit reads them.
// Shared by the player (js/simulation.js) and the script checker (js/sim_check.js), so a placeholder
// that would not resolve is caught before a demo. Every figure has a stable name (brief §7).

import { eur, pct, unitPrice, qty, shortDate } from "./format.js";
import { indexOf } from "./erp.js";
import { bestByNet } from "./guards.js";

const city = (world, plant) => (indexOf(world).plant.get(String(plant))?.city || String(plant)).replace(" am Main", "");
const supplierName = (world, id) => indexOf(world).supplier.get(String(id))?.name || String(id);
const list = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/**
 * The variables of a run's latest engine results (toolbox.latest()). Later results overwrite earlier
 * ones, as in Rebate Hunter.
 */
export function runVars(world, latest) {
  const v = {};
  const c = latest.compare;
  if (c) {
    const dq = c.display_quantity;
    const bu = c.base_unit;
    const price = (p) => unitPrice(p, dq, bu);
    v["compare.id"] = c.compare_id;
    v["group.id"] = c.id;
    v["group.label"] = c.label;
    v["group.base_unit"] = bu;
    v["group.quantity"] = qty(c.quantity, bu);
    v["group.spend"] = eur(c.spend);
    v["group.gap"] = eur(c.gap);
    v["group.justified"] = eur(c.justified);
    v["group.opportunity"] = eur(c.opportunity);
    v["group.unexplained"] = eur(c.unexplained);
    v["group.index"] = pct(c.index);
    v["group.spread"] = pct(c.spread);
    v["group.flagged"] = c.flagged ? "yes" : "";
    v["group.not_flagged"] = c.flagged ? "" : "yes";
    v["group.lines"] = String(c.lines.length);
    v["group.pairs"] = String(c.pairs.length);
    v["group.materiality"] = eur(c.materiality.opportunity_eur);
    v["group.materiality_spread"] = pct(c.materiality.spread);
    for (const [key, p] of [["benchmark", c.benchmark], ["highest", c.highest]]) {
      if (!p) continue;
      const pair = c.pairs.find((x) => x.id === p.pair);
      v[`group.${key}`] = price(p.price);
      v[`group.${key}_pair`] = p.pair;
      v[`group.${key}_plant`] = city(world, p.plant);
      v[`group.${key}_plant_code`] = p.plant;
      v[`group.${key}_supplier`] = p.supplier;
      v[`group.${key}_supplier_name`] = supplierName(world, p.supplier);
      if (pair) {
        v[`${key}.line`] = pair.lines[0];
        v[`${key}.line2`] = pair.lines[1] || pair.lines[0];
        v[`group.${key}_quantity`] = qty(pair.quantity, bu);
        v[`group.${key}_share`] = pct(pair.share);
        v[`group.${key}_unexplained`] = eur(pair.unexplained);
        const contract = c.lines.find((l) => pair.lines.includes(l.id) && l.contract)?.contract;
        v[`${key}.contract`] = contract || "none";
      }
    }
    for (const p of c.pairs) {
      const k = `pair.${p.plant}/${p.supplier}`;
      v[`${k}.price`] = price(p.price);
      v[`${k}.quantity`] = qty(p.quantity, bu);
      v[`${k}.share`] = pct(p.share);
      v[`${k}.unexplained`] = eur(p.unexplained);
      v[`${k}.justified`] = eur(p.justified);
      v[`${k}.line`] = p.lines[0];
      v[`${k}.line2`] = p.lines[1] || p.lines[0];
      v[`${k}.city`] = city(world, p.plant);
      const urgent = c.lines.find((l) => p.lines.includes(l.id) && l.urgent);
      const routine = c.lines.find((l) => p.lines.includes(l.id) && !l.urgent);
      if (urgent) v[`${k}.urgent_line`] = urgent.id;
      if (routine) v[`${k}.routine_line`] = routine.id;
      v[`${k}.supplier_name`] = supplierName(world, p.supplier);
    }
    for (const l of c.lines) v[`line.${l.id}.price`] = price(l.price);
    const applicable = ["H", "R", "B"].filter((id) => c.options[id]?.applicable);
    if (applicable.length) v["option.best"] = bestByNet(c, applicable);
    for (const [id, o] of Object.entries(c.options)) {
      const k = `option.${id}`;
      v[`${k}.title`] = o.title;
      v[`${k}.savings`] = eur(o.savings);
      v[`${k}.bundle`] = eur(o.bundle);
      v[`${k}.one_off`] = eur(o.one_off);
      v[`${k}.net`] = eur(o.net);
      v[`${k}.residual`] = eur(o.residual);
      v[`${k}.index_after`] = pct(o.index_after);
      v[`${k}.days`] = o.days_to_first_saving === null || o.days_to_first_saving === undefined ? "—" : String(o.days_to_first_saving);
      v[`${k}.first_saving_date`] = o.days_to_first_saving === null || o.days_to_first_saving === undefined ? "—" : shortDate(o.days_to_first_saving);
      v[`${k}.plants`] = list((o.plants || []).map((p) => city(world, p)));
      v[`${k}.suppliers`] = String((o.suppliers || []).length);
      v[`${k}.applicable`] = o.applicable ? "yes" : "";
      if (o.share_after !== undefined) v[`${k}.share_after`] = pct(o.share_after);
      if (o.supplier) { v[`${k}.supplier`] = o.supplier; v[`${k}.supplier_name`] = supplierName(world, o.supplier); }
      if (o.plants_moved) {
        v[`${k}.plants_moved`] = list(o.plants_moved.map((p) => city(world, p)));
        v[`${k}.plants_not_covered`] = list((o.plants_not_covered || []).map((p) => city(world, p))) || "none";
      }
    }
  }
  const s = latest.sensitivity;
  if (s) {
    v["sensitivity.label"] = s.label;
    v["sensitivity.opportunity"] = eur(s.opportunity);
    v["sensitivity.spread"] = pct(s.spread);
    v["sensitivity.index"] = pct(s.index);
    v["sensitivity.flagged"] = s.flagged ? "yes" : "";
  }
  for (const r of latest.refreshed || []) {
    v[`rate.${r.currency}.date`] = shortDate(r.date);
    v[`rate.${r.currency}.per_eur`] = String(r.per_eur);
  }
  latest.candidates.forEach((cand, i) => {
    const k = `candidate.${i + 1}`;
    v[k] = cand.candidate_id;
    v[`${k}.lines`] = String(cand.lines.length);
    v[`${k}.plants`] = list(cand.evidence.plants.map((p) => city(world, p)));
    v[`${k}.base_unit`] = cand.proposed_base_unit;
  });
  const cl = latest.clusters[latest.clusters.length - 1];
  if (cl) {
    v["cluster.id"] = cl.id;
    v["cluster.base_unit"] = cl.base_unit;
    v["cluster.lines"] = String(cl.line_ids.length);
  }
  const sc = latest.scanned;
  if (sc) {
    const flagged = sc.analyses.filter((a) => a.flagged).sort((a, b) => b.opportunity - a.opportunity);
    v["scan.groups"] = String(sc.analyses.length);
    v["scan.flagged"] = String(flagged.length);
    v["scan.identified"] = eur(flagged.reduce((t, a) => t + a.opportunity, 0));
    if (flagged[0]) { v["scan.top"] = flagged[0].id; v["scan.top_label"] = flagged[0].label; }
  }
  if (latest.approved) {
    v["decision.option"] = latest.approved.id;
    v["decision.label"] = latest.approved.label;
    if (latest.approved.reason) v["decision.reason"] = latest.approved.reason;
  }
  if (latest.drafts?.length) {
    v["actions.total"] = String(latest.drafts.length);
    v["actions.approved"] = String(latest.drafts.filter((d) => d.status === "approved").length);
    v["actions.rejected"] = String(latest.drafts.filter((d) => d.status === "rejected").length);
  }
  return v;
}

const PLACEHOLDER = /\{\{\s*([^}]+?)\s*\}\}/g;
const DATE_KEY = /^date:\+?(-?\d+)$/;

/** Replaces {{key}} with vars[key]; {{date:+N}} becomes the short date N days from today. */
export function fillTemplate(vars, text) {
  return String(text ?? "").replace(PLACEHOLDER, (m, key) => {
    const dm = DATE_KEY.exec(key);
    if (dm) return shortDate(Number(dm[1]));
    return key in vars ? vars[key] : m;
  });
}

/** Placeholder keys in a text that `vars` cannot resolve. */
export function unresolvedKeys(vars, text) {
  const out = [];
  for (const m of String(text ?? "").matchAll(PLACEHOLDER)) {
    const key = m[1];
    if (!DATE_KEY.test(key) && !(key in vars)) out.push(key);
  }
  return out;
}

/** Fills every string of an object (a tool input) and lists what did not resolve. */
export function fillDeep(vars, value, missing = []) {
  if (typeof value === "string") { missing.push(...unresolvedKeys(vars, value)); return fillTemplate(vars, value); }
  if (Array.isArray(value)) return value.map((x) => fillDeep(vars, x, missing));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, x]) => [k, fillDeep(vars, x, missing)]));
  return value;
}
