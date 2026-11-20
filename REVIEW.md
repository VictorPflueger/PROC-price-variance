# Review

Two parts: the parity of the shared shell with the sister apps, which `tests/parity.mjs` checks on every
change, and the independent review of version 1.0.0 (AC-22), with every finding and what became of it.

## Part 1: the shared shell

The Price Variance Agent takes over Rebate Hunter's shell, as the Timetable Translator and Repack Pilot
did, so a fix or a design change in one prototype can be carried to the others file by file.
`tests/parity.mjs` compares each file below with a checkout of Rebate Hunter's `main`, with the app
names and storage prefixes normalised (`node tests/parity.mjs ../PROC-Rebate-Hunter`).

### Identical, character for character

| File | What it does |
| --- | --- |
| `js/anthropic.js` | Streaming Messages client, retries, the key check, the browser header |
| `js/clock.js` | Day 0 is today; a recorded replay pins it |
| `js/cost.js` | Usage × price per model and tier |
| `js/dom.js` | Element helper, tooltips, downloads |
| `js/drawer.js` | The drawer: Options, Outbox and Audit, and Vici's byline |
| `js/keystore.js` | The key in this tab's session storage, under `pv.anthropic.key` |
| `js/labels.js` | AI labels on paragraphs |
| `js/md.js` | Markdown for reports and drafts, without HTML |
| `js/modal.js` | Dialogs on Vici's `vc-dialog` |
| `js/sse.js` | Server-sent events |
| `js/theme.js` | The theme before the page is drawn; `vc-theme` is the one shared storage key |
| `css/components.css`, `css/console.css` | The shell's components and the console |
| `tests/tokens.mjs`, `tests/page-icon.mjs`, `tests/vici-files.mjs` | The shared design tests; this app's values are in `tests/lib/prototype.mjs` |
| `tests/hexagon.mjs` | The shared hexagon test; its list of exceptions may differ and is empty here |

### The same rules, comments aside

| File | Note |
| --- | --- |
| `css/drawer.css`, `css/modals.css` | Comments may name this app |
| `css/style.css` | Up to its marked app-specific block; below it the honesty line, the tiles' unit and the scenario chooser |

### Vici

`vici/` is Vici v1.0.0 (`fdd868b`), byte for byte; `tests/vici-files.mjs` and `tests/parity.mjs` check it.

### Adapted: exactly two modules

| File | Reason | Diff against Rebate Hunter |
| --- | --- | --- |
| `js/handover.js` | The run waits for a third human step besides the decision and the approval: confirming a cluster of lines the agent proposes (scenario 2), so it tracks *Your confirmation* and offers `turnLabel()` | Repack Pilot's version of the module (its third step confirmed an item-master entry), with the comment naming this app's cluster |
| `js/progress.js` | While a confirmation waits, the merlot turn sits on the furthest step reached (Check in the scripted runs) and its label comes from `turnLabel()`; Rebate Hunter's five steps, its state map and its handling of a run that ends with nothing found stay, because scenario 4 needs them | Rebate Hunter's file with Repack Pilot's two changes: `stepOf` for a confirmation and the turn label from `js/handover.js` |

Any further change to a shared file waits for Victor's approval (brief, section 4) and joins this table
with its reason before it is made.

## Part 2: the independent review

**Who and when.** On 20 Nov 2026 an agent that did not build the prototype reviewed release candidate
1.0.0: commit `eb7a1b4` on the branch `m3-hardening-release`, served from a read-only archive of that
commit, so that the work still going on in the branch could not change what it saw. It ran no git command
that changes state. Its report went back to the builder, who fixed the findings in the commits named below,
each with a test that fails on the code the reviewer saw.

**What it checked, and how.**

- **Figures.** It recomputed all 63 comparable groups from `data/world.js` and `data/fx.js` with its own
  script, written from the method rather than from the engine. The engine matched to within 1e-6, and the
  six scenarios matched DATA_SOURCES.md. It compared the ladder, the tables, the tiles, the option cards, the
  report, the CSV and the alert with the engine, and recomputed the CSV's totals.
