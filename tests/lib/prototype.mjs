// What differs between the prototypes in the shared Vici tests (tests/tokens.mjs, tests/hexagon.mjs,
// tests/page-icon.mjs and tests/vici-files.mjs). Those four files are the same in Rebate Hunter,
// Navigator, Timetable Translator, Repack Pilot and this app; this file is the one place that is not.
// Everything here is the Price Variance Agent's.

/** The prototype's name, as on its page and on its card on Victor's website. */
export const NAME = "Price Variance Agent";

/**
 * Colour pairs only this prototype draws (the shared shell's pairs are in tests/tokens.mjs):
 * [what, foreground token, background token, kind]. kind "text" needs 4.5:1, "mark" (a line, an icon,
 * a control's border, a bar) 3:1 (WCAG 2.2, 1.4.3 and 1.4.11). Tokens are Vici's, without "--vc-".
 * Version 0.1.0 draws the board's engine check, the console's idle content and the header's honesty
 * line; the price ladder's and the portfolio's pairs join with them in version 0.2.0.
 */
export const COLOUR_PAIRS = [
  // The board's canvas (bg-sunken): its title, explanation and the note on the scenario in focus.
  ["Board: the title and the note on the scenario in focus, on the canvas", "text", "bg-sunken", "text"],
  ["Board: the explanation under the title, on the canvas", "text-muted", "bg-sunken", "text"],
  ["Board: the count of flagged groups, a plain tag", "neutral-text", "neutral-bg", "text"],
  // The engine check's table (surface).
  ["Engine check: group names and figures", "text", "surface", "text"],
  ["Engine check: ids, quantities, lines and the index under a figure", "text-muted", "surface", "text"],
  ["Engine check: the scenario in focus, framed in 2 px of ink", "text", "surface", "mark"],
  ["Engine check: a flagged group's tag (word and icon) on its tint", "danger-text", "danger-bg", "text"],
  ["Engine check: a flagged group's icon on its tint", "danger-text", "danger-bg", "mark"],
  // The console's idle content (surface) and the header (surface).
  ["Console: the version note, a neutral alert", "neutral-text", "neutral-bg", "text"],
  ["Console: a tip's title and the chosen tip's ink frame", "text", "surface", "mark"],
  ["Console: a tip's number in its hexagon, on the quiet fill", "text", "bg-subtle", "text"],
  ["Console: the chosen tip's number, inverted", "surface", "text", "text"],
  ["Console: a tip's words, muted", "text-muted", "surface", "text"],
  ["Header: the honesty line (fictional company, no client data)", "text-muted", "surface", "text"],
  ["Header: a tile's unit after its figure", "text-muted", "surface", "text"]
];

/**
 * Colours that must stay apart, beyond the shared ones in tests/tokens.mjs: [what, token, token].
 * The test reports how far apart they stay under colour-vision deficiency; it does not fail on them.
 */
export const SEPARATIONS = [
  ["Engine check: a flagged tag (danger) against the focus frame (ink)", "danger-solid", "text"]
];

/**
 * The hexagon test's tour of the app (tests/hexagon.mjs): the states version 0.1.0 has. The page has
 * just been opened, without SKIP_INTRO, so the intro opens by itself. visit(name, { settle }) checks
 * the page as it is, settle ms (250) after the step.
 */
export async function hexagonTour(page, visit) {
  await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
  await page.waitForSelector(".intro-modal", { timeout: 10000 });
  await visit("start screen with the intro");
  await page.keyboard.press("Escape");
  await page.waitForSelector(".intro-modal", { state: "detached", timeout: 5000 });
  await visit("idle board");
  await page.click('.scenario-pick[data-scenario="SC-CONSULT"]');
  await visit("scenario 2 chosen: no group before a confirmation");
  await page.click('.scenario-pick[data-scenario="SC-SHOES"]');
  await visit("scenario 6 chosen: the group of two material numbers in focus");
  await page.click("#tab-options");
  await page.waitForSelector("#panel-options:not([hidden])", { timeout: 5000 });
  await visit("drawer open: options");
  await page.click("#tab-outbox");
  await visit("drawer open: outbox");
  await page.click("#tab-audit");
  await visit("drawer open: audit");
  await page.click(".drawer-toggle");
  await page.click("#btn-about");
  await page.waitForSelector(".intro-modal", { timeout: 5000 });
  await visit("How it works, opened from the header");
  await page.keyboard.press("Escape");
}

/**
 * The page icon (tests/page-icon.mjs): the icon and kind proposed for this prototype's card on
 * Victor's website (VictorPflueger/VIP, data/prototypes.js; the card follows in version 1.0.0), the
 * colour of that kind's cell (Vici's lilac for a prototype), and favicon.svg exactly: the card's cell
 * drawn for small sizes.
 */
export const PAGE_ICON = {
  icon: "trend-down",
  kind: "prototype",
  tone: "lilac",
  favicon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 103.92">
  <!-- Price Variance Agent's page icon: Vici's trend-down icon in a lilac hexagon cell, the icon and
       kind proposed for its card on Victor Pflüger's website (VictorPflueger/VIP, data/prototypes.js).
       Vici's lilac 100 (#f2e9fd) and lilac 900 (#372544); the icon is drawn larger and bolder than
       on the card so that it still reads at 16 px. -->
  <polygon points="120,51.96 90,103.92 30,103.92 0,51.96 30,0 90,0" fill="#f2e9fd"/>
  <g transform="translate(18 9.96) scale(3.5)" fill="none" stroke="#372544" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 7 L10 13 L13.5 9.5 L20 16 M14.5 16 H20 V10.5"/>
  </g>
</svg>
`
};
