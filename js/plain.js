// Plain words for the screen. The engine, the guardrails and the figure audit keep their own forms
// ("€6.90 per 100 EA", "1010 / 30024"); this module only changes what the page shows ("€6.90 per 100
// gloves", "Frankfurt, Chroma MRO AG"). Pure module: the page and the tests share it.

import { INCOTERM_GROUPS, UPLIFT_GROUPS } from "./normalise.js";

// What each case counts its items in; any other group counts in units.
const NOUNS = { "20001001": "gloves", "20001003": "hoses", "20001005": "boxes", "20001006": "pallets", "MPN:Brekholt:BH-7730-S3": "pairs" };
const UNIT_WORDS = {
  EA: ["piece", "pieces"], BOX: ["box", "boxes"], CS: ["case", "cases"], PAK: ["pack", "packs"], ROL: ["roll", "rolls"],
  DR: ["drum", "drums"], PAL: ["pallet", "pallets"], KAR: ["carton", "cartons"], H: ["hour", "hours"], DAY: ["day", "days"],
  PD: ["person-day", "person-days"], L: ["litre", "litres"], M: ["metre", "metres"], KG: ["kilogram", "kilograms"]
};
const SYMBOL = { EUR: "€", GBP: "£", USD: "$" };
const n0 = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const n2 = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const noun = (groupId, baseUnit = "EA") => NOUNS[groupId] || (baseUnit === "EA" ? "units" : (UNIT_WORDS[baseUnit] || [baseUnit, baseUnit])[1]);
export const place = (world, plantId) => (world.plant.find((p) => p.id === plantId)?.city || plantId).replace(" am Main", "");
export const supplierName = (world, id) => world.supplier.find((s) => s.id === id)?.name || id;
export const who = (world, plant, supplier) => `${place(world, plant)}, ${supplierName(world, supplier)}`;
export const money = (amount, currency = "EUR", digits = 2) => `${SYMBOL[currency] || `${currency} `}${(digits ? n2 : n0).format(amount)}`;
export const pct = (fraction, digits = Math.abs(fraction) < 0.1 && Math.abs(fraction * 100 - Math.round(fraction * 100)) > 1e-9 ? 1 : 0) => `${(fraction * 100).toFixed(digits)} %`;
export const plural = (n, one, many = `${one}s`) => `${n0.format(n)} ${n === 1 ? one : many}`;

/** "box of 100", "case of 1,000", "hour": an order unit in the words of the item's master data. */
export function unitName(orderUnit, conversions = {}, baseUnit = "EA", count = 1) {
  const [one, many] = UNIT_WORDS[orderUnit] || [orderUnit, orderUnit];
  const per = conversions[orderUnit];
  const of = per && per > 1 && orderUnit !== baseUnit ? ` of ${n0.format(per)}` : "";
  return `${count === 1 ? one : many}${of}`;
}

/** True when a line's delivery terms leave the freight to the buyer (Incoterms groups E and F). */
export const freightLeftOut = (incoterm) => UPLIFT_GROUPS.includes(INCOTERM_GROUPS[String(incoterm || "").toUpperCase()]);

/** A line's price as the order books it: "£62.00 per case of 1,000", "€720.00 per 100 boxes of 100". */
export function asBooked(line, conversions = {}, baseUnit = "EA") {
  const per = Number(line.price_unit || 1);
  const amount = money(Number(line.net_price), line.currency);
  if (per === 1 && line.order_unit === "EA") return `${amount} each`;
  if (per === 1) return `${amount} per ${unitName(line.order_unit, conversions, baseUnit)}`;
  return `${amount} per ${n0.format(per)} ${(UNIT_WORDS[line.order_unit] || [line.order_unit, line.order_unit])[1]}`;
}

/** An exchange rate as the method uses it: "€1.1610 per £". */
export const rate = (toEur, currency) => `€${toEur.toFixed(4)} per ${SYMBOL[currency] || currency}`;

/** A price per base unit at the group's display quantity: "€6.90 per 100 gloves", "€44.50 each". */
export function perUnit(pricePerBase, displayQuantity, baseUnit, groupId) {
  const amount = money(pricePerBase * displayQuantity);
  if (displayQuantity > 1) return `${amount} per ${n0.format(displayQuantity)} ${noun(groupId, baseUnit)}`;
  if (baseUnit === "EA") return `${amount} each`;
  if (baseUnit === "H") return `${amount} an hour`;
  return `${amount} per ${(UNIT_WORDS[baseUnit] || [baseUnit])[0]}`;
}

/**
 * A text the engine or the agent wrote, in plain words: unit codes become words, pair ids and supplier
 * numbers become names. ctx: { world, groupId, baseUnit }.
 */
export function plain(text, { world, groupId = null, baseUnit = "EA" } = {}) {
  if (!text) return "";
  const nounOf = noun(groupId, baseUnit);
  let s = String(text);
  s = s.replace(/\bper ([\d,]+) EA\b/g, (_, q) => `per ${q} ${nounOf}`);
  s = s.replace(/\bper EA\b/g, "each").replace(/\bper H\b/g, "an hour");
  s = s.replace(/\bper (PD|DAY|ROL|L|M|KG|PAK|CS|BOX)\b/g, (_, u) => `per ${UNIT_WORDS[u][0]}`);
  s = s.replace(/\b([\d,]+(?:\.\d+)?) (EA|PD|H)\b/g, (_, q, u) => `${q} ${u === "EA" ? nounOf : UNIT_WORDS[u][Number(q.replace(/,/g, "")) === 1 ? 0 : 1]}`);
  s = s.replace(/\bCL-\d+\b/g, "the cluster").replace(/\bCAND-\d+\b/g, "the candidate").replace(/(^|[.!?]\s+)the (cluster|candidate)\b/g, (m, a, w) => `${a}The ${w}`);
  if (world) {
    s = s.replace(/\b(\d{4}) \/ (\d{5})\b/g, (_, p, sup) => who(world, p, sup));
    s = s.replace(/\bsuppliers? (\d{5}) \(([^)]+)\)/g, (_, id, name) => name);
    s = s.replace(/\bsupplier (\d{5})\b/g, (_, id) => supplierName(world, id));
    s = s.replace(/\bplant (\d{4})\b/g, (_, id) => place(world, id));
    s = s.replace(/\b\d{5}\b/g, (m) => (world.supplier.some((x) => x.id === m) ? supplierName(world, m) : m));
  }
  return s;
}

/** The live agent's messages, in this page's words: its Diagnostics and Simulation mode are gone. */
export function liveWords(text) {
  return String(text || "")
    .replace(/ \(Blocked or unreachable from this browser \(([^)]*)\)\.\)/, " ($1)")
    .replace(/Check the network or run Diagnostics; Simulation mode works offline\./, "Check the network; the simulation works offline.")
    .replace(/use Simulation mode/g, "run the simulation")
    .replace(/or run the Simulation/g, "or run the simulation")
    .replace(/Try another scenario or model/g, "Try another case or model")
    .trim();
}