- **Comparability.** Only a material, a manufacturer part number or a confirmed cluster forms a group;
  exclusions carry their reason; the person-day is eight hours; the window's mean rate is used and the E or
  F uplift applies; the benchmark's 10 % floor and the 15 % allowance for urgent orders hold.
- **Honesty rules.** It played scenarios 1 to 6 as simulations at ×4 in Chrome, at 1920 × 1080 and
  1280 × 720, light and dark, and scenario 2 with every answer to the cluster dialog. It drove a Live run
  with the repository's scripted stand-in for the API (`tests/lib/fake-claude.mjs`) and tried texts and
  board marks a model could produce. It checked that the key stays in this tab's session storage only,
  that drafts are never sent and that the caps hold before each call.
- **Interface.** It tabbed through a decision, sampled animations under reduced motion and measured
  overflow at both sizes.
- **Tests.** It ran `node tests/run-all.mjs`: 15 of 17 suites passed (R17 and R18 below).

**What held.** The engine and the golden cases (G1 to G5, F01 to F16); every figure on screen and in the
exports; rounding and signs ("-€200", "€699"); the comparability and normalisation rules above; scenario 4
ending with nothing to propose; scenario 5's sensitivity labelled "(representative)" while the tiles stay
on the window's rate; the SIMULATION badge and tape, the AI disclosure, "Fictional company, no client data"
in the header and the AI labels.

**Findings and what became of them.** Two high, eleven medium and five low findings. Every high and medium
finding is fixed; so are the five low ones. The tests named are the ones that now guard each fix.

