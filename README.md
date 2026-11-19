# Price Variance Agent

**Price Variance Agent** is a browser-only prototype of an agentic-AI assistant for procurement. It compares what GlobalCorp SE, a fictional industrial group, pays for the same item or service across plants, suppliers, countries and company codes. A deterministic engine brings every order line to one comparable price (price unit, unit of measure, currency at the ECB's euro reference rates, delivery terms), sets a benchmark from the best price the group already pays at volume, and separates the part of each gap that a documented reason explains from the part nothing explains. The agent checks the evidence, proposes costed ways to close the gap next to accepting it, waits for a person's decision and drafts the change requests and the negotiation brief.

Every figure comes from the engine, never from the model. Value is tracked in four separate stages, identified, approved, implemented and realised, and nothing reads as saved before later orders show it. Nothing is sent anywhere: drafts stay in an outbox.

**Fictional company, no client data.**

Live site: <https://victorpflueger.github.io/PROC-price-variance/>

## What it is and why it matters

Large groups buy the same gloves, hoses, pallets and consultants at several plants, from several suppliers, in several currencies and on several delivery terms. The same item then costs very different amounts, and most of the difference has no reason anyone would accept. A price-variance programme finds a few per cent of the spend this way; the hard part is proving that two prices are really comparable. The Price Variance Agent makes that proof visible: it compares only the same material number, the same manufacturer part number, or lines a person confirmed as the same service; it shows every step that makes a price comparable; and it keeps a reason (an urgent order, within an allowance) apart from a habit.

## How it works

1. **Spot.** The agent picks up a short tip ("Lyon seems to pay far more for nitrile gloves than Frankfurt") and finds the comparable group of order lines it is about.
2. **Check.** It normalises the lines to euros per base unit, delivered: price unit, unit conversion (a person-day is 8 hours), the window's mean ECB rate and a 5 % logistics uplift for Incoterms groups E and F. Free-text services become comparable only when a person confirms the cluster (*Your confirmation*).
3. **Calculate.** The engine sets the benchmark (the lowest price among the pairs of plant and supplier that buy at least 10 % of the group's quantity), splits every line's gap into a justified and an unexplained part, and computes the opportunity a year, the spread, the price variance index and the options.
4. **Propose.** Two or three options with their savings a year, one-off cost and days to the first saving, next to accepting the variance with a reason. You decide (*Your decision*).
5. **Prepare.** Drafts of the kinds the approved option allows, footed "Requires human approval before sending" (*Your approval*). Nothing is sent.

## Status

**Version 0.1.0 (milestone M1): the shell, the world and the engine.** The page boots on Vici and the sister apps' shell; the board shows the engine's check of every comparable group of the world, run in the page at the bundled ECB rate; the header shows the value log's approved savings with what is implemented and realised to date. The live agent, the price ladder, the six scenarios as simulations, the cluster dialog and the Method dialog arrive in versions 0.2.0 and 1.0.0 ([PLAN.md](PLAN.md), section 9).

| Part | Where |
| --- | --- |
| The method: normalisation, comparable groups, benchmark, options, the value pipeline | `js/normalise.js`, `js/groups.js`, `js/variance.js`, `js/options.js`, `js/pipeline.js`, `js/params.js` |
| Display strings | `js/format.js` |
| The figure audit | `js/figures.js` |
| Data contracts and their validator | `js/schemas.js`, `js/schema.js` |
| The world, its six tips and their frozen figures | `data/world.js`, `data/scenarios.js`, `data/reference_cases.js`, built by `tools/build_world.mjs` |
| The ECB rates | `data/fx.js`, built by `tools/build_fx.mjs` in `.github/workflows/fx-snapshot.yml` |

## Run it

No build step and no install. Serve the folder over http and open it in a current Chrome or Edge:

```
python -m http.server 8000
```

then open <http://localhost:8000>. Opened straight from disk (`file://`), the browser blocks its modules and the boot screen explains why. On GitHub Pages it runs as is.

To rebuild the data: `node tools/build_world.mjs` (the world from its fixed seed), `node tools/check_world.mjs` (its checks), and in GitHub Actions the workflow *FX snapshot* (the rates).

## Tests

`node tests/run-all.mjs` runs every suite; [tests/README.md](tests/README.md) lists them. The engine reproduces the brief's golden cases to within 1e-9 (`node tests/engine.mjs`), the figure audit its cases F01 to F16 (`node tests/audit.mjs`), and the world its rules (`node tools/check_world.mjs`). GitHub Actions runs everything on every push and pull request (`.github/workflows/tests.yml`).

## In production

The prototype stands in for all of this in one browser page:

| Step | Product | Role |
| --- | --- | --- |
| Source | SAP S/4HANA or Ariba | Order, requisition, invoice, contract and supplier data |
| Data | Microsoft Fabric | Data Factory, OneLake, SQL, Spark or dbt: the variance analytics run here |
| Agents | Azure OpenAI and Copilot Studio | The agent and its tools |
| Reporting | Power BI | Reporting and opportunity tracking |
| Action | Power Automate and Teams | Alerts, approvals, tasks; SAP executes what people approved |

## Files

| Path | Holds |
| --- | --- |
| `index.html`, `favicon.svg` | The page, its security policy and its icon |
| `js/` | The shell (shared with the sister apps), the engine and the interface |
| `css/` | The shell's styles and the board's |
| `data/` | The world, the rates, the tips and the frozen figures |
| `tools/` | The builders and the world checker; `tools/source/` holds the account extract and the material groups |
| `tests/` | The test suites; `tests/fixtures/` the brief's golden cases |
| `vici/` | Vici v1.0.0, Victor's design system, unchanged |
| `PLAN.md` | The build plan |
| `TECH_NOTES.md`, `DATA_SOURCES.md`, `DESIGN.md`, `REVIEW.md` | Verified facts and decisions, sources, design, the parity of the shared shell |

## Author

Built by Victor Pflüger, on [Vici](https://victorpflueger.github.io/ViciDesign/), his design system.
