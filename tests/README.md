# Tests (optional, for developers)

The Price Variance Agent itself needs no Node.js, npm or build step. These scripts are the checks behind
the acceptance checklist in `TECH_NOTES.md` §12. Run them after changing code or data. GitHub Actions runs
them on every push and pull request (`.github/workflows/tests.yml`).

## What runs

| Suite | Command | Checks |
| --- | --- | --- |
| tokens | `node tests/tokens.mjs` | The colour system on Vici's values (`vici/dist/tokens.json`), light and dark: WCAG 2.2 contrast for every pair the shell and this app draw (`lib/prototype.mjs`), every Vici token the app names exists; reports how far state colours stay apart under colour-vision deficiency. Node.js only |
| page-icon | `node tests/page-icon.mjs` | `favicon.svg` byte for byte; the header and the loading screen use the page icon's cell; with a checkout of Victor's website (`VIP`) next to this repository, its card still gives this app the same icon and kind (otherwise that part is skipped and says so). Node.js only |
| vici-files | `node tests/vici-files.mjs` | `vici/` holds exactly the files `vici/README.md` lists; with a checkout of Vici (`ViciDesign`) at the same release next to this repository, every file byte for byte. Node.js only |
| world | `node tools/check_world.mjs` | The world (AC-05): two builds give the same bytes and the files are current; the 124 accounts equal the extract; plants, delivery countries, units, contracts, currencies; every record fits its schema; each scenario against its frozen figures and its pattern; scenario 4 unflagged within ±5 % of the rate; no background group flagged; the past case's realised value and leakage, and its group analysed only after implementation; every simulation script played on every path through the live toolbox and its guardrails (AC-13). Node.js only |
| unit | `node tests/unit.mjs` | The streaming client and the cost maths (Rebate Hunter's cases), display strings, the schema validator, the sixteen tool schemas within the strict-tool limits and checked by the app's own validator (`node tests/unit.mjs tools`), and the static checks of AC-07 (`node tests/unit.mjs static`): the security policy exactly as the brief's, nothing from a third party, every storage key `pv.` apart from `vc-theme` (with a planted control), the golden data of Diagnostics current with `fixtures/`. The exports (AC-16, `node tests/unit.mjs exports`): the file names, the report's banner, the CSV's quoting and its figures against the engine for three groups, an audit export built in Node valid against its schema, and nine planted faults each refused. Node.js only |
| engine | `node tests/engine.mjs` | The brief's golden cases from `fixtures/`: G1 to G3 (lines, pairs, totals and every display string, the half-euro tie included), G4 and G4b (the options, H not applicable), G5 (realised value, leakage, the window boundaries), the normalisation cases (price units, the person-day, exclusions, currencies, every Incoterms 2020 rule, every conversion of the world), display rules; GR, the guardrails of the live toolbox call by call, and S, every simulation script with planted faults it must catch. Name groups to run only those (`node tests/engine.mjs G1 G4b`). Node.js only |
| audit | `node tests/audit.mjs` | The figure audit: F01 to F16 with their offending tokens, with the brief's figures and with the engine's own results; the brief's three notes; ids, dates, names, counts, scales, rates; the independent review's bypasses (a label or a year hiding a figure, figures in words, a negative figure written as a gain) and its value words ("saved", "realised"). Node.js only |
| hygiene | `node tests/hygiene.mjs` | No file the repository publishes carries a term of a private list or an e-mail address. The list never enters the repository: it is read from the `HYGIENE_TERMS` environment variable (a CI secret), from the file named in `HYGIENE_TERMS_FILE`, or from a `.hygiene-terms` file next to the repository folder. Without it only the generic checks run, and the suite ends with HYGIENE GENERIC OK. Node.js only |
| docs | `node tests/docs.mjs` | The documents carry their sections; every section the code cites ("TECH_NOTES §3") and every path a document names exists; the README links the live site. `--complete` checks the release's documentation set (AC-23, milestone M3). Node.js only |
| parity | `node tests/parity.mjs <Rebate Hunter checkout>` | The shared shell is the sister app's (AC-06): the shared modules and the four shared tests character for character (names normalised), `style.css` up to its app block, `modals.css` and `drawer.css` rule for rule, `vici/` byte for byte, and exactly two adapted modules, `js/handover.js` and `js/progress.js`, each named in `REVIEW.md` with its reason. Without a checkout it says so and exits with 2 (`run-all` reports it as skipped) |
| smoke | `node tests/smoke.mjs` | In Chromium: the page boots from its data files with no page error, no policy violation and no request to another host; the idle board and the value pipeline; the scenario list and menu; the intro; the drawer; the keyboard; storage keys; a missing data file named on the boot screen; and the board (AC-14, `node tests/smoke.mjs board`): scenario 1 played to its decision, the ladder's pairs, benchmark and lines, every pair's lines and every line's normalisation opened through 40 px buttons, by pointer and by keyboard, the tables, the value pipeline and a sweep's portfolio chart, each against figures the test computes itself from the data files. AC-19: `keyboard-run` plays scenario 1 to Done by keyboard alone and checks a visible focus indicator at every stop; `motion` checks that nothing animates under reduced motion while the agent reads lines; `names` checks the accessible names of the ladder, its rows, the pair's popover, the portfolio's bars, and every option's and draft's Approve and Reject (each names what it decides; no two share a name). `method` opens the Method dialog: its sections, the parameters (a change confirmed and logged in the audit, kept for the next live run but never used by a simulation, locked during a run, reset to the defaults), the rates with their dates and the production path |
| hexagon | `node tests/hexagon.mjs` | Vici's hexagon rule: nothing in the app's files or in the rendered page is round, at every state of a played simulation, the cluster dialog, the options, the outbox and the tables included (`lib/prototype.mjs`), in both themes; each part first proves on planted examples that it catches every kind. `node tests/hexagon.mjs files` runs the file scan alone |
| design | `node tests/design.mjs` | Series colours (AC-14): the app's files name no data colour but teal, apricot and the two greys; every bar of a sweep's portfolio chart and of the value pipeline is filled with one of them, in both themes, never merlot, fjord, lilac, honey or a state colour; ten planted bars in forbidden colours are caught |
| accept | `node tests/accept.mjs` | The key (AC-08), with a stand-in for the API: asked only for Live, checked with `GET /v1/models`, kept in this tab's session storage under `pv.anthropic.key` and sent only to the API host; never in local storage, exports, the audit log, a recording or the console; Forget key removes it; the dialog refuses to work in a frame; a live run's audit export valid against its schema. The exports (AC-16, `node tests/accept.mjs exports`): a simulation's report, its group analysis and its audit log downloaded from the page, each with its name, its content and its figures against the engine, the audit log valid against its schema with the app's own validator and a broken copy refused. Cases: `key exports` |
| layout | `node tests/layout.mjs` | AC-17, in both themes: `viewports` at 1920×1080, 1600×900, 1536×864, 1366×768 and 1280×720 in every main state (idle, a decision waiting, the full ladder with a line's normalisation, the outbox, the run's end, the tables, the cluster dialog, the portfolio, the Method dialog): no horizontal overflow, nothing on the board or the tiles cut to an ellipsis, the ladder's texts clear of its marks, the header and the control bar on their rows; `targets` at 1920×1080 and 1280×720: every visible target at least 40 px, dialogs and popovers included; `controls`: a planted overflow, a planted ellipsis and a planted small target each caught. Cases: `viewports targets controls` |
| live | `node tests/live.mjs` | The live agent against a scripted stand-in for the Messages API and the rate host, nothing real called: every guardrail refused with a Guardrail line (AC-09), the rates through Frankfurter with a failing, blocked and refreshed rate (AC-10), the 40-call and €3 caps and the cost meter (AC-11), the recorder, Live sweep and Custom what-if, a parameter changed in the Method dialog used by the next live run's engine, recorded in its audit export and keeping the run from becoming a simulation; and the independent review's findings: the agent cannot mark pairs approved or accepted (`marks`, R1), and disguised figures and texts that call value saved or realised are refused (`words`, R2 and R5). Cases: `guard rates caps record entries marks words params` |
| sims | `node tests/sims.mjs` | The six scenarios as simulations, offline and without a key (AC-12): every scenario approving the recommendation, rejecting it and approving another, and accepting the variance; the tape, the tiles and the ladder equal the engine; scenario 2's cluster dialog confirmed, split and rejected with Your confirmation in merlot on Check and the rail never moving back (AC-10); no tile, card or label reads "saved" (AC-15); `timing` plays the demo's scenario (marked *Start here*) at ×1 with every answer given at once: the decision within 45 s and Done within 150 s of Start (for AC-21); `session` approves in one run and checks that the next run's Approved savings tile still counts it until Reset, and that a later decision on the same group replaces it. Cases: `paths confirmation words timing session` |

`node tests/run-all.mjs` runs everything in that order, prints a summary and ends with ALL SUITES PASSED
when every suite ran and passed. Name suites to run only those (`node tests/run-all.mjs unit engine`).
The parity suite looks for a Rebate Hunter checkout next to this repository (`../PROC-Rebate-Hunter`) or
in `PARITY_REF`.

No test calls a real API or the real rate host, and the browser suites block every request to another host.

Two scripts check the published site and are not part of `run-all`: `node tests/live_site.mjs [url]` checks
that GitHub Pages serves the commit's page, engine, tools, world, rates and scripts and that scenario 1 runs
to Done there (the workflow `.github/workflows/live-site.yml` runs it after every Pages build; it retries
for up to twelve minutes while the cache catches up), and `node tests/remote_head.mjs` checks that GitHub's
`main` holds exactly the local commit with nothing left uncommitted.

## Setup for the browser suites

You need Node.js 22 and Playwright with Chromium. Install them once, outside this folder:

```
npm install -g playwright@1.56.0
npx playwright install chromium
```

The GitHub Actions workflow pins the same version. Then run with Node's module path pointing at the
global packages:

```
NODE_PATH="$(npm root -g)" node tests/run-all.mjs
```

On Windows PowerShell: `$env:NODE_PATH = (npm root -g); node tests/run-all.mjs`.

Options (environment variables):
- `PLAYWRIGHT_MODULE`: path to a Playwright installation, instead of `NODE_PATH`.
- `CHROME_PATH`: use this Chrome or Chromium binary instead of Playwright's.
- `PV_TEST_OUT`: folder for screenshots and result files (default: a folder named price-variance-tests in the system temp folder).
- `PARITY_REF`: path to a Rebate Hunter checkout for the parity suite.

The smoke suite serves the app on a random port between 8400 and 8699, the design suite between 8700 and 8759, the hexagon suite between 8790 and 9089; the live, sims, accept and layout suites on 8771, 8772, 8773 and 8774.
