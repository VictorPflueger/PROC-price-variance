// Extracts GlobalCorp SE's vendor accounts from Rebate Hunter's world into tools/source/accounts.json,
// once, so the two procurement prototypes (and the Data Quality Agent, decision N1) tell one story.
//
// Rule (brief §8.1): keep the accounts that belong to none of the five real corporate groups, neither by
// group key nor as members in the subscription register: 143 accounts. Of each group of accounts that
// share a normalised name and country (17 groups), keep the lowest id: 124 accounts. Names are
// normalised by the Data Quality Agent's rule: lower case, dots removed, every other character that is
// not a letter or a digit a space, the legal-form tokens dropped. Each account keeps its id, name, city,
// country, currency, category and company code; the invented tax id and the bank's last four digits
// are dropped, because no bank account appears in this world.
//
// Usage: node tools/extract_accounts.mjs [path to a PROC-Rebate-Hunter checkout]   (default ../PROC-Rebate-Hunter)
// The world builder reads the extract, never Rebate Hunter's repository.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.resolve(process.argv[2] || path.join(ROOT, "..", "PROC-Rebate-Hunter"));
const worldFile = path.join(source, "data", "world.js");
if (!existsSync(worldFile)) { console.error(`No Rebate Hunter world at ${worldFile}`); process.exit(2); }

export const LEGAL_FORMS = ["gmbh", "ag", "se", "sa", "sas", "sarl", "ltd", "limited", "plc", "bv", "nv", "spa", "srl", "kg", "co", "inc"];
/** The Data Quality Agent's name rule. */
export function normaliseName(name) {
  return String(name).toLowerCase().replace(/\./g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim()
    .split(/\s+/).filter((t) => t && !LEGAL_FORMS.includes(t)).join(" ");
}

const text = readFileSync(worldFile, "utf8");
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(text, sandbox);
const W = sandbox.window.WORLD;

let commit = null;
try { commit = execFileSync("git", ["-C", source, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim(); } catch { commit = null; }

const realGroups = new Set(W.groups.filter((g) => g.real).map((g) => g.id));
const registered = new Set(W.register.filter((r) => realGroups.has(r.group)).map((r) => r.vendor));
// A real group's key is the group key its registered members carry (CISCO, MICROSOFT, ...).
const realKeys = new Set(W.vendors.filter((v) => registered.has(v.id) && v.group_key).map((v) => v.group_key));
const outside = W.vendors.filter((v) => !registered.has(v.id) && !(v.group_key && realKeys.has(v.group_key)));

const byKey = new Map();
for (const v of outside) {
  const key = `${normaliseName(v.name)}|${v.country}`;
  byKey.set(key, [...(byKey.get(key) || []), v]);
}
const numeric = (a, b) => Number(a.id) - Number(b.id) || a.id.localeCompare(b.id);
const duplicateGroups = [...byKey.values()].filter((vs) => vs.length > 1);
const kept = [...byKey.values()].map((vs) => [...vs].sort(numeric)[0]).sort(numeric);
const dropped = duplicateGroups.flatMap((vs) => {
  const [keep, ...rest] = [...vs].sort(numeric);
  return rest.map((v) => ({ id: v.id, kept: keep.id, name: v.name, country: v.country }));
}).sort(numeric);

const counts = { vendors: W.vendors.length, outside_real_groups: outside.length, duplicate_name_groups: duplicateGroups.length, kept: kept.length };
const expected = { vendors: 161, outside_real_groups: 143, duplicate_name_groups: 17, kept: 124 };
const off = Object.keys(expected).filter((k) => counts[k] !== expected[k]);
if (off.length) {
  console.error(`The counts differ from the brief's: ${off.map((k) => `${k} ${counts[k]} (expected ${expected[k]})`).join(", ")}`);
  process.exit(1);
}
const nonEuro = kept.filter((v) => v.currency !== "EUR");
if (nonEuro.length) { console.error(`Accounts outside the real groups that do not invoice in euros: ${nonEuro.map((v) => v.id).join(", ")}`); process.exit(1); }

const doc = {
  about: "GlobalCorp SE's vendor accounts outside the five real corporate groups of Rebate Hunter's world, one per duplicate-name group (the lowest id). Fictional, like the company. Shared with the Data Quality Agent (decision N1); written by tools/extract_accounts.mjs.",
  source: { repository: "PROC-Rebate-Hunter", file: "data/world.js", commit, world_version: W.meta?.world_version ?? null, sha256: createHash("sha256").update(text).digest("hex") },
  rule: {
    real_groups: [...realGroups].sort(),
    excluded: "accounts with a real group's key or a register entry in a real group",
    name_normalisation: "lower case; dots removed; every other character that is not a letter or a digit a space; legal-form tokens dropped",
    legal_forms: LEGAL_FORMS,
    duplicates: "one account per normalised name and country: the lowest id",
    fields_dropped: ["tax_id", "bank", "spend", "open_payables_eur", "group_key", "origin"]
  },
  counts,
  company_codes: W.company_codes.map(({ id, code, name, city, country, currency }) => ({ id, code, name, city, country, currency })),
  accounts: kept.map(({ id, name, city, country, currency, category, company_code }) => ({ id, name, city, country, currency, category, company_code })),
  dropped_duplicates: dropped
};
const out = path.join(ROOT, "tools", "source", "accounts.json");
writeFileSync(out, `${JSON.stringify(doc, null, 2)}\n`);
console.log(`EXTRACT OK: ${counts.kept} accounts (${counts.outside_real_groups} outside the real groups, ${counts.duplicate_name_groups} duplicate-name groups) from Rebate Hunter ${commit ?? "(no git)"} -> ${path.relative(ROOT, out)}`);
