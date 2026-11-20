// Candidate clusters for free-text and service lines (pv_match). A candidate is only a proposal: lines
// become comparable when a person confirms the cluster and its base unit in ui_confirm_cluster
// (brief §6.2). Similar descriptions never make lines comparable on their own.
//
// Evidence for a candidate, all of it shown to the person in the cluster dialog:
//   - one material group;
//   - order units that convert to one base unit (hours and days through the person-day parameter,
//     never through SAP's 24-hour day);
//   - short texts that share at least two distinctive terms once pricing words ("Tagessatz", "hourly
//     rate", "tarif journalier") are set aside, or one term and a close text (difflib ratio);
//   - at least two plant–supplier pairs, since a cluster is for comparing prices across them.
// Pure module: no DOM, no storage, no network.

import { sequenceRatio } from "./similarity.js";
import { inWindow } from "./groups.js";
import { TIME_UNITS } from "./normalise.js";
import { DEFAULTS } from "./params.js";

// Words that describe how a service is priced or scheduled, not what it is (German, English, French).
const PRICING_WORDS = new Set([
  "tagessatz", "stundensatz", "stunden", "stunde", "abrechnung", "nach", "pauschal", "pauschale", "monatlich", "quartal",
  "hourly", "daily", "rate", "rates", "per", "day", "days", "hour", "hours", "fixed", "fee", "lump", "sum", "quarterly", "monthly",
  "tarif", "journalier", "horaire", "forfait", "forfaitaire", "prestation", "jour", "heure", "trimestriel", "mensuel",
  "und", "and", "et", "de", "du", "des", "la", "le", "der", "die", "das", "the", "of", "for", "pour", "für"
]);

/** The distinctive terms of a short text, in lower case, with their written form. */
export function termsOf(text) {
  const out = new Map();
  for (const raw of String(text || "").split(/[\s,;()]+/)) {
    for (const part of raw.includes("/") ? [raw] : raw.split("-")) {
      const t = part.toLowerCase().replace(/^[^\p{L}\p{N}/]+|[^\p{L}\p{N}/]+$/gu, "");
      if (t.length < 2 || PRICING_WORDS.has(t) || /^\d+$/.test(t)) continue;
      if (!out.has(t)) out.set(t, part.replace(/^[^\p{L}\p{N}/]+|[^\p{L}\p{N}/]+$/gu, ""));
    }
  }
  return out;
}

/** The base units a set of order units can convert to: time units through the person-day, else one unit. */
export function baseUnitsFor(orderUnits) {
  const units = [...new Set(orderUnits)];
  if (units.every((u) => TIME_UNITS.includes(u))) return units.includes("DAY") || units.includes("PD") ? ["PD", "H"] : ["H", "PD"];
  return units.length === 1 ? units : [];
}

const compatible = (a, b) => a === b || (TIME_UNITS.includes(a) && TIME_UNITS.includes(b));

function linked(x, y) {
  if (x.line.material_group !== y.line.material_group) return false;
  if (!compatible(x.line.order_unit, y.line.order_unit)) return false;
  if (x.line.short_text === y.line.short_text) return true;
  let shared = 0;
  for (const t of x.terms.keys()) if (y.terms.has(t)) shared += 1;
  if (shared >= 2) return true;
  return shared >= 1 && sequenceRatio(x.clean, y.clean) >= 0.6;
}

/**
 * Candidate clusters among the free-text lines of the window that no confirmed cluster holds yet.
 * input: { text?, material_group?, line_ids? }; ctx: { params, today, confirmed: Set of line ids }.
 * Returns { candidates: [{ key, material_group, line_ids, lines, base_units, proposed_base_unit,
 * evidence }], considered }.
 */
