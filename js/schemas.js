// The data contracts (brief §10) as JSON Schemas, validated by js/schema.js: the data products of the world
// (Material, Supplier, Plant, Contract, PoLine, FxRate, ValueLogEntry, and CompanyCode, MaterialGroup and
// Buyer, which the world also carries), the engine's results (ComparableGroup, Cluster, Normalisation,
// GroupAnalysis, Option) and the records of a run (Decision, Draft, RunEvent, AuditEvent), with the
// audit log's export (AuditExport, brief §9: the JSON export validates against it, AC-16).
// Day numbers count from the day the app is opened: 0 is today, negative days are past.

export const INCOTERMS = ["EXW", "FCA", "FAS", "FOB", "CPT", "CIP", "CFR", "CIF", "DAP", "DPU", "DDP"];
export const EVENT_TYPES = [
  "run_start", "state_change", "narration", "reasoning", "tool_call", "tool_result", "alert", "board_update",
  "kpi_update", "options", "option_decision", "confirmation_request", "confirmation_decision", "fx_sensitivity",
  "param_change", "action_draft", "action_decision", "report", "cost_update", "notice", "attempt_discarded", "run_end"
];
export const DRAFT_TYPES = ["change_request", "buyer_notice", "negotiation_brief", "tender_memo", "variance_memo"];

