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

## The demo in five minutes

Pick scenario 1, **Gloves at three sites** (marked *Start here* in the console), set Replay to **×1** and press **Start agent → Run simulation**. Within about half a minute the agent has normalised the lines, set Frankfurt's contract price of €6.90 per 100 EA as the benchmark and found €14,146 a year that no reason explains: Lyon buys off contract at €9.80 per 100 EA, and Birmingham, cheapest as booked in pounds per case of a thousand, pays €7.56 per 100 EA once the price is in euros and delivered. Open any row of the price ladder and any line in it to see the normalisation step by step. Approve the recommended option and the two drafts, and watch the Approved savings tile grow while realised value stays where later orders put it. [DEMO_SCRIPT.md](DEMO_SCRIPT.md) has the minute-by-minute script, the pre-flight checks, the contingencies and answers to the questions that will come.

## Status

**Version 1.0.0 (milestone M3): the release.** The live agent runs in the browser with your own Anthropic key: sixteen tools, every guardrail in code, caps of 40 model calls and €3 a run, and the ECB's rates through Frankfurter as a labelled sensitivity. The price board shows a group's price ladder (every pair, the benchmark, the unexplained and justified parts, every line's normalisation one click away) and the portfolio with the value pipeline, each with a table of the same numbers. The cluster dialog asks *Your confirmation* before free-text services become comparable; the options, the outbox with its drafts and the report follow. The six scenarios play as simulations, offline and without a key; Live sweep and Custom what-if run live. Version 1.0.0 adds the **Method** dialog with the parameters and the production path, the exports (the report as Markdown, a group's analysis as CSV, the audit log as JSON, each validated), a layout checked from 1920 × 1080 down to 1280 × 720 in both themes with every target at least 40 px, a run completed by keyboard alone, the independent review ([REVIEW.md](REVIEW.md)) and the release documents. [PLAN.md](PLAN.md) has the build plan; `TECH_NOTES.md` §12 the evidence for every acceptance criterion.

## Run it

No build step and no install. Serve the folder over http and open it in a current Chrome or Edge:

```
python -m http.server 8000
```

then open <http://localhost:8000>. Opened straight from disk (`file://`), the browser blocks its modules and the boot screen explains why. On Windows, `py -m http.server 8000` does the same. Live mode works locally too, because the Anthropic API accepts browser calls from any origin with its browser header.

To rebuild the data: `node tools/build_world.mjs` (the world from its fixed seed), `node tools/check_world.mjs` (its checks), and in GitHub Actions the workflow *FX snapshot* (`.github/workflows/fx-snapshot.yml`, the rates).

## Deploy

The site is published by GitHub Pages from this repository's `main` branch, folder `/ (root)`. Every merge to `main` publishes the new version within a minute or two, and the workflow *live site* (`.github/workflows/live-site.yml`) then checks the published site: the page, the engine, the tools, the world, the rates and the scripts as served must equal the commit's, and a simulation of scenario 1 must run to the end there (`tests/live_site.mjs`).

To publish a copy of your own:

1. **Create a public repository** and push this folder's contents to its `main` branch (or upload them: GitHub's web upload takes at most 100 files at once, so upload `js/` and `vici/` separately). Keep the hidden file `.nojekyll`; it stops GitHub from running Jekyll over the Markdown files.
2. **Turn on Pages.** **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch **main**, folder **/ (root)**, **Save**.
3. **Open the site** after a minute or two at `https://<your-user>.github.io/<repository>/`. Progress shows under **Actions** ("pages build and deployment").
4. **Check it on the presentation laptop:** **Diagnostics → Run all tests**. The footer names the version.

**Updating.** Pages caches files for up to ten minutes. After an update, hard-reload (**Ctrl + Shift + R**, or **Cmd + Shift + R** on a Mac) and check the version in the Diagnostics footer.

**Other hosts.** The folder runs unchanged on any static host, such as Cloudflare Pages or Netlify. A host of its own gives the app its own origin, which keeps its browser storage apart from other apps (see *Your API key*).

## The two modes

**Start agent** first asks how the agent should run.

| | **Simulation** | **Live agent** |
| --- | --- | --- |
| What runs | An authored replay of the agent's run, through the same tools and guardrails | Real Claude reasoning with real tool calls |
| Figures | Recalculated by the engine from the company data at playback | Calculated by the engine |
| Exchange rates | The window's mean ECB rate; a rate the script opens is replayed and labelled "representative" | The window's mean ECB rate; a rate fetched from Frankfurter is a labelled sensitivity |
| Parameters | Always the defaults | Yours, as set in the Method dialog, frozen when the run starts and logged |
| Key and cost | None | Your Anthropic API key; a few tens of euro cents a run |
| Network | None; works fully offline | api.anthropic.com and api.frankfurter.dev only |
| Labelling | SIMULATION badge with a striped tape, the word in the console, the report's banner, `SIMULATION` in every export's name and `"mode": "simulation"` in the audit log | LIVE badge, `LIVE` in the export names, `"mode": "live"` |

