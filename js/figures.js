// The figure audit (brief §7, rule 7), built on Rebate Hunter's js/figures.js: every figure the agent
// writes into an alert, an option text, a cluster note, a draft or the report must be one that a tool
// returned in this run, so "every figure comes from the engine" is enforced in code, not only asked for.
//
// Changes from Rebate Hunter's audit, as the brief asks:
//   - amounts of any size are checked (minimum 0); a written amount matches a figure when it lies within
//     half a unit of its last written digit and within 2 % of the figure, with no €0.50 floor;
//   - English text only: a comma before exactly three digits always groups thousands ("€9,500" is nine
//     thousand five hundred) and a dot is the decimal point; any other writing ("€1.738,80") is reported
//     as written;
//   - a unit price is an amount at a quantity of a unit: "per ‹n› ‹unit›" belongs to its token, and an
//     offending price is reported as written without its unit ("€9.90"); a bare amount may also match a
//     unit price at its item's display quantity ("Frankfurt €6.90");
//   - percentages and quantities match within half a unit of their last digit; counts written in digits
//     must be counts a tool returned, counts written as words pass;
//   - the known figures are the typed values of the run's engine, ERP and rate results (amounts, prices,
//     shares, quantities, counts, rates), not every number of every record;
//   - exempt from the number check but required to exist: record ids, plant and company codes after
//     "plant" or "company code", supplier numbers after "supplier", "vendor" or "account", and the pair
//     form "1010 / S-A"; exempt outright: dates in the app's display form or ISO form, times of day,
//     version numbers and names with numbers ("Incoterms 2020", a known material description);
//   - since the independent review (R2): a label ("level 45") or a year ("by 2026") is exempt only when no
//     percentage, currency, scale or unit follows it; amounts and percentages written in words ("fifteen
//     thousand euros", "forty-two per cent") are read and checked like digits; and an amount keeps its
//     sign: a figure the engine gives as negative passes only with its minus sign or with words that say
//     it is a loss ("loses", "costs more than it saves"), and a minus sign needs a negative figure.
// Pure module: no DOM, no storage, no network.

const SP = "[ \\u00a0\\u202f]";
const NUM = "\\d(?:[\\d.,]*\\d)?";
const SIGN = "[-\\u2212]?";
const SCALE = "(?:k|K|m|M|bn|thousand|million|billion)(?![A-Za-z])";
const SCALE_OF = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6, bn: 1e9, billion: 1e9 };
const CURRENCY_OF = { "€": "EUR", eur: "EUR", euro: "EUR", euros: "EUR", "£": "GBP", gbp: "GBP", pound: "GBP", pounds: "GBP" };
const MAX_RELATIVE = 0.02;

/** Unit codes read strictly: a quantity or price in one of these must match a figure in that unit. */
export const UNIT_CODES = Object.freeze(["EA", "BOX", "CS", "PAK", "ROL", "M", "L", "KG", "DR", "H", "DAY", "PD", "PAL", "PC", "PCS", "ST", "G", "T", "ML", "MM", "CM", "KM", "M2", "M3"]);
/** Unit words and the codes they may stand for. */
const UNIT_WORDS = {
  piece: ["EA"], pieces: ["EA"], pcs: ["EA"], pc: ["EA"], each: ["EA"],
  box: ["BOX"], boxes: ["BOX"], case: ["CS"], cases: ["CS"],
  hour: ["H"], hours: ["H"], hr: ["H"], hrs: ["H"],
  day: ["DAY", "PD"], days: ["DAY", "PD"], "person-day": ["PD"], "person-days": ["PD"], "man-day": ["PD"], "man-days": ["PD"],
  drum: ["DR"], drums: ["DR"], roll: ["ROL"], rolls: ["ROL"], pack: ["PAK"], packs: ["PAK"],
  litre: ["L"], litres: ["L"], liter: ["L"], liters: ["L"], kilogram: ["KG"], kilograms: ["KG"], kg: ["KG"],
  metre: ["M"], metres: ["M"], meter: ["M"], meters: ["M"]
};
const MONTHS = "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?";
const WEEKDAYS = "Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?";

/**
 * Reads a number written in English: commas group thousands (a comma is followed by exactly three
 * digits), a dot is the decimal point. Returns { value, decimals } or null when it is not English.
 */
export function readEnglishNumber(raw) {
  const s = String(raw);
  if (!/^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/.test(s)) return null;
  const [int, frac = ""] = s.replace(/,/g, "").split(".");
  return { value: Number(`${int}${frac ? `.${frac}` : ""}`), decimals: frac.length };
}

