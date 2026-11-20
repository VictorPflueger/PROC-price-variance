# Price Variance Agent: the five-minute demo

**Goal.** After five minutes the room can repeat one sentence: *"It finds where we pay different prices
for the same thing, proves that the prices are comparable, prices the part no reason explains, and lets a
person decide what happens next, without calling anything saved before later orders show it."*

**The run.** Scenario 1, **Gloves at three sites**, marked *Start here* in the console's scenario list, as
a **Simulation at ×1**. The tip says that Lyon seems to pay far more for nitrile gloves than Frankfurt. The
agent checks it against the order lines, finds that Birmingham, cheapest as booked, is not cheap once its
price is in euros and delivered, takes Frankfurt's contract price of €6.90 per 100 EA as the benchmark and
finds €14,146 a year that nothing explains. At ×1 the decision waits about half a minute after Start, and
the whole run takes about a minute and a half when every answer comes at once (`tests/sims.mjs` timing
measures this on every change); the rest of the five minutes belongs to the room.

**Live instead.** With a key you rehearsed, the same scenario runs live on Sonnet 5.5. The agent words
things its own way and takes longer; the figures are the engine's and the same as in the simulation. Use
Live only after a full rehearsal on the same laptop and network.

---

## Pre-flight

Thirty minutes before, on the presentation laptop and network:

1. Open the site in Chrome or Edge and hard-reload (**Ctrl + Shift + R**). On a first visit the window
   **How the Price Variance Agent works** opens by itself; close it. Close other tabs, silence
   notifications, plug in the power and disable sleep.
2. Click **Diagnostics → Run all tests.** The footer must read **Price Variance Agent 1.0.0**. *Golden
   cases*, *Simulation scripts* and *Key and privacy* must pass. The *Anthropic API* and *ECB reference
   rates (Frankfurter)* rows matter only for Live: a failing rate row is harmless, because the bundled
   rates stay in use and the console says so.
3. Play the scenario once at **×4** to refresh the flow in your head, then click **Reset**.
4. Set the stage: scenario 1 (*Start here*) in the console, **Replay ×1** in the control bar, **Larger
   text** in the console's header, the light theme (the sun in the header), full screen (**F11**). The
   status pill reads **Idle** and the board shows the value pipeline.
5. For a live run: enter the key in this tab (Start agent → **Continue with my API key** → paste →
   **Check key and continue**), do one full rehearsal, then **Reset** and keep the tab open. Never show the
   key on the projector or paste it into chat or slides.

## The five-minute version

| Time | Segment | On screen |
| --- | --- | --- |
| 0:00–0:40 | The tip | The idle workspace: the tip in the console, the value pipeline on the board, the four tiles |
| 0:40–1:20 | Half a minute of checking | Mode dialog, then the console checks and the board turns to the gloves' price ladder |
| 1:20–2:30 | Like for like | The ladder: the benchmark, Lyon's unexplained part, Birmingham's line normalised step by step |
| 2:30–3:30 | Your decision | The options in the drawer; approve the recommended one |
| 3:30–4:15 | Your approval | The Outbox: a mock change request and a buyer notice, each approved |
| 4:15–5:00 | When a saving is real | The Approved savings tile, the value pipeline, the report and the audit export |

### 1. The tip (0:00–0:40)

On screen: the board's portfolio view with the value pipeline. Two earlier decisions are on it: €11,400 a
year approved, €8,000 implemented, €2,100 realised to date, and one leakage line.

> "GlobalCorp is a fictional industrial group with plants in Frankfurt, Duisburg, Birmingham and Lyon. They
> buy the same gloves, hoses and pallets at every plant, from different suppliers, in two currencies, on
> different delivery terms. At the bottom of the board you see what earlier decisions are worth: approved,
> implemented and realised are kept apart, and only €2,100 has actually shown up in later orders."

Point at the console: *Lyon seems to pay far more for nitrile gloves than Frankfurt.*

