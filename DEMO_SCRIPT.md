# Price Variance Agent: the five-minute demo

**For** a CPO, a head of purchasing or a category manager. **Goal:** after five minutes they can repeat one sentence: *"The agent checked a buyer's hunch against every order, proved €14,146 a year that no reason explains, and a person approved the fix in minutes; nothing was sent."*

## The four figures at the top

| Figure | What it shows | In the demo |
|---|---|---|
| Unexplained a year | The gap no recorded reason explains, then what is left after your decision | €14,146, then €1,644 |
| Highest vs best price | How much more the dearest plant pays than the best price at volume | 42 %, Lyon |
| Tip → decision | From the tip on screen to your approval, measured on the page | about 4 minutes |
| Session cost | What the agent's run costs in model fees | ≈ €0.08 for a live run |

## Before the call

1. Chrome or Edge, full screen (F11), standard zoom, light theme; other tabs closed, notifications off.
2. Walk the five steps once. The simulation needs no key and no network.
3. Let the guide open, or start at `?guide=0` if you explain the prototype yourself.
4. For a live run, bring your own Anthropic API key from a workspace with a spend limit, and keep the simulation as the fallback.

## The five minutes

The same script as the guide's last chapter, *How to present*. Next, the number keys or the arrows move between the steps.

1. **The tip: a buyer's hunch. Point at the four figures.** Close the guide with Start. (1 min)
   “The gap's worth and width, your time to decide, the agent's cost.”
2. **Like for like.** Point at the card that converts one order. (1 min)
   “Birmingham's £6.20 per 100 looks cheap. In euros, delivered, it's €7.56.”
3. **The gap.** Point at the green mark through every bar. (1 min)
   “Lyon pays €9.80, the contract €6.90: €14,146 a year no reason explains.”
4. **Your decision: approve the recommended option.** Click Approve on the option framed in lilac; the first figure falls to €1,644 and the clock stops. (1 min)
   “Savings of €12,501 a year, the first after 30 days.”
5. **The drafts: approve both.** Click Approve on each draft, then open the decision log. (1 min)
   “The agent writes them. Nothing leaves without a person's approval.”

## Questions you will get

**Is this real data?** No. GlobalCorp SE and its orders are invented; the ECB's exchange rates and the arithmetic are real. In production the orders come from SAP S/4HANA or Ariba.

**Is that really the same item?** The engine compares only the same material number, the same manufacturer part number, or lines a person confirmed as one service. The consultants' case shows that confirmation.

**Why is part of the price justified?** Urgent orders with a recorded reason may pay up to 15 % more. Step 3 shows that part in honey, apart from the gap in coral; the hoses' case is built on it.

**When is a saving real?** Approved is a decision, not a saving: the euros count as realised only when later orders show them.

**What does the AI decide?** Nothing. An engine computes every figure, the agent checks and drafts, a person approves, and nothing is sent.

## If something goes wrong

- **The page stays on its loading screen.** It was opened from a file; serve the folder over http.
- **A live run stops early.** The story says why: the key, the network, 40 model calls or €3. Start agent, then Run the simulation.
- **Someone asks for a case where nothing is wrong.** Open the boxes from the case menu: the delivery terms explain the gap, and the agent proposes nothing.
