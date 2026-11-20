# Price Variance Agent: design

On Vici 2.0, Victor's design system, copied unchanged into `vici/`, and on the layout every prototype of Victor's shares (Vici's *Build a prototype*), so a partner who presented one finds their way around this one.

## The screen

- **Header.** The name in a lilac hexagon, SIMULATION or LIVE, How it works, the theme toggle, and the four key figures top right.
- **Under the header.** One sentence on what the prototype does and that its data is fictional, beside the byline.
- **Talk track.** Start agent with "You are interacting with an AI system" beside it, the five numbered steps, the case menu, and Stop during a live run.
- **Work area.** The stage on the left shows what to look at: the orders as booked, one order converted, the gap chart, the options, the drafts. The story on the right says what it means: a title with the finding, a lead, the agent's words, the decision log, and one primary button for the next step.

It reads from the back of a room at 1920 × 1080 and fits 1280 × 720 without scrolling, in both themes, with text at Vici's sizes or larger.

## Colour

| Colour | Means |
|---|---|
| Merlot | You: the current step, Approve, the next step |
| Lilac | The AI: its words, its recommendation, its drafts, the live-run notice |
| Coral | The gap no reason explains, on the chart and on the first figure |
| Honey | The part a recorded reason justifies |
| Sage | The best price at volume, a contract, a decision taken |
| Ink | Everything else |

Each step has one primary button. Where the step waits for your click (Approve, Same service), Next turns secondary.

## Plain words

The engine and the agent speak in ids and unit codes. The presenter says names and units instead: "Lyon, Rhône MRO SARL" for "3010 / 80002", "per 100 gloves" for "per 100 EA", the option's title for "Option H". `js/plain.js` does this in one place, and the tests check every sentence of the six cases on every decision path.

## The figures

Every figure on screen comes from the engine's results in the run; `js/story.js` only chooses and words them. The key figures start with values that make sense before anything happens, and two of them move when you decide: the first falls to what is left, the clock stops. The guide's figures are written in from the same engine when the page loads.

## What stayed and what went

The engine, the tools, the agent and the simulation scripts stayed, byte for byte. The console went: the price board, the portfolio and value pipeline, the outbox drawer, the Method dialog, Diagnostics, the exports, the replay speeds and the run recorder. A presenter needs none of them in five minutes, and the engine still computes everything they showed.
