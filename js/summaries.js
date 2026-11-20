// One-line, readable summaries of tool results for the agent console. Shared by both producers, so a
// live result and its replay read the same; every tool has its own line.

import { eur, pct, unitPrice, shortDate } from "./format.js";

const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

export function summarizeToolResult(name, r) {
  if (!r) return "No result";
  if (r.error && r.guardrail) return `Refused: ${r.error}`;
  if (r.error) return `Error: ${r.error}`;
  switch (name) {
    case "erp_get_overview":
      return `${plural(r.company_codes?.length || 0, "company code")}, ${plural(r.plants?.length || 0, "plant")}, ${plural(r.data_products?.length || 0, "data product")}; rates: ${r.rates?.label || "bundled"}`;
    case "erp_query":
      return `${plural(r.total, "row")} in ${r.product}${r.truncated ? `, first ${r.returned} shown` : ""}`;
    case "erp_get_record": {
      const rec = r.record || {};
      const what = rec.description || rec.name || rec.short_text || rec.city || r.id;
      const rel = r.related || {};
      const extra = rel.contracts ? `; ${plural(rel.contracts.length, "contract")}` : rel.contract ? `; contract ${rel.contract.id}` : r.product === "po_line" ? "; no contract" : "";
      const mpn = rel.same_manufacturer_part?.length ? `; same part number as ${rel.same_manufacturer_part.map((m) => m.id).join(", ")}` : "";
      return `${r.product} ${r.id}: ${what}${extra}${mpn}`;
    }
    case "pv_scan":
      return `${plural(r.groups, "comparable group")}, ${r.flagged} flagged; portfolio index ${pct(r.portfolio?.index)}`;
    case "pv_normalise":
      if (r.excluded) return `${r.line}: excluded (${r.reason})`;
      return `${r.line}: ${r.display} delivered${r.steps?.currency && r.steps.currency !== "EUR" ? ` (from ${r.steps.currency})` : ""}${r.steps?.logistics_uplift ? `, ${r.steps.incoterm} uplift ${pct(r.steps.logistics_uplift)}` : ""}`;
    case "pv_compare": {
      const b = r.benchmark ? `benchmark ${unitPrice(r.benchmark.price, r.display_quantity, r.base_unit)} (${r.benchmark.pair})` : "no benchmark";
      const s = r.sensitivity ? `; ${r.sensitivity.label}: ${eur(r.sensitivity.opportunity)} a year` : "";
      return `${r.label}: ${b}; spread ${pct(r.spread)}; ${eur(r.opportunity)} a year unexplained; ${r.flagged ? "flagged" : "not flagged"}${s}`;
    }
    case "pv_match": {
      const c = r.candidates || [];
      return c.length ? `${plural(c.length, "candidate")}; first ${c[0].candidate_id}: ${plural(c[0].lines.length, "line")}, units ${c[0].evidence.order_units.join(" and ")} (not comparable until confirmed)` : "No candidate cluster";
    }
    case "ui_confirm_cluster":
      if (r.decision === "rejected") return "Your confirmation: rejected, nothing is compared";
      return `Your confirmation: ${r.decision} as ${r.cluster_id} (${plural(r.line_ids?.length || 0, "line")}, base unit ${r.base_unit})`;
    case "open_ecb_rate":
      if (r.ok === false) return `Rate not fetched (${r.error}); the bundled rates stay`;
      return `ECB reference rate of ${shortDate(r.date)}: 1 EUR = ${r.per_eur} ${r.currency}`;
    case "ui_mark_board":
      return `${plural(r.marked, "mark")} on the board`;
    case "ui_report_alert":
      return `Alert shown, checked in this run: ${(r.checked || []).length} items`;
    case "ui_propose_options":
    case "ui_await_decision":
      if (r.decision === "approved") return `Your decision: approved ${r.option_id === "accept" ? `accepting the variance (${r.reason})` : `option ${r.option_id}`}`;
      if (r.decision === "rejected") return `Your decision: rejected option ${r.option_id}`;
      return "Waiting for your decision";
    case "ui_draft_action":
      return `Draft ${r.action_id} in the Outbox (nothing is sent)`;
    case "ui_await_approvals":
      return `Drafts decided: ${r.approved} approved, ${r.rejected} rejected`;
    case "ui_final_report":
      return `Report published: ${String(r.outcome || "").replace(/_/g, " ")}`;
    default:
      return typeof r.summary === "string" ? r.summary : "Result received";
  }
}