// ---- known figures ---------------------------------------------------------------------------------

const AMOUNT_KEYS = new Set([
  "spend", "gap", "justified", "unexplained", "opportunity", "savings", "bundle", "one_off", "net", "residual",
  "realised", "missed", "approved", "approved_bundle", "implemented", "identified", "leakage_missed",
  "approved_savings_eur", "bundle_part_eur", "identified_eur", "approved_eur", "implemented_eur", "realised_eur",
  "opportunity_eur", "materiality_eur", "day_rate_eur", "cost_eur"
]);
const PRICE_KEYS = new Set(["price", "baseline", "new_price", "normalised_price_eur", "benchmark"]);
const SHARE_KEYS = new Set(["share", "share_after", "index", "index_after", "spread", "projected", "logistics_uplift", "materiality_spread", "benchmark_min_share", "urgent_allowance", "bundle_discount"]);
const QUANTITY_KEYS = new Set(["quantity", "leakage_quantity", "baseline_quantity", "quantity_moved", "quantity_base"]);
const COUNT_KEYS = new Set([
  "days_to_first_saving", "leakage_lines", "approved_options", "implemented_options", "lines", "pairs", "excluded",
  "window_days", "baseline_days", "person_day_hours", "harmonise_days_per_plant", "renegotiate_days_per_supplier",
  "tender_days", "lead_time_harmonise_days", "lead_time_renegotiate_days", "lead_time_tender_days", "total", "count",
  "observations", "display_quantity", "base_units_per_order_unit", "price_unit"
]);
const DAY_KEY = /(^|_)day$/;
const CODE_KEYS = new Set(["plant", "plants", "plants_moved", "plants_not_covered", "company_code", "company_codes"]);
const ID_KEYS = new Set([
  "id", "line", "line_ids", "lines_moved", "baseline_lines", "cancelled", "group", "group_id", "supplier", "suppliers",
  "old_supplier", "new_supplier", "material", "materials", "contract", "order", "entry", "compare_id", "candidate_id",
  "cluster_id", "buyer"
]);
const NAME_KEYS = new Set(["description", "short_text", "name", "label", "title", "city"]);
const PAIR = /^(\S+) \/ (\S+)$/;

/** The figures a run's tools returned, by type, with the ids, codes and names that exist. */
export class KnownFigures {
  constructor() {
    this.amounts = [];
    this.prices = [];
    this.shares = [];
    this.quantities = [];
    this.counts = new Set();
    this.rates = [];
    this.ids = new Set();
    this.codes = new Set();
    this.names = new Set();
    this.units = new Set(UNIT_CODES);
  }

  /** An amount of money: its size, and whether the engine gives it as negative (review R2d). */
  addAmount(value, currency = "EUR") {
    const n = Number(value);
    if (Number.isFinite(n)) this.amounts.push({ value: Math.abs(n), negative: n < 0, currency });
    return this;
  }
  /** A unit price: value per one unit, written at a display quantity (€6.90 per 100 EA). */
  addPrice(value, displayQuantity = 1, unit = "EA", currency = "EUR") {
    const v = Math.abs(Number(value));
    if (!Number.isFinite(v) || !unit) return this;
    this.prices.push({ value: v, display_quantity: Number(displayQuantity) || 1, unit: String(unit), currency });
    this.units.add(String(unit));
    return this;
  }
  /** A share, an index or a gap as a fraction (0.42 for 42.0 %). */
  addShare(fraction) {
    const v = Math.abs(Number(fraction));
    if (Number.isFinite(v)) this.shares.push(v);
    return this;
  }
  /** A quantity in a unit (20,000 EA). */
  addQuantity(value, unit) {
    const v = Math.abs(Number(value));
    if (!Number.isFinite(v) || !unit) return this;
    this.quantities.push({ value: v, unit: String(unit) });
    this.units.add(String(unit));
    return this;
  }
  /** A count (3 suppliers, 30 days). */
  addCount(n) {
    const v = Math.abs(Number(n));
    if (Number.isFinite(v) && Number.isInteger(v)) this.counts.add(v);
    return this;
  }
  /** An exchange rate: 1 unit of currency = rateToEur EUR (and its inverse, per euro). */
  addRate(rateToEur, currency) {
    const r = Number(rateToEur);
    if (!Number.isFinite(r) || r <= 0 || !currency) return this;
    this.rates.push({ value: r, from: currency, to: "EUR" }, { value: 1 / r, from: "EUR", to: currency });
    return this;
  }
  addId(id) { if (id !== null && id !== undefined && id !== "") this.ids.add(String(id)); return this; }
  addCode(code) { if (code !== null && code !== undefined && code !== "") this.codes.add(String(code)); return this; }
  addName(name) { if (name && /\d/.test(String(name))) this.names.add(String(name)); return this; }

