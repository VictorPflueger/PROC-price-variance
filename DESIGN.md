# Design

How the Price Variance Agent looks and why. It is built on Victor's design system Vici (v1.0.0, in
`vici/`, unchanged) and on the shell the sister prototypes share (REVIEW.md, Part 1). Version 0.2.0 has
the price board's two views and their tables, the cluster dialog, the options, the outbox and the audit;
the Method dialog follows in milestone M3.

## 1. The brief

A procurement agent for a room of decision-makers: it finds where one company pays different prices for
the same item or service, makes the prices comparable, separates what a reason explains from what nothing
explains, and proposes costed options that a person approves. The screen has to read from the back of a
room at 1920 × 1080 and fit a laptop at 1280 × 720 without horizontal scrolling. It must never pass a
simulation for a live run, never call a saving real before later orders show it, and never let a figure
reach the screen that the engine did not compute.

## 2. Methods, and what each one decided

- **The sisters' shell, unchanged where it can be.** Header with four tiles, control bar, centrepiece,
  console with the progress rail, drawer with Options, Outbox and Audit, dialogs. Two modules are adapted
  for a third human step, *Your confirmation* (REVIEW.md); everything else is Rebate Hunter's, so a fix
  travels between the prototypes file by file.
- **Like for like before anything else.** The board shows normalised prices only (€ per base unit,
  delivered), at the item's display quantity ("€6.90 per 100 EA"), and every line opens its normalisation
  steps (M2), so the room sees why a price that looks cheap is not.
- **The engine computes, the screen shows.** Every figure comes from `js/variance.js`, `js/options.js` or
  `js/pipeline.js` and is formatted by `js/format.js` alone (Intl with en-GB after rounding to 1e-9).
- **Numbers also as a table.** Vici's data-visualisation guideline asks for the numbers one click away:
  Table beside the board's views shows the group's pairs and lines, or the flagged groups and the value
  pipeline, with the same figures as the charts.
- **The price ladder.** One row per plant and supplier, sorted by price, the plant's name first: a hexagon
  at the pair's normalised price sized by its quantity, the benchmark as an ink line with its label, the
  unexplained part from the benchmark in danger with a cross, the justified part hatched with its reason, and
  the euros a year at the row's end, always with a word ("✕ €12,351 a year", "benchmark", "at or below",
  "✓ approved"). The lines sit as small hexagons in a lane above their pair, each at its price, nudged into
  a honeycomb ribbon where they share one (a contract pair's lines all do), so none hides under its pair and
  each opens its normalisation. With the drawer open the ladder is compact: the pairs, without the lines.
- **The portfolio.** The flagged groups as bars of opportunity from zero, largest first, each with its
  spread and index; below them the value pipeline as four labelled bars, approved "a year", realised "to
  date", the leakage named, the definitions one click away. No pies or donuts.

## 3. Colour grammar

Each colour means one thing, everywhere (the same four rules as the sister apps, applied to prices).

| Colour (Vici's tokens) | Means | Where you see it | Never used for |
| --- | --- | --- | --- |
| **Merlot** (`--vc-accent` and its tokens) | **The person in charge** | Primary buttons, every Approve, the step that waits for you (*Your confirmation*, *Your decision*, *Your approval*), the recommended option's frame, your decisions in the console and the audit, the focus ring | A mark among state colours: merlot sits close to Vici's danger tone |
| **Danger** (`--vc-danger-*`) | **Paid above the benchmark without a reason** | The unexplained part on the price ladder, with a cross and its euros a year; the alert card | Decoration |
| **Warning** (`--vc-warning-*`) | A gap a reason explains, or one that waits for a decision | The justified part on the ladder, hatched in `--vc-warning-text` on `--vc-warning-bg` (the pale `--vc-warning-solid` is too faint for a mark), with its reason; an accepted variance | |
| **Success** (`--vc-success-*`) | Closed by an approved option | A tick and "✓ approved" on the ladder, never "saved" | Anything before a person approved it |
| **Fjord** (`--vc-info-*`) | Checking, and money an option spends | The lines the agent reads pulse in a fjord outline and keep it once read; an option's one-off cost; the sensitivity note at a newer rate | |
| **Lilac** (`--vc-feature-*`) | **The AI's voice** | The AI disclosure, AI labels, hypotheses and *Revised* lines, drafts; a proposed cluster until a person confirms it, its columns outlined in `--vc-feature-solid` | Anything a person decided |
| **Ink** (`--vc-text`, Vici's neutrals) | Everything else, the benchmark line included | Text, tables, the ladder's pairs and lines, the tips; a selection is a 2 px ink frame (the chosen tip) | |
| **Teal, apricot and greys** (`--vc-data-2`, `--vc-data-3`, `--vc-data-7`, `--vc-data-8`) | Chart series only | The flagged groups' bars (teal) and the value pipeline's four stages (teal, apricot, grey, dark grey) | Any state |
| **The tape** (`--vc-text` and `--vc-surface` stripes) | **Simulation** | The SIMULATION badge, tape and watermark, always with the word | |

Every state also has a form of its own (WCAG 1.4.1), because Vici's state tones are close in lightness: a
word, Vici's state icon, and on the ladder a cross for unexplained and hatching for justified. Plants are
told apart by the labels on their rows, never by colour. `tests/tokens.mjs` checks the contrast of every
pair the app draws in both themes, with this app's pairs in `tests/lib/prototype.mjs`.

## 4. Where the look comes from

Vici v1.0.0: its tokens, fonts, components and icons, loaded from `vici/` (a copy byte for byte, checked by
`tests/vici-files.mjs` against a checkout of Vici). The page icon is Vici's `trend-down` in a lilac hexagon
cell, the icon proposed for the prototype's card on Victor's website (decision D2), drawn in `favicon.svg`
larger and bolder so that it reads at 16 px. Nothing is round: hexagons replace circles and capsules
everywhere, with no exception (`tests/hexagon.mjs`). Light theme by default, dark through Vici's toggle;
the app has no colour value of its own apart from the favicon.

## 5. The checks

| Test | Checks |
| --- | --- |
| `tests/tokens.mjs` | Contrast of every pair the shell and this app draw, light and dark; every token the app names exists |
| `tests/hexagon.mjs` | Nothing round in the app's files or in the rendered page, at every state of a played simulation (the cluster dialog, the ladder, a popover, the options, the outbox, the tables, Diagnostics), both themes |
| `tests/page-icon.mjs` | The favicon byte for byte, the cell in the header and on the loading screen |
| `tests/vici-files.mjs` | `vici/` as Vici's release, file for file |
| `tests/design.mjs` | Series colours: only teal, apricot and the greys fill a chart, in both themes, with planted bars in forbidden colours caught |
| `tests/smoke.mjs` | The page at 1600 × 900: header, tiles, rail, drawer, scenarios, keyboard, storage; the board at 1920 × 1080 against the engine, every line's normalisation opened by keyboard and by pointer |

Screenshots at 1920 × 1080 and 1280 × 720, light and dark, go with each milestone's pull request.

## 6. Deviations from Vici

None beyond the sister apps' (Rebate Hunter's DESIGN.md, section 10): the shell's tiles, rail and console
keep their measures. The board's tables and the options' table use Vici's compact table with tighter cells,
so they fit 1280 × 720 without horizontal scrolling; the ladder is an SVG drawn to the board's size and
drawn again when the drawer opens or closes.
