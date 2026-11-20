// The ERP side of the world: the data products (brief §6.1) as the agent's three erp_* tools read them,
// and the same queries for the board's popovers, the simulation player and the script checker.
//
//   erp_get_overview  company codes, plants, the data products with row counts and as-of day, the
//                     exchange rates with their dates, the parameters
//   erp_query         rows of one data product with filters (eq, in, gte, lte, contains), at most 50
//                     rows plus the total count
//   erp_get_record    one record with its related records (material, supplier, contract, plant, buyer)
//
// The po_line and contract views add the supplier's name and the plant's city, as a reporting view
// over EKKO/EKPO would. Nothing here compares lines: that is the engine's job (js/variance.js). Pure
// module: no DOM, no storage, no network.

import { PARAMETERS } from "./params.js";
import { METHOD_VERSION } from "./normalise.js";

export const MAX_ROWS = 50;
export const DEFAULT_ROWS = 20;

/** The data products the agent can read, with their typical SAP source (DATA_SOURCES.md). */
export const PRODUCTS = Object.freeze({
  po_line: { label: "Purchase-order items", source: "EKKO, EKPO", id: "id" },
  material: { label: "Materials", source: "MARA, MAKT, MARM", id: "id" },
  supplier: { label: "Supplier accounts", source: "LFA1, LFM1 (business partner in S/4HANA)", id: "id" },
  contract: { label: "Outline agreements (contracts)", source: "EKKO and EKPO with document category K", id: "id" },
  plant: { label: "Plants", source: "T001W", id: "id" },
  company_code: { label: "Company codes", source: "T001", id: "id" },
  buyer: { label: "Buyers (purchasing group owners)", source: "T024", id: "id" },
  material_group: { label: "Material groups", source: "T023", id: "id" },
  fx_rate: { label: "Exchange rates to EUR for the analysis window", source: "ECB euro reference rates", id: "currency" },
  value_log: { label: "Approved options (the agent's own store)", source: "the agent's own store", id: "id" }
});
export const PRODUCT_NAMES = Object.freeze(Object.keys(PRODUCTS));
export const FILTER_OPS = Object.freeze(["eq", "in", "gte", "lte", "contains"]);

/** Indexes over a world, built once per world object. */
const INDEX = new WeakMap();
export function indexOf(world) {
  let ix = INDEX.get(world);
  if (ix) return ix;
  const by = (list = [], key = "id") => new Map(list.map((r) => [String(r[key]), r]));
  ix = {
    company_code: by(world.company_code),
    plant: by(world.plant),
    supplier: by(world.supplier),
    buyer: by(world.buyer),
    material: by(world.material),
    material_group: by(world.material_group),
    contract: by(world.contract),
    po_line: by(world.po_line),
    value_log: by(world.value_log)
  };
  INDEX.set(world, ix);
  return ix;
}

/** Rows of a data product, as the views show them. */
function rowsOf(world, fx, product) {
  const ix = indexOf(world);
  switch (product) {
    case "po_line":
      return (world.po_line || []).map((l) => ({
        ...l,
        supplier_name: ix.supplier.get(String(l.supplier))?.name ?? null,
        plant_city: ix.plant.get(String(l.plant))?.city ?? null
      }));
    case "contract":
      return (world.contract || []).map((c) => ({ ...c, supplier_name: ix.supplier.get(String(c.supplier))?.name ?? null }));
    case "supplier":
      return (world.supplier || []).map(({ added, ...s }) => s);
    case "fx_rate":
      return fxRows(fx);
    default:
      return world[product] || [];
  }
}

/** The bundled exchange rates as rows of the fx_rate product. */
export function fxRows(fx) {
  return Object.entries(fx?.currencies || {}).map(([currency, v]) => ({
    currency,
    rate_to_eur: v.rate_to_eur,
    mean_per_eur: v.mean_per_eur ?? null,
    observations: v.observations ?? null,
    first: v.first ?? null,
    last: v.last ?? null,
    source: currency === "EUR" ? null : (v.source || fx.source || null)
  }));
}