- **Use Simulation** for the demo at ×1, for rehearsal at ×2 or ×4, as the fallback on stage, and for anyone exploring without a key. Replay speed is in the control bar.
- **Use Live** after a rehearsal on the same laptop and network. If the agent finds nothing material, it says so.
- **Live sweep** (control bar) scans every comparable group without a tip, ranks them on the portfolio and investigates the first flagged one.
- **Custom what-if** (Scenario menu) takes a price question in your own words, for example *"Do our plants pay the same for safety shoes?"*. Both need the live agent.

The six scenarios and what each one plants are in `DATA_SOURCES.md` §4.

## Your API key

The app asks for a key only when you start a live run: **Live agent** in the mode dialog, **Live sweep** or a custom what-if.

1. **Create a dedicated workspace with a spend limit.** In the Claude Console (`platform.claude.com`), open **Settings → Workspaces** and create one, for example "Price variance demo"; set a monthly spend limit for it. Spend limits apply per workspace, not per key, and not on the Default Workspace.
2. **Create a key in that workspace** under **Settings → API keys**.
3. **Enter it only in the app.** Paste it when the app asks (**Continue with my API key**); it is checked with the free `GET /v1/models` call, which uses no tokens. Never paste the key into chat, slides or e-mail.

What happens to the key:

- It is kept in this tab's session storage only, under `pv.anthropic.key`. The browser drops it when the tab closes; it is absent from other tabs, and it is never written to local storage, the console, the audit log, the exports or a recorded run. The key field asks password managers not to save it.
- It is sent only to api.anthropic.com, in the `x-api-key` header; the page's security policy blocks every other destination but the rate host.
- Live mode needs the app in its own tab: inside another page's frame the key dialog refuses the key, so a framing page cannot steer the clicks around it. Simulation works anywhere.
- **Start agent → Change or forget key → Forget key** removes it at any time. On a shared computer, do that before you leave.
- **One origin, several apps.** GitHub Pages serves all of an account's project sites from one origin, and browser storage belongs to the origin. Every key this app stores starts with `pv.`, so it never overwrites a sister app's, but a page of the same origin opened in the same tab could read a stored key. For anything beyond a demo, give the app its own host. Diagnostics' *Key and privacy* row checks all of this in your browser.

## What a run costs

A simulation costs nothing. In a live run, the Session cost tile shows the real cost of every model call as it happens: token usage × list price, converted at 1 USD = 0.894 EUR. The audit log holds the usage of every call.

| Model (selector) | Per preset scenario run | Notes |
| --- | --- | --- |
| **Sonnet 5.5** (default) | expect about €0.15–0.40 | Best balance for the stage |
| Haiku 5.5 | about €0.02–0.05 | Fastest and cheapest |
| Opus 5.5 | about €0.35–0.90 | Deepest reasoning, slower |

These are estimates carried over from the sister apps, whose prompts and tool sets are of a similar size and whose Sonnet runs measured about €0.20. This agent's system prompt and sixteen tool definitions come to about 4,000 tokens, it uses prompt caching, and it has no web search, so there is no search fee. The first measured run of this app is AC-20 (below); measure your own during rehearsal. A Live sweep reads more data and can cost more. Each run stops on its own at 40 model calls or once €3 is spent.

## The Method and its parameters

**Method** in the control bar opens the engine's rules in ten short sections: comparable groups, a comparable price, the benchmark, justified and unexplained, spread, index and materiality, the options, the value pipeline, the parameters, the exchange rates and the path to production. The parameters (the analysis window, the benchmark's minimum share, the urgent allowance, the logistics uplift, the person-day, materiality, the day rate and the efforts and lead times of the options) are assumptions, shown as such, with their defaults in `DATA_SOURCES.md` §5.

You can change them between runs; they hold until the page is reloaded. A change applies to the next **live** run only: the run freezes the values it starts with, its audit log records every change under *Your decisions* with the time it was made, and the audit export lists the values in effect and those that differ from the defaults. A simulation always plays at the defaults, so its figures stay the scripted ones, and a live run with changed parameters cannot be saved as a simulation. **Reset to the defaults** restores them; while the agent runs, the fields are locked.

## Exports

