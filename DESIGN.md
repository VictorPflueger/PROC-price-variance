# Design

How the Price Variance Agent looks and why. It is built on Victor's design system Vici (v1.0.0, in
`vici/`, unchanged) and on the shell the sister prototypes share (REVIEW.md, Part 1). Version 1.0.0 has
the price board's two views and their tables, the cluster dialog, the options, the outbox, the audit and
the Method dialog, laid out for a room and a laptop (section 7) and usable by keyboard alone (section 8).

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
  steps, so the room sees why a price that looks cheap is not.
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
  a honeycomb ribbon where they share one (a contract pair's lines all do), so none hides under its pair.
  They are marks, not targets of their own: the row is the target. A click on a line's mark opens that
  line's normalisation at once; anywhere else on the row, or Enter, opens a popover listing every line
  with its day and price, each a button to its normalisation and back. On a short board (the drawer open on a
  laptop) the ladder is compact and each line sits on its pair's row.
- **The portfolio.** The flagged groups as bars of opportunity from zero, largest first, each with its
  spread and index; below them the value pipeline as four labelled bars, approved "a year", realised "to
  date", the leakage named, the definitions one click away. No pies or donuts.
- **The Method dialog.** The engine's rules in ten short sections, written for a reader who asks how a
  figure came about: comparable groups, a comparable price, the benchmark, justified and unexplained,
  spread, index and materiality, the options, the value pipeline, the parameters (editable between runs,
  each change logged), the exchange rates with their dates, and the production path as the same five-step
  diagram as the intro window's last part (SAP, Fabric, the agents, Power BI, Power Automate and Teams).
- **Exports that say what they are.** Every file starts with `price-variance-`, then the run and its mode
  in capitals, so a replay's report, analysis or audit log never passes for a live one.

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
cell, the icon of the prototype's card on Victor's website (decision D2), drawn in `favicon.svg`
larger and bolder so that it reads at 16 px. Nothing is round: hexagons replace circles and capsules
everywhere, with no exception (`tests/hexagon.mjs`). Light theme by default, dark through Vici's toggle;
the app has no colour value of its own apart from the favicon.

## 5. The checks

| Test | Checks |
| --- | --- |
| `tests/tokens.mjs` | Contrast of every pair the shell and this app draw, light and dark; every token the app names exists |
| `tests/hexagon.mjs` | Nothing round in the app's files or in the rendered page, at every state of a played simulation (the cluster dialog, the ladder, a popover, the options, the outbox, the tables, Diagnostics), both themes |
| `tests/page-icon.mjs` | The favicon byte for byte, the cell in the header and on the loading screen, and with a checkout of the website next to the repository (as in CI) the card's icon and kind |
| `tests/vici-files.mjs` | `vici/` as Vici's release, file for file |
| `tests/design.mjs` | Series colours: only teal, apricot and the greys fill a chart, in both themes, with planted bars in forbidden colours caught |
| `tests/smoke.mjs` | The page at 1600 × 900: header, tiles, rail, drawer, scenarios, keyboard, storage; the board at 1920 × 1080 against the engine, every line's normalisation opened by keyboard and by pointer; a whole run by keyboard alone with a visible focus indicator on every stop; reduced motion; the accessible names of the board; the Method dialog |
| `tests/layout.mjs` | From 1920 × 1080 to 1280 × 720 in both themes and every main state: no horizontal overflow, nothing on the board or the tiles cut to an ellipsis, the ladder's texts clear of its marks, the header and the control bar on their rows; every visible target at least 40 px; a planted overflow, ellipsis and small target each caught |

Screenshots at 1920 × 1080 and 1280 × 720, light and dark, go with each milestone's pull request.

## 6. Deviations from Vici

None beyond the sister apps' (Rebate Hunter's DESIGN.md, section 10): the shell's tiles, rail and console
keep their measures. The board's tables and the options' table use Vici's compact table with tighter cells,
so they fit 1280 × 720 without horizontal scrolling; the ladder is an SVG drawn to the board's size and
drawn again when the drawer opens or closes.

