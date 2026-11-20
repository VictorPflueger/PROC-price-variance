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
| world | `node tools/check_world.mjs` | The world (AC-05): two builds give the same bytes and the files are current; the 124 accounts equal the extract; plants, delivery countries, units, contracts, currencies; every record fits its schema; each scenario against its frozen figures and its pattern; scenario 4 unflagged within ±5 % of the rate; no background group flagged; the past case's realised value and leakage, and its group analysed only after implementation. Node.js only |
| unit | `node tests/unit.mjs` | The streaming client and the cost maths (Rebate Hunter's cases), display strings, the schema validator, and the static checks of AC-07 (`node tests/unit.mjs static`): the security policy exactly as the brief's, nothing from a third party, every storage key `pv.` apart from `vc-theme`. Node.js only |
| engine | `node tests/engine.mjs` | The brief's golden cases from `fixtures/`: G1 to G3 (lines, pairs, totals and every display string, the half-euro tie included), G4 and G4b (the options, H not applicable), G5 (realised value, leakage, the window boundaries), the normalisation cases (price units, the person-day, exclusions, currencies, every Incoterms 2020 rule, every conversion of the world), display rules. Name groups to run only those (`node tests/engine.mjs G1 G4b`). Node.js only |
| audit | `node tests/audit.mjs` | The figure audit: F01 to F16 with their offending tokens, with the brief's figures and with the engine's own results; the brief's three notes; ids, dates, names, counts, scales, rates. Node.js only |
| hygiene | `node tests/hygiene.mjs` | No file the repository publishes carries a term of a private list or an e-mail address. The list never enters the repository: it is read from the `HYGIENE_TERMS` environment variable (a CI secret), from the file named in `HYGIENE_TERMS_FILE`, or from a `.hygiene-terms` file next to the repository folder. Without it only the generic checks run, and the suite ends with HYGIENE GENERIC OK. Node.js only |
| docs | `node tests/docs.mjs` | The documents carry their sections; every section the code cites ("TECH_NOTES §3") and every path a document names exists; the README links the live site. `--complete` checks the release's documentation set (AC-23, milestone M3). Node.js only |
| parity | `node tests/parity.mjs <Rebate Hunter checkout>` | The shared shell is the sister app's (AC-06): the shared modules and the four shared tests character for character (names normalised), `style.css` up to its app block, `modals.css` and `drawer.css` rule for rule, `vici/` byte for byte, and exactly two adapted modules, `js/handover.js` and `js/progress.js`, each named in `REVIEW.md` with its reason. Without a checkout it says so and exits with 2 (`run-all` reports it as skipped) |
| smoke | `node tests/smoke.mjs` | In Chromium: the page boots from its data files with no page error, no policy violation and no request to another host; the engine in the page (every group, the four planted ones flagged, the approved-savings tile); the scenarios; the intro; the drawer; the keyboard; storage keys; a missing data file named on the boot screen |
| hexagon | `node tests/hexagon.mjs` | Vici's hexagon rule: nothing in the app's files or in the rendered page is round, at every state of version 0.1.0 (`lib/prototype.mjs`), in both themes; each part first proves on planted examples that it catches every kind. `node tests/hexagon.mjs files` runs the file scan alone |

`node tests/run-all.mjs` runs everything in that order, prints a summary and ends with ALL SUITES PASSED
when every suite ran and passed. Name suites to run only those (`node tests/run-all.mjs unit engine`).
The parity suite looks for a Rebate Hunter checkout next to this repository (`../PROC-Rebate-Hunter`) or
in `PARITY_REF`.

No test calls a real API or the real rate host, and the browser suites block every request to another host.

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

The smoke suite serves the app on a random port between 8400 and 8699, the hexagon suite between 8790 and 9089.
