# Technical notes

Verified facts with their dates, the decisions taken with their reasons, and the records of each
milestone. Version 1.0.0 (milestone M3): the release, with the exports, the Method dialog, the layout and
accessibility checks, the independent review and the documents, on version 0.2.0's live agent, price board
and simulations and version 0.1.0's shell, world and engine. The verification log and the acceptance
checklist hold every milestone's records.

## 1. Claude models and token prices (cost meter inputs)

Verified on 19 Nov 2026 (Phase 0, probes P7 and P8 of PLAN.md) from Anthropic's models overview and
pricing pages; identical to the sister apps' `js/config.js`.

| Model | API id | Input | Output | Cache write (5 min) | Cache read | Effort used |
| --- | --- | --- | --- | --- | --- | --- |
| Sonnet 5.5 | `claude-sonnet-5-5` | $2.00 | $10.00 | $2.50 | $0.10 | medium |
| Haiku 5.5 | `claude-haiku-5-5` | $0.10 (above 100,000 prompt tokens $0.50) | $0.50 ($2.50) | $0.125 ($0.625) | $0.01 ($0.05) | medium |
| Opus 5.5 | `claude-opus-5-5` | $4.00 | $20.00 | $5.00 | $0.20 | high |

Prices are US dollars per million tokens. All three have a context window of 1M tokens and 128K output
tokens, and adaptive thinking. Tool use adds 286 input tokens with `tool_choice` auto. The cost meter
converts at 1 USD = 0.894 EUR, the value the brief fixes and the sister apps use (`js/config.js`), so the
meter is stable; `tests/unit.mjs` checks the price table (group `cost`).

## 2. The method's parameters and the readings it needed

The parameters of brief section 6.6 are in `js/params.js` with their defaults, each an assumption,
validated (a parameter that is unknown, negative or not a number is refused) and frozen in Simulation from
M2: analysis window 365 days; benchmark minimum share 10 %; urgent allowance 15 %; logistics uplift for
Incoterms groups E and F 5 %; person-day 8 hours; materiality €5,000 a year and 5 %; day rate €1,200;
harmonise 1 day per moved plant; renegotiate 2 days per supplier; tender 8 days; bundle discount 3 %;
lead times 30, 60 and 90 days.

Readings the brief's rules needed (PLAN.md section 1.6), each tested:

- **Figure audit, two readings (B4).** A bare amount may match a unit price at its item's display
  quantity ("Frankfurt €6.90" in F01). "Half a unit of its last digit" counts the digits as written:
  "€1,600" is exact to the euro. Without the first, F01 fails; without the second, F07 passes.
- **H not applicable (B5).** The brief's fixture has no case; `tests/fixtures/m100-h-not-applicable.json`
  (G4b) adds one: without Duisburg's lines and with S-A delivering to DE only, no line above the
  benchmark sits at a plant S-A delivers to.
- **Services carry no Incoterms rule (B6):** no rule, no uplift. A rule outside Incoterms 2020 (DAT, which
  DPU replaced) excludes the line with its reason.
- **The value pipeline's windows (B7).** After implementation means a day later than the implementation
  day; the baseline covers the 365 days up to the day before it (days −455 to −91 for day −90); a line on
  the implementation day counts on neither side. `tests/fixtures/g5.json` holds the boundary lines.
- **Unit prices at a display quantity of 1 (B12):** "€38.00 per EA", the 1 left out.
- **R and H touch the lines above the benchmark.** R counts every supplier with a line above the
  benchmark once; H moves every line above the benchmark at a plant the benchmark supplier delivers to,
  including that supplier's own lines above its benchmark price, and counts such a plant as moved.
- **Benchmark ties:** the lower price, then the larger quantity, then the lower plant and supplier ids.
- **Flags compare with a tolerance of 1e-9,** so floating-point noise never flips a threshold.

## 3. Messages API from the browser (CORS, headers, protocol)

Probed on 19 Nov 2026 between 19:19 and 19:30 UTC (PLAN.md section 1.4, P1 to P11):

- The preflight for `POST /v1/messages` from an `Origin` of the published site answers 200 with
  `access-control-allow-origin: *` and allows `x-api-key`, `anthropic-version`, `content-type` and
  `anthropic-dangerous-direct-browser-access`.
