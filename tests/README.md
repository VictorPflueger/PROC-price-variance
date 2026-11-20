# Tests (optional, for developers)

The Price Variance Agent itself needs no Node.js, npm or build step. These scripts check it after a change to code, data or docs. GitHub Actions runs them on every push and pull request (`.github/workflows/tests.yml`).

## What runs

| Suite | Command | Checks |
| --- | --- | --- |
| tokens | `node tests/tokens.mjs` | The colour system on Vici's values (`vici/dist/tokens.json`), light and dark: WCAG 2.2 contrast for every pair the page draws (`lib/prototype.mjs`); how far the state colours stay apart under colour-vision deficiency |
| page-icon | `node tests/page-icon.mjs` | `favicon.svg` byte for byte; the header and the loading screen use the page icon's cell; with Victor's website (`VIP`) next to this repository, its card gives the same icon and kind |
| fingerprint | `node tests/fingerprint.mjs` | The case is intact: the engine, the tools, the agent, the data and the six scripts are version 1.0.0's files byte for byte, and every comparable group and every decision path gives 1.0.0's figures (`fixtures/fingerprint-1.0.0.json`) |
| world | `node tools/check_world.mjs` | The world, the six scenarios against their frozen figures, and every simulation script on every decision path through the live tools and their guardrails |
| unit | `node tests/unit.mjs` | The streaming client, the cost maths, display strings, the schema validator, the sixteen tool schemas, the security policy |
| engine | `node tests/engine.mjs` | The golden cases G1 to G5, the normalisation cases, display rules, the guardrails of the live tools call by call, and every script with planted faults |
| audit | `node tests/audit.mjs` | The figure audit: F01 to F16, ids, dates, names, disguised figures and value words |
| hygiene | `node tests/hygiene.mjs` | No published file carries a private term or an e-mail address. The list comes from the `HYGIENE_TERMS` secret or a `.hygiene-terms` file next to the repository; without it only the generic checks run |
| vici | `node tests/vici.mjs` | Vici's own checks: the guide and its key figures, the byline, the writing rules and the AI notice on the page; the layout of Vici's brief (SIMULATION or LIVE, one sentence and the byline under the header); every sentence the presenter writes for the six cases on every decision path, without ids, unit codes or placeholders; the docs; `vici/` byte for byte at the commit its README names |
| lean | `node tests/lean.mjs` | The limits a change has to argue with: the presenter's modules and lines, one stylesheet, the two modules that make requests, the security policy, the docs' length, nothing of 1.0.0's console left |
| docs | `node tests/docs.mjs` | Every path a document names exists; the README says what is real; `DEMO_SCRIPT.md` walks the guide's talk track step for step and sentence for sentence; every euro amount and percentage in the docs is the engine's |
| showcase | `node tests/showcase.mjs` | The presenter in Chromium: the five steps by click, key, Next and link; the four key figures against the engine, before and after the decision; every way out of the gloves case with its drafts and the decision log; all six cases without ids or unit codes; the guide at 1280 × 720 and 1366 × 768, with Vici's own browser test; the layout at 1920 × 1080, 1366 × 768 and 1280 × 720 in both themes. Cases: `steps kpis decide cases guide layout` |
| hexagon | `node tests/hexagon.mjs` | Vici's hexagon rule: nothing round in the app's files or on the rendered page, at every step, in both themes |
| live | `node tests/live.mjs` | A live run against a stand-in for the Messages API, nothing real called: Start agent asks simulation or live, LIVE and the AI notice while it runs, the steps unlock and the page follows the agent, the person decides, the measured session cost, the key never in local storage, a refused key, Stop, the 40-call and €3 caps, an unreachable API. Cases: `happy key stop caps offline` |

`node tests/run-all.mjs` runs everything in that order and ends with ALL SUITES PASSED when every suite ran and passed. Name suites to run only those (`node tests/run-all.mjs unit showcase`). With `--require-vici`, as on GitHub Actions, the Vici checks fail without a ViciDesign checkout instead of skipping.

No test calls a real API or the real rate host; the browser suites block every request to another host.

`node tests/live_site.mjs [url]` checks the published site and is not part of `run-all`: GitHub Pages serves this commit's files, and the gloves case runs through its five steps there. The *live site* workflow runs it after every Pages build.

## Setup

You need Node.js 22 and Playwright with Chromium, installed once outside this folder:

```
npm install -g playwright@1.56.0
npx playwright install chromium
```

Then run with Node's module path pointing at the global packages, and a ViciDesign checkout next to this repository (`../ViciDesign`) or in `VICI_DIR`:

```
NODE_PATH="$(npm root -g)" node tests/run-all.mjs
```

On Windows PowerShell: `$env:NODE_PATH = (npm root -g); node tests/run-all.mjs`. `CHROME_PATH` points the browser suites at another Chromium; `PV_TEST_OUT` says where screenshots go.