  /** The parameters in force: shares, amounts and counts. */
  addParams(params = {}) {
    for (const [k, v] of Object.entries(params)) {
      if (SHARE_KEYS.has(k)) this.addShare(v);
      else if (AMOUNT_KEYS.has(k)) this.addAmount(v);
      else this.addCount(v);
    }
    return this;
  }

  /**
   * Every typed figure of an engine, ERP or rate result: walked by field name, with the base unit,
   * display quantity and currency of the record it sits in.
   */
  addResult(result) {
    const walk = (v, key, ctx, depth) => {
      if (depth > 16 || v === null || v === undefined) return;
      if (Array.isArray(v)) {
        if (COUNT_KEYS.has(key) || CODE_KEYS.has(key) || ID_KEYS.has(key) || ["pairs", "lines", "excluded", "after", "leakage", "suppliers", "plants", "warnings"].includes(key)) this.addCount(v.length);
        for (const x of v) walk(x, key, ctx, depth + 1);
        return;
      }
      if (typeof v === "object") { this.#addRecord(v, ctx, walk, depth); return; }
      if (typeof v === "number") { this.#addNumber(key, v, ctx); return; }
      if (typeof v === "string") this.#addString(key, v);
    };
    walk(result, null, { base_unit: null, display_quantity: 1, currency: "EUR" }, 0);
    return this;
  }

  #addRecord(o, parent, walk, depth) {
    const ctx = {
      base_unit: typeof o.base_unit === "string" ? o.base_unit : parent.base_unit,
      display_quantity: Number.isFinite(o.display_quantity) ? o.display_quantity : parent.display_quantity,
      currency: typeof o.currency === "string" && /^[A-Z]{3}$/.test(o.currency) ? o.currency : parent.currency
    };
    // A line's normalisation: every step with its own unit and currency.
    if (o.steps && typeof o.steps === "object" && "normalised_price_eur" in o.steps) {
      const s = o.steps;
      const cur = s.currency || "EUR";
      if (Number.isFinite(s.price_per_order_unit) && o.order_unit) this.addPrice(s.price_per_order_unit, 1, o.order_unit, cur);
      if (Number.isFinite(s.price_per_base_unit)) this.addPrice(s.price_per_base_unit, ctx.display_quantity, ctx.base_unit, cur);
      if (Number.isFinite(s.price_per_base_unit_eur)) this.addPrice(s.price_per_base_unit_eur, ctx.display_quantity, ctx.base_unit);
      if (Number.isFinite(s.normalised_price_eur)) this.addPrice(s.normalised_price_eur, ctx.display_quantity, ctx.base_unit);
      if (Number.isFinite(s.rate_to_eur) && s.currency) this.addRate(s.rate_to_eur, s.currency);
      if (Number.isFinite(s.logistics_uplift)) this.addShare(s.logistics_uplift);
      if (Number.isFinite(s.base_units_per_order_unit)) { this.addQuantity(s.base_units_per_order_unit, ctx.base_unit); this.addCount(s.base_units_per_order_unit); }
      if (Number.isFinite(o.quantity_base)) this.addQuantity(o.quantity_base, ctx.base_unit);
      for (const k of ["line", "group"]) this.#addString(k, o[k]);
      return;
    }
    // An order line or a contract: the price per order unit at its price unit, the quantity in its unit.
    if (o.order_unit && (Number.isFinite(o.net_price) || Number.isFinite(o.price)) && !("normalisation" in o)) {
      const per = Number(o.price_unit) || 1;
      const net = Number.isFinite(o.net_price) ? o.net_price : o.price;
      this.addPrice(net / per, per, o.order_unit, ctx.currency);
      if (Number.isFinite(o.quantity)) this.addQuantity(o.quantity, o.order_unit);
    }
    // A material: its conversions as quantities of the base unit.
    if (o.conversions && typeof o.conversions === "object" && o.base_unit) {
      for (const [u, f] of Object.entries(o.conversions)) { this.addQuantity(f, o.base_unit); this.addQuantity(1, u); this.addCount(f); }
    }
    // An exchange rate.
    if (Number.isFinite(o.rate_to_eur) && typeof o.currency === "string") this.addRate(o.rate_to_eur, o.currency);
    if (Number.isFinite(o.per_eur) && typeof o.currency === "string") this.addRate(1 / o.per_eur, o.currency);
    for (const [k, x] of Object.entries(o)) {
      if (k === "steps" || k === "conversions") continue;
      walk(x, k, ctx, depth + 1);
    }
  }

  #addNumber(key, v, ctx) {
    if (key === null) return;
    if (AMOUNT_KEYS.has(key)) this.addAmount(v);
    else if (PRICE_KEYS.has(key)) { if (ctx.base_unit) this.addPrice(v, ctx.display_quantity, ctx.base_unit); }
    else if (SHARE_KEYS.has(key)) this.addShare(v);
    else if (QUANTITY_KEYS.has(key)) { if (ctx.base_unit) this.addQuantity(v, ctx.base_unit); }
    else if (key === "rate_to_eur" || key === "per_eur" || key === "mean_per_eur") { /* added with the record */ }
    else if (COUNT_KEYS.has(key) || DAY_KEY.test(key) || /_days$|_count$|_options$/.test(key)) this.addCount(v);
  }