## 7. Layout

The screen is laid out for two sizes at once: a projector at 1920 × 1080, read from the back of a room,
and a laptop at 1280 × 720. `tests/layout.mjs` checks five sizes between them (1920 × 1080, 1600 × 900,
1536 × 864, 1366 × 768, 1280 × 720), in both themes, in every main state: idle, a decision waiting with
the drawer open, the full ladder with a pair's lines and a line's normalisation open, the outbox, the
run's end with the report, the tables, scenario 2's cluster dialog, the portfolio after a sweep and the
Method dialog.

- **No horizontal scrolling, anywhere.** The page, the board, the console, the drawer and every dialog fit
  their width; long tables scroll vertically inside their panel.
- **Nothing cut short on the board or the tiles.** No ellipsis and no clamped line: a label that does not
  fit wraps, and the ladder makes room for its row labels and values before it draws the plot. Its labels
  stay clear of the plot and its values clear of the marks.
- **The shell keeps its rows.** The header stays within 140 px with its badges clear of the tiles, and the
  control bar stays on one row; on a laptop its buttons keep their icons and show their words as
  tooltips.
- **The board adapts to its height, not only its width.** The ladder is drawn to the board's size and drawn
  again whenever the board changes, for instance when the drawer opens. A row is at least 58 px high on a
  full ladder and 44 px on a compact one, which then scrolls inside the board. The intro window's
  production path is a row of five steps with arrows on a wide screen and a column below 1,100 px.
- **Tables fit by their content.** The board's tables and the options use Vici's compact table; the
  options' columns take the width their content needs and their headers break at spaces, never inside a
  word.

## 8. Accessibility

The aim is a run that anyone can follow and complete without a mouse, without colour and without motion.

- **Targets of at least 40 px.** Every visible control is at least 40 px high and wide at 1920 × 1080 and
  1280 × 720, in every state, dialogs and popovers included (AC-17, `tests/layout.mjs` targets). A small
  checkbox counts with the label that wraps it; a link inside a sentence is part of the prose, as WCAG 2.5.8
  allows. The ladder's rows are full-height bands; its lines are marks inside them, reached through the
  row.
- **A whole run by keyboard.** Tab reaches the replay speed, the tip, Start agent, the mode cards, the
  options' Approve and every draft's Approve; Enter and Space act, Escape closes a dialog or popover and
  returns focus to where it came from (`tests/smoke.mjs` keyboard-run plays scenario 1 to Done this way).
  On the ladder, a row opens its pair's popover; Tab moves through its lines, Enter opens a line's
  normalisation, "Back to the pair's lines" returns, and Escape returns to the row.
- **Visible focus.** Vici's focus ring, a 2 px outline in `--vc-focus` with a 2 px offset, on every
  control; hexagonal icon buttons show it as a hexagon, a card's link outlines the whole card, and a
  ladder row draws its band's outline. The keyboard run checks that every stop shows one.
- **Reduced motion.** With the system's reduced-motion setting, Vici's rule shortens every animation to an
  instant and the pulses of the lines the agent reads stop; the state stays visible as the still fjord
  outline (`tests/smoke.mjs` motion).
- **Names for what is drawn.** The ladder is a named group that says what its rows open; each row is a
  button named with its plant, supplier, normalised price, share of the quantity, unexplained euros a year
  and number of lines. The marks, the axis and the benchmark line are hidden from assistive technology,
  because the rows and the Table view carry the same facts as text. The pair's popover is a named dialog;
  its line buttons say that they open the normalisation. Every bar of the portfolio and the value pipeline
  has its label and value as text (`tests/smoke.mjs` names).
- **Colour is never alone.** Every state has a word and a form of its own (section 3); contrast is checked
  for every pair the app draws in both themes (`tests/tokens.mjs`).
- **Text that can grow.** The page is English (`lang="en"`); **Larger text** in the console's header
  enlarges the console for projectors without breaking the layout.
