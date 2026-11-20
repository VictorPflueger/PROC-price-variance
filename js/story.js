// The five steps and the four key figures, built from a run (js/run.js) and the company data. Every
// figure comes from the engine's results in the run; this module only chooses and words them.
// Pure module: the page renders what it returns, and the tests check its words and figures in Node.

import { DEFAULTS } from "./params.js";
import { DRAFT_LABELS } from "./drafts.js";
import { asBooked, freightLeftOut, liveWords, money, noun, pct, perUnit, place, plain, plural, rate, supplierName, unitName, who } from "./plain.js";

const EPS = 1e-9;
const eur0 = (x) => money(x, "EUR", 0);
const words = (t) => (String(t).match(/\S+/g) || []).length;
const LABELS = ["The tip", "Like for like", "The gap", "Your decision", "The drafts"];
const IDS = ["tip", "compare", "gap", "decide", "drafts"];

/** The most frequent way a pair's lines are booked, as one representative order line. */
function typicalLine(lines) {
  const count = new Map();
  for (const l of lines) {
    const k = [l.net_price, l.price_unit, l.order_unit, l.currency, l.incoterm].join("|");
    count.set(k, [...(count.get(k) || []), l]);
  }
  return [...count.values()].sort((a, b) => b.length - a.length || b[0].order_day - a[0].order_day)[0][0];
}

/**
 * story({ world, scenario, run, mode, params }) → { case, steps[5], kpis, decided, finished }
 * run: digest(events) of js/run.js. mode: "simulation" or "live".
 */
