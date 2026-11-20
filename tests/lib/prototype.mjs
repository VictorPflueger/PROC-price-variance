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
 */
export const COLOUR_PAIRS = [
  // The board's caption card and tools (surface).
  ["Board: the caption's title", "text", "surface", "text"],
  ["Board: the caption's facts", "text-muted", "surface", "text"],
  ["Board: the sensitivity note (fjord: a labelled check)", "info-text", "surface", "text"],
  // The price ladder on the board's canvas (bg-sunken).
  ["Ladder: a plant's name, the benchmark's label and line", "text", "bg-sunken", "text"],
  ["Ladder: a supplier's name, the axis ticks, a row's tags", "text-muted", "bg-sunken", "text"],
  ["Ladder: a pair's hexagon outline and the benchmark line", "text", "bg-sunken", "mark"],
  ["Ladder: unexplained (danger) as words at the row's end", "danger-text", "bg-sunken", "text"],
  ["Ladder: the unexplained bar's outline and cross", "danger-solid", "bg-sunken", "mark"],
  ["Ladder: the cross inside the unexplained bar", "danger-solid", "danger-bg", "mark"],
  ["Ladder: justified (warning) as words at the row's end", "warning-text", "bg-sunken", "text"],
  ["Ladder: the justified hatch and its outline", "warning-text", "warning-bg", "mark"],
  ["Ladder: the justified pair's outline", "warning-text", "bg-sunken", "mark"],
  ["Ladder: approved (success) as words with the tick", "success-text", "bg-sunken", "text"],
  ["Ladder: the approved pair's tick", "success-solid", "success-bg", "mark"],
  ["Ladder: a line the agent reads, outlined in fjord", "info-solid", "bg-sunken", "mark"],
  // The portfolio's bars (series colours only) and their labels.
  ["Portfolio: a bar in teal (series 1)", "data-2", "bg-subtle", "mark"],
  ["Portfolio: a bar in apricot (series 2)", "data-3", "bg-subtle", "mark"],
  ["Portfolio: a bar in grey (series 3)", "data-7", "bg-subtle", "mark"],
  ["Portfolio: a bar's label and value", "text", "bg-sunken", "text"],
  ["Portfolio: a bar's spread, index and definitions", "text-muted", "bg-sunken", "text"],
  // A proposed cluster (the AI's voice: lilac) and the dialog around it.
  ["Cluster: the proposal's tag", "feature-text", "feature-bg", "text"],
  ["Cluster: the agent's note on its tint", "text", "feature-bg", "text"],
  ["Cluster: a column's outline, a candidate's dashed outline", "feature-solid", "surface", "mark"],
  ["Cluster: the agent's note, its lilac bar", "feature-solid", "feature-bg", "mark"],
  ["Cluster: words only some texts use (warning)", "warning-text", "surface", "text"],
  // The drawer: the options' table and an option's one-off cost (fjord: money an option spends).
  ["Options: the recommended row's letter", "accent-text", "surface", "text"],
  ["Options: an option's one-off cost", "info-text", "surface", "text"],
  // The console's scenario list and the header.
  ["Console: a tip's title and the chosen tip's ink frame", "text", "surface", "mark"],
  ["Console: a tip's number, muted", "text-muted", "surface", "text"],
  ["Console: the chosen tip's number (the person's choice: merlot)", "on-accent", "accent", "text"],
  // A pair's popover (Vici's popover: the raised surface), its lines and their buttons.
  ["Popover: a line's id, day and price", "text", "surface-raised", "text"],
  ["Popover: a line's day, muted", "text-muted", "surface-raised", "text"],
  ["Popover: read by the agent (fjord: checking)", "info-text", "info-bg", "text"],
  ["Popover: a line button's hover", "text", "surface-hover", "text"],
  ["Popover: a line button's focus ring", "focus", "surface-raised", "mark"],
  // The Method dialog (the raised surface) and the production path's diagram.
  ["Method: a parameter's default, subtle", "text-subtle", "surface-raised", "text"],
  ["Method: a changed parameter's default (the person's choice: merlot)", "accent-text", "surface-raised", "text"],
  ["Method: a rate fetched in the run (fjord: a labelled check)", "info-text", "surface-raised", "text"],
  ["Method: an invalid value's border", "danger-solid", "surface-raised", "mark"],
  ["Production path: a step's title on its tint", "text", "bg-subtle", "text"],
  ["Production path: a step's text on its tint", "text-muted", "bg-subtle", "text"],
  ["Production path: the arrow between two steps", "text-muted", "surface-raised", "mark"],
  ["Audit: the note of an empty log", "text-muted", "surface", "text"],
  ["Header: the honesty line (fictional company, no client data)", "text-muted", "surface", "text"],
  ["Header: a tile's unit after its figure", "text-muted", "surface", "text"]
];