  #addString(key, s) {
    if (typeof s !== "string" || !s) return;
    if (key === null) return;
    const pair = PAIR.exec(s);
    if (pair) { this.addCode(pair[1]); this.addId(pair[2]); return; }
    if (CODE_KEYS.has(key)) this.addCode(s);
    else if (ID_KEYS.has(key)) this.addId(s);
    else if (NAME_KEYS.has(key)) this.addName(s);
  }
}

// ---- reading a text ----------------------------------------------------------------------------------

const re = (source, flags = "g") => new RegExp(source, flags);
// What makes the number before it a figure, not a label or a year: a percentage, a currency, a scale or a
// unit (review R2a and R2b).
const UNIT_ALT = [...UNIT_CODES, ...Object.keys(UNIT_WORDS)].sort((x, y) => y.length - x.length).map((u) => u.replace(/-/g, "\\-")).join("|");
const FIGURE_AFTER = `${SP}?(?:%|per${SP}?cent\\b|percent\\b|(?:€|£)(?!${SP}?\\d)|EUR\\b|GBP\\b|euros?\\b|pounds?\\b|k\\b|bn\\b|m\\b|thousand\\b|million\\b|billion\\b|(?:${UNIT_ALT})\\b)`;
const EXEMPT = [
  re(`\\b(?:(?:${WEEKDAYS}),?${SP})?\\d{1,2}${SP}(?:${MONTHS})\\.?(?:,?${SP}\\d{4})?\\b`),     // Thu 19 Nov, 19 Nov 2026
  re(`\\b(?:${MONTHS})\\.?${SP}(?:\\d{1,2},?${SP})?\\d{4}\\b`),                               // November 2026, Nov 19, 2026
  re("\\b\\d{4}-\\d{2}-\\d{2}(?:T[\\d:.]+Z?)?\\b"),                                          // 2026-11-19
  re("\\b\\d{1,2}:\\d{2}(?::\\d{2})?\\b"),                                                    // 15:56, 15:56:03
  re("\\b\\d+(?:st|nd|rd|th)\\b"),                                                            // 19th
  re(`\\bIncoterms®?${SP}?20\\d\\d\\b`, "gi"),
  re("\\bS\\/4\\s?HANA\\b|\\bR\\/3\\b", "gi"),
  re(`\\b(?:v|version${SP}|method${SP}|engine${SP})\\d+\\.\\d+\\.\\d+\\b`, "gi"),
  re(`\\b(?:[Ii]n|[Ss]ince|[Uu]ntil|[Ff]rom|[Bb]y|[Dd]uring|[Oo]f|[Ff]or|FY)${SP}?(?:19|20)\\d\\d\\b(?![.,]\\d)(?!${SP}?(?:[A-Z]{1,4}\\b|pieces|boxes|cases|units|lines|orders))(?!${FIGURE_AFTER})`, "g"),
  re(`\\b(?:scenario|step|rule|section|phase|milestone|tier|level)${SP}\\d+\\b(?![.,]\\d)(?!${FIGURE_AFTER})`, "gi"),
  re("\\bQ[1-4]\\b")
];
// Ids that must exist. Each pattern's numbered groups are ids (1, 2) or codes ("c").
const ID_PATTERNS = [
  { re: re(`\\b(\\d{4})${SP}?\\/${SP}?([A-Z0-9][A-Za-z0-9-]*)`), kinds: ["code", "id"] },          // 1010 / S-A
  { re: re("\\bMPN:[^\\s,;()]*[^\\s,;().]"), kinds: ["id0"] },                                     // MPN:<manufacturer>:<part>
  { re: re("\\b\\d{10}-\\d{5}\\b"), kinds: ["id0"] },                                               // 4500012345-00010
  { re: re("\\b(?=[A-Z0-9-]*\\d)[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+\\b|\\b[A-Z]{1,3}\\d+[A-Z]?\\b"), kinds: ["id0"] } // M-100, CL-01, P1
];
const LIST = (item) => `${item}(?:(?:,${SP}*|${SP}(?:and|or|&)${SP}|${SP}?\\/${SP}?)${item})*`;
const KEYWORD_PATTERNS = [
  { re: re(`\\b(?:plants?|company${SP}codes?)${SP}(${LIST("\\d{4}")})`, "gi"), kind: "code" },
  { re: re(`\\b(?:suppliers?|vendors?|accounts?|materials?|orders?|POs?|lines?|items?|contracts?|agreements?)(?:${SP}(?:no\\.?|number|id))?${SP}(${LIST("\\d{3,10}(?:-\\d{5})?")})`, "gi"), kind: "id" }
];

