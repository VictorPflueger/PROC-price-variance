// Display strings (brief §5): every number and date goes through Intl with en-GB. A value is first
// rounded to 1e-9, so floating-point noise never moves a displayed digit, and Intl then rounds it
// with its default, half away from zero: a tie such as €778.50 always shows as "€779".
//   amounts      euros without decimals: "€1,739", "-€779"
//   unit prices  two decimals at the item's display quantity: "€6.90 per 100 EA", "€38.00 per EA"
//   shares       percentages with one decimal: "42.0%"
//   quantities   whole numbers with their unit: "20,000 EA"
//   dates        "Thu 19 Nov", with the year when it is not this year: "Wed 19 Nov 2025"
// Pure module (no DOM); the engine never formats, only this module does.

import { appToday } from "./clock.js";

/** The value rounded to 1e-9 (the step before Intl rounds it for display). */
export function round9(x) {
  const v = Number(x);
  if (!Number.isFinite(v)) return v;
  const r = Math.round(v * 1e9) / 1e9;
  return Object.is(r, -0) ? 0 : r;
}

const EUR0 = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
const EUR2 = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PCT1 = new Intl.NumberFormat("en-GB", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
const INT = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const NUM2 = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Some ICU versions write the minus sign as U+2212; the app writes a hyphen-minus everywhere.
const minus = (s) => s.replace(/−/g, "-");
const dash = "—";
const missing = (v) => v === null || v === undefined || !Number.isFinite(Number(v));

/** An amount in euros without decimals: "€1,739", "-€779". */
export function eur(value) {
  return missing(value) ? dash : minus(EUR0.format(round9(value)));
}

/** An amount in euros with cents, for the cost meter and small figures: "€0.38". */
export function eurCents(value) {
  return minus(EUR2.format(round9(Number(value) || 0)));
}

/** A unit price at the item's display quantity: "€6.90 per 100 EA"; "€38.00 per EA" when it is 1. */
export function unitPrice(pricePerBaseUnit, displayQuantity = 1, unit = "EA") {
  if (missing(pricePerBaseUnit)) return dash;
  const q = Number(displayQuantity) || 1;
  return `${minus(EUR2.format(round9(pricePerBaseUnit * q)))} per ${q === 1 ? "" : `${INT.format(q)} `}${unit}`;
}

/** A share or a gap as a percentage with one decimal: "42.0%". */
export function pct(fraction) {
  return missing(fraction) ? dash : minus(PCT1.format(round9(fraction)));
}

/** A quantity as a whole number with its unit: "20,000 EA". */
export function qty(value, unit = "") {
  if (missing(value)) return dash;
  return `${minus(INT.format(round9(value)))}${unit ? ` ${unit}` : ""}`;
}

/** A whole number with thousands separators: "1,370,000". */
export function int(value) {
  return minus(INT.format(round9(Number(value) || 0)));
}

/** A number with two decimals (a rate or a factor): "1.19". */
export function num2(value) {
  return missing(value) ? dash : minus(NUM2.format(round9(value)));
}

/** mm:ss (or h:mm:ss) for a stopwatch. */
export function clock(ms) {
  const total = Math.max(0, Math.floor((ms || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (x) => String(x).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

// ---- dates ---------------------------------------------------------------------------------------

const DATE_PARTS = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const MONTH3 = (m) => (m === "Sept" ? "Sep" : m);

/** The calendar date of a day number (0 is today, negative days are past). */
export function dateOfDay(day, today = appToday()) {
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() + Number(day));
}

/** "2026-11-19" for a day number, in the browser's own calendar. */
export function isoOfDay(day, today = appToday()) {
  const d = dateOfDay(day, today);
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "Thu 19 Nov" for a day number or an ISO date; "Wed 19 Nov 2025" when the year is not this year. */
export function shortDate(dayOrIso, today = appToday()) {
  let d;
  if (typeof dayOrIso === "number") d = dateOfDay(dayOrIso, today);
  else {
    const text = String(dayOrIso ?? "");
    d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T12:00:00` : text);
  }
  if (Number.isNaN(d.getTime())) return dash;
  const parts = Object.fromEntries(DATE_PARTS.formatToParts(d).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  const base = `${parts.weekday} ${parts.day} ${MONTH3(parts.month)}`;
  return d.getFullYear() === today.getFullYear() ? base : `${base} ${parts.year}`;
}

/** "19 Nov 2026" from an ISO date or timestamp. */
export function dateWithYear(iso) {
  const text = String(iso ?? "");
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T12:00:00` : text);
  if (Number.isNaN(d.getTime())) return "an earlier date";
  const parts = Object.fromEntries(DATE_PARTS.formatToParts(d).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  return `${parts.day} ${MONTH3(parts.month)} ${parts.year}`;
}

/** "15:56:03" local time from an ISO timestamp. */
export function timeOfDay(iso) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