/**
 * Colours that must stay apart, beyond the shared ones in tests/tokens.mjs: [what, token, token].
 * The test reports how far apart they stay under colour-vision deficiency; it does not fail on them.
 */
export const SEPARATIONS = [
  ["Ladder: unexplained (danger) against justified (warning)", "danger-solid", "warning-text"],
  ["Ladder: unexplained (danger) against approved (success)", "danger-solid", "success-solid"],
  ["Ladder: the benchmark (ink) against unexplained (danger)", "text", "danger-solid"],
  ["Portfolio: teal against apricot", "data-2", "data-3"]
];

/**
 * The hexagon test's tour of the app (tests/hexagon.mjs). The page has just been opened, without
 * SKIP_INTRO, so the intro opens by itself. visit(name, { settle }) checks the page as it is, settle ms
 * (250) after the step. Scenario 2 is played in Simulation at ×4 to its cluster confirmation, its
 * decision and its end, which shows the ladder, the dialog, the options, the outbox and the tables.
 */
export async function hexagonTour(page, visit) {
  await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
  await page.waitForSelector(".intro-modal", { timeout: 10000 });
  await visit("start screen with the intro");
  await page.keyboard.press("Escape");
  await page.waitForSelector(".intro-modal", { state: "detached", timeout: 5000 });
  await visit("idle: the portfolio and the value pipeline");
  await page.click('.scenario-pick__item[data-id="SC-CONSULT"]');
  await page.click("button[aria-label='Replay speed ×4']");
  await page.click("#btn-start");
  await page.waitForSelector(".mode-card", { timeout: 5000 });
  await visit("the mode dialog");
  await page.click('.mode-card[data-mode="simulation"] .mode-cta button');
  await page.waitForSelector(".cluster-modal", { timeout: 60000 });
  await visit("the cluster confirmation");
  await page.click('.cluster-modal [data-action="confirm"]');
  await page.waitForSelector('.option-card[data-recommended="true"] [data-action="approve"]', { timeout: 60000 });
  await visit("a decision waiting: the ladder and the options");
  await page.click(".ladder .ladder-row");
  await visit("a pair's popover");
  await page.keyboard.press("Escape");
  await page.click('.option-card[data-recommended="true"] [data-action="approve"]');
  await page.waitForSelector('.action-card[data-status="pending"]', { timeout: 30000 });
  await visit("the outbox with a draft");
  for (const b of await page.$$('.action-card[data-status="pending"] [data-action="approve"]')) await b.click();
  await page.waitForFunction(() => /Done/.test(document.querySelector(".status-pill .text")?.textContent || ""), null, { timeout: 60000 });
  await visit("the run's end");
  await page.click(".table-toggle");
  await visit("the group's tables");
  await page.click('.board-tools button[data-view="portfolio"]');
  await visit("the portfolio's tables");
  await page.click("#tab-audit");
  await visit("drawer open: audit");
  await page.click("#btn-diagnostics");
  await page.waitForSelector(".diag-table", { timeout: 5000 });
  await visit("Diagnostics", { settle: 600 });
  await page.keyboard.press("Escape");
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