/** erp_get_overview: company codes, plants, data products, rates and parameters. */
export function erpOverview(world, fx, params) {
  const counts = Object.fromEntries(PRODUCT_NAMES.map((p) => [p, rowsOf(world, fx, p).length]));
  return {
    company: `${world.meta?.company || "GlobalCorp SE"} (fictional)`,
    today_day: 0,
    note: "Day numbers count from today (day 0); negative days are past. Lines are comparable only within a comparable group (the same material, the same manufacturer part number, or a cluster a person confirmed).",
    company_codes: (world.company_code || []).map((c) => ({ ...c })),
    plants: (world.plant || []).map((p) => ({ ...p })),
    data_products: PRODUCT_NAMES.map((p) => ({ product: p, description: PRODUCTS[p].label, typical_source: PRODUCTS[p].source, count: counts[p], as_of_day: 0 })),
    rates: {
      label: fx?.label || null,
      version: fx?.version || null,
      window: fx?.window || null,
      currencies: fxRows(fx)
    },
    parameters: PARAMETERS.map((p) => ({ name: p.key, value: params?.[p.key] ?? p.value, unit: p.unit, label: p.label, assumption: true })),
    versions: { world: world.meta?.world_version || null, method: METHOD_VERSION, fx: fx?.version || null }
  };
}

const isNumeric = (v) => typeof v === "number" && Number.isFinite(v);

function matches(row, f) {
  const v = row[f.field];
  const raw = String(f.value ?? "");
  switch (f.op) {
    case "eq":
      if (isNumeric(v)) return Number(raw) === v;
      if (typeof v === "boolean") return String(v) === raw.toLowerCase();
      if (v === null || v === undefined) return raw === "" || raw.toLowerCase() === "null";
      return String(v) === raw;
    case "in": {
      const set = raw.split(",").map((s) => s.trim()).filter(Boolean);
      if (isNumeric(v)) return set.map(Number).includes(v);
      return set.includes(String(v));
    }
    case "gte": return isNumeric(v) && Number.isFinite(Number(raw)) && v >= Number(raw);
    case "lte": return isNumeric(v) && Number.isFinite(Number(raw)) && v <= Number(raw);
    case "contains": {
      const needle = raw.toLowerCase();
      if (Array.isArray(v)) return v.some((x) => String(x).toLowerCase() === needle || String(x).toLowerCase().includes(needle));
      return v !== null && v !== undefined && String(v).toLowerCase().includes(needle);
    }
    default: return false;
  }
}

/** erp_query: rows of one product with filters, at most 50 rows plus the total count. */
export function erpQuery(world, fx, input = {}) {
  const product = input.product;
  if (!PRODUCTS[product]) return { error: `Unknown data product "${product}". Use one of: ${PRODUCT_NAMES.join(", ")}.` };
  const all = rowsOf(world, fx, product);
  const fields = new Set(all.flatMap((r) => Object.keys(r)));
  const filters = Array.isArray(input.filters) ? input.filters : [];
  for (const f of filters) {
    if (!fields.has(f.field)) return { error: `Field "${f.field}" is not in ${product}. Its fields: ${[...fields].join(", ")}.` };
    if (!FILTER_OPS.includes(f.op)) return { error: `Filter op "${f.op}" is not supported; use ${FILTER_OPS.join(", ")}.` };
    if ((f.op === "gte" || f.op === "lte") && !Number.isFinite(Number(f.value))) return { error: `Filter ${f.field} ${f.op} needs a number, got "${f.value}".` };
  }
  let rows = all.filter((r) => filters.every((f) => matches(r, f)));
  const sort = typeof input.sort === "string" && input.sort.trim() ? input.sort.trim() : null;
  if (sort) {
    const desc = sort.startsWith("-");
    const key = desc ? sort.slice(1) : sort;
    if (!fields.has(key)) return { error: `Cannot sort by "${key}": not a field of ${product}.` };
    rows = rows.slice().sort((a, b) => {
      const x = a[key];
      const y = b[key];
      const c = isNumeric(x) && isNumeric(y) ? x - y : String(x ?? "").localeCompare(String(y ?? ""));
      return desc ? -c : c;
    });
  }
  const limit = Math.max(1, Math.min(MAX_ROWS, Number.isInteger(input.limit) ? input.limit : DEFAULT_ROWS));
  return {
    product,
    total: rows.length,
    returned: Math.min(limit, rows.length),
    truncated: rows.length > limit,
    filters: filters.map((f) => ({ field: f.field, op: f.op, value: String(f.value ?? "") })),
    rows: rows.slice(0, limit)
  };
}

/** A buyer shown by role and team, never by name alone ("Buyer, MRO, Lyon"). */
export function buyerRole(world, id) {
  const ix = indexOf(world);
  const b = ix.buyer.get(String(id));
  if (!b) return null;
  const city = ix.plant.get(String(b.plant))?.city || b.plant;
  return `${b.role}, ${b.team}, ${String(city).replace(" am Main", "")}`;
}