- A keyless request with the browser header answers 401 `authentication_error` with
  `access-control-allow-origin: *`, readable by the page; without the header the answer carries no
  `access-control-allow-origin` and a browser blocks it, so the header stays mandatory. A real page on
  127.0.0.1 in Chrome 153 confirmed both, and `GET /v1/models` with the header (401, readable).
- `anthropic-version: 2023-06-01` stays (brief section 4); `2026-10-21` is the newest version and answers
  the same, but removes `temperature`, `top_p` and `top_k`.
- Thinking: `{type: "adaptive", display: "summarized"}`, because `display` defaults to `"omitted"` on the
  newest models.
- Strict tools: at most 20 strict tools, 24 optional parameters and 16 union-typed parameters across a
  request's strict schemas; the 16 tools have 14 optional parameters and no union types, and use only
  `type`, `properties`, `required`, `additionalProperties: false`, `enum`, `items` and `description`
  (`tests/unit.mjs`, group `tools`). The list of supported keywords was not readable, so every input is
  also validated in code (`js/schema.js`) and refused with the guardrail "input" when it breaks its schema.

The shared `js/anthropic.js` and `js/keystore.js` are Rebate Hunter's, unchanged. The key is requested only
for Live, checked with `GET /v1/models`, kept in this tab's session storage under `pv.anthropic.key`, sent
only to `api.anthropic.com` and removed by "Forget key"; the key dialog refuses to work inside a frame
(AC-08, `tests/accept.mjs`).

### The agent loop (`js/agent.js`, `js/prompt.js`)

A live run sends the system prompt (the method, the rules, the tools' order of use) and one opening
message: a scenario's tip, the Live sweep's instruction to start from `pv_scan` without a tip, or the
person's own words in Custom what-if. Each call carries the 16 tools with `strict: true`, adaptive thinking
with `display: "summarized"`, the model's effort (section 1) and `max_tokens` 128,000. Stop reasons:

- `tool_use`: every tool runs in the browser and every `tool_use` is answered, an error included;
- `max_tokens`: a cut tool call is retried once with more room, otherwise the run continues;
- `end_turn`: the run ends, unless the agent stopped before its report (two nudges at most);
- `refusal` and `model_context_window_exceeded`: the run ends and says why.

Rebate Hunter's caps hold: at most 40 model calls a run, the retry included, and €3 a run, checked before
every call (none starts once €3 is spent, B8) and after each; 90 seconds without streamed data count as a
failed request. A 400 that names `strict` drops it once and says so in the console. The rail's steps follow
the run's phases: Spot (scanning, diagnosing), Check (verifying), Calculate (simulating), Propose (the
options and the decision), Prepare (the drafts, their approval and the report). *Your decision* waits on
Propose, *Your approval* on Prepare, and *Your confirmation* of a cluster on the furthest step reached
(Check in the scripted runs), all in merlot; the rail never moves back (`js/progress.js`).

## 4. Open data: the ECB's reference rates

**The rule (brief section 6.3).** One rate per currency for the whole analysis:
rate to EUR = 1 / the mean of the ECB's daily quotes of that currency per euro over the window, with its
first and last date. `data/fx.js` holds it; a rate fetched in a live run is only ever a labelled
sensitivity beside it.

**The snapshot.** Neither the ECB nor Frankfurter answers from the environment that builds this app
(`connect_rejected`, 19 Nov 2026), so `tools/build_fx.mjs` runs in the workflow
`.github/workflows/fx-snapshot.yml`. It reads the ECB Data Portal's daily series `EXR.D.GBP.EUR.SP00.A`
(CSV), reads Frankfurter's v1 time series in quarters, compares every day and fails on any difference or
missing day, and writes `data/fx.js`. Its first successful run on 19 Nov 2026 (20:38 UTC):

| Currency | Window | Daily quotes | Mean per euro | Rate to EUR |
| --- | --- | --- | --- | --- |
| GBP | 20 Nov 2025 to 19 Nov 2026 | 255 | 0.8613667843137256 | 1.1609456252677857 |

Both sources agreed on all 255 days. The first run failed after the snapshot was built, in the engine
suite (a test picked a cancelled line; section 11), and pushed nothing; the second pushed the review
branch `fx/2026-11-19-2`, which the M1 branch took as it was.