| What | Where | File name |
| --- | --- | --- |
| The report (Markdown) | **Open the report** at the end of a run → **Download .md** | `price-variance-<run>-<MODE>-report.md`; a simulation's starts with a SIMULATION banner |
| A group's analysis (CSV) | The **CSV** button beside the board's views, once the group is compared | `price-variance-<run>-<MODE>-<group>-analysis.csv`: one row per order line with its normalisation, pair, benchmark, gap, justified and unexplained part, excluded lines with their reason; UTF-8 with a byte order mark, so spreadsheets read "€" |
| The audit log (JSON) | Drawer → **Audit** → **Export JSON** | `price-variance-<run>-<MODE>-audit.json`: every run event, model request and response, decision with its reviewer and time, the method, engine and rate versions, the parameters in effect and the cost |

`<MODE>` is `SIMULATION` or `LIVE`, so a replay's file never passes for a live one. The audit export follows the `AuditExport` schema in `js/schemas.js`, and the accept and unit suites validate real exports against it with the app's own validator (`js/schema.js`) on every change; the key never appears in any export.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| The page says it must be opened through a web server | It was opened from disk (`file://`). Use GitHub Pages or `python -m http.server` (see *Run it*). |
| GitHub Pages shows 404 | Wait two minutes after enabling Pages and check **Actions**. `index.html` must be in the repository's root, and Pages must deploy branch `main`, folder `/ (root)`. |
| An old version after an update | Pages caches for up to ten minutes. Hard-reload and check the version in the Diagnostics footer. |
| "Could not reach api.anthropic.com", or Diagnostics fails the Anthropic API row | A firewall, proxy or browser extension blocks the call. Try another network, such as a phone hotspot, or a browser profile without extensions. Simulation works offline. |
| "Anthropic rejected this key (401)" | The key is wrong, expired or archived. Enter a valid one. |
| "Spend limit reached" or "no credit" | Raise the workspace's spend limit or add credit in the Console, or switch to Simulation. |
| The ECB rates row fails, or the console says the bundled rates stay in use | Frankfurter is blocked or down from this network. Nothing to fix: the analysis uses the window's mean rate from `data/fx.js`; a fetched rate would only be a labelled sensitivity. |
| "The API is busy right now" | Anthropic returned overloaded or rate-limit errors after the automatic retries. Wait a minute, switch to Haiku, or run the simulation. |
| A **Guardrail** line in the console | Code refused a step, for example a figure no tool returned or a draft the decision does not allow. The agent is told why and corrects it; the run facts count these refusals. |
| The run ends as **Stopped** | The model ended its turn twice without finishing; the app does not invent the rest. Start again, or play the simulation of the same scenario. |
| The ladder shows its lines on the pairs' rows | The board is short, usually because the drawer is open on a small screen. Every row still opens its lines; click **Hide** on the drawer for the full ladder. |
| A parameter field is locked | The agent is running. Change parameters between runs; they apply to the next live run. |
| Text too small on the projector | **Larger text** in the console's header. The layout is tested at 1920 × 1080 and down to 1280 × 720. |

## Safety and the EU AI Act

The app follows the transparency and human-oversight lines of the EU AI Act. This is a design intent, not a legal assessment.

- **Disclosure.** "You are interacting with an AI system" is shown permanently in the header, and the alert, the options, the drafts and the report the agent wrote carry an AI label.
- **Human oversight.** A cluster of free-text lines waits for a person's confirmation, the options for a decision, and every draft for its own approval. A run that ends first says so: "Run ended before a decision" on the options, "Not decided: the run ended" on a draft.
- **No real-world action.** The outbox has no e-mail or ERP connection; approving a draft only marks it as cleared. A change request says "Mock change request for demonstration; no ERP system is connected."
- **Record-keeping.** The audit log holds every run event, model request and response, decision, reviewer and time, the method, engine and rate versions and the parameters in effect, and exports as JSON.
- **Honest figures and modes.** Every figure comes from the engine and every figure the agent writes is checked against it; simulation output is labelled everywhere and never presented as live; no value reads as saved before later orders show it.

## Quality and acceptance

- The **run facts** line at the end of every run states agent time, tool calls by kind, verification steps, revisions, guardrail refusals and cost; the audit log holds the same facts.
- `node tools/check_world.mjs` checks the world, the six scenarios against their frozen figures and every simulation script on every decision path under the live guardrails.
- `node tests/engine.mjs` reproduces the brief's golden cases to within 1e-9, every display string included; `node tests/audit.mjs` checks the figure audit's cases F01 to F16.
- The browser suites play every scenario on every decision path offline, check the board against the engine, the key's handling, the exports, the layout from 1920 × 1080 to 1280 × 720 in both themes, a run by keyboard alone and the design rules (colour contrast, series colours, nothing round).
- [REVIEW.md](REVIEW.md) holds the parity of the shared shell and the independent review; `TECH_NOTES.md` §11 is the verification log and §12 the acceptance checklist with the evidence of every criterion.

