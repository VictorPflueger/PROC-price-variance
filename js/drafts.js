// Draft finalisation shared by both producers (the live tools and the simulation player), so the
// safety lines can never differ between a live run and its replay (brief §7, rule 5): every draft
// carries the agent's footer, and a change request also says that no ERP system is connected. The
// lines are added in code, after any truncation, so no draft can lose them.

export const DRAFT_TYPES = Object.freeze(["change_request", "buyer_notice", "negotiation_brief", "tender_memo", "variance_memo"]);
export const DRAFT_FOOTER = "Prepared with the Price Variance Agent. Requires human approval before sending.";
export const MOCK_CHANGE_LINE = "Mock change request for demonstration; no ERP system is connected.";
export const MAX_BODY = 5600;

/** The kinds of draft each decision allows (brief §7, rule 5). */
export const DRAFTS_BY_OPTION = Object.freeze({
  H: Object.freeze(["change_request", "buyer_notice"]),
  R: Object.freeze(["negotiation_brief"]),
  B: Object.freeze(["tender_memo"]),
  accept: Object.freeze(["variance_memo"])
});

/** Each kind in words, for the agent's next step and the Outbox. */
export const DRAFT_WORDS = Object.freeze({
  change_request: "a mock contract or catalogue change request",
  buyer_notice: "a notice to the buyers whose lines move",
  negotiation_brief: "a negotiation brief for the buyer with the normalised evidence",
  tender_memo: "a tender request memo",
  variance_memo: "a memo recording the accepted variance and its reason"
});

export const DRAFT_LABELS = Object.freeze({
  change_request: "Change request",
  buyer_notice: "Buyer notice",
  negotiation_brief: "Negotiation brief",
  tender_memo: "Tender memo",
  variance_memo: "Variance memo"
});

/** The body as it goes into the Outbox: trimmed, with the mock line (change requests) and the footer. */
export function finalizeDraft(type, body) {
  let out = String(body || "").trim().slice(0, MAX_BODY);
  if (type === "change_request" && !out.includes(MOCK_CHANGE_LINE)) out = `${out}\n\n${MOCK_CHANGE_LINE}`;
  if (!out.includes(DRAFT_FOOTER)) out = `${out}\n\n${DRAFT_FOOTER}`;
  return out;
}