export function matchCandidates(world, input = {}, ctx = {}) {
  const params = ctx.params || DEFAULTS;
  const confirmed = ctx.confirmed || new Set();
  const free = (world.po_line || []).filter((l) => !l.material && !l.cancelled && inWindow(l.order_day, params, ctx.today ?? 0) && !confirmed.has(l.id));
  const items = free.map((line) => {
    const terms = termsOf(line.short_text);
    return { line, terms, clean: [...terms.keys()].join(" ") };
  });
  // Union-find over linked lines.
  const parent = items.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (linked(items[i], items[j])) parent[find(i)] = find(j);
    }
  }
  const comps = new Map();
  items.forEach((it, i) => {
    const r = find(i);
    if (!comps.has(r)) comps.set(r, []);
    comps.get(r).push(it);
  });
  const want = {
    group: input.material_group ? String(input.material_group) : null,
    ids: new Set((input.line_ids || []).map(String)),
    terms: input.text ? termsOf(input.text) : null
  };
  const candidates = [];
  for (const members of comps.values()) {
    const pairs = new Set(members.map((m) => `${m.line.plant} / ${m.line.supplier}`));
    if (members.length < 2 || pairs.size < 2) continue;
    const mg = members[0].line.material_group;
    if (want.group && mg !== want.group) continue;
    if (want.ids.size && !members.some((m) => want.ids.has(m.line.id))) continue;
    if (want.terms && want.terms.size) {
      const hit = members.some((m) => [...want.terms.keys()].some((t) => m.terms.has(t)) || sequenceRatio(m.clean, [...want.terms.keys()].join(" ")) >= 0.6);
      if (!hit) continue;
    }
    const units = [...new Set(members.map((m) => m.line.order_unit))];
    const baseUnits = baseUnitsFor(units);
    if (!baseUnits.length) continue;
    // Terms every text shares, and terms only some texts have (the differences the person weighs).
    const texts = [...new Set(members.map((m) => m.line.short_text))];
    const termSets = texts.map((t) => termsOf(t));
    const shared = [...termSets[0].entries()].filter(([t]) => termSets.every((s) => s.has(t))).map(([, w]) => w);
    const differing = [...new Set(termSets.flatMap((s) => [...s.keys()]))]
      .filter((t) => !termSets.every((s) => s.has(t)))
      .map((t) => ({ term: termSets.find((s) => s.has(t)).get(t), lines: members.filter((m) => m.terms.has(t)).length }));
    const lines = members
      .map((m) => m.line)
      .sort((a, b) => a.plant.localeCompare(b.plant) || a.order_day - b.order_day || a.id.localeCompare(b.id));
    candidates.push({
      key: lines.map((l) => l.id).join("|"),
      material_group: mg,
      line_ids: lines.map((l) => l.id),
      lines: lines.map((l) => ({
        id: l.id, plant: l.plant, supplier: l.supplier, short_text: l.short_text, quantity: l.quantity, order_unit: l.order_unit,
        net_price: l.net_price, price_unit: l.price_unit, currency: l.currency, order_day: l.order_day
      })),
      base_units: baseUnits,
      proposed_base_unit: baseUnits[0],
      evidence: {
        material_group: mg,
        order_units: units,
        conversion: units.some((u) => TIME_UNITS.includes(u)) && units.length > 1
          ? `hours and days convert at ${params.person_day_hours} hours a person-day (an assumption), never at SAP's 24-hour day`
          : `one order unit (${units[0]})`,
        shared_terms: shared,
        differing_terms: differing,
        texts,
        plants: [...new Set(lines.map((l) => l.plant))],
        suppliers: [...new Set(lines.map((l) => l.supplier))],
        pairs: pairs.size
      }
    });
  }
  candidates.sort((a, b) => b.line_ids.length - a.line_ids.length || a.key.localeCompare(b.key));
  return { candidates, considered: free.length };
}

/** A readable label for a confirmed cluster: its shared terms and its material group's name. */
export function clusterLabel(world, candidate) {
  const mg = (world.material_group || []).find((g) => g.id === candidate.material_group);
  const terms = candidate.evidence?.shared_terms?.length ? candidate.evidence.shared_terms.join(" ") : candidate.lines?.[0]?.short_text || "Free-text lines";
  return `${terms} (${mg ? mg.name.toLowerCase() : candidate.material_group}, confirmed cluster)`;
}