const text = { type: "string", minLength: 1 };
const textOrNull = { type: ["string", "null"] };
const ids = { type: "array", items: text };
const day = { type: "integer" };
const pastDay = { type: "integer", maximum: 0 };
const currency = { type: "string", pattern: "^[A-Z]{3}$" };
const country = { type: "string", pattern: "^[A-Z]{2}$" };
const unit = { type: "string", pattern: "^[A-Z][A-Z0-9]{0,3}$" };
const plantId = { type: "string", pattern: "^[0-9]{4}$" };
const companyCode = { type: "string", pattern: "^CC-[0-9]{4}$" };
const groupCode = { type: "string", pattern: "^[A-Z]{3}-[A-Z]{3}$" };
const isoDate = { type: "string", pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" };
const version = { type: "string", pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+$" };
const amount = { type: "number" };
const nonNegative = { type: "number", minimum: 0 };
const positive = { type: "number", exclusiveMinimum: 0 };
const fraction = { type: "number", minimum: 0 };
const record = (properties, required = Object.keys(properties)) => ({ type: "object", properties, required, additionalProperties: false });

export const SCHEMAS = {
  // ---- data products --------------------------------------------------------------------------------
  CompanyCode: record({ id: companyCode, code: { type: "string", pattern: "^[0-9]{4}$" }, name: text, city: text, country, currency }),
  Plant: record({ id: plantId, company_code: companyCode, city: text, country, role: text }),
  MaterialGroup: record({ id: groupCode, name: text, category: { type: "string", pattern: "^[A-Z]{3}$" }, vendor_category: text }),
  Supplier: record({
    id: text, name: text, city: text, country, currency, category: text, company_code: companyCode,
    delivers_to: { type: "array", items: country, minItems: 1, uniqueItems: true }, added: { type: "boolean" }
  }),
  Buyer: record({
    id: { type: "string", pattern: "^BU-[0-9]{2}$" },
    name: { type: "string", pattern: "^\\p{Lu}[\\p{Ll}-]+ \\p{Lu}\\.$" },
    role: text, team: { enum: ["MRO", "Packaging", "Services"] }, plant: plantId
  }),
  Material: record({
    id: text, description: text, material_group: groupCode, base_unit: unit,
    conversions: { type: "object", propertyNames: unit, additionalProperties: positive },
    display_quantity: positive, manufacturer: textOrNull, mpn: textOrNull
  }),
  Contract: record({
    id: text, supplier: text, company_code: companyCode, material: text, price: nonNegative, price_unit: positive,
    order_unit: unit, incoterm: { enum: [...INCOTERMS, null] }, currency, valid_from: day, valid_to: day
  }),
  PoLine: record({
    id: { type: "string", pattern: "^[0-9]{10}-[0-9]{5}$" }, order: { type: "string", pattern: "^[0-9]{10}$" },
    item: { type: "string", pattern: "^[0-9]{5}$" }, company_code: companyCode, plant: plantId, supplier: text,
    material: textOrNull, short_text: text, material_group: groupCode, quantity: positive, order_unit: unit,
    net_price: nonNegative, price_unit: positive, currency, incoterm: { enum: [...INCOTERMS, null] }, order_day: pastDay,
    contract: textOrNull, buyer: text, urgent: { type: "boolean" }, urgent_reason: textOrNull, cancelled: { type: "boolean" }
  }),
  FxRate: record({
    currency, rate_to_eur: positive, mean_per_eur: { type: ["number", "null"], exclusiveMinimum: 0 },
    observations: { type: ["integer", "null"], minimum: 1 }, first: { anyOf: [isoDate, { type: "null" }] },
    last: { anyOf: [isoDate, { type: "null" }] }, source: textOrNull
  }, ["currency", "rate_to_eur"]),
  ValueLogEntry: record({
    id: text, group: text, option: { enum: ["H", "R", "B"] }, plant: { anyOf: [plantId, { type: "null" }] },
    old_supplier: textOrNull, new_supplier: textOrNull, new_price: { type: ["number", "null"], minimum: 0 },
    approved_day: pastDay, approved_savings_eur: nonNegative, bundle_part_eur: nonNegative,
    implemented_day: { type: ["integer", "null"], maximum: 0 }
  }),

  // ---- engine results --------------------------------------------------------------------------------
  ComparableGroup: record({
    id: text, kind: { enum: ["material", "mpn", "cluster"] }, label: textOrNull, material_group: { anyOf: [groupCode, { type: "null" }] },
    base_unit: unit, display_quantity: positive, materials: ids,
    units: { type: "object", additionalProperties: { type: "object" } },
    line_ids: ids, implemented_day: { type: ["integer", "null"] },
    lines: { type: "array", items: { $ref: "#/$defs/PoLine" } },
    left_out: record({ outside_window: { type: "integer", minimum: 0 }, before_implementation: { type: "integer", minimum: 0 }, cancelled: { type: "integer", minimum: 0 } })
  }, ["id", "kind", "base_unit", "display_quantity", "materials", "units"]),
  Cluster: record({
    id: { type: "string", pattern: "^CL-[0-9]{2}$" }, base_unit: unit, line_ids: { type: "array", items: text, minItems: 2, uniqueItems: true },
    material_group: { anyOf: [groupCode, { type: "null" }] }, label: textOrNull
  }, ["id", "base_unit", "line_ids"]),
  Normalisation: record({
    line: textOrNull, group: textOrNull,
    steps: record({
      price_per_order_unit: { type: ["number", "null"] }, base_units_per_order_unit: { type: ["number", "null"] },
      price_per_base_unit: { type: ["number", "null"] }, currency: textOrNull, rate_to_eur: { type: ["number", "null"] },
      price_per_base_unit_eur: { type: ["number", "null"] }, incoterm: textOrNull, logistics_uplift: { type: ["number", "null"] },
      normalised_price_eur: { type: ["number", "null"] }
    }),
    display: textOrNull, excluded: { type: "boolean" }, reason: text, method_version: version,
    order_unit: textOrNull, base_unit: textOrNull, display_quantity: positive, quantity_base: { type: ["number", "null"] }
  }, ["line", "group", "steps", "display", "excluded", "method_version"]),
  AnalysisLine: record({
    id: text, plant: text, supplier: text, pair: text, material: textOrNull, order_day: { type: ["integer", "null"] },
    contract: textOrNull, urgent: { type: "boolean" }, urgent_reason: textOrNull, quantity: positive, price: nonNegative,
    spend: nonNegative, gap: nonNegative, justified: nonNegative, unexplained: nonNegative, normalisation: { $ref: "#/$defs/Normalisation" }
  }),
  Pair: record({
    id: text, plant: text, supplier: text, quantity: positive, spend: nonNegative, lines: ids, price: nonNegative,
    share: fraction, gap: nonNegative, justified: nonNegative, unexplained: nonNegative, eligible: { type: "boolean" }
  }),
  Option: record({
    id: { enum: ["H", "R", "B", "accept"] }, title: text, applicable: { type: "boolean" }, savings: amount, bundle: nonNegative,
    one_off: nonNegative, net: amount, residual: amount, index_after: fraction,
    days_to_first_saving: { type: ["integer", "null"], minimum: 0 }, plants: ids, suppliers: ids, warnings: { type: "array", items: text },
    supplier: textOrNull, plants_moved: ids, plants_not_covered: ids, lines_moved: ids, quantity_moved: nonNegative, share_after: fraction,
    reasons: { type: "array", items: text, minItems: 1 }
  }, ["id", "title", "applicable", "savings", "bundle", "one_off", "net", "residual", "index_after", "days_to_first_saving", "plants", "suppliers", "warnings"]),
  GroupAnalysis: record({
    id: text, kind: { enum: ["material", "mpn", "cluster"] }, label: textOrNull, material_group: textOrNull, base_unit: unit,
    display_quantity: positive, method_version: version,
    lines: { type: "array", items: { $ref: "#/$defs/AnalysisLine" } },
    excluded: { type: "array", items: record({ id: text, plant: textOrNull, supplier: textOrNull, reason: text }) },
    cancelled: ids,
    pairs: { type: "array", items: { $ref: "#/$defs/Pair" } },
    quantity: nonNegative,
    benchmark: { anyOf: [record({ pair: text, plant: text, supplier: text, price: nonNegative, share: fraction }), { type: "null" }] },
    highest: { anyOf: [record({ pair: text, plant: text, supplier: text, price: nonNegative }), { type: "null" }] },
    spend: nonNegative, gap: nonNegative, justified: nonNegative, unexplained: nonNegative, opportunity: nonNegative,
    index: fraction, spread: fraction,
    materiality: record({ opportunity_eur: nonNegative, spread: fraction, opportunity_ok: { type: "boolean" }, spread_ok: { type: "boolean" } }),
    flagged: { type: "boolean" }, warnings: { type: "array", items: text },
    options: record({ H: { $ref: "#/$defs/Option" }, R: { $ref: "#/$defs/Option" }, B: { $ref: "#/$defs/Option" }, accept: { $ref: "#/$defs/Option" } })
  }),

  // ---- records of a run --------------------------------------------------------------------------------
  Decision: record({
    options_seq: { type: "integer", minimum: 1 }, option_id: { enum: ["H", "R", "B", "accept"] }, option_label: text,
    decision: { enum: ["approved", "rejected"] }, reason: textOrNull, by: text, at: text
  }, ["options_seq", "option_id", "decision", "by"]),
  Draft: record({
    action_id: text, type: { enum: DRAFT_TYPES }, recipient: text, subject: text, body: text,
    status: { enum: ["pending", "approved", "rejected"] }, option_id: { enum: ["H", "R", "B", "accept"] },
    unchecked: { type: "array", items: text }
  }, ["action_id", "type", "recipient", "subject", "body", "status"]),
  RunEvent: record({
    id: text, seq: { type: "integer", minimum: 0 }, type: { enum: EVENT_TYPES }, ts: text, t: { type: ["number", "null"] },
    run_id: textOrNull, mode: { enum: ["live", "simulation", null] }, payload: { type: "object" }
  }, ["type", "ts", "payload"]),
  AuditEvent: record({
    id: text, seq: { type: "integer", minimum: 0 }, type: { enum: [...EVENT_TYPES, "model_call"] }, ts: text, t: { type: ["number", "null"] },
    run_id: textOrNull, mode: { enum: ["live", "simulation", null] }, payload: { type: "object" },
    reviewer: text
  }, ["type", "ts", "payload"]),

  // ---- the audit log as exported (js/audit.js buildAuditExport) ----------------------------------------
  Parameters: record(Object.fromEntries([
    "window_days", "benchmark_min_share", "urgent_allowance", "logistics_uplift", "person_day_hours", "materiality_eur",
    "materiality_spread", "day_rate_eur", "harmonise_days_per_plant", "renegotiate_days_per_supplier", "tender_days",
    "bundle_discount", "lead_time_harmonise_days", "lead_time_renegotiate_days", "lead_time_tender_days"
  ].map((k) => [k, nonNegative]))),
  AuditExport: record({
    app: text, app_version: version, exported_at: text,
    mode: { enum: ["live", "simulation", null] }, mode_statement: text, ai_disclosure: text, company_note: text,
    versions: record({ app: version, method: text, engine: text, world: textOrNull, fx: textOrNull }),
    model: { anyOf: [record({ id: text, label: textOrNull, price_usd_per_million: { type: ["object", "null"] } }), { type: "null" }] },
    usage: { anyOf: [record({ input_tokens: nonNegative, output_tokens: nonNegative, cache_read_input_tokens: nonNegative, cache_creation_input_tokens: nonNegative }), { type: "null" }] },
    cost: { type: ["object", "null"] },
    rates: record({
      basis: record({ version: textOrNull, label: textOrNull, status: textOrNull, source: textOrNull, currencies: { type: "object" } }),
      fetched_in_run: { type: "array", items: { type: "object", properties: { ok: { type: "boolean" }, currency: currency, date: isoDate, per_eur: positive, rate_to_eur: positive }, required: ["ok"] } }
    }),
    parameters: record({
      in_effect: { anyOf: [{ $ref: "#/$defs/Parameters" }, { type: "null" }] },
      changed_from_defaults: { type: "array", items: record({ name: text, default: nonNegative, value: nonNegative }) },
      changes: { type: "array", items: record({ ts: text, name: text, from: nonNegative, to: nonNegative }) }
    }),
    run: { anyOf: [record({
      run_id: text, mode: { enum: ["live", "simulation"] }, entry: { enum: ["scenario", "sweep", "custom"] }, scenario_id: textOrNull,
      title: text, model: textOrNull, sim_source: { enum: ["authored", "recorded", null] },
      parameters: { anyOf: [{ $ref: "#/$defs/Parameters" }, { type: "null" }] },
      parameters_changed: { type: "array", items: record({ name: text, default: nonNegative, value: nonNegative }) },
      started_at: text, ended_at: textOrNull, status: text
    }), { type: "null" }] },
    run_facts: { type: ["object", "null"] },
    // A decision: who, when and what (its payload's fields follow, as the run event carries them).
    decisions: { type: "array", items: { type: "object", properties: { type: { enum: ["confirmation_decision", "option_decision", "action_decision"] }, ts: text, reviewer: text, decision: text }, required: ["type", "ts", "reviewer", "decision"] } },
    counts: { type: "object" },
    events: { type: "array", items: { $ref: "#/$defs/AuditEvent" } },
    api_exchanges: { type: "array", items: { type: "object" } }
  })
};

/** The names the brief asks for (§10); the others are the records those refer to. */
export const CONTRACT_NAMES = [
  "Material", "Supplier", "Plant", "Contract", "PoLine", "FxRate", "ComparableGroup", "Cluster", "Normalisation",
  "GroupAnalysis", "Option", "Decision", "Draft", "ValueLogEntry", "RunEvent", "AuditEvent"
];

/** The schema of each world data product. */
export const PRODUCT_SCHEMAS = {
  company_code: "CompanyCode", plant: "Plant", material_group: "MaterialGroup", supplier: "Supplier", buyer: "Buyer",
  material: "Material", contract: "Contract", po_line: "PoLine", value_log: "ValueLogEntry"
};