/** erp_get_record: one record and its related records. */
export function erpGetRecord(world, fx, input = {}) {
  const product = input.product;
  if (!PRODUCTS[product]) return { error: `Unknown data product "${product}". Use one of: ${PRODUCT_NAMES.join(", ")}.` };
  const id = String(input.id ?? "");
  const rows = rowsOf(world, fx, product);
  const key = PRODUCTS[product].id;
  const record = rows.find((r) => String(r[key]) === id);
  if (!record) return { product, id, found: false, error: `No ${product} record with id "${id}".` };
  const ix = indexOf(world);
  const contractsOf = (pred) => (world.contract || []).filter(pred).map((c) => ({ ...c, supplier_name: ix.supplier.get(String(c.supplier))?.name ?? null }));
  const supplierOf = (sid) => { const s = ix.supplier.get(String(sid)); if (!s) return null; const { added, ...rest } = s; return rest; };
  const related = {};
  switch (product) {
    case "po_line":
      related.material = record.material ? ix.material.get(String(record.material)) || null : null;
      related.supplier = supplierOf(record.supplier);
      related.plant = ix.plant.get(String(record.plant)) || null;
      related.buyer = record.buyer ? { id: record.buyer, role: buyerRole(world, record.buyer) } : null;
      related.contract = record.contract ? contractsOf((c) => c.id === record.contract)[0] || null : null;
      break;
    case "material": {
      related.material_group = ix.material_group.get(String(record.material_group)) || null;
      related.contracts = contractsOf((c) => c.material === record.id);
      related.same_manufacturer_part = record.manufacturer && record.mpn
        ? (world.material || []).filter((m) => m.id !== record.id && m.manufacturer === record.manufacturer && m.mpn === record.mpn).map((m) => ({ id: m.id, description: m.description, manufacturer: m.manufacturer, mpn: m.mpn }))
        : [];
      break;
    }
    case "supplier":
      related.contracts = contractsOf((c) => c.supplier === record.id);
      related.plants_delivered = (world.plant || []).filter((p) => (record.delivers_to || []).includes(p.country)).map((p) => p.id);
      break;
    case "contract":
      related.supplier = supplierOf(record.supplier);
      related.material = ix.material.get(String(record.material)) || null;
      related.company_code = ix.company_code.get(String(record.company_code)) || null;
      break;
    case "plant":
      related.company_code = ix.company_code.get(String(record.company_code)) || null;
      related.buyers = (world.buyer || []).filter((b) => b.plant === record.id).map((b) => ({ id: b.id, role: buyerRole(world, b.id) }));
      break;
    case "buyer":
      related.plant = ix.plant.get(String(record.plant)) || null;
      related.shown_as = buyerRole(world, record.id);
      break;
    case "value_log":
      related.old_supplier = supplierOf(record.old_supplier);
      related.new_supplier = supplierOf(record.new_supplier);
      related.plant = ix.plant.get(String(record.plant)) || null;
      break;
    default:
      break;
  }
  return { product, id, found: true, record: { ...record }, related };
}

/** The suppliers whose contracts an ERP result looked up (a contract query by supplier counts even when empty). */
export function contractLookups(name, input = {}, result = {}) {
  const out = new Set();
  if (!result || result.error) return out;
  if (name === "erp_query" && input.product === "contract") {
    for (const f of input.filters || []) {
      if (f.field !== "supplier") continue;
      if (f.op === "eq") out.add(String(f.value));
      if (f.op === "in") String(f.value).split(",").map((s) => s.trim()).filter(Boolean).forEach((s) => out.add(s));
    }
    for (const r of result.rows || []) out.add(String(r.supplier));
  }
  if (name === "erp_get_record") {
    if (result.product === "contract" && result.record) out.add(String(result.record.supplier));
    if (result.product === "supplier" && result.record) out.add(String(result.record.id));
    const rel = result.related || {};
    if (rel.contract) out.add(String(rel.contract.supplier));
    for (const c of rel.contracts || []) out.add(String(c.supplier));
  }
  return out;
}

/** Is an id a record of the world (any product), a plant code or a company code? */
export function isKnownId(world, id) {
  const ix = indexOf(world);
  const s = String(id);
  return ix.po_line.has(s) || ix.material.has(s) || ix.supplier.has(s) || ix.contract.has(s) || ix.plant.has(s)
    || ix.company_code.has(s) || ix.buyer.has(s) || ix.value_log.has(s) || ix.material_group.has(s)
    || (world.company_code || []).some((c) => c.code === s) || /^\d{10}$/.test(s) && (world.po_line || []).some((l) => l.order === s);
}