**Until a snapshot exists** `node tools/build_fx.mjs --fallback` writes the rate Rebate Hunter's
TECH_NOTES section 4 observed through Frankfurter's v1 on 14 Oct 2026, 1 EUR = 0.84385 GBP, labelled on
screen as one day's rate, not a window mean.

**Frankfurter in live runs.** `open_ecb_rate` (`js/opendata.js`) keeps Frankfurter's v1 API
(`https://api.frankfurter.dev/v1/...`), which serves the ECB's reference rates only and "remains available
indefinitely"; the v2 API blends 112 sources unless asked for `providers=ecb`. A rate fetched in a run is a
labelled sensitivity (`pv_compare` with `at_rate_of`, shown on the board as "Sensitivity …"): the tiles,
the options and every figure keep the window's rate. A failing or blocked request leaves the bundled
rates in use and says so in the console; a failure of the source is remembered for the session, and
Diagnostics tests it again (AC-10, `tests/live.mjs` rates). Its CORS behaviour was not probed from this
environment; Rebate Hunter's notes quote "CORS is open and there's no key to leak" (14 Oct 2026), and
PLAN.md Appendix A holds a one-line browser-console check. Victor's live run (AC-20) shows it.

## 5. The world: GlobalCorp SE's data products

`tools/build_world.mjs` builds `data/world.js` from a fixed seed (1729) and three inputs, so two builds
give the same bytes (AC-05):