| ID | Severity | Area | Finding | Disposition |
| --- | --- | --- | --- | --- |
| R1 | High | honesty, interface | The model could mark pairs "approved" or "accepted" on the board (`ui_mark_board`) before or without a person's decision. | Fixed in `ebe44ad`: the tool takes only checking, above and neutral; "above" is refused for a pair or line at or below the benchmark (rule `board`); approved and accepted come only from a decision, in code. Tests: `tests/engine.mjs` GR, `tests/live.mjs` marks. |
| R2 | High | figures, honesty | The figure audit could be passed with ordinary phrasing: a label or a year swallowing the figure that follows ("a price level 45% above", "by 2026 euros"), amounts in words, and a loss written as a gain. | Fixed in `bf940f7`: a label or year is exempt only when no %, currency, scale or unit follows; amounts in words are read; the sign of a net figure is compared. Tests: `tests/audit.mjs` bypasses (the review's four texts refused, the controls passed), `tests/live.mjs` words. |
| R3 | Medium | interface, comparability | Every normalisation popover read "(group null)", and no ladder row named its E or F Incoterms rule (an inverted lookup). | Fixed in `ed81573` and `6179208`: "FCA (group F)", and every row's tags name its E or F rule. Test: `tests/smoke.mjs` board. |
| R4 | Medium | honesty, figures | Scenario 2's texts assumed the default answer: "person-day" after a confirmation in hours, and a residual risk for a plant that a split had already covered. | Fixed in `6179208`: the texts take the confirmed base unit, and the residual risk appears only when a plant stays uncovered. Test: `tests/engine.mjs` S (the hour, and the split without Birmingham); `tools/check_world.mjs` now plays every answer, 62 paths. |
| R5 | Medium | honesty | In a Live run nothing stopped the model from calling approved value "saved" or "realised". | Fixed in `4b933b3`: rule 8 of the system prompt, and the guardrail `value` refuses such an alert, option, draft or report unless the word is negated or conditional. Tests: `tests/audit.mjs` value, `tests/live.mjs` words. |
| R6 | Medium | honesty, interface | The status read "Simulating" during Calculate, in a Live run too. | Fixed in `6179208`: it reads "Calculating". Tests: `tests/sims.mjs` words, `tests/live.mjs` marks. |
| R7 | Medium | interface, figures | With a tender approved, the Approved savings line was cut off and the bundle discount never showed as its own part. | Fixed in `595759e`: "incl. €… bundle discount" first, then implemented and realised, on lines that wrap. Test: `tests/layout.mjs`. |
| R8 | Medium | interface | At 1280 × 720 the group table clipped "Unexplained, a year". | Fixed in `595759e`: the headers wrap, and the layout test measures scroll containers inside the page. Test: `tests/layout.mjs`. |
| R9 | Medium | interface | At a decision no Approve, Reject or Accept was on screen at either size. | Fixed in `595759e`: each card's actions stay in view, and the recommended option's Approve is brought into view, again after a resize. Test: `tests/layout.mjs`. |
| R10 | Medium | interface, comparability | At 1280 × 720 the cluster dialog hid its evidence and the choice of base unit below the plant columns. | Fixed in `595759e`: the proposal, the evidence and the base unit come before the lines by plant, which show in full. Test: `tests/layout.mjs`. |
| R11 | Medium | figures, interface | After a parameter change, a simulation ran at the defaults while the Method and cluster dialogs showed the changed values. | Fixed in `6179208`: both dialogs show the values of the run on screen, and the Method dialog says that a simulation runs at the defaults. Test: `tests/smoke.mjs` method. |
| R12 | Medium | honesty (audit) | A parameter change disappeared from the audit log when the next run began. | Fixed in `134d3b7`: the change is carried into the next run's log with its time and reviewer. Test: `tests/live.mjs` params. |
| R13 | Medium | figures | Approved savings forgot the approvals of earlier runs in the same session. | Fixed in `5093a2a`: the session keeps its approvals by group until Reset; a later decision on a group replaces the earlier one. Test: `tests/sims.mjs` session. |
| R14 | Low | honesty | A replay's console line said it fetched the ECB rate. | Fixed in `6179208`: "Replays a representative ECB reference rate (not fetched)". Test: `tests/unit.mjs`. |
| R15 | Low | interface (accessibility) | Every Approve and Reject had the same accessible name. | Fixed in `5fa6e94`: "Approve option H: …", "Approve draft: … (to …)". Test: `tests/smoke.mjs` names. |
| R16 | Low | honesty | The default buyer notice told every moved plant it paid more "without a documented reason", false for Lyon's urgent orders. | Fixed in `6179208` and `cf84759`: the notice says how much a documented reason explains is in the comparison. Test: `tests/engine.mjs` S. |
| R17 | Low | documents, release | The app still said 0.2.0, the demo script was missing and the docs gave 1,538 order lines. | Fixed in `134d3b7` and `9576855`: version 1.0.0, DEMO_SCRIPT.md, 1,540 lines. Tests: `tests/docs.mjs`, `tests/smoke.mjs`. |
| R18 | Low | tests | The smoke case motion failed now and then on the boot screen's spinner. | Fixed in `134d3b7`: it waits for the boot screen to go before sampling. Test: `tests/smoke.mjs` motion. |

**What the review could not check.** The real API and the Frankfurter service: the reviewer had no key and
no internet, so for R2 and R5 it showed that the code let such texts through, not that a real model writes
them. That is part of Victor's live run (AC-20). Nor could it check the private list of terms for the
hygiene check, the card on the website (a separate pull request on that repository), real screen readers,
browsers other than Chrome, or the five-minute demo (AC-21), which is Victor's to give.

**Each fix tested by taking it away.** The reviewer's probe scripts are not part of the repository; each
fix carries its own test instead. To show that a test guards its fix, the fix's own changes to the app
were reversed on top of the branch's head, every other fix kept, and the test run again (20 Nov 2026).
For R1 to R17 every test named above failed without its fix. One clarification: `tools/check_world.mjs`
plays scenario 2's new paths but does not read their texts, so for R4 the guard is the S group of
`tests/engine.mjs`. R12's change could not be reversed mechanically, because later commits touch the same
lines, so it was taken out by hand. R18 was a timing fault that cannot be forced; its case passed three runs
in a row. The full suite passes on the branch's head; TECH_NOTES.md section 11 records the run with its
counts.
