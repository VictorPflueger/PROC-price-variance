# Technical notes

Verified facts with their dates, the decisions taken with their reasons, and the records of each
milestone. Version 0.1.0 (milestone M1): the shell, the world and the engine. Sections 9 and 10 grow in
milestone M2, the verification log and the acceptance checklist with every milestone.

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
  request's strict schemas; the planned 16 tools have 12 optional parameters and no union types. The list
  of supported keywords was not readable, so every input is also validated in code (`js/schema.js`).

The shared `js/anthropic.js` and `js/keystore.js` are Rebate Hunter's, unchanged. The key is requested only
for Live, checked with `GET /v1/models`, kept in this tab's session storage under `pv.anthropic.key` and
removed by "Forget key"; the live agent arrives in M2 (AC-08).

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

**Frankfurter for live runs (M2).** `open_ecb_rate` keeps Frankfurter's v1 API
(`https://api.frankfurter.dev/v1/...`), which serves the ECB's reference rates only and "remains available
indefinitely"; the v2 API blends 112 sources unless asked for `providers=ecb`. Its CORS behaviour was not
probed from this environment; Rebate Hunter's notes quote "CORS is open and there's no key to leak"
(14 Oct 2026), and PLAN.md Appendix A holds a one-line browser-console check.

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

The sixteen contracts of brief section 10 are in `js/schemas.js`, with CompanyCode, MaterialGroup and
Buyer for the world's other products, and AnalysisLine and Pair for the parts of a group analysis.
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
| D2 | Page icon Vici's `trend-down` in a lilac cell, kind "prototype"; card text proposed in M3 | The brief's default |
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
| M1-5 | Version 0.1.0's board shows the engine's check of every group (a table), until the board of M2 replaces it | 19 Nov 2026 |

## 9. Live-agent guardrails

Arrive in milestone M2 with the live agent (a guards module shared by the tools and the script checker, AC-09): only the engine compares; a verified
alert needs a `pv_compare` result, three normalised lines (one of the benchmark pair, one of the highest
pair) and the benchmark supplier's contract looked up; options from the latest comparison; drafts only of
the kinds the approved option allows, with both footers added in code; the report only after every
decision; the figure audit (section 7) on every text; Rebate Hunter's caps of 40 calls and €3, the budget
also checked before every call (B8).

## 10. Simulation scripts and recorded runs

Arrive in milestone M2: six authored scripts in Rebate Hunter's format (`"source": "authored"`), every
figure a placeholder the engine fills at playback, held to the live guardrails by
`tools/check_world.mjs` (AC-13). Scenario 4's script ends with `nothing_found`.

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
| AC-08 to AC-15, AC-20 | The live agent, the board, the simulations | M2 | Open |
| AC-16 to AC-19, AC-21 to AC-23 | Exports, layout, design, accessibility, documents, review | M3 | Open |