> "This is how a price gap usually arrives: as a hunch. Let's see whether it survives the question every
> buyer asks: is that really the same thing at a comparable price?"

### 2. Half a minute of checking (0:40–1:20)

Click **Start agent**. In the mode dialog, click **Run simulation**.

> "Simulation is an authored replay through the same tools and guardrails as the live agent. The engine
> recalculates every figure from the company's data while it plays, and the tape says SIMULATION
> everywhere. With my own key the same run goes live."

Let it run; say one line per moment:

- *Hypothesis* in the console: "It states what it believes and checks it before it believes it."
- The board turns to the gloves' price ladder, the lines the agent reads pulse: "One material number at
  every plant, so these lines may be compared."
- *Revised*: "Birmingham looked cheapest as booked, but in pounds, per case of a thousand and without the
  freight. It normalises that line before it trusts it."
- The alert card, and the rail's **Propose** step in merlot, *Your decision*: "Only now, with three lines
  normalised and the benchmark supplier's contract looked up, does it raise a verified alert. Merlot means
  it is our turn."

### 3. Like for like (1:20–2:30)

Click **Hide** on the drawer to give the ladder the whole board.

> "One row per plant and supplier. The ink line is the benchmark: €6.90 per 100 EA, the price Frankfurt
> already pays on contract, at volume. Lyon buys off contract at €9.80 per 100 EA; red with a cross is
> what it pays above the benchmark without a reason: €12,351 a year. The hatched part is a reason: urgent
> orders with a recorded reason, up to an allowance."

Click Birmingham's row, then one of its lines, to open its normalisation.

> "£62 per case of a thousand, free carrier. That is 6.2 pence a glove, €0.072 at the year's mean ECB
> rate, plus 5 % for the freight the terms leave to us: €7.56 per 100 EA delivered. Cheapest as booked, not
> cheapest delivered. Every line on this board opens like this."

Press **Escape** to go back. If someone asks about the €6.00 row at Duisburg: it is 20,000 gloves, under
2 % of the quantity, and a benchmark must be a price the group pays at volume (at least 10 %).

### 4. Your decision (2:30–3:30)

Click **Review options** in the console. The drawer opens on three options next to accepting the variance.

> "Three costed ways to close the gap. H moves Lyon and Duisburg to the contract supplier: €12,501 a year
> for €2,400 once, first saving after 30 days; Birmingham stays, because that supplier does not deliver to
> the UK. R renegotiates every price above the benchmark, B tenders the whole volume with a bundle discount
> that is marked as an assumption. Or we accept the variance, with a reason. It recommends the highest
> savings less one-off cost; nothing happens until a person decides."

Click **Approve** on option H.

### 5. Your approval (3:30–4:15)

The agent drafts exactly what H allows: a **Change request (mock)** to procurement master data and a
**Buyer notice** to the buyers at Duisburg and Lyon, each *Pending approval* with an AI label.

> "It may draft only what the decision allows, every figure in these texts is checked in code against the
> engine, and the footer says that nothing goes out without approval. This outbox is connected to nothing."

Approve both drafts.

### 6. When a saving is real (4:15–5:00)

Point at the tiles: **Approved savings** now reads €23,901 a year; realised is still €2,100 to date.

> "Approved, not saved. The €12,501 counts as realised only when later order lines show the new price, and
> any line that goes back to the old supplier shows up as leakage."

Click **Open the report** in the console and read its first two sentences; then the Audit tab, **Export
JSON**.

> "Every tool call, every figure, every decision with its time and its owner. From a hunch to a costed,
> approved decision in five minutes, and a person in charge of every step."

---

## Contingencies

**The page does not react, or a step seems stuck.** The status pill shows the phase and the console's clock
keeps running. A simulation needs no network. Click **Reset**, then Start again at **×2** and talk over the
faster replay.

