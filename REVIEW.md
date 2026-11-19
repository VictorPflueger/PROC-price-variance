# Review

Two parts: the parity of the shared shell with the sister apps, which `tests/parity.mjs` checks on every
change, and the independent review of version 1.0.0 (AC-22), which follows in milestone M3.

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

Follows in milestone M3: an agent that did not build the prototype reviews figures, comparability, the
honesty rules and the interface, and no high or medium finding stays open (AC-22).