- `tools/source/accounts.json`, written once by `tools/extract_accounts.mjs` from Rebate Hunter's world
  (commit `73c00f8`, world 1.2.0): of 161 vendor accounts, the 143 outside the five real corporate groups
  (by group key or register entry), all invoicing in euros, 129 in company code 1000; 17 groups share a
  normalised name and country (the Data Quality Agent's rule), and the lowest id of each stays: 124
  accounts with id, name, city, country, currency, category and company code. The invented tax id and the
  bank's last four digits are dropped.
- `tools/source/material_groups.json`: the two-level taxonomy (fifteen material groups in MRO supplies,
  packaging, chemicals and services), shared with the Data Quality Agent (decision N1).
- `data/fx.js`: the scenarios' prices in pounds are fixed in pounds; the background's are set at the
  bundled rate, so the background stays within a few per cent at any snapshot. A new snapshot rebuilds the
  world and its frozen figures in the same pull request. Rebuilt at rates from 1.14 to 1.22 EUR per pound,
  the world passes every check (19 Nov 2026), so a snapshot within that band changes no pattern.

The world holds the four plants, 132 suppliers (the 124 accounts and eight additions from 80001: seven in
Birmingham invoicing in pounds and a distributor in Lyon), 12 buyers shown by role and team, 64 materials,
24 contracts, 1,538 order lines (1,536 in the window, two of the baseline's before it) and two value-log
entries. DATA_SOURCES.md section 4 lists each planted scenario.

## 6. Front-end, fonts and browser security

No build step, no library, no font or script from a third party: Vici v1.0.0 sits in `vici/` unchanged
and brings its own fonts. The page's data are scripts that set `window.*` globals, because the policy
allows no fetch from the page's own origin.

### Content Security Policy (meta tag in `index.html`)

Exactly the brief's (section 4), checked by `tests/unit.mjs` (group `static`, AC-07):

`default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src https://api.anthropic.com https://api.frankfurter.dev; object-src 'none'; base-uri 'none'; form-action 'none'`

Every storage key starts with `pv.` (`js/config.js`), apart from Vici's theme choice, `vc-theme`. GitHub
Pages serves all of an account's project sites from one origin, so a sister app must never share a key.

## 7. The engine and the data contracts

Pure ES modules that run in the page and in Node, with no DOM, storage or fetch:

| Module | Does |
| --- | --- |
| `js/normalise.js` | One line's normalisation under the step names of brief section 10, or why it is excluded |
| `js/groups.js` | Comparable groups: material, manufacturer part number, confirmed clusters; the window; the lines after an implementation |
| `js/variance.js` | Pairs, benchmark, gaps, justified and unexplained parts, totals, spread, index, materiality; the scan; the portfolio index |
| `js/options.js` | H, R, B and accepting the variance, with their figures and warnings |
| `js/pipeline.js` | Identified, approved, implemented and realised value, and the leakage |
| `js/params.js` | The parameters with their defaults |
| `js/format.js` | Every display string: Intl with en-GB after rounding to 1e-9 |
| `js/figures.js` | The figure audit (brief section 7, rule 7) |
| `js/schemas.js`, `js/schema.js` | The JSON Schemas of the data contracts and a validator without a dependency |
| `js/world.js` | The engine's context at the bundled rates, the scan of the world and its value pipeline |
| `js/exports.js` | The export file names, the report's simulation banner and a group's analysis as CSV (RFC 4180, a byte order mark, numbers to 1e-9) |

The sixteen contracts of brief section 10 are in `js/schemas.js`, with CompanyCode, MaterialGroup and
Buyer for the world's other products, AnalysisLine and Pair for the parts of a group analysis, and since
1.0.0 Parameters and AuditExport, the contract of the audit log's JSON export (its run, parameters,
decisions with their reviewer, rates, usage and events). Where a schema offers alternatives (`anyOf`) and
only one of them gets past its type, the validator reports that alternative's own errors, so a broken
export names the field that is wrong rather than "one of 2 alternatives".
`tools/check_world.mjs` validates every record of every data product against them. The validator supports
the keywords those schemas use and treats any other keyword as an error, so a schema never silently checks
less than it says.

The figure audit reads English only: a comma before exactly three digits groups thousands, a dot is the
decimal point, and anything else ("€1.738,80") is reported as written. Amounts of any size are checked,
with no €0.50 floor; a written figure matches within half a unit of its last digit and, for amounts,
within 2 % of the figure. Ids, plant and company codes, supplier numbers and the pair form "1010 / S-A"
must exist; dates, times, version numbers and names with numbers are exempt.

## 8. Build decisions log

| # | Decision | Taken |
| --- | --- | --- |
| D1 | Product name "Price Variance Agent"; card subtitle "Procurement price variance" | The brief's default |
| D2 | Page icon Vici's `trend-down` in a lilac cell, kind "prototype"; the website's card, on its main branch since 20 Nov 2026 with the note "Work in progress.", gets its release note ("Free simulation, no API key needed. Fictional company, no client data.") in the website's pull request #5, proposed for Victor's approval | The brief's default; the card text in M3 |
| D3 | No German interface in version 1 | The brief's default |
| D4 | The method's parameters as brief section 6.6, labelled as assumptions | The brief's default |
| D5 | One world with the Data Quality Agent, no runtime dependency | The brief's default, through N1 |
| D6 | Authored simulation scripts; recorded runs curated later | The brief's default |
| D7 | The production path in the intro window and the README | The brief's default |
| N1 | The taxonomy and the account extract as data files the Data Quality Agent can copy | Approved by Victor, 19 Nov 2026 |
| N2 | The rate snapshot from a workflow pushing to a review branch; the labelled fallback until it runs | Approved by Victor, 19 Nov 2026 |
| N3 | Realistic annual sizes for the planted figures | Approved by Victor, 19 Nov 2026 |
| P-1 | Sister module names; the engine as flat, pure modules in `js/` | Approved with the plan |
| P-2 | Rebate Hunter's run events plus `confirmation_request`, `confirmation_decision`, `fx_sensitivity` and `param_change` | Approved with the plan |
| P-3 | `strict: true` on the 16 tools, dropped once on a 400 that names it | Approved with the plan; M2 |
| P-4 | Opportunity identified and the index fill from a run's own engine results; approved savings show the value log from the start | Approved with the plan; the tiles of 0.1.0 follow it |
| P-5 | The recommended option has the highest savings less one-off cost, or a reason the audit checks | Approved with the plan; M2 |
| P-6 | Each milestone's GATES.md stays in the session's working folder; the pull request reports the gates | Approved with the plan |
| M1-1 | Background prices in pounds at the bundled rate, scenario prices fixed in pounds | 19 Nov 2026, so a new snapshot cannot flag a background group (section 5) |
| M1-2 | Scenario 4 planted smaller than the Phase 0 sizing (B10): Birmingham 18,000 EA at £1.62, Lyon 120,000, Frankfurt 80,000 at €1.90, Duisburg 40,000 at €1.91; Birmingham under 10 % of the quantity, so it never sets the benchmark | 19 Nov 2026: not flagged at the rate, nor 5 % below or above it |
| M1-3 | The past cases: Duisburg's cable ties (H approved day −120 for €8,000 a year, implemented day −90, one leakage line) and Lyon's stretch film (H approved day −12 for €3,400 a year, not implemented) | 19 Nov 2026 |
| M1-4 | The shoe's manufacturer "Brekholt" and part number "BH-7730-S3" are invented; a web search on 19 Nov 2026 found no maker of that name | 19 Nov 2026 |
| M1-5 | Version 0.1.0's board shows the engine's check of every group (a table), until the board of M2 replaces it | 19 Nov 2026; replaced in 0.2.0 |
| M2-1 | A simulation is a scripted model: every scripted tool call runs through the live toolbox (`js/tools.js`), so the engine recomputes every figure at playback and every guardrail applies as in Live | 20 Nov 2026 |
| M2-2 | Scripts name the engine's figures as placeholders (`{{opportunity}}`, `js/sim_vars.js`) filled at playback; a script with a typed figure fails the checker | 20 Nov 2026 |
| M2-3 | Three guards beyond the brief's: options only after a verified alert of the same group; none for a group below materiality; one alert group per run | 20 Nov 2026: each closes a way to propose options the alert never showed |
| M2-4 | The figure audit's scopes: the facts of the run's tool results, each comparison on its own, and a sensitivity's figures only in the alert and the report | 20 Nov 2026 |
| M2-5 | A text the figure audit refuses twice is shown with an "Unchecked" tag naming the figures | 20 Nov 2026, Rebate Hunter's rule |
| M2-6 | The ladder lays each pair's lines in a lane above its hexagon, nudged into a honeycomb ribbon where they share a price; with the drawer open the ladder is compact and shows the pairs only | 20 Nov 2026: every line of a contract pair has one price, so the lines hid under the pair's hexagon and could not be opened |
| M2-7 | The value pipeline's bars use teal, apricot and the two greys in stage order; the flagged groups all teal | 20 Nov 2026, brief section 9 |
| M3-1 | A ladder row is the target for its pair and its lines: a full-height band of at least 58 px (44 px on a compact ladder) opens a popover that lists every line as a button to its normalisation, with a way back; the line hexagons are marks, hidden from pointer and assistive technology | 20 Nov 2026: an 8 px line cannot be a 40 px target (AC-17) without covering its neighbours, and the row already names its lines |
| M3-2 | The parameters are edited in the Method dialog between runs; a live run freezes the values it starts with, a simulation always plays at the defaults, every change is a `param_change` of the person, carried with the time it was made into the next live run's audit log, the audit export records the values in effect and those changed, a reload restores the defaults, and a live run with changed parameters cannot be saved as a simulation | 20 Nov 2026: a script's figures are the defaults' figures, and a recording at other values would replay figures the engine no longer gives |
| M3-3 | Export names `price-variance-<run>-<MODE>-report.md`, `…-<group>-analysis.csv` and `…-audit.json`; a simulation's report starts with a SIMULATION banner; the CSV has one row per line, excluded lines with their reason | 20 Nov 2026, brief section 9 |
| M3-4 | The audit export gets its own schema (AuditExport) and the accept and unit suites validate real exports with the app's validator, with planted faults that must be refused | 20 Nov 2026, AC-16 |
| M3-5 | Scenario 1 is marked `start_here` in `data/scenarios.js`: the console tags it *Start here*, the demo script uses it and `tests/sims.mjs` timing plays it at ×1 | 20 Nov 2026, AC-21 |
| M3-6 | Disclosure summaries, the cluster dialog's line choices and the board's small controls are 40 px targets; a checkbox counts with its label, and a link inside a sentence is prose | 20 Nov 2026, AC-17 |
| M3-7 | The live-site test and workflow are the Timetable Translator's, adapted: the served files equal the commit's and scenario 1 runs to Done on the published site after every Pages build | 20 Nov 2026 |

## 9. Live-agent guardrails

In code, in `js/tools.js` with the policy in `js/guards.js`, shared by the live loop, the simulation player
and the script checker (AC-09, `tests/live.mjs` guard, `tests/engine.mjs` GR). A refused call returns an
error to the model, names the rule, and shows a Guardrail line in the console:

| Rule | Refused |
| --- | --- |
| input | An input that breaks its tool's schema (`js/schema.js`) |
| groups | A comparison of a material group, a candidate or two groups at once; an alert naming lines of another group; a second alert group in one run |
| cluster | A cluster nobody confirmed; free-text lines become comparable only through `ui_confirm_cluster` |
| alert | A verified alert without its `pv_compare` result, without three normalised lines (one of the benchmark pair, one of the highest pair among them) or without the benchmark supplier's contract looked up |
| options | Options outside the latest `pv_compare` of the group, before its verified alert, for a group below materiality, fewer than two distinct applicable ones, or after a decision; a stale decision (a superseded option set, a rejected option) |
| drafts | A draft before an approval, or of a kind the approved option does not allow; both footers are added in code |
| report | A report before every decision and draft is settled, or an outcome the decision does not give |
| figures | A figure no tool returned (section 7), in the alert, the option texts, the cluster note, the drafts and the report: refused twice with the offending tokens, then shown with an "Unchecked" tag |

Rebate Hunter's caps of 40 calls and €3 a run, the budget checked before every call (B8), and the
recommended option's rule (P-5) hold in both modes.

## 10. Simulation scripts and recorded runs

`data/sim_runs.js` holds six authored scripts (`"source": "authored"`), one per scenario, in steps the
player (`js/simulation.js`) runs: `say` and `think` for narration, `tool` for any engine or ERP tool, `open`
for a rate with its representative result, `board`, `alert`, `confirm` with a branch per answer of the
person (confirmed, split, rejected), `propose` with the option texts and the decision loop, `draft`,
`awaitApprovals`, `report`, `if` on a filled variable, and `expect: "refused"` on a step that shows a
guardrail at work (scenario 3's first alert). Every figure is a placeholder the engine fills at playback
(M2-2); open data is replayed and labelled "representative". Scenario 4 ends with `nothing_found`.

`tools/check_world.mjs` and `tests/engine.mjs` (group S) play every script on every path with an automatic
person through the live toolbox (AC-13): approving the recommendation, rejecting it and approving another,
accepting the variance, and each answer to scenario 2's cluster. A script fails when a step is refused that
should not be, a placeholder stays unresolved, a figure is typed, the alert comes before its evidence,
the contract lookup or the hypothesis is missing, or fewer than eight calls precede the decision; the
group S cases plant each fault and must catch it.

"Save run as simulation" in the Audit tab turns a completed live run of a preset scenario into a recorded
script (`"source": "recorded"`, `js/recorder.js`): the key never enters it, the checker must accept it
before it is kept, and its open data replays as "recorded" (`tests/live.mjs` record).

## 11. Verification log

| Date | What | Result |
| --- | --- | --- |
| 19 Nov 2026 | Golden cases G1 to G5 recomputed in Phase 0 | 132 checks, no disagreement with the brief |
| 19 Nov 2026 | `node tests/engine.mjs` (G1, G2, G3, G4, G4b, G5, normalisation, display) | ENGINE OK, 316 checks |
| 19 Nov 2026 | `node tests/audit.mjs` (F01 to F16 and the rules around them) | 16 of 16 as the brief expects; 53 checks |
| 19 Nov 2026 | `node tools/check_world.mjs` at the snapshot rate | WORLD OK, 68 checks |
| 19 Nov 2026 | The world rebuilt at 1.13 to 1.24 EUR per pound | Passes from 1.14 to 1.22; at 1.13 the approved stretch film group is flagged and scenario 4's tip reads under 2 %, at 1.23 scenario 4 is flagged at 5 % above the rate |
| 19 Nov 2026 | First run of `fx-snapshot.yml` | Snapshot built; failed in the engine suite, which picked a cancelled line in pounds as the line to check the rate on; the test now takes a line that is not cancelled |
| 19 Nov 2026 | Second run of `fx-snapshot.yml` | Passed; pushed `fx/2026-11-19-2` |
| 19 Nov 2026 | Negative controls: a planted error in each of the world checker, the parity test, the static checks and the smoke test | Each fails as it should |
| 20 Nov 2026 | `node tools/check_world.mjs`: the world and the six scripts on every path | WORLD OK, 77 checks; SCRIPTS OK, 6 scripts, 38 paths |
| 20 Nov 2026 | `node tests/engine.mjs` with GR (the guardrails call by call) and S (the scripts, with planted faults) | ENGINE OK, 388 checks |
| 20 Nov 2026 | `node tests/unit.mjs`: the tool schemas within the strict limits, the storage rule with a planted control, the golden data current | UNIT OK, 58 checks |
| 20 Nov 2026 | `node tests/live.mjs` against the scripted stand-ins: guard, rates, caps, record, entries | Every case passes; no request reaches a real host |
| 20 Nov 2026 | `node tests/sims.mjs`: 16 runs along every decision path, the cluster dialog's three answers, the words | SIMS OK; every run offline, without a key |
| 20 Nov 2026 | `node tests/accept.mjs` (the key) and `node tests/smoke.mjs board` (the board against the engine) | ACCEPT OK, 22 checks; SMOKE OK, board, 23 checks |
| 20 Nov 2026 | `node tests/design.mjs series`, with ten planted bars in forbidden colours | DESIGN OK, 14 checks; every planted bar caught |
| 20 Nov 2026 | `node tests/tokens.mjs` with the board's pairs | Three marks failed at first (the justified hatch in `--vc-warning-solid`, the cluster columns in `--vc-feature-border`); now drawn in `--vc-warning-text` and `--vc-feature-solid`, 83 pairs pass in both themes |
| 20 Nov 2026 | M3, the exports: `node tests/unit.mjs exports` and `node tests/accept.mjs exports` | UNIT OK, exports, 19 checks (names, banner, the CSV of three groups against the engine, an audit export valid against AuditExport, nine planted faults refused); ACCEPT OK, key and exports, 41 checks (the report, the analysis and the audit log downloaded from the page). A fault planted inside an `anyOf` first gave only "one of 2 alternatives"; the validator now names the field (section 7) |
| 20 Nov 2026 | M3, the layout: `node tests/layout.mjs viewports targets controls` | The first runs failed: compact ladder rows of 35 to 39 px, disclosure summaries of 20 to 26 px, the cluster dialog's checkboxes of 10 by 13 px (fixed, M3-1 and M3-6), and a false "control bar wraps" (the check counted rows by their top edges; it now compares vertical extents). Then LAYOUT OK, 176 checks: five sizes, both themes, every main state; the planted overflow, ellipsis and small target each caught |
| 20 Nov 2026 | M3, the keyboard run: `node tests/smoke.mjs keyboard-run` | At first two stops (a dialog's close button, the Simulation card's button) showed "no focus ring": Vici draws those rings with `::after` and on the parent card, which the check did not read; it does now, with no change to the app. SMOKE OK, 8 checks: scenario 1 to Done by keyboard alone, a visible indicator at every stop |
| 20 Nov 2026 | M3, reduced motion, names and the Method dialog: `node tests/smoke.mjs motion names method board` | SMOKE OK. An independent run of `motion` caught Vici's boot spinner, which keeps turning under reduced motion by Vici's design (2.4 s a turn) during the 400 ms the boot screen takes to leave; sampling now starts once it has left (three runs pass) |
| 20 Nov 2026 | M3, the demo's timing: `node tests/sims.mjs timing` | Scenario 1 at ×1, every answer given at once: the decision after 27.6 s, Done after 92.6 s (limits 45 s and 150 s) |
| 20 Nov 2026 | M3, the parameters in a live run: `node tests/live.mjs params` | First four failures: the test reloaded the page before the run, which restores the defaults (the parameters live in the page). Then one: the run's audit lost a change made before the run, because the log is reset when a run starts; the app now carries such changes into the next live run's log with the time they were made (M3-2). LIVE OK, params, 9 checks |
| 20 Nov 2026 | M3, the live-site check: `tests/live_site.mjs` against this checkout served over http, and against a copy with `js/config.js` changed | Passes against the checkout (the files equal, scenario 1 to Done); fails against the changed copy, as it should |
| 20 Nov 2026 | SAP field names of DATA_SOURCES.md section 6 (EKKO-INCO1, MARM, MARA-MFRPN), by web search | Verified in data-dictionary references and SAP's knowledge-base previews |
| 20 Nov 2026 | M3, the page icon against the website's card: the shared `tests/page-icon.mjs` with the website at its pull request's head next to the app, and with the card's icon changed | Matches (`trend-down`, prototype); the changed icon is caught |

## 12. Acceptance checklist

| ID | Criterion (brief section 12) | Milestone | Status |
| --- | --- | --- | --- |
| AC-01 | G1 to G3 to within 1e-9, every display string | M1 | `tests/engine.mjs` G1 G2 G3 |
| AC-02 | G4, G4b's not-applicable case, G5 | M1 | `tests/engine.mjs` G4 G4b G5 |
| AC-03 | Normalisation: price units, every conversion in the world, the person-day, exclusions, currencies, Incoterms 2020 | M1 | `tests/engine.mjs` N |
| AC-04 | The figure audit's F01 to F16 | M1 | `tests/audit.mjs` |
| AC-05 | The world: deterministic, 124 accounts, the scenarios with frozen figures, scenario 4 unflagged, the past case | M1 | `tools/check_world.mjs` |
| AC-06 | Parity with exactly two adapted modules listed in REVIEW.md; the four shared tests with this app's values | M1 | `tests/parity.mjs`, `tests/tokens.mjs`, `tests/page-icon.mjs`, `tests/vici-files.mjs`, `tests/hexagon.mjs` |
| AC-07 | The security policy, nothing from a third party, `pv.` storage keys | M1 | `tests/unit.mjs` static, `tests/smoke.mjs` storage |
| AC-08 | The key: asked only for Live, checked, kept in this tab, never stored, exported, recorded or logged; Forget key; no frame | M2 | `tests/accept.mjs` key |
| AC-09 | Every guardrail refused with a Guardrail line, against the scripted API stand-in | M2 | `tests/live.mjs` guard, `tests/engine.mjs` GR |
| AC-10 | *Your confirmation* in merlot on Check, the rail never moving back; a failing or blocked rate leaves the bundled rates; a refreshed rate a labelled sensitivity | M2 | `tests/sims.mjs` confirmation, `tests/live.mjs` rates |
| AC-11 | Never a 41st call, none once €3 is spent; the cost meter within 1e-9 | M2 | `tests/live.mjs` caps |
| AC-12 | The six simulations offline without a key, on every decision path; scenario 4 ends with nothing to propose | M2 | `tests/sims.mjs` paths |
| AC-13 | Every simulation script passes under the live guardrails | M2 | `tools/check_world.mjs`, `tests/engine.mjs` S |
| AC-14 | The ladder and the portfolio chart equal the engine; every line opens its normalisation; the tables; series colours | M2 | `tests/smoke.mjs` board, `tests/live.mjs` entries, `tests/design.mjs` series |
| AC-15 | No "saved"; approved savings "a year", realised "to date" | M2 | `tests/sims.mjs` words |
| AC-20 | Victor runs one scenario live with his key; the audit export shows model, usage, rates and cost | M2 | Manual: Victor's run (the pull request lists the steps) |
| AC-16 | The exports carry their names and content; the JSON exports validate against the schemas with the app's own validator | M3 | `tests/accept.mjs` exports, `tests/unit.mjs` exports |
| AC-17 | 1920 × 1080 to 1280 × 720, both themes: no horizontal overflow, nothing on the board or the tiles cut to an ellipsis, every target at least 40 px | M3 | `tests/layout.mjs` viewports, targets and controls |
| AC-18 | The four shared design tests: contrast in both themes, nothing round, the page icon matching the website's card, `vici/` as its release | M3 | `tests/tokens.mjs`, `tests/hexagon.mjs`, `tests/page-icon.mjs` (against the website's checkout in CI), `tests/vici-files.mjs` |
| AC-19 | A run by keyboard alone with visible focus; reduced motion stops the pulses; markers and rows have accessible names | M3 | `tests/smoke.mjs` keyboard-run, motion and names |
| AC-21 | Victor gives the five-minute demo at ×1 without help | M3 | Manual: Victor's demo with `DEMO_SCRIPT.md`; `tests/sims.mjs` timing measures the demo's run at ×1 |
| AC-22 | An agent that did not build the prototype reviews figures, comparability, the honesty rules and the interface; no high or medium finding stays open | M3 | `REVIEW.md` part 2 |
| AC-23 | README, DESIGN, TECH_NOTES, DATA_SOURCES and DEMO_SCRIPT complete; hygiene and the documents check pass | M3 | `tests/docs.mjs` --complete, `tests/hygiene.mjs` |
