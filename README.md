# Price Variance Agent

An AI agent for procurement that finds where plants pay more for the same item and proposes a fix. It takes a buyer's tip, makes every price comparable, finds the gap no reason explains and drafts what a person approves.

Live site: <https://victorpflueger.github.io/PROC-price-variance/>

**Fictional company, no client data.** GlobalCorp SE and its orders are invented; the exchange rates are the ECB's.

## The four figures

Top right, each explained in the guide's How it works chapter.

| Figure | What it measures | Gloves case |
|---|---|---|
| Unexplained a year | The price gap no recorded reason explains, at today's volume; after your decision, what is left | €14,146, then €1,644 |
| Highest vs best price | How much more the dearest plant pays than the group's best price at volume | 42 %, Lyon |
| Tip → decision | Time from the tip to your decision, measured on the page | about 4 minutes |
| Session cost | What the agent's model calls cost: estimated for the simulation, measured in a live run | ≈ €0.08 on Sonnet 5.5 |

## The talk track

The guide, *How the prototype works*, opens once per browser tab. When it closes, the page plays each step for as long as it takes to read and stops wherever you act, with **Your turn** above the button to press. Space pauses; the arrow keys, a clicker or the numbered steps step by hand. The guide's last chapter is the presenter's script, five steps of a minute each; [DEMO_SCRIPT.md](DEMO_SCRIPT.md) adds what to do and the questions that come.

1. **The tip**: the buyer's hunch and every order of the item, as booked.
2. **Like for like**: one order converted step by step (pack size, currency, freight), then every price in euros per 100, delivered.
3. **The gap**: each plant against the best price the group pays at volume, and what no reason explains.
4. **Your decision**: three costed options next to accepting the gap. The agent recommends one; you approve.
5. **The drafts**: what your decision allows, each waiting for your approval. Nothing is sent.

A link opens a step, paused: `?case=gloves&step=gap`. The case menu holds five more: consultants (a cluster only a person can confirm), hoses (urgency as a reason), boxes (an honest negative), pallets (pounds) and shoes (two material numbers, one part).

## Start agent: the simulation or a live run

The page opens on the simulation: a replay of the agent's run through its live tools, so the engine computes every figure again and no model is called. **Start agent** offers it again, or a live run with Claude on your own Anthropic API key, with "You are interacting with an AI system" beside it. The key stays in this tab and goes only to api.anthropic.com. A live run stops at 40 model calls or €3, and says why when it stops early.

## What is real

| | |
|---|---|
| Fictional | GlobalCorp SE: 4 plants, 132 suppliers, 1,540 order lines, the buyers' tips, and the agent's words in the simulation |
| Real | The engine's arithmetic, the ECB's exchange rates and, on your key, Claude |
| Simulated | The simulation's run: scripted steps played through the real tools |
| In production | Orders from SAP S/4HANA or Ariba, the engine on Microsoft Fabric, the agent on Azure OpenAI, approvals in Teams |

[DATA_SOURCES.md](DATA_SOURCES.md) lists every source with its date.

## How it works

A deterministic engine makes every price comparable and computes every figure; the agent checks, explains and drafts; a person decides. The engine compares only the same material number, the same manufacturer part number, or lines a person confirmed as one service. It sets the bar at the best price the group pays with at least 10 % of the quantity, lets urgent orders with a recorded reason pay up to 15 % more, adds 5 % for freight the supplier leaves out, and proposes nothing below €5,000 a year.

The engine, the sixteen tools, the agent with its guardrails and the six simulation scripts are version 1.0.0's files, byte for byte (`tests/fingerprint.mjs`). Version 2.0.0 replaced the console around them with a presenter:

| Module | Does |
|---|---|
| `js/app.js` | The five steps, Play, the keys and links, the key figures, Start agent |
| `js/run.js` | Sorts a run's events into the five steps and logs every decision |
| `js/story.js` | Words each step and figure from the engine's results, in plain names |
| `js/view.js` | Draws a step: the stage on the left, the story on the right |
| `js/plain.js` | Names instead of ids, units in words |
| `js/estimate.js` | Plays a case at once and estimates what it costs live |
| `js/live.js` | Checks the key and starts the live agent |

[DESIGN.md](DESIGN.md) describes the screen and its colours, on Vici 2.0, Victor's design system (`vici/`).

## Run it

No build step and no install. Serve the folder over http and open it in Chrome or Edge:

```
python -m http.server 8000
```

then <http://localhost:8000>. Opened from disk, the browser blocks its modules and the loading screen says so. GitHub Pages publishes `main`; the *live site* workflow checks that the published page is this commit's and plays.

## Tests

`node tests/run-all.mjs` runs every suite; [tests/README.md](tests/README.md) lists them. GitHub Actions runs them on every push, with ViciDesign at the commit `vici/` was copied from, so Vici's checks of the guide, the byline, the writing and the AI notice run on the page. No test calls the real API.

## History

Version 1.0.0 was a console with a price board, an outbox, a Method dialog and exports. Its plan, review and technical notes are in the git history (commit `6b40c27`).

## Author

Built by Victor Pflüger, on [Vici](https://victorpflueger.github.io/ViciDesign/).
