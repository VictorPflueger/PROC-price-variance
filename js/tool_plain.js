// What a tool call does, in one plain sentence for the console ("Reads Lyon's order lines for material
// 20001001"). The tool's own name and arguments stay one click away; this line is for the audience,
// written by code, never by the model (brief §7, rule 8). Pure (the world is passed in), so the tests
// can check it in Node. The Timetable Translator's js/tool_plain.js is the pattern.

import { indexOf } from "./erp.js";

const PRODUCT_WORDS = {
  po_line: "order lines", material: "materials", supplier: "supplier accounts", contract: "contracts", plant: "plants",
  company_code: "company codes", buyer: "buyers", material_group: "material groups", fx_rate: "exchange rates",
  value_log: "approved options of the value log"
};

/** The sentence for one tool call, or null for a tool without one (the console then shows the name only). */
export function toolPlain(name, input = {}, world = null) {
  const i = input && typeof input === "object" ? input : {};
  const ix = world ? indexOf(world) : null;
  const plant = (id) => (ix?.plant.get(String(id))?.city || String(id)).replace(" am Main", "");
  const supplier = (id) => ix?.supplier.get(String(id))?.name || `supplier ${id}`;
  const material = (id) => ix?.material.get(String(id))?.description || `material ${id}`;
  const filter = (f) => (Array.isArray(i.filters) ? i.filters.find((x) => x.field === f && (x.op === "eq" || x.op === "in")) : null);
  switch (name) {
    case "erp_get_overview":
      return "Reads the company overview: plants, data products, exchange rates and the method's parameters";
    case "erp_query": {
      const what = PRODUCT_WORDS[i.product] || i.product || "rows";
      const parts = [];
      const p = filter("plant");
      if (p) parts.push(`of ${String(p.value).split(",").map((x) => plant(x.trim())).join(" and ")}`);
      const m = filter("material");
      if (m && !String(m.value).includes(",")) parts.push(`for ${material(m.value)}`);
      const s = filter("supplier");
      if (s && !String(s.value).includes(",")) parts.push(`${i.product === "contract" ? "of" : "from"} ${supplier(s.value)}`);
      const text = Array.isArray(i.filters) ? i.filters.find((x) => x.op === "contains") : null;
      if (text) parts.push(`matching "${String(text.value).slice(0, 40)}"`);
      return `Reads the ${what}${parts.length ? ` ${parts.join(" ")}` : ""} in the ERP data`;
    }
    case "erp_get_record": {
      const what = { po_line: "order line", material: "material", supplier: "supplier account", contract: "contract", plant: "plant", buyer: "buyer", value_log: "value-log entry" }[i.product] || i.product;
      return `Opens ${what} ${i.id} with its related records`;
    }
    case "pv_scan":
      return "Ranks every comparable group by its unexplained price variance (engine)";
    case "pv_normalise": {
      const l = ix?.po_line.get(String(i.line_id));
      return l
        ? `Normalises one of ${plant(l.plant)}'s lines step by step: price unit, unit of measure, currency, delivery terms (engine)`
        : "Normalises one order line step by step (engine)";
    }
    case "pv_compare": {
      const id = String(i.group_id || "");
      const label = ix?.material.get(id)?.description || (id.startsWith("MPN:") ? `part number ${id.split(":").slice(2).join(":")}` : id.startsWith("CL-") ? `the confirmed cluster ${id}` : id);
      return i.at_rate_of
        ? `Recalculates ${label} at the refreshed ECB rate, as a labelled sensitivity (engine)`
        : `Calculates ${label}: benchmark, gaps, the unexplained part and the options (engine)`;
    }
    case "pv_match":
      return "Looks for free-text lines that may be the same service (only a person can confirm it)";
    case "ui_confirm_cluster":
      return "Asks you to confirm whether these lines are the same service, and in which unit";
    case "open_ecb_rate":
      return `Fetches the ECB reference rate for ${i.currency || "the currency"}${i.date ? ` of ${i.date}` : ""} through Frankfurter`;
    case "ui_mark_board":
      return "Marks what it is looking at on the price board";
    case "ui_report_alert":
      return "Raises the alert, with what it checked in this run";
    case "ui_propose_options":
      return "Puts the costed options on screen and waits for your decision";
    case "ui_await_decision":
      return "Waits for your decision";
    case "ui_draft_action":
      return "Drafts a document for the Outbox (nothing is sent)";
    case "ui_await_approvals":
      return "Waits for your approval of the drafts";
    case "ui_final_report":
      return "Writes the report";
    default:
      return null;
  }
}