// Numbers written in words (review R2c): "fifteen thousand", "forty-two", "half a million".
const SMALL_WORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS_WORDS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const BIG_WORDS = { thousand: 1e3, million: 1e6, billion: 1e9 };
const NUMBER_WORD = `(?:${[...Object.keys(SMALL_WORDS), ...Object.keys(TENS_WORDS)].join("|")})`;
const WORDS_SPAN = re(`\\b(?:(?:an?|half(?:${SP}an?)?)(?=${SP}(?:hundred|thousand|million|billion)\\b)|${NUMBER_WORD}\\b)(?:(?:${SP}|-|${SP}and${SP})(?:${NUMBER_WORD}|hundred|thousand|million|billion)\\b)*`, "gi");

/** A number written in words: { value, scale } (scale: the largest of thousand, million, billion, or 1). */
export function readNumberWords(raw) {
  let total = 0;
  let current = 0;
  let scale = 1;
  let half = false;
  for (const w of String(raw).toLowerCase().split(/[\s\u00a0\u202f-]+/).filter(Boolean)) {
    if (w === "and") continue;
    if (w === "a" || w === "an") { current += 1; continue; }
    if (w === "half") { half = true; continue; }
    if (w in SMALL_WORDS) current += SMALL_WORDS[w];
    else if (w in TENS_WORDS) current += TENS_WORDS[w];
    else if (w === "hundred") current = (current || 1) * 100;
    else if (w in BIG_WORDS) { total += (current || 1) * BIG_WORDS[w]; current = 0; scale = Math.max(scale, BIG_WORDS[w]); }
    else return null;
  }
  const value = (total + current) * (half ? 0.5 : 1);
  return Number.isFinite(value) ? { value, scale } : null;
}

const unitCandidates = (word, known) => {
  if (known.units.has(word)) return { strict: true, units: [word] };
  const w = word.toLowerCase();
  if (UNIT_WORDS[w]) return { strict: false, units: UNIT_WORDS[w] };
  return null;
};

/**
 * Audits a text against the known figures.
 * Returns { ok, offending: [tokens as written], tokens: [{ raw, kind, ok, index }] }.
 * options.floor: a minimum tolerance for amounts (0; Rebate Hunter's audit used €0.50).
 */
