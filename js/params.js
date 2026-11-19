// The method's parameters (brief §6.6): every one an assumption, labelled as such. Edited only in the
// Method dialog in Live mode, each change logged; read-only in Diagnostics; locked in Simulation so
// the scripted runs stay valid (a lower threshold would flag scenario 4). Pure module (no DOM).

/** Each parameter with its default, unit and label. Fractions are stored as fractions (0.1 = 10 %). */
export const PARAMETERS = [
  { key: "window_days", value: 365, unit: "days", label: "Analysis window" },
  { key: "benchmark_min_share", value: 0.10, unit: "share", label: "Benchmark: minimum share of the group's quantity" },
  { key: "urgent_allowance", value: 0.15, unit: "share", label: "Urgent allowance above the benchmark" },
  { key: "logistics_uplift", value: 0.05, unit: "share", label: "Logistics uplift for Incoterms groups E and F" },
  { key: "person_day_hours", value: 8, unit: "hours", label: "Person-day for service lines" },
  { key: "materiality_eur", value: 5000, unit: "€ a year", label: "Materiality: opportunity" },
  { key: "materiality_spread", value: 0.05, unit: "share", label: "Materiality: spread" },
  { key: "day_rate_eur", value: 1200, unit: "€", label: "Day rate (blended person-day)" },
  { key: "harmonise_days_per_plant", value: 1, unit: "days", label: "Harmonise: days per moved plant" },
  { key: "renegotiate_days_per_supplier", value: 2, unit: "days", label: "Renegotiate: days per supplier" },
  { key: "tender_days", value: 8, unit: "days", label: "Tender: days" },
  { key: "bundle_discount", value: 0.03, unit: "share", label: "Tender: bundle discount on the group's spend at the benchmark" },
  { key: "lead_time_harmonise_days", value: 30, unit: "days", label: "Lead time: harmonise" },
  { key: "lead_time_renegotiate_days", value: 60, unit: "days", label: "Lead time: renegotiate" },
  { key: "lead_time_tender_days", value: 90, unit: "days", label: "Lead time: tender" }
];

/** The defaults, frozen. */
export const DEFAULTS = Object.freeze(Object.fromEntries(PARAMETERS.map((p) => [p.key, p.value])));

/** The defaults with some values changed (an unknown key or a value that is not a positive number throws). */
export function withParams(changes = {}) {
  const out = { ...DEFAULTS };
  for (const [k, v] of Object.entries(changes)) {
    if (!(k in DEFAULTS)) throw new Error(`Unknown parameter ${k}`);
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) throw new Error(`Parameter ${k} must be a number of at least 0`);
    out[k] = v;
  }
  return Object.freeze(out);
}

/**
 * A parameter set with its change log. locked: no change is accepted (Simulation). Each accepted change
 * is returned as { name, from, to } for the audit (event param_change).
 */
export function createParams({ locked = false, values = DEFAULTS } = {}) {
  let current = withParams(Object.fromEntries(Object.entries(values).filter(([k]) => k in DEFAULTS)));
  const log = [];
  return {
    get: () => current,
    locked: () => locked,
    set(name, value) {
      if (locked) return { error: "The parameters are locked in Simulation, so the scripted runs stay valid." };
      if (!(name in DEFAULTS)) return { error: `Unknown parameter ${name}.` };
      try {
        const from = current[name];
        current = withParams({ ...current, [name]: value });
        const change = { name, from, to: value };
        log.push(change);
        return { change };
      } catch (e) {
        return { error: e.message };
      }
    },
    reset() { current = DEFAULTS; },
    changes: () => log.slice()
  };
}
