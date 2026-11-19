// A small JSON Schema validator without a dependency, for the data contracts of js/schemas.js and the
// tools' inputs. It supports the keywords those schemas use: $ref (to "#/$defs/<Name>"), type (one or a
// list; "integer" included), enum, const, properties, required, additionalProperties (false or a schema),
// propertyNames, items, minItems, maxItems, uniqueItems, minimum, maximum, exclusiveMinimum,
// exclusiveMaximum, minLength, maxLength, pattern and anyOf. Any other keyword is an error in the schema,
// so a schema never silently checks less than it says. Every error names the field and what it expects.
// Pure module: no DOM, no storage, no network.

const KNOWN = new Set([
  "$ref", "$id", "$schema", "$defs", "title", "description", "type", "enum", "const", "properties", "required",
  "additionalProperties", "propertyNames", "items", "minItems", "maxItems", "uniqueItems", "minimum", "maximum",
  "exclusiveMinimum", "exclusiveMaximum", "minLength", "maxLength", "pattern", "anyOf", "default", "examples"
]);

const typeOf = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v);
/** JSON types only: a number must be finite, an integer a whole number. */
const matchesType = (v, t) => {
  if (typeof v === "number") return Number.isFinite(v) && (t === "number" || (t === "integer" && Number.isInteger(v)));
  return t === typeOf(v);
};
const show = (v) => {
  if (typeof v === "number" && !Number.isFinite(v)) return String(v);
  const s = JSON.stringify(v);
  return s === undefined ? String(v) : s.length > 60 ? `${s.slice(0, 57)}...` : s;
};
const describeType = (t) => (Array.isArray(t) ? t.join(" or ") : t);

/**
 * Validates a value. schema: a schema object, or the name of one in defs.
 * Returns { ok, errors: [{ path, message }] } (at most `limit` errors).
 */
export function validate(value, schema, { defs = {}, path = "", limit = 20 } = {}) {
  const errors = [];
  const root = typeof schema === "string" ? defs[schema] : schema;
  if (!root) return { ok: false, errors: [{ path, message: `unknown schema ${show(schema)}` }] };
  check(value, root, path || (typeof schema === "string" ? schema : "value"), defs, errors, limit);
  return { ok: errors.length === 0, errors };
}

/** The errors as one sentence each: "po_line.quantity: expected a number of at least 0, got -5". */
export function formatErrors(errors) {
  return errors.map((e) => `${e.path}: ${e.message}`);
}

function check(v, s, path, defs, errors, limit) {
  if (errors.length >= limit) return;
  const fail = (message) => { if (errors.length < limit) errors.push({ path, message }); };
  for (const k of Object.keys(s)) if (!KNOWN.has(k)) { fail(`the schema uses the unsupported keyword ${k}`); return; }
  if (s.$ref) {
    const name = String(s.$ref).replace(/^#\/\$defs\//, "");
    const target = defs[name];
    if (!target) { fail(`the schema refers to an unknown definition ${s.$ref}`); return; }
    check(v, target, path, defs, errors, limit);
    return;
  }
  if (s.anyOf) {
    const ok = s.anyOf.some((alt) => { const e = []; check(v, alt, path, defs, e, 1); return e.length === 0; });
    if (!ok) fail(`expected one of ${s.anyOf.length} alternatives, got ${show(v)}`);
    return;
  }
  if (s.type !== undefined) {
    const types = Array.isArray(s.type) ? s.type : [s.type];
    if (!types.some((t) => matchesType(v, t))) { fail(`expected ${describeType(s.type)}, got ${show(v)}`); return; }
  }
  if (s.const !== undefined && JSON.stringify(v) !== JSON.stringify(s.const)) fail(`expected ${show(s.const)}, got ${show(v)}`);
  if (s.enum && !s.enum.some((x) => JSON.stringify(x) === JSON.stringify(v))) fail(`expected one of ${s.enum.map(show).join(", ")}, got ${show(v)}`);
  if (typeof v === "number") {
    if (s.minimum !== undefined && v < s.minimum) fail(`expected a number of at least ${s.minimum}, got ${v}`);
    if (s.maximum !== undefined && v > s.maximum) fail(`expected a number of at most ${s.maximum}, got ${v}`);
    if (s.exclusiveMinimum !== undefined && v <= s.exclusiveMinimum) fail(`expected a number greater than ${s.exclusiveMinimum}, got ${v}`);
    if (s.exclusiveMaximum !== undefined && v >= s.exclusiveMaximum) fail(`expected a number less than ${s.exclusiveMaximum}, got ${v}`);
  }
  if (typeof v === "string") {
    if (s.minLength !== undefined && v.length < s.minLength) fail(`expected a text of at least ${s.minLength} character(s), got ${show(v)}`);
    if (s.maxLength !== undefined && v.length > s.maxLength) fail(`expected a text of at most ${s.maxLength} characters, got ${v.length}`);
    if (s.pattern !== undefined && !new RegExp(s.pattern, "u").test(v)) fail(`expected a text matching ${s.pattern}, got ${show(v)}`);
  }
  if (Array.isArray(v)) {
    if (s.minItems !== undefined && v.length < s.minItems) fail(`expected at least ${s.minItems} item(s), got ${v.length}`);
    if (s.maxItems !== undefined && v.length > s.maxItems) fail(`expected at most ${s.maxItems} items, got ${v.length}`);
    if (s.uniqueItems && new Set(v.map((x) => JSON.stringify(x))).size !== v.length) fail("expected unique items");
    if (s.items) v.forEach((x, i) => check(x, s.items, `${path}[${i}]`, defs, errors, limit));
  }
  if (v && typeof v === "object" && !Array.isArray(v)) {
    for (const k of s.required || []) if (!(k in v)) fail(`missing the required field ${k}`);
    const props = s.properties || {};
    for (const [k, x] of Object.entries(v)) {
      const sub = `${path}.${k}`;
      if (s.propertyNames) check(k, s.propertyNames, `${sub} (name)`, defs, errors, limit);
      if (props[k]) check(x, props[k], sub, defs, errors, limit);
      else if (s.additionalProperties === false) { if (errors.length < limit) errors.push({ path: sub, message: "is not a field of this record" }); }
      else if (s.additionalProperties && typeof s.additionalProperties === "object") check(x, s.additionalProperties, sub, defs, errors, limit);
    }
  }
}