export function auditText(text, known, { floor = 0 } = {}) {
  const s = String(text ?? "");
  const taken = [];
  const tokens = [];
  const free = (a, b) => !taken.some(([x, y]) => a < y && b > x);
  const take = (a, b) => taken.push([a, b]);
  const token = (raw, kind, ok, index) => tokens.push({ raw, kind, ok, index });

  // 1. Names with numbers (known names first, longest first), dates, times, versions and labels.
  const names = [...known.names].sort((x, y) => y.length - x.length);
  const lower = s.toLowerCase();
  for (const name of names) {
    const n = name.toLowerCase();
    for (let i = lower.indexOf(n); i >= 0; i = lower.indexOf(n, i + n.length)) if (free(i, i + n.length)) take(i, i + n.length);
  }
  for (const r of EXEMPT) for (const m of s.matchAll(r)) if (free(m.index, m.index + m[0].length)) take(m.index, m.index + m[0].length);

  // 2. Ids and codes that must exist.
  const checkId = (value, kind, index) => {
    const ok = kind === "code" ? known.codes.has(value) : known.ids.has(value) || known.codes.has(value);
    token(value, kind, ok, index);
  };
  for (const { re: r, kinds } of ID_PATTERNS) {
    for (const m of s.matchAll(r)) {
      const a = m.index; const b = a + m[0].length;
      if (!free(a, b)) continue;
      if (kinds[0] === "id0") {
        if (!/\d/.test(m[0]) || known.units.has(m[0])) continue;
        take(a, b); checkId(m[0], "id", a); continue;
      }
      take(a, b);
      checkId(m[1], kinds[0], a);
      if (/\d/.test(m[2])) checkId(m[2], kinds[1], a + m[0].lastIndexOf(m[2]));
    }
  }
  for (const { re: r, kind } of KEYWORD_PATTERNS) {
    for (const m of s.matchAll(r)) {
      const start = m.index + m[0].length - m[1].length;
      for (const v of m[1].matchAll(/\d+(?:-\d{5})?/g)) {
        const a = start + v.index; const b = a + v[0].length;
        if (!free(a, b)) continue;
        take(a, b); checkId(v[0], kind, a);
      }
    }
  }

  // 3. Exchange rates: "1 GBP = 1.1850 EUR", "€1.19 per GBP".
  const RATE_EQ = re(`\\b1${SP}?(EUR|GBP|€|£)${SP}?=${SP}?(€|£)?${SP}?(${NUM})${SP}?(EUR|GBP)?`);
  for (const m of s.matchAll(RATE_EQ)) {
    const a = m.index; const b = a + m[0].length;
    if (!free(a, b)) continue;
    take(a, b);
    const from = CURRENCY_OF[m[1].toLowerCase()];
    const to = CURRENCY_OF[(m[2] || m[4] || "").toLowerCase()];
    const ok = matchRate(m[3], from, to, known);
    token(m[0].slice(m[0].indexOf("=") + 1).trim(), "rate", ok, a);
  }

  // 4. Money: prefix or suffix currency, a scale, and a "per ‹n› ‹unit›" tail.
  const PREFIX = re(`(${SIGN})(€|£|EUR${SP}?(?=\\d)|GBP${SP}?(?=\\d))(${SIGN})(${NUM})(?:${SP}?(${SCALE}))?`);
  const SUFFIX = re(`(${SIGN})(${NUM})(?:${SP}?(${SCALE}))?${SP}?(€|EUR\\b|GBP\\b|euros?\\b|pounds?\\b)`);
  const money = [];
  for (const m of s.matchAll(PREFIX)) money.push({ index: m.index, raw: m[0], num: m[4], scale: m[5], cur: m[2].trim(), sign: `${m[1]}${m[3]}` });
  for (const m of s.matchAll(SUFFIX)) money.push({ index: m.index, raw: m[0], num: m[2], scale: m[3], cur: m[4], sign: m[1] });
  money.sort((x, y) => x.index - y.index);
  const TAIL = re(`^${SP}?(?:per|\\/|an?|each)${SP}?(?:(${NUM})${SP})?([A-Za-z][A-Za-z0-9-]*|€|£)`, "");
  for (const t of money) {
    let end = t.index + t.raw.length;
    if (!free(t.index, end)) continue;
    const currency = CURRENCY_OF[t.cur.toLowerCase()] || "EUR";
    const tail = TAIL.exec(s.slice(end));
    const read = readEnglishNumber(t.num);
    const scale = t.scale ? SCALE_OF[t.scale.toLowerCase()] || 1 : 1;
    if (tail && CURRENCY_OF[tail[2].toLowerCase()] && !tail[1]) {
      // "€1.19 per GBP" or "£0.84 per EUR": a rate.
      end += tail[0].length; take(t.index, end);
      token(t.raw, "rate", read ? matchRate(t.num, CURRENCY_OF[tail[2].toLowerCase()], currency, known) : false, t.index);
      continue;
    }
    const unit = tail ? unitCandidates(tail[2], known) : null;
    if (tail && unit) {
      end += tail[0].length; take(t.index, end);
      const per = tail[1] ? readEnglishNumber(tail[1]) : { value: 1 };
      const ok = Boolean(read && per) && matchUnitPrice(read, scale, per.value, unit, currency, known, floor);
      token(t.raw, "price", ok, t.index);
      continue;
    }
    take(t.index, end);
    const negative = /[-\u2212]/.test(t.sign);
    token(t.raw, "amount", Boolean(read) && matchAmount(read, scale, currency, known, floor, { signed: negative, context: s.slice(Math.max(0, t.index - 60), t.index), after: s.slice(end, end + 60) }), t.index);
  }

  // 5. Percentages.
  const PERCENT = re(`(${SIGN})(${NUM})${SP}?(%|per${SP}cent\\b|percent\\b)`);
  for (const m of s.matchAll(PERCENT)) {
    const a = m.index; const b = a + m[0].length;
    if (!free(a, b)) continue;
    take(a, b);
    const read = readEnglishNumber(m[2]);
    const ok = Boolean(read) && known.shares.some((x) => Math.abs(x * 100 - read.value) <= 0.5 * 10 ** -read.decimals + 1e-9);
    token(m[0].trim(), "share", ok, a);
  }

  // 5b. Numbers in words (review R2c): with a currency an amount, with "per cent" a percentage, with a
  // scale word an amount, a count or a quantity; small counts in words ("three suppliers") pass as before.
  const WORDS_AFTER = re(`^${SP}?(?:(%|per${SP}?cent\\b|percent\\b)|(euros?\\b|EUR\\b|pounds?\\b|GBP\\b))`, "i");
  for (const m of s.matchAll(WORDS_SPAN)) {
    const a = m.index; const b = a + m[0].length;
    if (!free(a, b)) continue;
    const read = readNumberWords(m[0]);
    if (!read) continue;
    const after = WORDS_AFTER.exec(s.slice(b));
    if (after?.[1]) {
      take(a, b + after[0].length);
      const ok = known.shares.some((x) => Math.abs(x * 100 - read.value) <= 0.5 + 1e-9);
      token(s.slice(a, b + after[0].length).trim(), "share", ok, a);
      continue;
    }
    if (after?.[2]) {
      take(a, b + after[0].length);
      const currency = CURRENCY_OF[after[2].toLowerCase()] || "EUR";
      const ok = matchAmount({ value: read.value / read.scale, decimals: 0 }, read.scale, currency, known, 0, { signed: false, context: s.slice(Math.max(0, a - 60), a), after: s.slice(b + after[0].length, b + after[0].length + 60) });
      token(s.slice(a, b + after[0].length).trim(), "amount", ok, a);
      continue;
    }
    if (read.scale > 1) {
      take(a, b);
      const v = read.value;
      const half = 0.5 * read.scale + 1e-9;
      const around = { signed: false, context: s.slice(Math.max(0, a - 60), a), after: s.slice(b, b + 60) };
      const ok = matchAmount({ value: v / read.scale, decimals: 0 }, read.scale, "EUR", known, 0, around)
        || matchAmount({ value: v / read.scale, decimals: 0 }, read.scale, "GBP", known, 0, around)
        || (Number.isInteger(v) && known.counts.has(v)) || known.quantities.some((q) => Math.abs(q.value - v) <= half);
      token(m[0], "amount", ok, a);
    }
  }

  // 6. Everything else with a digit: quantities with a unit, counts, numbers written bare.
  const NUMBER = re(`(${SIGN})(${NUM})`);
  const AFTER = re(`^(?:${SP}?(k)(?![A-Za-z]))?(?:(${SP}?)([A-Za-z][A-Za-z0-9-]*))?`, "");
  for (const m of s.matchAll(NUMBER)) {
    const a = m.index + m[1].length;
    const numEnd = a + m[2].length;
    if (!free(a, numEnd)) continue;
    if (/[A-Za-z]/.test(s[a - 1] || "")) {
      // Glued to letters on the left ("A4", "x86"): an id or a name that must exist.
      take(a, numEnd);
      token(m[2], "id", known.ids.has(m[2]) || [...known.names].some((n) => n.includes(m[2])), a);
      continue;
    }
    const after = AFTER.exec(s.slice(numEnd));
    const scale = after[1] ? 1e3 : 1;
    const word = after[3];
    const read = readEnglishNumber(m[2]);
    const unit = word ? unitCandidates(word, known) : null;
    if (unit?.strict) {
      // A quantity in a unit code ("20,000 EA", "240 PD"): it must match a figure in that unit.
      const end = numEnd + after[0].length;
      take(a, end);
      const ok = Boolean(read) && known.quantities.some((q) => unit.units.includes(q.unit) && Math.abs(q.value - read.value * scale) <= 0.5 * 10 ** -read.decimals * scale + 1e-9);
      token(s.slice(a, end), "quantity", ok, a);
      continue;
    }
    const end = numEnd + (after[1] ? after[0].length - (word ? after[2].length + word.length : 0) : 0);
    take(a, end);
    const raw = s.slice(a, end);
    if (!read) { token(raw, "number", false, a); continue; }
    const v = read.value * scale;
    const half = 0.5 * 10 ** -read.decimals * scale + 1e-9;
    if (word) {
      // A number before a word ("3 suppliers", "90 days", "3,500 pallets"): a count, or a quantity in a
      // unit the word may stand for.
      const ok = (Number.isInteger(v) && known.counts.has(v)) || known.quantities.some((q) => (!unit || unit.units.includes(q.unit)) && Math.abs(q.value - v) <= half);
      token(raw, "count", ok, a);
      continue;
    }
    if (read.decimals === 0 && scale === 1) { token(raw, "count", known.counts.has(v), a); continue; }
    // A bare number with decimals: any figure of the run.
    const ok = known.amounts.some((x) => Math.abs(x.value - v) <= half)
      || known.prices.some((p) => Math.abs(p.value * p.display_quantity - v) <= half)
      || known.quantities.some((q) => Math.abs(q.value - v) <= half)
      || known.rates.some((r) => Math.abs(r.value - v) <= half);
    token(raw, "number", ok, a);
  }

  tokens.sort((x, y) => x.index - y.index);
  const offending = tokens.filter((t) => !t.ok).map((t) => t.raw);
  return { ok: offending.length === 0, offending, tokens };
}