### Acceptance record

| ID | What | Status |
| --- | --- | --- |
| AC-01 to AC-19, AC-22, AC-23 | The engine, the world, the shell, the agent, the board, the simulations, the exports, the layout, design and accessibility, the review and the documents | Automated or recorded; `TECH_NOTES.md` §12 names the evidence |
| AC-20 | Victor runs one scenario live with his own key, end to end within the caps; the audit export shows the model, the usage, the rates and the cost | Pending: Victor's live run |
| AC-21 | Victor gives the five-minute demo at ×1 without help ([DEMO_SCRIPT.md](DEMO_SCRIPT.md)) | Pending: Victor's demo |

## Tests

`node tests/run-all.mjs` runs every suite; [tests/README.md](tests/README.md) lists them with their setup. GitHub Actions runs them on every push and pull request (`.github/workflows/tests.yml`), and the live-site workflow checks the published site after every Pages build. No test calls the real API or the real rate host.

## In production

The prototype stands in for all of this in one browser page:

| Step | Product | Role |
| --- | --- | --- |
| Source | SAP S/4HANA or Ariba | Order, requisition, invoice, contract and supplier data |
| Data | Microsoft Fabric | Data Factory, OneLake, SQL, Spark or dbt: the variance analytics run here |
| Agents | Azure OpenAI and Copilot Studio | The agent and its tools |
| Reporting | Power BI | Reporting and opportunity tracking |
| Action | Power Automate and Teams | Alerts, approvals, tasks; SAP executes what people approved |

The intro window and the Method dialog show the same path.

## Files

| Path | Holds |
| --- | --- |
| `index.html`, `favicon.svg`, `.nojekyll` | The page, its security policy and its icon; the marker that keeps Jekyll away |
| `js/` | The shell (shared with the sister apps), the engine and the interface |
| `css/` | The shell's styles and the board's |
| `data/` | The world, the rates, the tips, the frozen figures and the simulation scripts |
| `tools/` | The builders and the world checker; `tools/source/` holds the account extract and the material groups |
| `tests/` | The test suites; `tests/fixtures/` the brief's golden cases |
| `vici/` | Vici v1.0.0, Victor's design system, unchanged |
| `.github/workflows/` | The tests, the rate snapshot and the live-site check |
| `PLAN.md` | The build plan |
| `README.md`, `DEMO_SCRIPT.md`, `TECH_NOTES.md`, `DATA_SOURCES.md`, `DESIGN.md`, `REVIEW.md` | This guide, the demo script, verified facts and decisions, every source with its date, the design, the parity of the shared shell and the independent review |

| Part | Modules |
| --- | --- |
| The method: normalisation, comparable groups, benchmark, options, the value pipeline | `js/normalise.js`, `js/groups.js`, `js/variance.js`, `js/options.js`, `js/pipeline.js`, `js/params.js` |
| The agent: the live loop, its prompt, the sixteen tools and their guardrails | `js/agent.js`, `js/prompt.js`, `js/tools.js`, `js/guards.js` |
| The simulations: the six scripts, the player, the checker, the recorder | `data/sim_runs.js`, `js/simulation.js`, `js/sim_check.js`, `js/recorder.js` |
| The price board and the cluster dialog | `js/board.js`, `js/board_ladder.js`, `js/board_portfolio.js`, `js/board_table.js`, `js/board_pop.js`, `js/cluster.js` |
| The Method dialog and the exports | `js/method.js`, `js/exports.js`, `js/audit.js` |
| Display strings and the figure audit | `js/format.js`, `js/figures.js` |
| Data contracts and their validator | `js/schemas.js`, `js/schema.js` |
| The world, its six tips and their frozen figures | `data/world.js`, `data/scenarios.js`, `data/reference_cases.js`, built by `tools/build_world.mjs` |
| The ECB rates | `data/fx.js`, built by `tools/build_fx.mjs` in `.github/workflows/fx-snapshot.yml` |

## Credits and licences

Design system: Vici by Victor Pflüger (MIT for its code; `vici/LICENSE`), with its fonts Bricolage Grotesque, Inter and JetBrains Mono (SIL Open Font License 1.1). Exchange rates: the European Central Bank's euro reference rates, through the Frankfurter API for live sensitivities. Claude is a service of Anthropic, billed to your own key. Details are in `DATA_SOURCES.md`.

## Author

Built by Victor Pflüger, on [Vici](https://victorpflueger.github.io/ViciDesign/), his design system.