export function story({ world, scenario, run, mode = "simulation", params = DEFAULTS }) {
  const a = run.compare;
  const lineById = new Map(world.po_line.map((l) => [l.id, l]));
  const material = a ? world.material.find((m) => m.id === a.id) : null;
  const conversions = material?.conversions || {};
  const ctx = { world, groupId: a?.id, baseUnit: a?.base_unit || "EA" };
  const titles = Object.fromEntries((run.options?.options || []).map((o) => [o.id, plain(o.title, { world, groupId: a?.id, baseUnit: a?.base_unit || "EA" })]));
  const say = (t) => plain(t, ctx).replace(/\b[Oo]ption ([HRB])\b/g, (m, id) => (titles[id] ? `“${titles[id]}”` : m));
  const price = (p) => (a ? perUnit(p, a.display_quantity, a.base_unit, a.id) : "");
  const agent = (i) => run.narration.filter((m) => m.step === i).map((m) => say(m.text));
  const working = run.end ? null : run.calls.at(-1)?.plain || null;
  const pairs = a ? a.pairs.map((p) => {
    const lines = p.lines.map((id) => lineById.get(id)).filter(Boolean);
    const typical = typicalLine(lines);
    return {
      id: p.id, who: who(world, p.plant, p.supplier), plant: place(world, p.plant), supplier: supplierName(world, p.supplier),
      contract: lines.some((l) => l.contract), booked: asBooked(typical, conversions, a.base_unit), freight: freightLeftOut(typical.incoterm),
      orders: lines.length, price: p.price, share: p.share, unexplained: p.unexplained, justified: p.justified, eligible: p.eligible
    };
  }) : [];
  const best = a?.benchmark ? pairs.find((p) => p.id === a.benchmark.pair) : null;
  const highest = a?.highest ? pairs.find((p) => p.id === a.highest.pair) : null;
  const opts = run.options;
  const decided = run.decision ? opts?.options.find((o) => o.id === run.decision.option_id) : null;
  const stopped = run.report?.outcome === "stopped" || (run.confirmed && run.confirmed.decision === "rejected");
  const negative = !!a && !a.flagged;
  // A step the agent has not reached: it is working on it, or the run ended first.
  const pending = run.end ? { kind: "empty", text: "The run stopped before this step." } : { kind: "wait" };
  const steps = [];

  // 1 The tip: the hint as it came in, and every order of the item as booked.
  const orders = a ? a.lines.length + a.excluded.length : 0;
  const kind = a?.kind === "mpn" ? "one manufacturer part number" : a?.kind === "cluster" ? "one service you confirmed" : "one item number";
  steps.push({
    title: `“${scenario.seed}”`,
    lead: a
      ? `A first hint, not a fact. ${plural(orders, "order")} of the last 12 months share ${kind}: ${plural(new Set(pairs.map((p) => p.plant)).size, "plant")}, ${plural(new Set(pairs.map((p) => p.supplier)).size, "supplier")}, ${new Set(a.lines.map((l) => lineById.get(l.id)?.currency)).size === 1 ? "one currency" : `${new Set(a.lines.map((l) => lineById.get(l.id)?.currency)).size} currencies`}.`
      : "A first hint, not a fact. The agent finds every order it is about before it believes anything.",
    stage: a ? { kind: "booked", rows: pairs.slice().sort((x, y) => x.plant.localeCompare(y.plant) || x.supplier.localeCompare(y.supplier)) }
      : run.confirmation ? { kind: "booked", rows: grouped(run.confirmation.lines.map((l) => ({ who: who(world, l.plant, l.supplier), booked: asBooked(lineById.get(l.id) || l), text: lineById.get(l.id)?.short_text || "" }))) }
        : pending
  });

  // 2 Like for like: one order converted step by step, then every price in the same unit.
  const confirm = run.confirmation && !run.confirmed ? run.confirmation : null;
  const shown = run.normalised.slice().sort((x, y) => weight(y) - weight(x))[0] || null;
  let card = null;
  if (shown && a) {
    const line = lineById.get(shown.line);
    const st = shown.steps;
    const d = a.display_quantity;
    const f = st.base_units_per_order_unit;
    const per = d > 1 ? `${d.toLocaleString("en-GB")} ${noun(a.id, a.base_unit)}` : unitName(a.base_unit, {}, a.base_unit);
    card = {
      who: who(world, shown.plant, shown.supplier),
      rows: [
        { label: "As booked", value: asBooked(line, conversions, a.base_unit), note: line.urgent ? "an urgent order" : "" },
        { label: `Per ${per}`, value: money(st.price_per_base_unit * d, st.currency), note: f === 1 && Number(line.price_unit || 1) === 1 ? "same unit" : f < 1 ? `a ${per} is ${1 / f} ${unitName(line.order_unit, {}, a.base_unit, 2)}` : `a ${unitName(line.order_unit, conversions, a.base_unit).replace(/ of [\d,]+$/, "")} holds ${f.toLocaleString("en-GB")}` },
        { label: "In euros", value: money(st.price_per_base_unit_eur * d), note: st.currency === "EUR" ? "already in euros" : `at ${rate(st.rate_to_eur, st.currency)}, the ECB's mean over 12 months` },
        ...(st.incoterm ? [{ label: "Delivered", value: money(st.normalised_price_eur * d), note: st.logistics_uplift > 0 ? `+${pct(st.logistics_uplift)}: ${st.incoterm} leaves the freight to the buyer` : `${st.incoterm} includes the freight` }] : [])
      ]
    };
    card.changed = weight(shown) > 0;
    card.title = `${place(world, shown.plant)}'s ${card.rows[1].value} is ${card.rows.at(-1).value} ${st.logistics_uplift > 0 ? "delivered" : "in euros"}`;
  }
  const lines = a ? a.lines.map((l) => lineById.get(l.id)).filter(Boolean) : [];
  const clauses = a ? [
    lines.some((l) => l.order_unit !== a.base_unit || Number(l.price_unit || 1) !== 1) ? (["H", "DAY", "PD"].includes(a.base_unit) ? `hours at ${params.person_day_hours} to a person-day` : "pack size") : null,
    lines.some((l) => l.currency !== "EUR") ? "the currency at the ECB's mean rate over 12 months" : null,
    lines.some((l) => freightLeftOut(l.incoterm)) ? `${pct(params.logistics_uplift)} for freight the supplier leaves out` : null
  ].filter(Boolean) : [];
  const unitPhrase = a ? (a.display_quantity > 1 ? `per ${a.display_quantity} ${noun(a.id, a.base_unit)}` : a.base_unit === "EA" ? "a piece" : `per ${unitName(a.base_unit, {}, a.base_unit)}`) : "";
  steps.push({
    title: confirm ? "Only you can say these are the same service" : stopped && !a ? "Not the same service: nothing is compared" : card?.changed ? card.title : "Every price is already in euros and delivered",
    lead: confirm
      ? say(confirm.note) || "Similar texts never make lines comparable. Confirm the cluster, or reject it."
      : !a ? "To compare, the engine brings every price to the same unit, in euros, delivered."
        : clauses.length ? `To compare, the engine brings every price to euros ${unitPhrase}${a.base_unit === "EA" ? ", delivered" : ""}: ${clauses.length > 1 ? `${clauses.slice(0, -1).join(", ")} and ${clauses.at(-1)}` : clauses[0]}.`
          : `The orders already price the item in euros ${unitPhrase}${a.base_unit === "EA" ? ", delivered" : ""}, so the engine compares them as they are.`,
    stage: confirm
      ? { kind: "confirm", request: confirm, rows: confirm.lines.map((l) => ({ id: l.id, text: l.short_text || l.text || "", plant: place(world, l.plant), booked: asBooked(lineById.get(l.id) || l, {}, confirm.proposed_base_unit), language: l.language || "" })), units: confirm.base_units, unit: confirm.proposed_base_unit }
      : a ? { kind: "normalise", card, rows: pairs.slice().sort((x, y) => x.price - y.price).map((p) => ({ ...p, comparable: price(p.price) })), excluded: a.excluded.length } : pending
  });

  // 3 The gap: the best price at volume sets the bar; the rest is a gap, justified or not.
  const allowance = a && a.justified > EPS ? ` Urgent orders with a recorded reason may pay up to ${pct(params.urgent_allowance)} more: that covers ${eur0(a.justified)} a year.` : "";
  steps.push({
    title: !a ? "The gap" : negative ? `Nothing worth acting on: ${eur0(a.opportunity)} a year` : `${eur0(a.opportunity)} a year that no reason explains`,
    lead: !a ? "" : negative
      ? `Below ${eur0(params.materiality_eur)} a year or a ${pct(params.materiality_spread)} spread, the agent proposes nothing. Here the dearest pays ${pct(a.spread, 1)} above the best price.`
      : `The best price the group already pays at volume sets the bar: ${best.plant}'s${best.contract ? " contract at" : ""} ${price(best.price)}.${allowance}`,
    stage: a ? {
      kind: "gap", best: a.benchmark ? price(a.benchmark.price) : null, unit: `€ ${unitPhrase}${a.base_unit === "EA" ? ", delivered" : ""}`,
      bars: pairs.slice().sort((x, y) => x.price - y.price).map((p) => ({
        who: p.who, value: p.price, label: money(p.price * a.display_quantity), unexplained: p.unexplained, justified: p.justified,
        best: p === best, small: !p.eligible && p.price < (a.benchmark?.price ?? 0), share: p.share
      })),
      min: Math.min(...pairs.map((p) => p.price)), max: Math.max(...pairs.map((p) => p.price)), bar: a.benchmark?.price ?? null,
      minShare: params.benchmark_min_share
    } : pending
  });

  // 4 Your decision: the costed options next to accepting the gap.
  const cards = opts ? opts.options.map((o) => ({
    id: o.id, title: say(o.title), risk: say(o.residual_risk), savings: o.savings, oneOff: o.one_off, days: o.days_to_first_saving,
    residual: o.residual, recommended: o.id === opts.recommended, reasons: o.reasons || null,
    status: run.decision?.option_id === o.id ? "approved" : run.rejected.includes(o.id) ? "rejected" : run.decision ? "closed" : "open"
  })) : [];
  const rec = cards.find((c) => c.recommended);
  steps.push({
    title: decided ? (decided.id === "accept" ? "You accepted the gap" : `Approved: ${say(decided.title)}`) : opts ? "Approve one way to close the gap" : "Nothing to decide",
    lead: decided
      ? (decided.id === "accept" ? `Nothing changes for the suppliers, and ${eur0(decided.residual)} a year stays unexplained. Reason: ${run.decision.reason}.` : "Approved is a decision, not a saving: the euros count as realised only when later orders show them.")
      : opts ? `${cards.length - 1 === 1 ? "One costed option" : `${cards.length - 1} costed options`} next to accepting the gap. The agent recommends the one with the highest savings after its one-off cost; you decide.`
        : stopped ? "You said the lines are not the same service, so nothing is compared or proposed." : negative ? "The gap is below what is worth acting on, so the agent proposes nothing." : "The options follow the gap.",
    recommendation: rec && !decided ? `Recommended: ${rec.title}. ${say(opts.reason)}` : null,
    stage: opts ? { kind: "options", cards } : { kind: "empty", text: stopped || negative ? "Nothing to decide in this case." : "The options appear once the agent has found the gap." }
  });

  // 5 The drafts: what the decision allows, each waiting for a person.
  const drafts = run.drafts.map((d) => ({
    id: d.action_id, label: DRAFT_LABELS[d.type] || d.type, to: say(d.recipient), subject: say(d.subject), body: say(d.body), status: d.status || "pending"
  }));
  const open = drafts.filter((d) => d.status === "pending").length;
  // Nothing to decide: the honest negative, or a cluster the person said is not one service.
  const none = !decided && !opts && (negative || stopped);
  steps.push({
    title: none ? "No drafts: there was nothing to decide" : !decided ? "Drafts follow your decision" : !drafts.length ? "Drafting…" : open ? `${plural(drafts.length, "draft")} ${drafts.length === 1 ? "waits" : "wait"} for your approval` : `${drafts.filter((d) => d.status === "approved").length} of ${plural(drafts.length, "draft")} approved, nothing sent`,
    lead: none ? "The agent drafts only what a decision allows, so this case ends with its finding." : !decided ? "Approve an option in step 4, and the agent drafts what it allows." : "The agent drafts only what your decision allows. Approving clears a draft for a person to send; nothing leaves this page.",
    stage: decided ? { kind: "drafts", drafts, outcome: run.report ? `Report filed: ${decided.id === "accept" ? "the gap accepted with its reason" : `${say(decided.title).replace(/^./, (c) => c.toLowerCase())}, approved`}. Nothing was sent.` : null } : { kind: "empty", text: none ? "Nothing to draft in this case." : "No drafts yet." }
  });

  // A step waits for the person when its own click comes next: confirming the cluster, approving an
  // option, deciding the drafts. Then that click is the step's one primary action, not Next, and the
  // step says whose turn it is and what to do (turn), above the action.
  const waits = [false, !!confirm, false, !!opts && !decided, !!decided && open > 0];
  const turns = [null, "Say whether these orders are the same service. Only you can.", null,
    "Approve one way to close the gap, or accept the gap with a reason.",
    open > 1 ? "Approve or reject each draft. Nothing is sent." : "Approve or reject the draft. Nothing is sent."];
  steps.forEach((s, i) => Object.assign(s, { id: IDS[i], label: LABELS[i], agent: agent(i), ready: ready(i), waits: waits[i], turn: waits[i] ? turns[i] : null }));
  if (confirm) for (const i of [2, 3, 4]) Object.assign(steps[i], { title: LABELS[i], lead: "First say in step 2 whether the orders are the same service. Then the engine compares them.", agent: [], recommendation: null, waits: false, turn: null, stage: { kind: "empty", text: "Waits for your answer in step 2." } });
  // How long Play stays on a step: the time to read its title and lead, between 7 and 14 seconds.
  for (const s of steps) s.read = Math.min(14000, Math.max(7000, 3000 + 230 * words(`${s.title} ${s.lead}`)));
  if (working && mode === "live") steps[Math.min(run.reached, 4)].working = say(working);

  // A step the run has not reached is closed: in a live run while the agent works, in either mode
  // past a decision still open (Next cannot pass it).
  function ready(i) {
    return i <= run.reached || (i === 4 && !!decided) || !!run.end;
  }

  // A live run that ended before its report says why, in the agent's own words where it gave them.
  const ended = run.end && !["done", "no_findings"].includes(run.end.status) && mode === "live"
    ? { status: run.end.status, text: liveWords(run.end.reason === "See the message above." ? run.notices.filter((n) => n.level === "error").at(-1)?.text || "" : run.end.reason || "") }
    : null;
  return { case: { id: scenario.id, title: scenario.title, tip: scenario.seed, noun: a ? noun(a.id, a.base_unit) : "units" }, steps, kpis: kpis(), log: log(), ended, decided: !!decided, finished: !!run.report || !!run.end };

  /** Who approved what, and when: every decision on the page, in order. */
  function log() {
    const draftOf = new Map(run.drafts.map((d) => [d.action_id, d]));
    return (run.log || []).map((e) => {
      let what;
      if (e.kind === "option") {
        what = e.option_id === "accept" ? `accepted the gap: ${e.reason}` : `${e.decision} “${titles[e.option_id] || say(e.option_label || "")}”`;
      } else if (e.kind === "confirmation") {
        what = e.decision === "confirmed" ? "confirmed the orders are one service" : "said the orders are not one service";
      } else {
        const type = e.type || draftOf.get(e.action_id)?.type;
        what = `${e.decision} the ${(DRAFT_LABELS[type] || "draft").toLowerCase()}`;
      }
      return { at: e.at, who: e.by === "user" || !e.by ? "You" : e.by, what };
    });
  }

  function kpis() {
    return {
      unexplained: a ? {
        value: eur0(a.opportunity), after: decided && decided.id !== "accept" ? eur0(decided.residual) : null,
        tone: decided && decided.id !== "accept" ? "done" : !decided && a.flagged ? "gap" : "",
        note: decided ? (decided.id === "accept" ? "you accepted it with a reason" : `${eur0(decided.savings)} a year approved`)
          : negative ? `below ${eur0(params.materiality_eur)} a year` : "at today's volume"
      } : null,
      highest: a && highest && best ? { value: `+${pct(a.spread)}`, note: `${highest.plant} ${money(highest.price * a.display_quantity)}, best ${money(best.price * a.display_quantity)}` } : null,
      clockNote: decided ? "until your decision" : negative ? "nothing worth a decision" : stopped ? "stopped at your answer" : "running since the tip",
      waiting: confirm ? "waits for your confirmation" : stopped ? "nothing compared" : run.end ? "the run stopped first" : null,
      empty: run.end && !confirm ? "n/a" : "…"
    };
  }
}

/** Rows that read the same, once, with how many orders they stand for. */
function grouped(rows) {
  const out = new Map();
  for (const r of rows) {
    const k = `${r.who}|${r.booked}|${r.text}`;
    out.set(k, { ...r, orders: (out.get(k)?.orders || 0) + 1 });
  }
  return [...out.values()];
}

/** Which normalised order shows the conversion best: one with freight added, then one in another currency. */
function weight(n) {
  return (n.steps.logistics_uplift > 0 ? 2 : 0) + (n.steps.currency !== "EUR" ? 1 : 0);
}