function tolerance(read, scale, figure, floor) {
  const half = 0.5 * 10 ** -read.decimals * scale;
  return Math.max(floor, Math.min(half, MAX_RELATIVE * Math.abs(figure))) + 1e-9;
}

// Words around an amount that say it is a loss, so a negative figure may be written without its sign:
// before it in the same clause ("loses €779"), or right after it ("€200 more than it saves").
const LOSS_BEFORE = /\b(?:los(?:e|es|ing|t)|loss(?:es)?|negative|deficit|short(?:fall)?|minus|below|less|lower|cheaper|under|costs?\s+more|more\s+than\s+it\s+(?:saves|brings|returns))\b[^.;:!?]*$/i;
const LOSS_AFTER = /^[^.;:!?]{0,40}?\b(?:more\s+than\s+it\s+(?:saves|brings|returns)|less|short|below|lower|cheaper|loss(?:es)?|in\s+the\s+red)\b/i;

/**
 * An amount against the run's amounts, of the same currency and within the tolerance. Its sign must agree
 * (review R2d): a minus sign needs a negative figure; a negative figure written without one passes only
 * when the words before it say it is a loss. sign: { signed: written with a minus, context: the text before }.
 */
function matchAmount(read, scale, currency, known, floor, { signed = false, context = "", after = "" } = {}) {
  const v = read.value * scale;
  const signOk = (x) => (signed ? x.negative : !x.negative || LOSS_BEFORE.test(context) || LOSS_AFTER.test(after));
  if (known.amounts.some((x) => x.currency === currency && signOk(x) && Math.abs(x.value - v) <= tolerance(read, scale, x.value, floor))) return true;
  if (signed) return false;
  // A bare amount may be a unit price at its item's display quantity ("Frankfurt €6.90").
  return known.prices.some((p) => p.currency === currency && Math.abs(p.value * p.display_quantity - v) <= tolerance(read, scale, p.value * p.display_quantity, floor));
}

function matchUnitPrice(read, scale, perQuantity, unit, currency, known, floor) {
  const v = read.value * scale;
  return known.prices.some((p) => {
    if (p.currency !== currency || !unit.units.includes(p.unit)) return false;
    const target = p.value * perQuantity;
    return Math.abs(target - v) <= tolerance(read, scale, target, floor);
  });
}

function matchRate(num, from, to, known) {
  const read = readEnglishNumber(num);
  if (!read || !from || !to) return false;
  const half = 0.5 * 10 ** -read.decimals + 1e-12;
  return known.rates.some((r) => r.from === from && r.to === to && Math.abs(r.value - read.value) <= half);
}
