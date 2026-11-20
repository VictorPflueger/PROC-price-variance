// A run as the presenter needs it. The simulation player and the live agent emit the same events on
// the bus (js/events.js); digest() reads them in order and sorts what happened into the five steps.
// Pure module: the page feeds it the bus, the tests the events of js/sim_check.js's playPath.
//
// The agent's words go to the step it is working on when it says them. Its progress only moves
// forward: comparing or normalising lines is step 2 (Like for like), looking up the best price's
// contract or raising the alert step 3 (The gap), the options step 4, a decision step 5. Every decision a
// person takes also goes into the log, with its time: who approved what.

export const STEP_IDS = ["tip", "compare", "gap", "decide", "drafts"];
const STEP_OF_TOOL = { pv_compare: 1, pv_normalise: 1, pv_match: 1, open_ecb_rate: 1, ui_confirm_cluster: 1, ui_report_alert: 2, ui_propose_options: 3 };

export function digest(events) {
  const r = {
    narration: [], calls: [], normalised: [], compare: null, sensitivity: null, alert: null, confirmation: null, confirmed: null,
    options: null, decision: null, rejected: [], drafts: [], report: null, cost: null, state: null, end: null, notices: [], reached: 0,
    log: []
  };
  const said = new Map();
  const calls = new Map();
  let cursor = 0;
  for (const e of events) {
    const p = e.payload || {};
    switch (e.type) {
      case "narration": {
        const m = said.get(p.msg_id) || { step: cursor };
        m.text = p.text;
        said.set(p.msg_id, m);
        break;
      }
      case "tool_call": {
        const contract = p.name === "erp_query" && p.input?.product === "contract" && cursor >= 1;
        cursor = Math.max(cursor, contract ? 2 : STEP_OF_TOOL[p.name] ?? 0);
        const c = { id: p.call_id, name: p.name, input: p.input, plain: p.plain, step: cursor };
        calls.set(p.call_id, c);
        r.calls.push(c);
        break;
      }
      case "tool_result": {
        const c = calls.get(p.call_id);
        if (c) Object.assign(c, { ok: p.ok, result: p.result, guard: p.guard || null });
        if (p.ok && p.name === "pv_compare" && p.detail?.analysis) { r.compare = p.detail.analysis; r.sensitivity = p.detail.sensitivity || r.sensitivity; }
        if (p.ok && p.name === "pv_normalise" && p.result && !p.result.excluded) r.normalised.push(p.result);
        if (p.ok && p.name === "ui_confirm_cluster") r.confirmed = p.result;
        break;
      }
      case "alert": r.alert = p; cursor = Math.max(cursor, 2); break;
      case "confirmation_request": r.confirmation = p; break;
      case "options": r.options = p; r.rejected = []; cursor = Math.max(cursor, 3); break;
      case "option_decision":
        if (p.decision === "approved") { r.decision = p; cursor = 4; } else r.rejected.push(p.option_id);
        r.log.push({ at: e.ts || null, kind: "option", ...p });
        break;
      case "confirmation_decision": r.log.push({ at: e.ts || null, kind: "confirmation", ...p }); break;
      case "action_draft": r.drafts.push({ ...p }); cursor = Math.max(cursor, 4); break;
      case "action_decision": {
        const d = r.drafts.find((x) => x.action_id === p.action_id);
        if (d) d.status = p.decision;
        r.log.push({ at: e.ts || null, kind: "draft", ...p, type: d?.type || null });
        break;
      }
      case "report": r.report = p; break;
      case "cost_update": r.cost = p; break;
      case "state_change": r.state = p.state; break;
      case "notice": r.notices.push(p); break;
      case "run_end": r.end = p; break;
      default: break;
    }
    r.reached = Math.max(r.reached, cursor);
  }
  r.narration = [...said.values()].filter((m) => m.text && m.text.trim());
  return r;
}
