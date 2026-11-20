# Design

How the Price Variance Agent looks and why. It is built on Victor's design system Vici (v1.0.0, in
`vici/`, unchanged) and on the shell the sister prototypes share (REVIEW.md, Part 1). Version 0.1.0 has
the shell, the header's tiles, the console's rail and the board's engine check; the price ladder, the
portfolio view, the cluster dialog and the Method dialog follow in milestones M2 and M3.

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
- **Numbers also as a table.** Vici's data-visualisation guideline asks for the numbers one click away;
  version 0.1.0's board is that table: every comparable group with its benchmark, spend, spread, index and
  opportunity, the planted groups flagged.

## 3. Colour grammar

Each colour means one thing, everywhere (the same four rules as the sister apps, applied to prices).

| Colour (Vici's tokens) | Means | Where you see it | Never used for |
| --- | --- | --- | --- |
| **Merlot** (`--vc-accent` and its tokens) | **The person in charge** | Primary buttons, every Approve, the step that waits for you (*Your confirmation*, *Your decision*, *Your approval*), the recommended option's frame, your decisions in the console and the audit, the focus ring | A mark among state colours: merlot sits close to Vici's danger tone |
| **Danger** (`--vc-danger-*`) | **Paid above the benchmark without a reason** | A flagged group's tag (with its icon and the word); from M2 the unexplained part on the price ladder, with a cross | Decoration |
| **Warning** (`--vc-warning-*`) | A gap a reason explains, or one that waits for a decision | From M2 the justified part on the ladder, hatched, with its reason | |
| **Success** (`--vc-success-*`) | Closed by an approved option | From M2: a tick and "approved", never "saved" | Anything before a person approved it |
| **Fjord** (`--vc-info-*`) | Checking, and money an option spends | From M2: the lines and groups the agent reads pulse in a fjord outline | |
| **Lilac** (`--vc-feature-*`) | **The AI's voice** | The AI disclosure; from M2 AI labels, hypotheses and *Revised* lines, a proposed cluster until a person confirms it, drafts | Anything a person decided |
| **Ink** (`--vc-text`, Vici's neutrals) | Everything else, the benchmark line included | Text, tables, the version note, the tips; a selection is a 2 px ink frame (the group of the chosen scenario, the chosen tip) | |
| **Teal, apricot and greys** (`--vc-data-2`, `--vc-data-3`, `--vc-data-7`, `--vc-data-8`) | Chart series only | From M2: the portfolio's opportunity bars and the value pipeline | Any state |
| **The tape** (`--vc-text` and `--vc-surface` stripes) | **Simulation** | From M2: the SIMULATION badge, tape and watermark, always with the word | |

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
| `tests/hexagon.mjs` | Nothing round in the app's files or in the rendered page, at every state of version 0.1.0, both themes |
| `tests/page-icon.mjs` | The favicon byte for byte, the cell in the header and on the loading screen |
| `tests/vici-files.mjs` | `vici/` as Vici's release, file for file |
| `tests/smoke.mjs` | The page at 1600 × 900: header, tiles, rail, drawer, scenarios, keyboard, storage |

Screenshots at 1920 × 1080 and 1280 × 720, light and dark, go with each milestone's pull request.

## 6. Deviations from Vici

None in version 0.1.0 beyond the sister apps' (Rebate Hunter's DESIGN.md, section 10): the shell's tiles,
rail and console keep their measures. The engine check's table uses Vici's table with tighter cells inside
the board (a container query below 820 px), so it fits 1280 × 720 without horizontal scrolling.
