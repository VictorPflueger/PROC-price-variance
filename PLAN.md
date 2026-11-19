# Price Variance Agent: build plan

**Status:** Phase 0 plan of 19 November 2026, waiting for approval. No app code yet.

This plan turns the build brief into three milestones. The brief decides what to build; this file decides how, in which order, and how each step is proven. Where the plan departs from the brief or from a sister prototype, it says so and gives the reason. Figures from the brief appear here unchanged. The brief itself stays outside the repository.

The Price Variance Agent compares what GlobalCorp SE, the fictional industrial group of Rebate Hunter, pays for the same item or service across plants, suppliers, countries and company codes. A deterministic engine normalises every order line to one comparable price, sets a benchmark from the best price GlobalCorp already pays at volume, splits each gap into a justified and an unexplained part, prices the unexplained part as an opportunity a year and costs the ways to close it. The agent checks the evidence, proposes, waits for a person and drafts; value is tracked as identified, approved, implemented and realised.

Contents: [0 Summary](#0-phase-0-in-one-page) · [1 Findings and probes](#1-phase-0-findings) · [2 Architecture](#2-architecture-and-file-tree) · [3 World and scenarios](#3-the-world-and-how-each-scenario-is-planted) · [4 Exchange rates](#4-the-exchange-rate-snapshot) · [5 Engine](#5-the-engine-and-the-value-pipeline) · [6 Events, tools, guardrails](#6-run-events-tool-schemas-and-guardrails) · [7 Screens](#7-screens) · [8 Tests and CI](#8-test-plan-and-ci) · [9 Milestones](#9-milestones-and-acceptance-criteria) · [10 Risks](#10-risks-and-how-i-will-test-them) · [Appendix](#appendix-a-browser-console-probe-for-the-ecb-rates)

---

## 0. Phase 0 in one page

**What I did.** Read the brief in full. Recomputed the golden cases G1 to G5 from their fixtures (132 checks, no disagreement) and ran F01 to F16 through a scratch figure audit written to the brief's rules (16 of 16 as expected). Checked the brief's account counts against Rebate Hunter's world by script (143, 129, 17 and 124: all as stated). Studied the sister prototypes at their current commits (Rebate Hunter 7.2.0 `73c00f8`, Navigator 1.2.0 `61f1483`, Timetable Translator 1.4.0 `04006b6`, Repack Pilot 0.5.0 `c319649`) and Duty Radar's plan of today; section 1.1 says what line by line and what by outline. Read Vici v1.0.0 at `fdd868b` and the website's card list at `f6f7aae`. Played one Simulation of each sister to its end in headless Chrome from local clones. Probed the Claude API's CORS behaviour from the shell and from a real Chrome page, re-verified model IDs, prices, API versions, thinking display and the strict-tool limits, and measured a draft of all 16 tool schemas against those limits. Sized the six scenarios with the method at two exchange rates. Found the Data Quality Agent's repository still empty.

**The plan in five lines.**

1. The sister shell carries over as the brief says: Vici, the shared modules and stylesheets, the four shared design tests, parity, hygiene and docs. Two shell modules are adapted openly, `js/handover.js` and `js/progress.js`, for the third human step *Your confirmation*, the way Repack Pilot did it, while keeping Rebate Hunter's five steps.
2. A pure engine owns every price, quantity, amount, share and date: normalisation, comparable groups (material, manufacturer part number, confirmed clusters), benchmark, gaps, options and the value pipeline. It reproduces G1 to G5 and the 16 audit cases, and runs in Node and in the page.
3. One run-event stream drives the screen in both modes. Live runs Rebate Hunter's loop with 16 tools whose every input is validated against its schema; Simulation replays six authored scripts with every figure recomputed at playback, held to the same guardrails by the checker.
4. The world is GlobalCorp SE with Rebate Hunter's 124 deduplicated accounts, four plants, about 1,500 order lines and six planted patterns; the exchange rates come from the ECB's time series through a tool that runs in GitHub Actions, because this environment cannot reach the ECB or Frankfurter.
5. Three milestones as in the brief, each one branch and one pull request with green CI: M1 shell, world and engine (v0.1.0), M2 agent, board and Simulation (v0.2.0), M3 hardening and release (v1.0.0).

**Decisions for you** (section 1.7): the brief's defaults D1 to D7, which I recommend as they stand, and three new ones: N1 the material-group taxonomy, which the Data Quality Agent has not defined yet; N2 the exchange-rate snapshot built in GitHub Actions; N3 the scale of the planted figures.

**What I need from you.**

1. Enable GitHub Pages: Settings → Pages → Deploy from a branch → `main` / `/ (root)`. The session proxy refuses the Pages API to me (HTTP 403), and it is a repository setting.
2. Add the repository secret `HYGIENE_TERMS` (Settings → Secrets and variables → Actions), one term per line, naming only what would reveal the relationship. Leave out public products and the public bodies the prototype cites, because the check matches whole words in every file and has no allowlist. The proxy refuses the secrets API to me too.
3. Optional: run the one-line probe of Appendix A in your browser and send me the line it prints. It answers whether the ECB rates through Frankfurter are readable from your site's origin, and gives a cross-check for the snapshot.
4. Approve or change the decisions. Then I start M1.

---

## 1. Phase 0 findings

### 1.1 What I read

| Source | What | Notes |
| --- | --- | --- |
| Build brief (project file, 19 Nov 2026) | In full | G1 to G5 and F01 to F16 recomputed (section 1.5) |
| Rebate Hunter 7.2.0 (`73c00f8`) | Line by line: `js/config.js`, `js/events.js`, `js/figures.js`, `js/guards.js`, `js/sim_vars.js`, `js/source_health.js`, `js/handover.js`, the ECB part of `js/opendata.js`, the request body and the stop handling of `js/agent.js` (by search), the policy and regions of `index.html`, TECH_NOTES §1 to §4, DESIGN §3, README *Reading the screen*. By outline and search: the header of every other module, `data/` (the world's structure, the scenarios, the first simulation script), `tools/build_world.mjs`, `tests/` and the workflow | The reference shell and the procurement sibling. Its world's account counts checked by script (section 1.5) |
| Timetable Translator 1.4.0 (`04006b6`) | Line by line: REVIEW Parts 1 to 4, `tests/parity.mjs`, `tests/hygiene.mjs`, `tests/docs.mjs`, `tests/run-all.mjs`, `js/tool_plain.js`, both workflows, the browser part of `tests/lib/harness.mjs`. By outline: `tests/lib/prototype.mjs`, `tests/sims.mjs`, the rest | REVIEW Part 2's shared-shell list is the base of the reuse map |
| Repack Pilot 0.5.0 (`c319649`) | PLAN.md §0, §1 and §a (the approved Phase 0 plan and its reuse map), TECH_NOTES D71 to D83, `js/handover.js` and `js/progress.js` diffed against Rebate Hunter's; the headers of `js/human.js`, `js/assumptions.js`, `tests/lib/script_fake.mjs` and `tests/lib/contrast.mjs` | The model for the two adapted shell modules (section 2.5) |
| Navigator 1.2.0 (`61f1483`) | The opening of TECH_NOTES §3 (its sources and the live CORS probe of 12 October); the module list; its Simulation played | Lacks `js/clock.js` and `js/labels.js`; loads Leaflet and map tiles from outside hosts, so it is no model for the security policy |
| Duty Radar (`b5cf15e`) | PLAN.md §0 to §3, §7 to §9 and the appendices; its probe log of today, re-checked (section 1.4) | Started today from a brief like this one; its M1 is merged |
| Vici v1.0.0 (`fdd868b`) | Guidelines: colour, hexagon, layout, typography, data visualisation; `dist/tokens.json`, `dist/vici-icons.svg` | `trend-down` is one of Vici's icons. Categorical data colours 1 to 6 are merlot, teal, apricot, fjord, lilac and honey, 7 and 8 greys; no pies or donuts; numbers also as a table |
| Website (`f6f7aae`) | README (adding a card), `data/prototypes.js` | A card has name, kind, subtitle, description, url, code, icon, tags and note |
| Data Quality Agent (`VictorPflueger/PROC-data-quality`) | Cloned at 19:11 UTC | Empty: no commit, so no plants, accounts or material-group taxonomy to align with yet (B1, N1) |

### 1.2 Sister prototypes played

This environment's network allowlist refuses `victorpflueger.github.io` (`connect_rejected`). I served each clone locally at the commit Pages deploys and played its default scenario's Simulation to the end at ×4 in headless Chrome 153.0.8010.12 (Playwright 1.63), approving the recommended option, every confirmation and every draft, with every request to another host blocked and counted.

| Prototype | Scenario | Result | Replay | Outside requests |
| --- | --- | --- | --- | --- |
| Rebate Hunter | Cisco acquisitions | Done; option A approved, two drafts approved; SIMULATION marked; no page error, no policy violation | 18 s at ×4 | None |
| Navigator | Tangier harness fire | Done; option B approved, five drafts; same markings | 18 s | unpkg.com, cdn.jsdelivr.net, tile.openstreetmap.org (blocked; the run still completes) |
| Timetable Translator | Platform change | Done; option A approved, two drafts; same markings | 11 s | None |
| Repack Pilot | Unknown item | Done; *Your confirmation* in merlot on the rail and in the status tag, then confirmed; same markings | 22 s | None |

Screenshots at 1920 × 1080 and 1280 × 720 stay outside the repository (Appendix B).

### 1.3 Target repository

- `VictorPflueger/PROC-price-variance`: public, created 19 November 2026, default branch `main`, size 0, no refs. My session has `admin`, `maintain` and `push`; `has_pages` is `false` (GitHub API, 19:07 UTC).
- The bootstrap commit holds this plan, a README stub and `.nojekyll`. After it, one branch and one pull request per milestone.
- The session proxy refuses the Pages API (`/repos/…/pages`) and the Actions secrets API with HTTP 403, so Pages and the `HYGIENE_TERMS` secret are yours to set (section 0).

### 1.4 Probe log

All on 2026-11-19, times in UTC. "Shell" is this build environment's terminal; "web fetch" is the tool that reads public pages for me and summarises them, so I asked it to quote verbatim.

| # | Probe | How | Result |
| --- | --- | --- | --- |
| P1 | Browser header and CORS: preflight | Shell (Node 22.23.5), 19:19: `OPTIONS /v1/messages` with `Origin: https://victorpflueger.github.io` and the four request headers | 200; `access-control-allow-origin: *`; allow-headers `x-api-key,anthropic-version,content-type,anthropic-dangerous-direct-browser-access`; max-age 600 |
| P2 | Keyless POST, browser header sent | Shell, 19:19, `anthropic-version: 2023-06-01` | 401 `authentication_error`; `access-control-allow-origin: *`; `access-control-expose-headers: *` |
| P3 | Keyless POST, browser header missing | Shell, 19:19 | 401 with no `access-control-allow-origin`: a browser blocks it. The header stays mandatory |
| P4 | Keyless POST with `anthropic-version: 2026-10-21`, header sent | Shell, 19:19 | 401, `access-control-allow-origin: *`: the newer version answers the same |
| P5 | Keyless `GET /v1/models?limit=100` with the header | Shell, 19:19 | 401, `access-control-allow-origin: *` |
| P6 | The same calls from a real page | Chrome 153.0.8010.12 headless, page on 127.0.0.1, 19:19 | With the header the page reads 401 `authentication_error`; without it `TypeError: Failed to fetch` (a CORS block); `/v1/models` with the header: 401, readable. As Navigator's TECH_NOTES §3 found on 12 October |
| P7 | Model IDs | Web fetch, models overview, about 19:22 | `claude-sonnet-5-5`, `claude-haiku-5-5`, `claude-opus-5-5` (and `claude-fable-5-2`): 1M context, 128K output; adaptive thinking on all three, always on for Opus 5.5; default effort Sonnet 5.5 high, Haiku 5.5 medium, Opus 5.5 medium |
| P8 | Prices | Web fetch, pricing page, about 19:22 | Sonnet 5.5 $2 in, $10 out, $2.50 five-minute cache write, $0.10 cache read; Opus 5.5 $4, $20, $5, $0.20; Haiku 5.5 $0.10, $0.50, $0.125, $0.01 for prompts up to 100,000 tokens and $0.50, $2.50, $0.625, $0.05 above. Tool use adds 286 input tokens with `tool_choice` auto. Identical to the sisters' `js/config.js`; 1 USD = 0.894 EUR stays as the brief says |
| P9 | API versions | Web fetch, versioning page, about 19:22 | `2026-10-21` is the newest; it removes `temperature`, `top_p` and `top_k` (a 400 on every model). `2023-06-01` is still listed and stays (brief §4) |
| P10 | Thinking display | Web search of the thinking pages, about 19:30 | `display` defaults to `"omitted"` on Opus 5.5 and the newest models, so the loop keeps Rebate Hunter's `{type: "adaptive", display: "summarized"}`. Opus 5.5 rejects `disabled` and `between_tools`; Haiku 5.5 rejects `between_tools`; Sonnet 5.5 accepts `between_tools` and rejects `disabled` (models overview) |
| P11 | Strict-tool limits | Web fetch, structured-outputs and strict-tool pages, about 19:24; my 16 drafted tool schemas measured by a script | At most 20 strict tools, 24 optional parameters and 16 union-typed parameters across all strict schemas of a request; beyond them "Schema is too complex for compilation" (400) and a 180-second compilation limit. The list of supported JSON Schema keywords did not come through the fetcher. Draft: 16 tools, 12 optional parameters, none union-typed, none of `minimum`, `maximum`, `minLength`, `maxLength`, `maxItems`, `pattern`, `oneOf`, `allOf` or `not` (section 6.2, B11) |
| P12 | ECB reference rates | Shell, 19:18: `www.ecb.europa.eu` and `data-api.ecb.europa.eu` refused (`connect_rejected`). Web fetch of the euro reference rates page, about 19:24 | **Not probed from here.** The page: updated at around 16:00 CET on working days except TARGET closing days; based on a concertation at around 14:10 CET; their use for transactions is strongly discouraged; 29 currencies; reference date 19 November 2026, 1 EUR = 0.83581 GBP; history as CSV, XML and SDMX, and on the ECB Data Portal |
| P13 | Frankfurter: endpoints, versions, CORS | Shell, 19:18: `api.frankfurter.dev` and `frankfurter.dev` refused (`connect_rejected`). Web fetch of frankfurter.dev, about 19:24 and 19:30 | **CORS not probed.** Public API at `api.frankfurter.dev`; v2: `/v2/rates` with `base`, `quotes`, `providers`, `date`, `from` and `to`, and `/v2/rate/{base}/{quote}`; v2 blends all providers by default, ECB rates only with `providers=ecb` or `/v2/providers/ecb/rates`; "The v1 API is deprecated in favor of v2, but remains available indefinitely"; no key; rate-limited without daily caps; the page makes no statement about CORS (Rebate Hunter's TECH_NOTES §4 quoted "CORS is open and there's no key to leak" on 14 October). Appendix A answers it from your site's origin |
| P14 | Incoterms 2020 | Shell: `iccwbo.org` refused. Web fetch of the ICC page; web search, about 19:30 | ICC: Incoterms 2020 is the current edition, in force since 1 January 2020, eleven three-letter rules (the page lists neither the rules nor groups). A chamber of commerce's page (IHK Gießen-Friedberg): group E (EXW), F without main carriage paid (FCA, FAS, FOB), C (CPT, CIP, CFR, CIF), D (DAP, DPU, DDP); by mode, seven for any mode and four for sea and inland waterway. As the brief says |
| P15 | SAP fields | Shell: `help.sap.com` refused. Web search, about 19:30 | SAP's knowledge-base articles (previews on support.sap.com) name EKPO-NETPR (net price, 9 digits and 2 decimals in the standard) and EKPO-PEINH (price unit), and EKPO-BPRME (order price unit). EKKO-INCO1, MARM and MARA-MFRPN not verified yet: DATA_SOURCES (M3) writes "typical source field, not verified" for any field still unverified then |
| P16 | GitHub | `gh api`, 19:07 | As section 1.3 |
| P17 | The sisters' live sites | Shell, 19:18 | `victorpflueger.github.io` refused (`connect_rejected`); the sisters were played locally (section 1.2) |

**Consequences for the plan.** The shared API module and its headers stay as they are. The exchange-rate snapshot cannot be built here: a GitHub Actions workflow builds it (N2), and until then the app uses the rate Rebate Hunter's TECH_NOTES §4 observed (1 EUR = 0.84385 GBP on 14 October 2026), labelled as a single day's rate. `open_ecb_rate` keeps Frankfurter's v1 (ECB data only), as Rebate Hunter's does (B2).

### 1.5 Golden cases recomputed

**G1 to G5: 132 checks, 0 disagreements.** A throwaway script computes every value of section 11 from the fixtures with the method of section 6 and compares each exact value within 1e-9 and each display string exactly: the nine lines (P7 excluded, "no conversion from PAL to EA"), the six pairs and their shares, the group totals and both materiality flags, the four options with H's moved plants (1020, 3010) and share (115/137, "83.9%"), R's three suppliers and B's bundle part (€283.59, "€284"), the realised value with its leakage, section 10's normalisation of P5, and the tie "-€779". Raw floating point makes the 1e-9 rounding before `Intl` necessary: the opportunity comes out as 1738.7999999999997 and B's savings as 2022.3899999999999. `Intl.NumberFormat("en-GB")` on Node 22.23.5 (ICU 78.3) gives "-€779" for −778.5.

**F01 to F16: 16 of 16 as expected**, with the expected offending tokens, from a scratch audit written to section 7's rule 7; the brief's three notes hold too (F02 passes with Rebate Hunter's €0.50 floor; F15 lies within ±€50 but 2.2 % off; F16 read with a decimal comma would be €9.50, P9's price). Two readings make the cases come out as the brief expects, and M1 writes both into TECH_NOTES:

1. A bare amount may match a unit price at its item's display quantity: "Frankfurt €6.90" in F01 has no "per 100 EA". F16's note says the same.
2. "Half a unit of its last digit" counts the digits as written: "€1,600" is exact to the euro (±€0.50). If its trailing zeros counted as rounding, F07 would match H's €1,621.50 (within ±€50 and 1.3 %) and pass.

**Rebate Hunter's accounts** (section 8.1 of the brief), by script: of 161 vendor accounts, 143 belong to none of the five real groups by group key or register entry, all invoicing in euros, 129 of them in company code 1000; 17 groups share a normalised name and country (among them 30008 and 30098, "Inno IT-Services AG", Paris); keeping one of each leaves 124. All as the brief says.

### 1.6 What I think is wrong, missing or not buildable

| # | Brief | Finding | Proposed fix |
| --- | --- | --- | --- |
| B1 | §8.1, D5: "the same material-group taxonomy as the Data Quality Agent's" | `PROC-data-quality` has no commit (cloned 19:11 UTC): there is no taxonomy, plant list or account rule to align with | I propose the taxonomy (section 3.3) and the account extract (section 3.1) as data files the Data Quality Agent can copy unchanged, whichever is built first (N1) |
| B2 | §6.3 and §7, `open_ecb_rate` | Frankfurter's v2 blends 112 sources by default; a v2 call without `providers=ecb` is not an ECB reference rate | `open_ecb_rate` keeps v1 (ECB only, "available indefinitely"), as Rebate Hunter's does; v2 with `providers=ecb` if v1 ever goes. The snapshot tool reads ECB data only |
| B3 | §8.1, `data/fx.js` | Neither the ECB nor Frankfurter is reachable from this environment | `tools/build_fx.mjs` in a manual GitHub Actions workflow that pushes `data/fx.js` to a review branch (N2); until then Rebate Hunter's rate of 14 October 2026, labelled; Appendix A cross-checks |
| B4 | §11, F01 and F07 | Two readings the cases need but the rules do not state (section 1.5) | Implement both, name them in TECH_NOTES, test them with F01 to F16 |
| B5 | AC-02, the "not applicable" case | No fixture | Variant G4b: M-100 without P6, P8 and P9, with S-A delivering to DE only; the benchmark stays 1010 / S-A and H has no line to move (computed in Phase 0) |
| B6 | §6.3 | Service lines carry no Incoterms | No Incoterms rule, no uplift; a unit test |
| B7 | §6.7 | The boundaries of "after the implementation day" and "the 365 days before implementation" | After: a day later than the implementation day. Before: the 365 days up to the day before it. G5 has no line on a boundary, so boundary cases join the fixtures |
| B8 | §4 and AC-11, "starts none once €3 is spent" | Rebate Hunter's loop stops once a run is above €3 after a call (`>`) | Check `≥ €3` before every call as well as after each one |
| B9 | §8.1, "keep their ids, names, cities, countries, currencies and categories" | Rebate Hunter's accounts also carry an invented tax id and the last four digits of a bank account | Drop both: "no … bank account appears" |
| B10 | §8.2 scenario 4 and §6.6 | The UK's price is in pounds, so its 6 % depends on the rate. Sized at today's ECB rate, the opportunity is €6,328, above €5,000, and only the spread (1.9 % under 5 %) keeps the group unflagged | Plant scenario 4 so that both conditions fail at the snapshot rate and stay failed within ±5 % of it; the world check asserts it, and the frozen figures follow a new snapshot |
| B11 | §4, the strict flag | The draft stays inside the documented numeric limits, but the supported keyword list could not be read | P-3: strict on all 16 tools, logged in TECH_NOTES, dropped once if the API answers a 400 that names it; the schema validator in code checks every input either way |
| B12 | §5, unit prices "per the item's display quantity" | Items whose display quantity is 1 | "€38.00 per EA" (the 1 left out); the audit reads "per EA" as per 1 EA |
| B13 | §9, the tile *Opportunity identified* | At the start nothing has been identified by anyone | The tiles fill from this run's engine results (P-4) |

The brief is otherwise consistent: every figure of section 11 follows from its fixtures, every account count of section 8.1 holds, and the sister files it names exist at the commits it names.

### 1.7 Decisions for you

The brief's decisions, with my recommendation:

| # | Decision | Default | My recommendation |
| --- | --- | --- | --- |
| D1 | Product name and card subtitle | "Price Variance Agent"; subtitle "Procurement price variance" | As the default |
| D2 | Page icon and website card | Vici's `trend-down`, kind "prototype"; card text in M3 | As the default: `trend-down` exists in Vici v1.0.0, in a lilac hexagon cell like Rebate Hunter's |
| D3 | German interface | Not in version 1 | As the default; if you want it later, Duty Radar's way of adding it to the shell |
| D4 | Method parameters | The defaults of §6.6, labelled as assumptions | As the default |
| D5 | One world with the Data Quality Agent | Yes, with no runtime dependency | Yes, through the two data files of N1 |
| D6 | API key for recording simulations | Authored scripts; you record live runs later | As the default |
| D7 | Production-path panel | In the intro window and the README | As the default (section 7.6) |

Three new ones:

| # | Decision | My recommended default | Why |
| --- | --- | --- | --- |
| N1 | Material groups and accounts shared with the Data Quality Agent | **The taxonomy of section 3.3 and the account extract of section 3.1** (`tools/source/material_groups.json`, `tools/source/accounts.json`; of each duplicate-name group the lowest id stays), copied unchanged into the Data Quality Agent | Its repository is empty, so one of the two has to set them; files keep both worlds in step without a runtime link |
| N2 | How `data/fx.js` gets built | **`tools/build_fx.mjs`, run by a manual workflow (`fx-snapshot.yml`) that pushes the snapshot to a review branch; I open the pull request**. It reads the ECB Data Portal's daily series and cross-checks Frankfurter's v1. Until it has run, Rebate Hunter's rate of 14 October 2026, labelled | This environment cannot reach either host (P12, P13); a runner can, and the brief asks for a tool. The pattern is Duty Radar's snapshot workflow |
| N3 | The scale of the planted figures | **Realistic annual sizes**: group spend €110,000 to €817,000 and opportunities of €11,550 to €37,466 a year (section 3.5), about €94,000 identified across the five planted findings | Every figure must survive "is that really comparable?"; a price-variance programme finds percentages of spend, not millions on gloves |

My own proposals, approved with the plan unless you object:

| # | Proposal | Why |
| --- | --- | --- |
| P-1 | Sister module names wherever a sister counterpart exists; the engine as flat, pure modules in `js/` (`js/normalise.js`, `js/groups.js`, `js/variance.js`, `js/options.js`, `js/pipeline.js`, `js/match.js`, `js/params.js`, `js/schema.js`, `js/schemas.js`) | A sister developer finds the same module in the same place; the engine runs in Node for the tests |
| P-2 | Rebate Hunter's run events, plus `confirmation_request` and `confirmation_decision` (Repack Pilot's names, which the adapted `js/handover.js` listens to), `fx_sensitivity` and `param_change` (section 6.1) | The shared rail and status tag work without further change |
| P-3 | `strict: true` on the 16 tools (B11) | Inputs the model cannot get wrong cost no call out of 40 |
| P-4 | *Opportunity identified* and *Price variance index* fill from this run's engine results (the flagged groups of its `pv_scan` and `pv_compare` results, each once); *Approved savings* shows the value log from the start, because it is history; *Session cost* as in the sisters | Nothing reads "identified" before the agent identified it |
| P-5 | The agent recommends the option with the highest annual savings less one-off cost, or gives a reason the audit checks, as Repack Pilot's D51 does | A recommendation the room can check against the cards |
| P-6 | GATES.md for each milestone stays in the session's working folder, as Duty Radar's does; each pull request reports the gates | The ledger carries machine paths; the pull request carries the result |

---

## 2. Architecture and file tree

### 2.1 Layers

1. **Interface:** the sister shell (header with four tiles, control bar, centrepiece, console with the progress rail, drawer with Options, Outbox and Audit, dialogs) with the price board in the centrepiece (Group and Portfolio views, each with its table one click away), the cluster confirmation dialog and the Method dialog.
2. **Run producers:** the Live loop (`js/agent.js`, Rebate Hunter's) and the Simulation player (`js/simulation.js`). Both emit the same run events; the interface never asks which one runs.
3. **Guardrails in code:** `js/guards.js`, `js/figures.js`, `js/schema.js` (tool inputs against their schemas) and `js/drafts.js` (footers), shared by the live tools and the script checker.
4. **Tools:** the 16 tools of `js/tools.js`: data (`erp_*`), engine (`pv_*`), open data (`open_ecb_rate`), person (`ui_confirm_cluster`, `ui_await_decision`, `ui_await_approvals`) and screen (`ui_mark_board`, `ui_report_alert`, `ui_propose_options`, `ui_draft_action`, `ui_final_report`).
5. **Engine:** pure modules (no DOM, no storage, no fetch) for normalisation, comparable groups, benchmark, gaps, options, the value pipeline, matching, parameters and display. Tools are the model's only way to them.
6. **Data:** `data/world.js` (the data products), `data/fx.js` (the window's mean rates), `data/scenarios.js`, `data/reference_cases.js`, `data/sim_runs.js`: scripts that set `window.*` globals, because the policy allows no fetch from the page's own origin.
7. **Audit log:** `js/audit.js` and `js/run_facts.js`, across all layers, exported as JSON.

The model never computes, stores or invents a figure; only a person's decision moves value from identified to approved; nothing leaves the page except a model call and a rate request in Live mode.

### 2.2 How a run works

1. **Start.** The scenario menu holds the six presets, **Live sweep** and **Custom what-if** (both Live only). **Start agent** opens the mode dialog: Simulation needs nothing; Live asks for the key and checks it with `GET /v1/models`.
2. **Spot.** The agent reads the tip (and nothing else), takes the overview, then finds the group: `pv_scan` for the sweep, `erp_query` for a tip's item or service.
3. **Check.** It normalises at least three lines with `pv_normalise` (a line of the benchmark pair and one of the highest-priced pair among them), looks up the benchmark supplier's contract, and for free-text lines proposes a cluster with `pv_match`, which only `ui_confirm_cluster` and a person turn into a comparable group (*Your confirmation*). It may fetch today's ECB rate.
4. **Calculate.** `pv_compare` returns the group in full: pairs, benchmark, every line's gap, justified and unexplained part, the totals, materiality and the options with their figures, optionally beside a labelled sensitivity at a refreshed rate.
5. **Propose.** `ui_report_alert` (refused unless the evidence of rule 3 is in this run), then `ui_propose_options` and `ui_await_decision` (*Your decision*).
6. **Prepare.** Drafts of the kinds the approved option allows, then `ui_await_approvals` (*Your approval*), then `ui_final_report` with the outcome the decision implies. The run facts close the console; the audit exports as JSON; after a live run, "Save run as simulation".

In Simulation the same tools run against the world at playback, so every figure is recomputed by the engine and every text takes its figures from placeholders.

### 2.3 File tree

```text
PROC-price-variance/
├── index.html              policy meta tag (brief §4), boot screen, page icon
├── favicon.svg             Vici's trend-down in a lilac hexagon cell
├── .nojekyll
├── vici/                   Vici v1.0.0, unchanged (vici/README.md)
├── css/                    components, console, drawer, modals, style (shared shell, app block at the
│                           end of style.css) and board.css (price board, cluster dialog, Method dialog)
├── js/
│   ├── shared shell        theme anthropic sse cost keystore clock dom drawer labels md modal (unchanged);
│   │                       handover progress (adapted for "Your confirmation")
│   ├── app shell           config events icons main ui state controls dialogs intro console tool_plain
│   │                       summaries run_facts kpi ai_label audit audit_panel diagnostics diagnostics_view
│   │                       options_panel outbox drafts payoff popovers source_health opendata similarity
│   ├── agent               agent prompt tools guards figures schema schemas simulation sim_vars sim_check
│   │                       recorder exports
│   ├── engine (pure)       world erp normalise groups variance options pipeline match params format
│   └── board               board board_data board_ladder board_portfolio board_table board_pop cluster method
├── data/                   world.js fx.js scenarios.js reference_cases.js sim_runs.js
├── tools/                  extract_accounts.mjs build_world.mjs check_world.mjs build_fx.mjs
│   └── source/             accounts.json (124 accounts) material_groups.json (N1)
├── tests/
│   ├── run-all.mjs README.md
│   ├── lib/                harness prototype fake-claude fake-rates script_fake fixtures
│   ├── fixtures/           m100.json m100-h-not-applicable.json g5.json audit-f01-f16.json normalise.json
│   └── suites              tokens page-icon vici-files hexagon parity hygiene docs unit engine audit
│                           smoke sims live accept layout design live_site remote_head
├── .github/workflows/      tests.yml live-site.yml fx-snapshot.yml
└── README.md DESIGN.md TECH_NOTES.md DATA_SOURCES.md DEMO_SCRIPT.md REVIEW.md PLAN.md
```

### 2.4 Reuse map

Dispositions: **Copy** (unchanged, apart from the names the parity test normalises), **Adapt** (the sister file, changed openly), **Replace** (same role, new content), **Pattern** (read for its design, no code taken), **Drop**, **New**. Every Rebate Hunter file is listed, then the files the shared tests import, then what comes from the other sisters.

#### Shared shell (the Timetable Translator's REVIEW.md, Part 2)

| File | From | Disposition | Note |
| --- | --- | --- | --- |
| `vici/` | Vici v1.0.0 via Rebate Hunter | Copy | Byte for byte, with `vici/README.md`; `tests/vici-files.mjs` and `tests/parity.mjs` check it |
| `js/theme.js` | Rebate Hunter | Copy | The theme before the page is drawn; `vc-theme` is the one shared storage key |
| `js/anthropic.js` | Rebate Hunter | Copy | Streaming, retries, the key check, the browser header (P1 to P6) |
| `js/sse.js` | Rebate Hunter | Copy | |
| `js/cost.js` | Rebate Hunter | Copy | The price-table maths AC-11 checks |
| `js/keystore.js` | Rebate Hunter | Copy | The key under `pv.anthropic.key`, through `STORAGE` in `js/config.js` |
| `js/clock.js` | Rebate Hunter | Copy | Day 0 is today; a recorded run pins it |
| `js/dom.js` | Rebate Hunter | Copy | |
| `js/drawer.js` | Rebate Hunter | Copy | The three tabs Options, Outbox and Audit, and Vici's byline |
| `js/handover.js` | Rebate Hunter, as Repack Pilot adapted it | Adapt | *Your confirmation* as the third human step (section 2.5); in REVIEW.md |
| `js/labels.js` | Rebate Hunter | Copy | |
| `js/md.js` | Rebate Hunter | Copy | |
| `js/modal.js` | Rebate Hunter | Copy | Also opens the cluster confirmation and the Method dialog |
| `js/progress.js` | Rebate Hunter, as Repack Pilot adapted it | Adapt | Rebate Hunter's five steps kept; *Your confirmation* on the furthest step reached (section 2.5); in REVIEW.md |
| `css/components.css` | Rebate Hunter | Copy | |
| `css/console.css` | Rebate Hunter | Copy | |
| `css/drawer.css` | Rebate Hunter | Copy | Same rules |
| `css/modals.css` | Rebate Hunter | Copy | Same rules |
| `css/style.css` | Rebate Hunter | Copy, plus the app block | Up to its marked app-specific block; below it the header's honesty line, the Method button and the tiles' sizes |
| `tests/tokens.mjs` | Rebate Hunter | Copy | This app's colour pairs live in `tests/lib/prototype.mjs` |
| `tests/hexagon.mjs` | Rebate Hunter | Copy | Empty exception list |
| `tests/page-icon.mjs` | Rebate Hunter | Copy | Compares with the website's card whenever a checkout sits beside the repository |
| `tests/vici-files.mjs` | Rebate Hunter | Copy | |

#### Files the shared tests and modules import, and the test and CI infrastructure

| File | From | Disposition | Note |
| --- | --- | --- | --- |
| `js/config.js` | Rebate Hunter | Adapt | `APP.id` "pv", name, version; models and prices as verified (P7, P8); `AGENT` caps 40 calls and €3; 1 USD = 0.894 EUR; `OPEN_DATA` with Frankfurter only; `STORAGE` keys `pv.*`; default scenario |
| `js/events.js` | Rebate Hunter | Adapt | The bus unchanged; the contract comment extended (section 6.1); `RUN_STATES` kept, so the rail and the status tag map as before |
| `js/icons.js` | Rebate Hunter | Adapt | Vici's icons and Rebate Hunter's drawings; `trend-down` for the page icon |
| `tests/lib/harness.mjs` | Timetable Translator | Adapt | `pv.*` keys, the intro flag, the output folder `PV_TEST_OUT` |
| `tests/lib/prototype.mjs` | Timetable Translator | Adapt | This app's name, the price board's colour pairs, the hexagon tour, the page icon (`trend-down`, lilac) |
| `tests/parity.mjs` | Timetable Translator | Adapt | This app's name and the `pv.` prefix in the normalisation; `js/handover.js` and `js/progress.js` move to a list of adapted files that must be named in REVIEW.md; every other shared file identical to Rebate Hunter's `main`, `vici/` byte for byte |
| `tests/hygiene.mjs` | Timetable Translator | Copy | Term list from the `HYGIENE_TERMS` secret or `../.hygiene-terms` |
| `tests/docs.mjs` | Timetable Translator | Adapt | English DEMO_SCRIPT headings (its own expects German ones), this app's documents and live URL |
| `tests/live_site.mjs`, `tests/remote_head.mjs` | Timetable Translator | Adapt | The published site serves this commit and replays scenario 1 |
| `tests/lib/fake-claude.mjs` | Timetable Translator | Adapt | Its protocol checks kept (headers, tool results first, thinking returned unchanged); this app's tools and `strict`; the rate host beside it in `tests/lib/fake-rates.mjs` |
| `tests/run-all.mjs` | Timetable Translator | Adapt | This app's suites (section 8.1) |
| `js/tool_plain.js` | Timetable Translator | Adapt | The plain sentence above each tool call, for the 16 tools |
| `.github/workflows/live-site.yml` | Timetable Translator | Copy | After every Pages build |

#### Rebate Hunter: root, documents and assets

| Path | Disposition | Price Variance Agent |
| --- | --- | --- |
| `index.html` | Adapt | Same skeleton, boot screen and meta policy, with `connect-src https://api.anthropic.com https://api.frankfurter.dev` exactly as the brief has it; the five data scripts; board, console and drawer regions |
| `favicon.svg` | Replace | Vici's `trend-down` in a lilac hexagon cell, drawn for 16 px |
| `.nojekyll` | Copy | In the bootstrap commit |
| `README.md` | Adapt | Stub now; complete at M3, with the production path |
| `DESIGN.md` | Adapt | The same system; the price board, the cluster dialog and the Method dialog in the colour grammar |
| `TECH_NOTES.md` | Adapt | The same sections: verified facts with dates (section 1.4), decisions (D1 to D7, N1 to N3, P-1 to P-6), guardrails, simulation format, verification log, acceptance checklist |
| `DATA_SOURCES.md` | Adapt | What is invented and what is real, the ECB rates with their dates, Incoterms 2020, the SAP fields as verified (section 1.4, P15) |
| `DEMO_SCRIPT.md` | Adapt | Five minutes, in English, with answers to the brief's four questions |
| `REVIEW.md` | Replace | Parity checklist naming both adapted modules with their reason; the independent review at M3 |
| `.github/workflows/tests.yml` | Adapt | The Timetable Translator's: Node 22, ubuntu-24.04, Playwright 1.56.0, the hygiene secret, parity against a fresh Rebate Hunter clone |

#### Rebate Hunter: styles

| Path | Disposition | Note |
| --- | --- | --- |
| `css/style.css`, `css/components.css`, `css/console.css`, `css/drawer.css`, `css/modals.css` | Copy | The shared shell (above) |
| `css/board.css` | Replace | The price board (ladder, portfolio bars, value pipeline, tables), the cluster dialog's columns, the Method dialog |

#### Rebate Hunter: data, tools and tests

| Path | Disposition | Price Variance Agent |
| --- | --- | --- |
| `data/world.js` | Replace | GlobalCorp SE's data products (section 3) |
| `data/scenarios.js` | Replace | The six tips (section 3.5) |
| `data/reference_cases.js` | Replace | Each scenario's frozen reference figures, for the checks only |
| `data/sim_runs.js` | Replace | Six authored scripts (section 6.5) |
| `tools/build_world.mjs` | Replace | Seeded generator of the data products from the account extract and the taxonomy |
| `tools/check_world.mjs` | Adapt | Loads this app's data; the world checks (section 3.7) and the script checker |
| `tools/legacy_seed.mjs`, `tools/legacy_reference.py` | Drop | Rebate Hunter's Streamlit legacy; the account extract replaces it |
| `tests/README.md` | Adapt | Same set-up, this app's suites |
| `tests/run-all.mjs`, `tests/lib/harness.mjs`, `tests/lib/prototype.mjs`, `tests/lib/fake-claude.mjs` | Adapt | From the Timetable Translator (above) |
| `tests/lib/fixtures.mjs` | Replace | Frankfurter's responses in their real shape, for the rate stand-in |
| `tests/unit.mjs` | Adapt | Streaming and cost maths kept; display with the 1e-9 rule; the schema validator |
| `tests/engine.mjs` | Replace | G1 to G5, G4b, the normalisation cases, scan, pipeline, guards |
| `tests/smoke.mjs` | Adapt | Main flows by mouse and keyboard, both board views and their tables, the Method dialog, `file://`, a missing data file |
| `tests/sims.mjs` | Adapt | Six scripts with both decision paths, accept, the cluster's three answers |
| `tests/live.mjs` | Adapt | The live loop against the stand-ins: the refusals of AC-09, the caps of AC-11, rate failure and sensitivity of AC-10 |
| `tests/accept.mjs` | Adapt | The key's lifecycle (AC-08), Diagnostics and the policy, Abort and Reset, offline Simulation, exports (AC-16) |
| `tests/layout.mjs` | Adapt | 1920 × 1080 to 1280 × 720 in both themes: no overflow, no ellipsis, 40 px targets (AC-17) |
| `tests/design.mjs` | Adapt | Colour grammar on the board; no merlot, fjord, lilac, honey or state colour as a series colour (AC-14) |
| `tests/tokens.mjs`, `tests/hexagon.mjs`, `tests/page-icon.mjs`, `tests/vici-files.mjs` | Copy | The shared design tests (above) |

#### Rebate Hunter: modules (`js/`)

| Path | Disposition | Price Variance Agent |
| --- | --- | --- |
| `js/agent.js` | Adapt | Same loop, caps, retries and abort hygiene; no web search; the budget checked before each call too (B8); parallel reads for `erp_*` and `pv_normalise`; every tool input validated by `js/schema.js` |
| `js/ai_label.js` | Adapt | Texts for the alert, the options, the cluster note, the drafts and the report |
| `js/anthropic.js` | Copy | Shared shell |
| `js/audit.js` | Adapt | AuditEvent: alert, evidence, the method, engine, world and exchange-rate versions, reviewer role, decision, timestamp, disposition, parameter changes; key redaction kept |
| `js/audit_panel.js` | Adapt | Filters, JSON export, "Save run as simulation" after a live run |
| `js/board.js` | Replace | The price board: both views, the group in focus, pulses, marks and decisions from the run events |
| `js/board_band.js` | Pattern | Its short-board fallback becomes the compact ladder (one line per pair) while the drawer is open |
| `js/board_data.js` | Replace | Pure view model from the engine's group analysis and scan |
| `js/board_group.js` | Pattern | Pure geometry with label separation and a fit test, for `js/board_ladder.js` |
| `js/board_pop.js` | Adapt | Same popover mechanics and focus return: a line's normalisation steps, a pair's lines and contract |
| `js/board_portfolio.js` | Replace | Sorted bars of the flagged groups' opportunity and the value pipeline's four bars |
| `js/board_race.js` | Pattern | Bars with square ends and brackets, for the ladder's gap bars |
| `js/clock.js` | Copy | Shared shell |
| `js/config.js` | Adapt | Above |
| `js/console.js` | Adapt | The plain sentence above each tool call, Guardrail lines, confirmation entries, the "Unchecked" tag |
| `js/controls.js` | Adapt | Start agent, Scenario, Live sweep, Model, Replay ×1 ×2 ×4, status, Abort, Reset, Method, Diagnostics |
| `js/cost.js` | Copy | Shared shell |
| `js/diagnostics.js` | Adapt | Rows: the Claude API, the ECB rates through Frankfurter, the world and the golden cases ("Run all tests"), the scripts, key and privacy (the policy equals `js/config.js`) |
| `js/diagnostics_view.js` | Adapt | No web-search probe; the parameters read-only |
| `js/dialogs.js` | Adapt | Mode cards, key dialog, Custom what-if, the report; the cluster confirmation and the Method dialog through `js/modal.js` |
| `js/dom.js` | Copy | Shared shell |
| `js/drafts.js` | Adapt | The draft kinds of rule 5; both footers added in code after any truncation |
| `js/drawer.js` | Copy | Shared shell |
| `js/erp.js` | Replace | Queries over the data products, one table for the three `erp_*` tools, the popovers, the player and the checker |
| `js/events.js` | Adapt | Above |
| `js/figures.js` | Adapt | Section 6.4 |
| `js/format.js` | Adapt | `Intl` with `en-GB` after rounding to 1e-9 (section 5.7) |
| `js/guards.js` | Adapt | Rules 2 to 7, shared by the tools and the checker (section 6.3) |
| `js/handover.js` | Adapt | Shared shell, section 2.5 |
| `js/icons.js` | Adapt | Above |
| `js/intro.js` | Adapt | "How it works": the five steps, what it achieves, the production path last |
| `js/keystore.js` | Copy | Shared shell |
| `js/kpi.js` | Replace | Opportunity identified, Price variance index, Approved savings, Session cost (P-4) |
| `js/labels.js` | Copy | Shared shell |
| `js/main.js` | Adapt | Required globals `WORLD`, `FX`, `SCENARIOS`, `REFERENCE_CASES`, `SIM_RUNS` |
| `js/md.js` | Copy | Shared shell |
| `js/modal.js` | Copy | Shared shell |
| `js/opendata.js` | Adapt | Frankfurter only (`ecbRate`), resolve-never-throw, the run's abort signal, the failure memory |
| `js/options_panel.js` | Adapt | The option cards of section 7.2, the recommended card's merlot frame, one solid Approve, Accept the variance with a reason |
| `js/outbox.js` | Adapt | The draft kinds; "Draft. Nothing is sent." |
| `js/payoff.js` | Adapt | Option figures and what a decision changes on the tiles and the board |
| `js/popovers.js` | Replace | Line, pair, supplier, plant and contract details from the same queries and engine results |
| `js/progress.js` | Adapt | Shared shell, section 2.5 |
| `js/prompt.js` | Replace | The mission and rules 1 to 10 |
| `js/rebate.js` | Replace | The engine modules of P-1 (section 5) |
| `js/recorder.js` | Adapt | A live run into the script format, with the world, engine, method and exchange-rate versions |
| `js/run_facts.js` | Adapt | Time, tool calls by kind, lines normalised, guardrail refusals, model calls against the cap, cost |
| `js/sim_check.js` | Adapt | Every script held to the live guardrails, the cluster confirmation and the `nothing_found` path included |
| `js/sim_vars.js` | Adapt | Stable figure names (section 5.8) |
| `js/similarity.js` | Copy | Rebate Hunter's port of difflib's ratio, for `js/match.js`; similarity only proposes, never merges |
| `js/simulation.js` | Adapt | Same player; the cluster confirmation with its three answers; figures recomputed at playback |
| `js/source_health.js` | Copy | Failure memory under `pv.diag` |
| `js/sse.js` | Copy | Shared shell |
| `js/state.js` | Adapt | Parameters and their lock in Simulation, confirmed clusters; `pv.*` keys |
| `js/summaries.js` | Replace | One line per tool result |
| `js/theme.js` | Copy | Shared shell |
| `js/tools.js` | Replace | The 16 tools (section 6.2) |
| `js/ui.js` | Adapt | Same orchestration, with the cluster and Method dialogs |
| `js/world.js` | Replace | Indexes over the data products; day and date helpers |
| `js/world_check.js` | Replace | The world checks of section 3.7 |

#### From the other sisters

| File | Disposition | Note |
| --- | --- | --- |
| Repack Pilot's `js/human.js` | Pattern | Decisions and confirmations queued from the start of a run; every wait rejected at once on Abort and Reset |
| Repack Pilot's `js/assumptions.js` | Pattern | Each parameter with value, unit and basis, editable and logged: the Method dialog's table |
| Repack Pilot's `tests/lib/script_fake.mjs` | Adapt | A fake Claude conversation made from each authored script, so the live suite runs all six scenarios through the real loop |
| Repack Pilot's `tests/lib/contrast.mjs` | Pattern | Contrast measured in the page, open dialogs included |
| Timetable Translator's `js/pop.js` and `js/facts.js` | Pattern | Popovers on a short centrepiece; an audit by scope |
| Navigator's map, Leaflet and geography modules | Drop | No map and no runtime library |

New, without a sister counterpart: the engine modules of P-1, `js/exports.js`, `js/method.js`, `js/cluster.js`, `js/board_ladder.js`, `js/board_table.js`, `data/fx.js`, `tools/extract_accounts.mjs`, `tools/build_fx.mjs`, `tools/source/*.json`, `tests/audit.mjs`, `tests/lib/fake-rates.mjs`, `tests/fixtures/*` and `.github/workflows/fx-snapshot.yml`.

### 2.5 The two adapted shell modules

- **`js/handover.js`** becomes Repack Pilot's version: the awaited step is one of *decision*, *approval* and *confirmation*; `confirmation_request` sets *confirmation* and `confirmation_decision` ends it; the status tag reads "Awaiting your confirmation"; a new `turnLabel()` gives "Your decision", "Your approval" or "Your confirmation".
- **`js/progress.js`** stays Rebate Hunter's (its five steps Spot, Check, Calculate, Propose, Prepare, its state map, and its handling of a run that ends with nothing found, which Repack Pilot's version dropped and scenario 4 needs), with Repack Pilot's two changes: while a confirmation waits, the merlot turn sits on the furthest step reached (Check in the scripted runs, because the confirmation comes before any engine calculation), and the label comes from `turnLabel()`. The rail never moves back.

Both diffs are kept as small as these changes allow. REVIEW.md names both with the reason, and `tests/parity.mjs` checks that every other shared file equals Rebate Hunter's `main`. Any further shell change waits for your approval (brief §4).

---

## 3. The world and how each scenario is planted

### 3.1 GlobalCorp SE, plants and accounts

- **Company codes** from Rebate Hunter: `CC-1000` GlobalCorp SE (Frankfurt am Main, EUR), `CC-2000` GlobalCorp UK Ltd (Birmingham, GBP), `CC-3000` GlobalCorp France SAS (Lyon, EUR).
- **Plants**, shared with the Data Quality Agent: 1010 Frankfurt (headquarters site and central warehouse) and 1020 Duisburg (production) in 1000, 2010 Birmingham in 2000, 3010 Lyon in 3000.
- **Accounts.** `tools/extract_accounts.mjs` reads Rebate Hunter's `data/world.js` at `73c00f8` once: of 161 accounts it keeps the 143 outside the five real groups (by group key and register entry), normalises their names by the Data Quality Agent's rule, keeps the lowest id of each of the 17 duplicate-name groups (30008, not 30098) and writes the 124 to `tools/source/accounts.json` with id, name, city, country, currency, category and company code. The invented tax id and the bank's last four digits are dropped (B9). The world builder reads the extract, never Rebate Hunter's repository.
- **Which accounts buy.** 30 to 40 of the 124 get order lines, chosen by category (MRO supplies, packaging, chemicals, consulting, IT, facility management, security) and by the countries they deliver to.
- **New accounts**, ids 80001 upwards in Rebate Hunter's style, marked as this prototype's additions: suppliers in company code 2000 invoicing in pounds (gloves, pallets, corrugated packaging, an SAP consultancy) and, where no kept account fits, a local distributor in Lyon.
- **Delivery countries.** Every supplier gets `delivers_to`: its own country, plus DE and FR for suppliers in DE, FR, NL, AT, CH, IT and ES; the new British accounts deliver to GB only. Any plant may order from any supplier that delivers to its country.

### 3.2 Data products

`data/world.js` sets `window.WORLD` with the data products of brief §6.1, each row JSON-safe and each field with the type its schema (section 5.1) gives it. Day numbers count from the day the app is opened.

| Data product | Fields |
| --- | --- |
| `po_line` | `id` (order and item, "4500012345-00010"), `order`, `item`, `company_code`, `plant`, `supplier`, `material` (null for free text), `short_text` (in the language it was bought in), `material_group`, `quantity`, `order_unit`, `net_price`, `price_unit`, `currency`, `incoterm` (null for services), `order_day`, `contract`, `buyer`, `urgent`, `urgent_reason`, `cancelled` |
| `material` | `id`, `description`, `material_group`, `base_unit`, `conversions` (base units per order unit), `display_quantity`, `manufacturer`, `mpn` |
| `supplier` | `id`, `name`, `country`, `city`, `currency`, `category`, `company_code`, `delivers_to` |
| `contract` | `id`, `supplier`, `company_code`, `material`, `price`, `price_unit`, `order_unit`, `incoterm`, `currency`, `valid_from`, `valid_to` |
| `plant` | `id`, `company_code`, `city`, `country`, `role` |
| `fx_rate` | from `data/fx.js`: `currency`, `rate_to_eur`, `mean_per_eur`, `first`, `last`, `observations`, `source` (section 4) |
| `value_log` | `id`, `group`, `option`, `plant`, `old_supplier`, `new_supplier`, `new_price`, `approved_day`, `approved_savings_eur`, `bundle_part_eur`, `implemented_day` |

Buyers are fictional users with a given name and an initial, shown by role and team ("Buyer, MRO, Lyon").

### 3.3 Material groups (N1)

A two-level taxonomy keyed to the vendor categories, in `tools/source/material_groups.json`:

| Category | Material group | Code | Examples in the world |
| --- | --- | --- | --- |
| MRO supplies | Personal protective equipment | `MRO-PPE` | Nitrile gloves, safety shoes, safety glasses |
| MRO supplies | Hydraulics and pneumatics | `MRO-HYD` | Hydraulic hoses, couplings |
| MRO supplies | Fasteners and fixings | `MRO-FAS` | Cable ties, anchors |
| MRO supplies | Tools and abrasives | `MRO-TLS` | Cutting discs, drill bits |
| MRO supplies | Electrical spares | `MRO-ELE` | Fuses, cable glands |
| Packaging | Corrugated board | `PKG-COR` | Shipping boxes |
| Packaging | Pallets and load carriers | `PKG-PAL` | Euro pallets |
| Packaging | Films and tapes | `PKG-FLM` | Stretch film, packing tape |
| Chemicals | Lubricants | `CHM-LUB` | Hydraulic oil, grease |
| Chemicals | Cleaning agents | `CHM-CLN` | Industrial cleaner |
| Chemicals | Process chemicals | `CHM-PRC` | Coolant concentrate |
| Consulting | Consulting services | `SRV-CON` | SAP finance consultants |
| IT services | IT services | `SRV-ITS` | Service desk, field engineer |
| Facility management | Facility services | `SRV-FAC` | Cleaning, maintenance |
| Security services | Security services | `SRV-SEC` | Guarding, gate control |

The material-group code is a field the Data Quality Agent can check, and `pv_match` proposes clusters only inside one group.

### 3.4 Materials, order lines, contracts and buyers

- **Materials:** 60 to 80 that at least two plants buy: goods in units such as EA, BOX, CS, PAK, ROL, M, L, KG and DR (drum), and service materials priced per hour (H) or per day (DAY), which convert to the person-day with the 8-hour parameter, never through SAP's 24-hour day. Material descriptions are English; order texts keep the plant's language (French in Lyon, German in Frankfurt and Duisburg, English in Birmingham).
- **Order lines:** about 1,500 over days −364 to 0, plus the earlier lines the past case's baseline needs (section 3.6). A few lines are cancelled; at least one has an order unit without a conversion (excluded and listed, as P7 is); about 3 % of background lines are urgent with a reason; free-text service lines appear in scenario 2 and in the background.
- **Currencies:** EUR and GBP, because every kept account invoices in euros and only the new British accounts invoice in pounds.
- **Incoterms:** a realistic mix (DAP, DDP, CPT, CIP, FCA, EXW and FOB among them) on goods; none on services. The unit tests cover all eleven rules (AC-03).
- **Contracts:** 20 to 30, for the benchmark suppliers of the scenarios and for background items, with price, price unit, order unit, Incoterms, currency and validity.
- **Seed:** a fixed seed; two builds give the same bytes (AC-05).

### 3.5 How each scenario is planted

Each scenario is a short, unverified tip (brief §8.2). The figures are the annual targets I sized with the method at the fallback rate (1 EUR = 0.84385 GBP); M1 plants them as order lines across the year, and the engine's exact results are frozen in `data/reference_cases.js`. Product names, manufacturers and part numbers are invented, and checked in M1 not to match a real product.

| # | Title | Group | What is planted | Sized with the method |
| --- | --- | --- | --- | --- |
| 1 | Gloves at three sites | Nitrile gloves, size L (`MRO-PPE`; EA, BOX = 100, CS = 1,000; display 100 EA) | Frankfurt 600,000 EA on contract at €6.90 per BOX, DAP: the benchmark, 43.8 % of the quantity. Lyon 450,000 EA off contract from a local distributor at €9.80 per BOX, DAP, 15 % of it urgent with a reason. Birmingham 250 cases of 1,000 at £62.00, FCA: £0.062 a piece looks cheapest, €7.71 per 100 EA delivered. Duisburg 500 BOX at €720.00 per 100 BOX (price unit 100) and a 20,000 EA bargain at €6.00 per BOX (1.5 %, too small to set the benchmark) | 1,370,000 EA, spend €109,587, opportunity €14,538 a year (€699 justified), spread 42.0 %, index 13.3 %. H €12,501 for €2,400; R €14,538 for €7,200; B €17,374 (bundle €2,836) for €9,600 |
| 2 | Same consultant, different day rate | Cluster `CL-01` after confirmation (`SRV-CON`, base unit person-day) | Free-text lines: Frankfurt 120 days at €1,150 a day; Duisburg 160 hours at €150 an hour; Lyon 60 days at €1,450 a day; Birmingham 320 hours at £170 an hour. `pv_match` proposes them; only the person's confirmation, with the base unit, makes them comparable | 240 person-days, spend €313,466, opportunity €37,466, spread 40.1 %. H €19,000 for €2,400; R €37,466 for €7,200; B €45,746 (bundle €8,280) for €9,600 |
| 3 | Express is not a reason | Hydraulic hose (`MRO-HYD`; EA) | Frankfurt 2,000 at €38.00 on contract: the benchmark. Duisburg 2,400 at €44.50 from another supplier: 720 urgent with a recorded reason, 1,680 routine at the same price. Lyon 600 at €38.40 | Opportunity €11,736 (€4,104 justified by urgency; €10,920 of routine orders unexplained), spread 17.1 %. H €11,736 for €2,400; R €11,736 for €4,800; B €17,436 for €9,600 |
| 4 | It's the delivery terms | Corrugated box (`PKG-COR`; EA) | Lyon 120,000 at €1.80 EXW; Birmingham 100,000 at £1.61 DAP, €1.91: 6.0 % above Lyon's price as written; Frankfurt and Duisburg at €1.90 and €1.91 DAP | With the uplift Lyon's price is €1.89: spread 1.1 %, opportunity €4,492, not flagged; the agent says so and proposes nothing (`nothing_found`). At today's ECB rate the spread is 1.9 % and the opportunity €6,328, still unflagged by the spread alone, so M1 plants it smaller (B10) |
| 5 | Pallets in pounds | Euro pallet (`PKG-PAL`; EA) | Frankfurt 9,000 and Duisburg 6,000 at €12.40 on contract: the benchmark. Lyon 4,000 at €12.65. Birmingham 3,500 at £14.80 DAP, €17.54 | Opportunity €18,985, spread 41.4 %; at today's ECB rate €19,576 and 42.8 %, so the finding holds (the labelled sensitivity in Live). H €1,000 for €1,200 does not pay, because the contract supplier does not deliver to GB; R €18,985 for €4,800; B €27,355 (bundle €8,370) for €9,600 |
| 6 | Same shoe, two numbers | `MPN:<manufacturer>:<part number>` (`MRO-PPE`; pair as EA) | Two material numbers, a German one bought by Frankfurt (1,200) and Duisburg (500) at €61.50 on contract, and a French one bought by Lyon (700) at €78.00, with the same manufacturer and part number | Opportunity €11,550, spread 26.8 %. H €11,550 for €1,200; R €11,550 for €2,400; B €15,978 for €9,600 |

The remaining groups vary within a few per cent and none is flagged at the defaults. A **Live sweep** at the defaults therefore flags scenarios 1, 3, 5 and 6 (the cluster exists only after a confirmation) and investigates the pallets first (€18,985). A **Custom what-if** takes any tip in the person's words.

### 3.6 Past cases and the value pipeline

- **Implemented:** Duisburg's cable ties (`MRO-FAS`). Option H approved on day −120, a planted annual saving, moving 1020 from one supplier to another at a contract price, implemented on day −90. The baseline lines run from day −455 to −91 at the old supplier; after day −90 most lines go to the new supplier and one or two still go to a third (leakage). The engine reports realised value to date and what each leakage line missed, as in G5.
- **Approved, not implemented:** a second option approved in the last weeks (stretch film, Lyon) with no implementation day, so *approved* and *implemented* differ.
- The cable-tie group is analysed only on the lines after its implementation day, so the sweep never flags it again for prices it has already fixed; the world check proves that.

### 3.7 World checks (AC-05)

`tools/check_world.mjs` (and Diagnostics in the page) checks: two builds give the same bytes; the 124 accounts equal the extract in id, name, city, country, currency and category; four plants; every line's supplier delivers to its plant's country; every order unit converts or the line is listed as excluded with its reason; 60 to 80 materials bought by two plants or more; 20 to 30 contracts; about 1,500 lines in the window; each scenario's pattern as section 3.5 says, against its frozen figures; scenario 4 not flagged at the defaults, nor within ±5 % of the snapshot rate; scenario 5 flagged at the same ±5 %; no background group flagged; the past case's realised value and leakage, and its group analysed only after implementation; no tax id, no bank field, no full name of a person; every simulation script passes the checker (AC-13).

---

## 4. The exchange-rate snapshot

`data/fx.js` sets `window.FX`:

```js
window.FX = {
  version: "fx-YYYY-MM-DD",                 // the snapshot's last date, in the audit of every run
  source: "European Central Bank, euro foreign exchange reference rates (daily), via …",
  window: { first: "YYYY-MM-DD", last: "YYYY-MM-DD", days: 365 },
  currencies: {
    EUR: { rate_to_eur: 1 },
    GBP: { mean_per_eur: …, rate_to_eur: …, observations: …, first: "…", last: "…" }
  }
};
```

- **The rule (brief §6.3):** one rate per currency for the whole analysis, `rate_to_eur = 1 / mean(daily quotes per euro)` over the window, with its first and last date on screen.
- **The tool:** `tools/build_fx.mjs` reads the ECB Data Portal's daily reference-rate series for each currency over the last 365 days (the series key and Frankfurter's time-series path are confirmed on the workflow's first run, since neither host answers here), cross-checks every day against Frankfurter's v1 time series (ECB data), fails on any difference, and writes `data/fx.js`.
- **Where it runs (N2):** `.github/workflows/fx-snapshot.yml`, started by hand, pushes the new `data/fx.js` to a branch `fx/<date>`; I open the pull request, and the world and its frozen figures are rebuilt in the same pull request.
- **Until it has run:** the rate Rebate Hunter's TECH_NOTES §4 observed, 1 EUR = 0.84385 GBP on 14 October 2026 (1 GBP = €1.185045), labelled on screen and in DATA_SOURCES as one day's rate, not a window mean.
- **Live sensitivity:** `open_ecb_rate` fetches today's or a dated rate (v1, ECB only); `pv_compare` with `at_rate_of` shows the group's figures at that rate beside the window's, labelled "at the ECB rate of <date>"; the tiles, the alert and the options keep the window's rate.
- **Simulation:** the rate result is representative and labelled "(representative)"; scenario 5 uses the ECB's rate of 19 November 2026 from the probe log (1 EUR = 0.83581 GBP).
- **Failure:** `open_ecb_rate` resolves rather than throws, follows the run's Abort, is remembered as failing only for network, CORS, timeout and 5xx errors, and the analysis then says it keeps the bundled rates (AC-10).

---

## 5. The engine and the value pipeline

### 5.1 Modules and contracts

Pure ES modules that run in the page and in Node, with no DOM, storage or fetch. A context object carries the world, the rates, the parameters, the confirmed clusters and today's day number. `METHOD_VERSION` starts at 1.0.0 (it appears in every normalisation, as brief §10 shows); the engine, world and rate versions travel with every result and into the audit.

| Module | Does |
| --- | --- |
| `js/normalise.js` | One line's normalisation, step by step, or why it is excluded |
| `js/groups.js` | The comparable groups: material, manufacturer part number, confirmed clusters; the window; the lines after an implementation |
| `js/variance.js` | Pairs, benchmark, every line's gap, justified and unexplained part, totals, spread, index, materiality; the scan ranked by opportunity; the portfolio index and its projection |
| `js/options.js` | H, R, B and accepting the variance, with their figures and warnings |
| `js/pipeline.js` | Identified, approved, implemented and realised value, and the leakage |
| `js/match.js` | Candidate clusters for free-text and service lines, with their evidence; candidates never count |
| `js/params.js` | The parameters of §6.6 with their defaults, the lock in Simulation and the change log |
| `js/format.js` | Every display string (section 5.7) |
| `js/schemas.js`, `js/schema.js` | The JSON Schemas of brief §10 (Material, Supplier, Plant, Contract, PoLine, FxRate, ComparableGroup, Cluster, Normalisation, GroupAnalysis, Option, Decision, Draft, ValueLogEntry, RunEvent, AuditEvent) as a module, and a small validator without a dependency (type, properties, required, additionalProperties, enum, items and the few bounds the data contracts need) |

### 5.2 Normalisation

normalised price = net price / price unit / (base units per order unit) × rate to EUR × (1 + logistics uplift), in euros per base unit, delivered. The result carries every step under the names of brief §10 (`price_per_order_unit`, `base_units_per_order_unit`, `price_per_base_unit`, `currency`, `rate_to_eur`, `price_per_base_unit_eur`, `incoterm`, `logistics_uplift`, `normalised_price_eur`), the display string and `method_version`.

- Conversions come from the material master, or for a confirmed cluster from its base unit. Hours and days convert through the person-day parameter (8 hours), never through SAP's 24-hour day.
- No conversion: the line is excluded from every figure and listed with its reason ("no conversion from PAL to EA"). A cancelled line is left out.
- The uplift applies to Incoterms groups E and F (EXW, FCA, FAS, FOB), by default 5 %; groups C and D and lines without Incoterms (services) get none (B6).
- The rate is the window's mean from `data/fx.js`; a refreshed rate only ever produces a labelled sensitivity beside it.

### 5.3 Comparable groups and clusters

- **Material:** the group's id is the material number.
- **Manufacturer part number:** materials that share manufacturer and part number with another material number form one group, `MPN:<manufacturer>:<part number>`, and are not analysed again on their own, so no figure counts twice. They must share a base unit; the world check fails otherwise.
- **Cluster:** `pv_match` proposes candidates among lines without a material number: one material group, order units that convert to one base unit, similar short texts (Rebate Hunter's port of difflib's ratio on normalised texts, threshold set in M1 and shown as evidence). A candidate never counts. `ui_confirm_cluster` opens the dialog; the person confirms it with its base unit (`CL-01`, `CL-02` …), splits it (confirms some lines) or rejects it. Similar descriptions never make lines comparable on their own.
- **Lines that count:** the last 365 days (days −364 to 0), not cancelled, and for a group with an implemented option only the lines after its implementation day.

### 5.4 Benchmark, gap and options

As brief §6.4 and §6.5, with these details:

- **Pairs** carry quantity in base units, the volume-weighted mean normalised price and the share of the group's quantity. The **benchmark** is the lowest pair price among pairs with at least 10 % of the quantity; on a tie the larger quantity, then the lower plant and supplier ids decide.
- **Gap**, **justified** (urgent with a recorded reason, capped at 15 % of the benchmark per unit), **unexplained**, **normalised spend**, **spread**, **index** and **materiality** (opportunity ≥ €5,000 and spread ≥ 5 %), exactly as the brief defines them and as G1 to G3 test them.
- **H** covers the plants in the countries the benchmark supplier delivers to, moves their lines above the benchmark (the lines below stay), counts the plants moved, and returns the supplier's share afterwards; it is "not applicable" when nothing can move (G4b). **R** counts the suppliers above the benchmark once each and says it depends on every one of them agreeing. **B** shows its bundle discount as its own part. **Accept** needs a reason: specification differs, supply security, local requirement, price change within the window, volume tier, other.
- Each option returns savings a year, one-off cost, savings less one-off cost, days to first saving (30, 60, 90), residual unexplained variance, index after, the plants and suppliers it touches and its warnings.

### 5.5 The value pipeline

- **Identified:** the opportunity of the flagged groups (€ a year), from this run's engine results (P-4).
- **Approved:** the savings a year of options a person approved, in this session or before (`value_log`), with bundle discounts as their own part.
- **Implemented:** the approved savings of options with an implementation day (the planted past case only, because nothing changes a system).
- **Realised:** for an implemented option, the sum of quantity × (baseline − paid price) over every line of its plant and item after the implementation day, whichever supplier it went to; the baseline is the volume-weighted mean price paid to the old supplier in the 365 days before implementation. Lines after implementation that go to another supplier than the new one are **leakage**, each with what it missed against the new price. Boundaries as B7.
- **Projected portfolio index** after approvals: (sum of unexplained − approved savings on unexplained parts) / (sum of normalised spend − approved savings, bundle discounts included).
- No tile, card or label calls value saved or realised before later order lines show it; approved savings always read "a year", realised value "to date" (AC-15).

### 5.6 Parameters

The thirteen assumptions of brief §6.6 with their defaults, each labelled as an assumption: analysis window 365 days; benchmark minimum share 10 %; urgent allowance 15 %; uplift for groups E and F 5 %; person-day 8 hours; materiality €5,000 a year and 5 %; day rate €1,200; harmonise 1 day per moved plant; renegotiate 2 days per supplier; tender 8 days; bundle discount 3 %; lead times 30, 60 and 90 days. Edited only in the Method dialog in Live mode, each change logged (`param_change`, in the audit with the old and new value); read-only in Diagnostics; locked in Simulation so the scripts stay valid.

### 5.7 Rounding and display

Full precision for every calculation; display only through `Intl` with `en-GB`, after rounding the value to 1e-9, so floating-point noise never moves a digit and a tie such as €778.50 shows as "€779" (half away from zero, `Intl`'s default). Amounts in euros without decimals ("€1,739", "-€779"); unit prices with two decimals at the item's display quantity ("€6.90 per 100 EA", "€38.00 per EA" when it is 1, B12); shares and gaps with one decimal ("42.0%"); quantities whole with their unit ("20,000 EA"); dates as "Thu 19 Nov", with the year when it is not this year. A static check forbids `toFixed` in the engine.

### 5.8 Fixtures and figure names

Written into `tests/fixtures/` before the code they test (brief §15):

| File | Holds |
| --- | --- |
| `m100.json` | The M-100 fixture and the expected values and displays of G1 to G4 |
| `m100-h-not-applicable.json` | G4b (B5) |
| `g5.json` | The cable-tie fixture and G5, plus boundary lines (B7) |
| `audit-f01-f16.json` | The sixteen texts, the run's known figures and ids, the expected results and tokens |
| `normalise.json` | Price units, every unit conversion in the world, the person-day, a missing conversion, both currencies, all eleven Incoterms rules |

Every engine figure has a stable name that the simulation scripts use as a placeholder: `group.quantity`, `group.benchmark`, `group.spend`, `group.gap`, `group.justified`, `group.opportunity`, `group.index`, `group.spread`, `pair.<plant>/<supplier>.price`, `line.<id>.price`, `option.H.savings`, `option.H.one_off`, `option.H.net`, `option.H.residual`, `option.H.index_after`, `option.H.share_after`, `option.B.bundle` and their R, B and accept counterparts, `pipeline.identified`, `pipeline.approved`, `pipeline.implemented`, `pipeline.realised`, `pipeline.leakage_missed`.

---

## 6. Run events, tool schemas and guardrails

### 6.1 Run-event types

Rebate Hunter's envelope and bus, with its event types and these changes (P-2):

| Event | Payload | From |
| --- | --- | --- |
| `run_start`, `state_change`, `narration`, `reasoning`, `cost_update`, `notice`, `attempt_discarded`, `run_end` | As Rebate Hunter's; `run_end` keeps `no_findings` for scenario 4 | Both producers |
| `tool_call` | As Rebate Hunter's, plus `plain`, the sentence from `js/tool_plain.js` | Both |
| `tool_result` | As Rebate Hunter's; engine results carry `compare_id` and the versions | Both |
| `alert` | `compare_id`, `group_id`, `title`, `summary`, `line_ids`, `checked` (the "Checked in this run:" list from the tool results) | `ui_report_alert` |
| `board_update` | `view` (group or portfolio), `group_id`, `pair_ids`, `line_ids`, `state` (checking, above, justified, approved, neutral), `focus` | Tools, decisions |
| `kpi_update` | `identified_eur`, `flagged_groups`, `index`, `index_projected`, `approved_eur`, `implemented_eur`, `realised_eur` | Engine results, decisions |
| `options` | `options_seq`, `compare_id`, `group_id`, `recommended`, `reason`, `options` (H, R and B present with the engine's figures, accept always) | `ui_propose_options` |
| `option_decision` | `option_id` (H, R, B or accept), `options_seq`, `decision`, `reason` for accept, `by` | The person |
| `confirmation_request` | `request_id`, `candidate_id`, `lines`, `evidence`, `base_units`, `proposed_base_unit`, `note` | `ui_confirm_cluster` |
| `confirmation_decision` | `request_id`, `decision` (confirmed, split, rejected), `cluster_id`, `base_unit`, `line_ids` | The person |
| `fx_sensitivity` | `group_id`, `currency`, `date`, `per_eur`, the figures at that rate beside the window's | `pv_compare` with `at_rate_of` |
| `param_change` | `name`, `from`, `to` | The Method dialog |
| `action_draft`, `action_decision` | As Rebate Hunter's, with this app's draft kinds | Drafts, the person |
| `report` | `markdown`, `outcome` (`option_approved`, `variance_accepted`, `nothing_found`, `stopped`) | `ui_final_report` |

The run states stay Rebate Hunter's (`scanning`, `diagnosing`, `verifying`, `simulating`, `options`, `awaiting_approval`, `executing`), so the rail reads Spot, Check, Calculate, Propose and Prepare without change.

### 6.2 Tool schemas

Measured in Phase 0 (P11): 16 tools, 12 optional parameters, no union types, none of the keywords outside the strict subset. Bounds such as "at most 50 rows" live in the descriptions and are enforced in code.

| Tool | Kind | Input (required; optional) | Returns |
| --- | --- | --- | --- |
| `erp_get_overview` | Data | none | Company codes, plants, data products with row counts and as-of day, the rates with their dates, the parameters |
| `erp_query` | Data | `product`; `filters` (each `field`, `op` of eq, in, gte, lte, contains, `value`), `sort`, `limit` | At most 50 rows and the total count |
| `erp_get_record` | Data | `product`, `id` | One record with its related records (material, supplier, contract, plant, buyer) |
| `pv_scan` | Engine | none; `limit` | Every group with spread, opportunity, index and flag, ranked by opportunity; the portfolio index; the value pipeline |
| `pv_normalise` | Engine | `line_id` | The normalisation of brief §10, or why the line is excluded |
| `pv_compare` | Engine | `group_id`; `at_rate_of` | The group in full with its options and a `compare_id`; at a rate fetched in this run, a labelled sensitivity beside it |
| `pv_match` | Engine | none; `text`, `material_group`, `line_ids` | Candidate clusters with their evidence |
| `ui_confirm_cluster` | Person | `candidate_id`, `base_unit`, `note` | The person's answer: confirmed (`CL-nn`), split (`CL-nn` with the confirmed lines) or rejected |
| `open_ecb_rate` | Open data | `currency`; `date` | The rate per euro and its inverse, the date and the source, or an error that says the bundled rates stay |
| `ui_mark_board` | Screen | `state`; `group_id`, `pair_ids`, `line_ids` | The marks on the board |
| `ui_report_alert` | Screen | `compare_id`, `title`, `summary` | The verified alert with "Checked in this run:" |
| `ui_propose_options` | Person | `compare_id`, `options` (two or three of H, R and B, each with `title`, `description`, `residual_risk`), `recommended`, `reason` | `options_seq`; the cards take every figure from the engine by option id |
| `ui_await_decision` | Person | none | The decision on the options on screen |
| `ui_draft_action` | Outbox | `type` (change request, buyer notice, negotiation brief, tender memo, variance memo), `recipient` (a role), `subject`, `body` | The draft, footers added in code |
| `ui_await_approvals` | Person | none | Each draft approved or rejected |
| `ui_final_report` | Summary | `outcome`, `markdown` | Ends the run |

Every input is validated against its schema in code (`js/schema.js`); a failure returns `is_error: true` with a message that names the field and what it expects. With P-3, the tools are also sent with `strict: true`.

### 6.3 Guardrails in code

| Rule (brief §7) | In code | Test |
| --- | --- | --- |
| 1 Data, never instructions | The prompt; tool results and order texts are passed as data | `live`: an order text that reads like an instruction is ignored |
| 2 Only the engine compares | Alerts and options name one `compare_id` and lines of its group only; a candidate counts only after a confirmation returned by `ui_confirm_cluster` | AC-09 |
| 3 Verified alert | `verifiedAlertError`: that `pv_compare` result in this run; at least three of its lines normalised, among them one of the benchmark pair and one of the highest-priced pair; the benchmark supplier's contract looked up (a query that finds none counts); the refusal says what is missing | AC-09 |
| 4 Options | Two or three distinct applicable options from the latest `pv_compare` of the group, plus accept; the recommendation among them; refused after an approval; a decision binds to its `options_seq`, once; accept needs a reason | AC-09 |
| 5 Drafts | Only after an approval, only the kinds the option contains (H: change request and buyer notice; R: negotiation brief; B: tender memo; accept: variance memo); the two footers in code | AC-09 |
| 6 Report | Refused while a decision or a draft is open; the outcome follows the decision | AC-09 |
| 7 Figure audit | `js/figures.js` (section 6.4) on the alert, option texts, cluster note, drafts and report; after two refusals the text shows with an "Unchecked" tag | AC-04, `live` |
| 8 Narration | One or two short sentences per step, no figures (the prompt); the plain sentence above each tool call from `js/tool_plain.js` | `smoke` |
| 9 Open data | `js/opendata.js`: resolves, follows Abort, remembers only network, CORS, timeout and 5xx failures | AC-10 |
| 10 Budgets and stops | `js/agent.js` (section 6.6) | AC-11 |

### 6.4 The figure audit

Built on Rebate Hunter's `js/figures.js`, with the brief's changes and the two readings of section 1.5:

- Amounts of any size (minimum 0); a written amount matches within half a unit of its last written digit and within 2 % of the figure, with no €0.50 floor; a comma before exactly three digits always groups thousands; "k" and "m" scale.
- A unit price is an amount at the item's display quantity; "per ‹n› ‹unit›" belongs to its token, and an offending price is reported as written without its unit ("€9.90"). A bare amount may also match a unit price at its display quantity.
- Percentages and quantities match within half a unit of their last digit; counts written in digits must be counts a tool returned, counts written as words pass.
- The known figures are the typed values of this run's engine, ERP and rate results, kept apart by scope as Rebate Hunter's `FigureLedger` does: a draft quotes only the result its approved option rests on, a projection only as a projection.
- Exempt but required to exist: record ids, plant and company codes after "plant" or "company code", supplier numbers after "supplier", "vendor" or "account", dates in the display or ISO form, names with numbers ("Incoterms 2020").

### 6.5 Simulation scripts

Rebate Hunter's format (`data/sim_runs.js`): `state`, `say`, `tool` (re-executed against the world), `open` (a representative rate result, labelled), `alert`, `board`, `options` (texts per option id), `awaitOption` (text for each rejection, a branch for each approval and for accept with a reason), `draft`, `awaitActions`, `report`, `end`; plus a `confirm` step with branches for confirmed, split and rejected. Every figure is a placeholder by its stable name. Each script is marked `"source": "authored"`, states a hypothesis, makes a visible revision ("Revised: …") and calls at least eight tools before the decision; scenario 4 has no options and ends with `nothing_found` after at least eight tool calls. `js/sim_check.js` holds every script to the guardrails above, through `tools/check_world.mjs` and in Diagnostics. Live runs saved with "Save run as simulation" become `"source": "recorded"` after I curate them.

### 6.6 Agent loop, caps, cost and key

- Rebate Hunter's loop and request: streaming; `cache_control: {type: "ephemeral"}`; `thinking: {type: "adaptive", display: "summarized"}`; effort per model as in its `js/config.js`; `tool_choice: {type: "auto"}`; `anthropic-version: 2023-06-01`, switching in `js/config.js` with the other prototypes; no web search.
- Caps: 40 model calls (the retry of a cut turn included); €3, checked before every call and after each (B8); 90 s idle; two transport retries; one `max_tokens` retry at 1.5 times the room; at most two nudges after an early `end_turn`; `refusal` and a full context window end the run; a 400 that names `output_config`, `display`, `thinking`, `cache_control` or `strict` drops that field once.
- Cost meter: usage × price per model and tier (`js/cost.js`), converted at 1 USD = 0.894 EUR.
- Key: requested only when a live run starts, checked with `GET /v1/models`, kept in this tab's session storage under `pv.anthropic.key`, never in local storage, logs, exports, recordings or the console; "Forget key" removes it; the key dialog refuses to work inside a frame; the key goes only to api.anthropic.com.

---

## 7. Screens

### 7.1 Mapping

| Part | Holds |
| --- | --- |
| Header | Vici's `trend-down` in a lilac hexagon cell, "Price Variance Agent" and "Price variance agent for GlobalCorp SE (fictional)"; the mode badge (SIMULATION on the neutral tape, or LIVE); "How it works"; the theme toggle; "You are interacting with an AI system"; "Fictional company, no client data"; four tiles: Opportunity identified (€ a year, flagged groups below), Price variance index (the projected index below after an approval), Approved savings (€ a year; implemented and realised to date below), Session cost |
| Control bar | Start agent, Scenario (six presets), Live sweep, Model, Replay ×1 ×2 ×4, the status tag, Abort, Reset, Method, Diagnostics; icons with tooltips below 1400 px |
| Centrepiece | The price board: Group view (the price ladder) and Portfolio view (opportunity bars and the value pipeline), each with its table one click away |
| Console | The rail (Spot, Check, Calculate, Propose, Prepare, with the merlot turn), the plain sentence above each tool call with the details one click away, Guardrail lines, the run facts |
| Drawer | Options, Outbox ("Draft. Nothing is sent."), Audit |
| Dialogs | Mode, key, Custom what-if, the cluster confirmation, Method, Diagnostics ("Run all tests"), the report, How it works |

### 7.2 1920 × 1080: group view with a decision waiting (scenario 1)

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ⬢ Price Variance Agent        [▨ SIMULATION] [ⓘ How it works] [☾]  ┌Opportunity ident.┐┌Price var. index┐┌Approved savings┐┌Session cost┐│
│   Price variance agent for     [✦ You are interacting with an AI system] │ €14,538 a year   ││ 13.3%          ││ €A a year      ││ €0.00      ││
│   GlobalCorp SE (fictional)    Fictional company, no client data       │ 1 group flagged  ││ this run       ││ €I impl., €R to date ││ simulated ││
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ▷ Start agent │ Scenario: Gloves at three sites ▾ │ ◎ Live sweep │ Model: Sonnet 5.5 ▾ │ ×1 ×2 ×4 │ ● Awaiting your decision │ Abort │ Reset │ Method │ Diagnostics │
├───────────────────────────────────────────────────────────────────────┬────────────────────────────────────────────┤
│ Nitrile gloves, size L · 1,370,000 EA a year     [Group|Portfolio] [▤]│ Agent console                  Larger text │
│ Benchmark €6.90 per 100 EA · Frankfurt, contract supplier · 43.8 %    │ ⬢Spot─⬢Check─⬢Calculate─⬢Propose▸Your decision─⬡Prepare │
│                       €6.00     €7.00     €8.00     €9.00     €10.00  │ ▨ SIMULATION  Scripted replay. No model calls. │
│ Duisburg · bargain      ⬡       ┊                     below · 1.5 %   │ 00:41 Reads Lyon's glove orders of the last │
│ Frankfurt · contract        ⬢═══┊ benchmark                           │       365 days                             │
│ Duisburg · contract          ⬡  ┊▒                    €150 a year     │ 00:44 Normalises a Birmingham line: price  │
│ Birmingham · FCA, £             ┊⨯⨯⨯⨯ ⬢                €2,037 a year   │       unit, case of 1,000, pounds, freight │
│ Lyon · off contract             ┊⨯⨯⨯⨯⨯⨯⨯⨯⨯⨯⨯⨯⨯⨯⨯⨯⨯⨯⨯▧▧ ⬢  €12,351 a year  │ 00:52 Calculates the group with the engine │
│                                 ┊ ⨯ unexplained   ▧ justified (urgent) │ Recommendation: option H …           [AI] │
├───────────────────────────────────────────────────────────────────────┴────────────────────────────────────────────┤
│ Options ③ │ Outbox │ Audit 38          Built by ⬡ Victor Pflüger  in ⊕       Actions stay drafts until you approve. Hide │
│ ┏ H Harmonise to the contract supplier ━ Recommended ┓ ┌ R Renegotiate to the benchmark ┐ ┌ B Bundle in one tender ┐ ┌ Accept the variance ┐ │
│ ┃ €12,501 a year · one-off €2,400 · net €10,101       ┃ │ €14,538 a year · one-off €7,200 │ │ €17,374 a year, of which│ │ €0 · reason ▾        │ │
│ ┃ first saving in 30 days                             ┃ │ net €7,338 · 60 days            │ │ bundle €2,836 · one-off │ │ residual €14,538     │ │
│ ┃ residual €2,037 · index 13.3% → 2.1%                ┃ │ residual €0 · if all 3 agree    │ │ €9,600 · net €7,774     │ │                      │ │
│ ┃ [✓ Approve]  [Reject]                               ┃ │ [Approve]  [Reject]             │ │ [Approve]  [Reject]     │ │ [Accept the variance]│ │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

The ladder has one row per pair, sorted by price, a hexagon at the pair's normalised price sized by its quantity, the lines as small hexagons, the benchmark as an ink line with its label, the unexplained part from the benchmark to each pair in the danger tone with a cross, the justified part hatched in the warning tone with its reason, and the euros a year at the row's end. A line opens its normalisation steps; a pair opens its lines and contract; the lines the agent reads pulse in a fjord outline. Plants are told apart by their row labels, not by colour. With the drawer open the ladder steps down to one line per pair (Rebate Hunter's band pattern). The figures are the Phase 0 sizing of section 3.5; €A, €I and €R stand for the past cases' figures, which M1 plants.

### 7.3 1280 × 720: the cluster confirmation (scenario 2)

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ⬢ Price Variance Agent [▨ SIMULATION][ⓘ][☾] ┌Opportunity┐┌Index┐┌Approved┐┌Cost┐ │
│ [✦ AI system] Fictional company, no client data │ —         ││ —   ││ €A a yr││€0  │ │
├──────────────────────────────────────────────────────────────────────────────────┤
│ ▷ │ Same consultant ▾ │ ◎ │ Sonnet 5.5 ▾ │ ×1 ×2 ×4 │ ● Awaiting your confirmation │ ▢ ↺ ⚖ ⚕ │
├──────────┌───────────────────────────────────────────────────────────┐──────────┤
│          │ Are these the same service?                     [✦ AI]    │          │
│          │ The agent proposes these lines as one group. They count   │          │
│          │ only if you confirm them.                                 │          │
│          │ ┌Frankfurt ────┐┌Duisburg ─────┐┌Lyon ──────────┐┌Birmingham ┐│          │
│          │ │SAP FI/CO     ││SAP FI Berater││Consultant SAP ││SAP finance││          │
│          │ │Berater, Senior││Stundensatz  ││Finance, jour  ││consultant,││          │
│          │ │120 DAY       ││160 H         ││60 DAY         ││hourly     ││          │
│          │ │☑ include     ││☑ include     ││☑ include      ││☑ include  ││          │
│          │ └──────────────┘└──────────────┘└───────────────┘└───────────┘│          │
│          │ Evidence: one material group (SRV-CON) · hours and days     │          │
│          │ convert at 8 hours a day · similar texts                     │          │
│          │ Base unit:  (•) person-day   ( ) hour                       │          │
│          │ [✓ Confirm group]   [Confirm selected]   [Reject]           │          │
│          └───────────────────────────────────────────────────────────┘          │
│ ⬢Spot ─ ⬢Check ▸Your confirmation ─ ⬡Calculate ─ ⬡Propose ─ ⬡Prepare                │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Options │ Outbox │ Audit 21        Built by …        Actions stay drafts …   Show │
└──────────────────────────────────────────────────────────────────────────────────┘
```

At 1280 × 720 the header keeps two rows, the control bar shows icons with tooltips, and the dialog shows the candidate lines side by side, each with its order text in the language it was bought in, its unit and its price on hover or focus. The proposed cluster is the AI's (lilac label); the decision buttons are the person's (merlot). The rail shows *Your confirmation* on Check, the furthest step reached, and the status tag says "Awaiting your confirmation".

### 7.4 1280 × 720: portfolio view and value pipeline (after a Live sweep)

```text
├────────────────────────────────────────────────────┬─────────────────────────────┤
│ [Group|Portfolio] [▤]   Flagged groups, € a year   │ Agent console               │
│ Euro pallet          ████████████████████ €18,985  │ ⬢⬢⬢⬢⬡ (names in tooltips)   │
│                      spread 41.4% · index 6.4%     │ 00:12 Ranks every group by  │
│ Nitrile gloves, L    ███████████████      €14,538  │       its opportunity       │
│                      spread 42.0% · index 13.3%    │ 00:15 Checks the first:     │
│ Hydraulic hose       ████████████         €11,736  │       Euro pallet           │
│ Safety shoe S3 (MPN) ████████████         €11,550  │                             │
│ Value pipeline  ⓘ definitions                      │                             │
│ Identified   ██████████████████████ €56,809 a year │                             │
│ Approved     ███                    €A a year      │                             │
│ Implemented  ██                     €I a year      │                             │
│ Realised     █                      €R to date · leakage: n lines, €L missed │     │
├────────────────────────────────────────────────────┴─────────────────────────────┤
```

Bars start at zero and are sorted by value; no pie or donut; the numbers are one click away as a table. Series colours are teal and apricot with Vici's greys, never merlot, fjord, lilac, honey or a state colour.

### 7.5 Colour grammar

| Colour | Means here |
| --- | --- |
| Merlot | The person in charge: Approve, the step that waits (*Your confirmation*, *Your decision*, *Your approval*), the recommended card's frame, decisions in the console and the audit |
| Lilac | The AI's voice: AI labels, the hypothesis and *Revised* lines, a proposed cluster (until a person confirms it), drafts, the AI disclosure |
| Fjord | Checking (the lines and groups the agent reads pulse in a fjord outline) and money an option spends |
| Danger | Paid above the benchmark without a reason, with a cross and the word |
| Warning | A gap a reason explains (hatched, with the reason) or that awaits a decision |
| Success | Closed by an approved option, with a tick and "approved", never "saved" |
| Ink | Everything else, the benchmark line included; a selection is a 2 px ink frame |
| Teal, apricot, greys (`--vc-data-2`, `-3`, `-7`, `-8`) | Chart series only: the portfolio bars and the pipeline |
| Neutral tape | SIMULATION |

Hexagons replace circles everywhere, with no exception (`tests/hexagon.mjs`); light theme by default, dark through Vici's toggle; no colour value of the app's own apart from the favicon.

### 7.6 The Method dialog and the production path

The Method dialog, opened from the control bar, explains comparability (material, manufacturer part number, confirmed clusters; names never merge lines), the normalisation steps, the benchmark rule, justified and unexplained, the index, the options and the value pipeline's four definitions; it lists the parameters (editable in Live mode, logged, locked in Simulation) and the exchange rates with their dates; and it ends with the production path, which the intro window and the README show too:

```text
SAP S/4HANA or Ariba ─▶ Microsoft Fabric ──────────────▶ AI agents ──────────▶ Power BI ─────────▶ Action
PO, requisition,        Data Factory, OneLake, SQL,      Azure OpenAI and      reporting and       Power Automate and
invoice, contract and   Spark or dbt: the variance       Copilot Studio        opportunity         Teams: alerts, approvals,
supplier data           analytics run here                                     tracking            tasks; SAP executes what
                                                                                                   people approved
└───────────────────────── this prototype stands in for all of it in one browser page ─────────────────────────┘
```

---

## 8. Test plan and CI

### 8.1 Suites

`node tests/run-all.mjs` runs every suite in order. No suite calls the real API or the real rate host; every browser suite fails on a policy violation, a page error or a request to another host.

| Suite | Checks | Criteria |
| --- | --- | --- |
| tokens, page-icon, vici-files | The shared design tests, unchanged, with this app's values | AC-06, AC-18 |
| parity | The shell against Rebate Hunter's `main`, the two adapted modules listed | AC-06 |
| hygiene, docs | No relationship term or e-mail address in any file; documents complete, every named path and cited section exists | AC-23 |
| unit | Streaming and retries, cost maths, display with the 1e-9 rule, the schema validator; the static checks: the policy exactly as brief §4, no outside script, style or font, every storage key `pv.` apart from `vc-theme`, no `toFixed` in the engine | AC-07, AC-11 (maths), AC-16 (validator) |
| engine | G1 to G5, G4b, the normalisation cases, scan, pipeline, the guards | AC-01, AC-02, AC-03 |
| audit | F01 to F16 with their tokens; the audit's scopes and retries | AC-04 |
| world (`tools/check_world.mjs`) | Section 3.7 and every script under the live guardrails | AC-05, AC-13 |
| smoke | Main flows by mouse and keyboard; both board views and their tables; every line's normalisation; the Method dialog; reduced motion; accessible names | AC-14, AC-19 |
| sims | The six scripts offline: both decision paths, accept, the cluster's three answers, scenario 4's honest negative; "saved" and "realised" scanned in every state | AC-12, AC-15 |
| live | The loop against `fake-claude.mjs`, `script_fake.mjs` and `fake-rates.mjs`: each refusal of AC-09, the caps, a failing and a blocked rate request, the sensitivity, a 400 that names `strict` | AC-09, AC-10, AC-11 |
| accept | The key's lifecycle, Diagnostics against the policy, Abort and Reset, offline Simulation, the exports and their validation | AC-08, AC-16 |
| layout, design, hexagon | 1920 × 1080 to 1280 × 720 in both themes; the colour grammar; nothing round | AC-14, AC-17, AC-18 |
| live_site, remote_head | The published site serves this commit and replays scenario 1 | Definition of done |

AC-20, AC-21 and AC-22 are manual: the README's acceptance record lists each with date, person and result.

### 8.2 Workflows

- `tests.yml`: on every push and pull request, a Node job (every Node suite, the hygiene list from the secret, parity against a fresh clone of Rebate Hunter) and a browser job (Playwright 1.56.0 with Chromium), Node 22 on ubuntu-24.04, as the sisters run it.
- `live-site.yml`: after every Pages build, the published site against the commit.
- `fx-snapshot.yml`: started by hand; builds `data/fx.js` and pushes it to a review branch (N2).

### 8.3 Evidence per milestone

Before a milestone: GATES.md from its acceptance criteria (P-6). At its end: the pull request, the CI result, screenshots at 1920 × 1080 and 1280 × 720 in both themes, every figure checked against the brief, and a list of what I could not check.

---

## 9. Milestones and acceptance criteria

| Milestone | Scope | Exit |
| --- | --- | --- |
| Phase 0 (now) | Study, probes, golden cases, this plan | Your approval |
| **M1 Shell, world and engine (v0.1.0)** | The shell with Vici, the two adapted modules and their entry in REVIEW.md, parity, hygiene and docs; the account extract and the taxonomy (N1); the rate snapshot (N2) or the labelled fallback; the world builder and checker; fixtures first, then normalisation, groups, benchmark, options and the value pipeline; the figure audit; schemas and validator; CI; a page that boots the shell with the world loaded | AC-01 to AC-07 |
| **M2 Agent, board and Simulation (v0.2.0)** | The 16 tools and guardrails, the live loop, the rates through Frankfurter, the price board's two views and tables, the cluster dialog, options, outbox and report, the recorder, the six scripts, Live sweep and Custom what-if | AC-08 to AC-15; AC-20 with your key |
| **M3 Hardening and release (v1.0.0)** | Exports, layout, design and accessibility tests, the Method dialog and the production path, all documents, the independent review, the pull request for the website's card, Pages and the live-site check | AC-16 to AC-19, AC-21 to AC-23 |

| AC | Criterion (brief §12, shortened) | Test | Milestone | Where |
| --- | --- | --- | --- | --- |
| AC-01 | G1 to G3 within 1e-9, every display string, the tie | unit | M1 | `engine`, `tests/fixtures/m100.json` |
| AC-02 | G4 with H's plants and share, R's suppliers, B's bundle, "not applicable"; G5 | unit | M1 | `engine`, G4b and `g5.json` |
| AC-03 | Normalisation: price units, every conversion, person-day, missing conversion, currencies, all eleven Incoterms rules | unit | M1 | `engine`, `normalise.json` |
| AC-04 | F01 to F16 with their tokens | unit | M1 | `audit` |
| AC-05 | Deterministic world, 124 accounts, the scenarios with frozen figures, scenario 4 unflagged, the past case | static | M1 | `tools/check_world.mjs` |
| AC-06 | Parity with exactly two adapted files; the four shared tests unchanged | static | M1 | `parity`, the four tests |
| AC-07 | The policy exactly; no outside script, style or font; storage keys | static | M1 | `unit` (static checks) |
| AC-08 | The key's handling | e2e | M2 | `accept` |
| AC-09 | Every refusal against the scripted stand-in, and schema failures | e2e | M2 | `live` |
| AC-10 | *Your confirmation* on the furthest step; failing rates; the labelled sensitivity | e2e | M2 | `live`, `sims` |
| AC-11 | No 41st call; none once €3 is spent; cost = usage × price within 1e-9 | e2e | M2 | `live`, `unit` |
| AC-12 | Six scenarios offline, both paths, accept, scenario 4 | e2e | M2 | `sims` |
| AC-13 | The checker passes every script | static | M2 | `tools/check_world.mjs` |
| AC-14 | Ladder and chart equal the engine; every line's normalisation; tables; series colours | e2e | M2 | `smoke`, `design` |
| AC-15 | No "saved" or "realised" without later lines; "a year" and "to date" | e2e | M2 | `sims` |
| AC-16 | Exports with their names and content, JSON valid against the schemas | e2e | M3 | `accept` |
| AC-17 | No overflow, no ellipsis, 40 px targets, both themes, 1920 × 1080 to 1280 × 720 | e2e | M3 | `layout` |
| AC-18 | The four shared design tests | static and e2e | M3 | tokens, hexagon, page-icon, vici-files |
| AC-19 | Keyboard alone, visible focus, reduced motion, accessible names | e2e | M3 | `smoke` |
| AC-20 | Your live run of one scenario within the caps, audit with model, usage, rates and cost | manual | M2 | README acceptance record |
| AC-21 | Your five-minute demo at ×1 without help | manual | M3 | README acceptance record |
| AC-22 | An independent review with no high or medium finding open | manual | M3 | REVIEW.md |
| AC-23 | README, DESIGN, TECH_NOTES, DATA_SOURCES and DEMO_SCRIPT complete; hygiene and docs pass | static | M3 | `hygiene`, `docs` |

---

## 10. Risks and how I will test them

| Risk | Mitigation | Test |
| --- | --- | --- |
| The rate snapshot cannot be built (the runner cannot reach the ECB or Frankfurter either) | The labelled fallback stays; your console line of Appendix A as a cross-check | The workflow's first run in M1; AC-05 |
| A new snapshot moves a scenario across a threshold (scenario 4 above all) | Scenario 4 planted with margin; the world rebuilt and its figures re-frozen in the snapshot's pull request | AC-05 with ±5 % on the rate |
| Floating point moves a displayed digit | Rounding to 1e-9 before `Intl`; no `toFixed` in the engine | AC-01, the static check |
| The model writes a figure no tool returned, or a unit price at the wrong quantity | The figure audit, two refusals, then "Unchecked", never silently | AC-04, `live` |
| Lines that only look alike are compared | Groups by material, part number or a person's confirmation only; the checker enforces it in the scripts | AC-09, AC-13 |
| The presenter rejects or splits the cluster on stage | Every script has the three branches; reject ends with nothing to compare | `sims` |
| A live run runs over its caps | Caps before and after each call | AC-11 |
| The API refuses the strict tools | Dropped once on a 400 that names `strict`; the validator in code either way | `live` |
| A venue's network blocks Frankfurter | The bundled rates stay and the console says so | AC-10 |
| The shared shell drifts from the sisters | `tests/parity.mjs` on every push | AC-06 |
| Four option cards and the ladder do not fit 1280 × 720 | The compact ladder, cards that wrap their lines | AC-17 |
| A relationship term lands in a public file | `tests/hygiene.mjs` with the secret list | AC-23 |
| The Data Quality Agent defines another taxonomy in parallel | One pair of data files to copy (N1) | Your decision on N1 |
| The published site differs from the commit | The live-site workflow after every Pages build | `live_site` |
| The run does not fit five minutes at ×1 | Scripts tuned to the timing; the sims suite records each run's duration | AC-21 rehearsal |

---

## Appendix A. Browser-console probe for the ECB rates

It runs on Rebate Hunter's live page, whose security policy already allows `api.frankfurter.dev` and whose origin is the one this app will have. Open <https://victorpflueger.github.io/PROC-Rebate-Hunter/>, press F12, paste the line into the console, press Enter and send me what it prints.

```js
(async()=>{const d=x=>x.toISOString().slice(0,10),t=new Date(),f=new Date(t-364*864e5);try{const r=await fetch(`https://api.frankfurter.dev/v1/${d(f)}..${d(t)}?base=EUR&symbols=GBP`),j=await r.json(),v=Object.entries(j.rates||{}).map(([k,x])=>[k,x.GBP]),m=v.reduce((s,x)=>s+x[1],0)/v.length;console.log("FX",JSON.stringify({cors:"ok",status:r.status,n:v.length,first:v[0]?.[0],last:v.at(-1)?.[0],mean_gbp_per_eur:m,eur_per_gbp:1/m}))}catch(e){console.log("FX blocked",String(e))}})()
```

A line starting `FX {"cors":"ok"` answers the CORS question for this origin and gives the window's mean as a cross-check for the snapshot; "FX blocked" means the browser could not read the answer.

## Appendix B. Phase 0 evidence kept outside the repository

The recomputation of G1 to G5, the scratch audit of F01 to F16, the account check, the CORS probes, the scenario sizing, the drafted tool schemas with their measurement, the four played simulations with their screenshots, and the gate ledger stay in the build session's working folder. They are scaffolding, not product files; M1 replaces them with the repository's own fixtures and tests.