**You clicked Reject, or the wrong option.** Say: "That is the control working." The remaining options stay
open, and the agent drafts only what the approved one allows. Approve another option, or accept the
variance with a reason; the report states the decision that was taken.

**The laptop shows 1280 × 720.** With the drawer open the board is short and the ladder compact: each
line sits on its pair's row. Every row still opens its lines and their normalisation; click **Hide** on the
drawer to see the full ladder.

**A Guardrail line appears (Live).** Point at it: "The code just refused a step, for example a figure no
tool returned. The agent is told why and corrects it." The run facts count these refusals.

**Live is slow, or the API fails.** Real reasoning has real latency; use the wait to explain the ladder. On
an error the console names the cause in plain words (key, network, rate limit). Click **Abort**, set
Replay to ×1 and run the simulation of the same scenario: "Same interface, labelled SIMULATION."

**The rate host is blocked (Live).** The console says the bundled rates stay in use. Nothing to fix: the
analysis uses the year's mean rate anyway, and a fetched rate would only be a labelled sensitivity.

**A Live sweep or scenario 4 finds nothing material.** "That is the right answer when the prices are
comparable. An agent that finds money every time is a liability." Then run scenario 1.

## Questions that will come

| Question | Answer |
| --- | --- |
| "Is this real data?" | "No. GlobalCorp SE, its plants, suppliers, materials, contracts, prices and order lines are invented, built from a fixed seed. What is real: the European Central Bank's euro reference rates, averaged over the year; the Incoterms 2020 rules; the structure of SAP's purchasing data the tools read. In Simulation the narration is authored and labelled; in Live the reasoning is the model's. Every figure comes from the engine either way." |
| "Is that really the same item?" | "Only three things make lines comparable: the same material number; the same manufacturer and part number on two material numbers, as with the safety shoes of scenario 6; or service lines a person confirmed as one service, as with the consultants of scenario 2. A similar description never does. A line without a unit conversion is excluded and named. And every line opens its normalisation: price unit, unit of measure, currency, delivery terms." |
| "Why is this price justified?" | "Only a reason the data records: an urgent order with a reason, up to 15 % above the benchmark. That is the hatched part. Currency and delivery terms are not reasons; they are made equal before anything is compared, which is why the UK's boxes in scenario 4 are not flagged. Anything else stays unexplained until a person accepts the variance with a reason, and that is logged." |
| "When is a saving real?" | "When later order lines show it. Identified is what the engine finds, approved what a person decided, implemented what is in place, realised what later orders at the new price prove, to date. The cable ties on the board were approved for €8,000 a year and have realised €2,100 so far, with one order that went back to another supplier as leakage." |
| "Can the AI make up the numbers?" | "Not the money. A deterministic engine computes every figure; the tiles and option cards come straight from it, and any figure the agent writes into an alert, a draft or the report is checked in code against the tool results." |
| "Why not take the cheapest price as the benchmark?" | "Because a bargain is not a price you can buy at. The benchmark is the lowest price among plant-and-supplier pairs that buy at least 10 % of the group's quantity: a price GlobalCorp already pays at volume." |
| "What does a run cost?" | "A simulation costs nothing. A live run is billed to my own key, typically tens of euro cents; the Session cost tile shows it, and a run stops at 40 model calls or €3." |
| "What about the EU AI Act?" | "It discloses that you are dealing with an AI system, a person decides every option, approves every draft and confirms every cluster, nothing is sent, and the audit log records every step for export." |
| "Could it run on our data?" | "Yes. The tools read standard purchasing data: order lines, materials and their unit conversions, contracts, suppliers. The Method dialog ends with the production path: SAP as the source, Microsoft Fabric for the analytics, the agent in Azure OpenAI and Copilot Studio, Power BI and Power Automate around it." |

## After the demo

- Start agent → **Change or forget key** → **Forget key**, or close the tab.
- If the key was ever visible on screen, delete it in the Claude Console and create a new one.
- Click **Reset** before the next visitor uses the laptop.
