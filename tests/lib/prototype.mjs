// What differs between the prototypes in the shared Vici tests (tests/tokens.mjs, tests/hexagon.mjs and
// tests/page-icon.mjs). Those files are the same in the sister prototypes; this file is the one place
// that is not.
// Everything here is the Price Variance Agent's.

/** The prototype's name, as on its page and on its card on Victor's website. */
export const NAME = "Price Variance Agent";

/**
 * Colour pairs only this prototype draws (the shared shell's pairs are in tests/tokens.mjs):
 * [what, foreground token, background token, kind]. kind "text" needs 4.5:1, "mark" (a line, an icon,
 * a control's border, a bar) 3:1 (WCAG 2.2, 1.4.3 and 1.4.11). Tokens are Vici's, without "--vc-".
 */
export const COLOUR_PAIRS = [
  // The header, the strip under it and the talk track.
  ["Header: a key figure's note", "text-muted", "surface", "text"],
  ["Header: the unexplained gap on its coral tint", "danger-text", "danger-bg", "text"],
  ["Header: a key figure that moved, on its tint", "success-text", "success-bg", "text"],
  ["Header: a tinted figure's label and note", "text", "danger-bg", "text"],
  ["Header: LIVE on lilac", "feature-text", "feature-bg", "text"],
  ["Strip under the header: what the prototype does", "text-muted", "surface", "text"],
  ["Talk track: a step's label", "text-muted", "bg", "text"],
  ["Talk track: the current step's label", "text", "bg", "text"],
  ["Talk track: the AI notice", "feature-text", "feature-bg", "text"],
  // The story: the agent's words and the decision log.
  ["Story: the agent's words on lilac", "text", "feature-bg", "text"],
  ["Story: replayed or live, on lilac", "feature-text", "feature-bg", "text"],
  ["Story: a running live step (lilac words)", "feature-text", "surface", "text"],
  ["Story: the lead and the log's times", "text-muted", "surface", "text"],
  // The stage: tables, the conversion card, the gap chart, options and drafts (sunken canvas, white panels).
  ["Stage: a title and a table's figures", "text", "bg-sunken", "text"],
  ["Stage: a note under a table", "text-muted", "bg-sunken", "text"],
  ["Stage: a cell's second line", "text-muted", "surface", "text"],
  ["Stage: the contract tag", "success-text", "success-bg", "text"],
  ["Conversion: the delivered price (merlot: the figure that counts)", "accent-text", "surface", "text"],
  ["Gap chart: a plant's name, its price and its euros a year", "text", "bg-sunken", "text"],
  ["Gap chart: the column heads and a small pair's note", "text-muted", "bg-sunken", "text"],
  ["Gap chart: the best price's bar and mark", "success-solid", "bg", "mark"],
  ["Gap chart: the unexplained part", "danger-solid", "bg", "mark"],
  ["Gap chart: the justified part", "warning-text", "bg", "mark"],
  ["Gap chart: another pair's bar", "border-strong", "bg", "mark"],
  ["Options: the agent's recommendation, framed in lilac", "feature-solid", "surface", "mark"],
  ["Options: the agent's Recommended tag", "feature-text", "feature-bg", "text"],
  ["Options: an approved option on its tint", "success-text", "success-bg", "text"],
  ["Start agent: the live card's words on lilac", "text", "feature-bg", "text"]
];

/**
 * Colours that must stay apart, beyond the shared ones in tests/tokens.mjs: [what, token, token].
 * The test reports how far apart they stay under colour-vision deficiency; it does not fail on them.
 */
export const SEPARATIONS = [
  ["Gap chart: unexplained (danger) against justified (warning)", "danger-solid", "warning-text"],
  ["Gap chart: unexplained (danger) against the best price (success)", "danger-solid", "success-solid"],
  ["Gap chart: another pair's bar against the best price", "border-strong", "success-solid"]
];

/**
 * The hexagon test's tour of the app (tests/hexagon.mjs). The page has just been opened in a new tab,
 * so the guide opens by itself. visit(name, { settle }) checks the page as it is, settle ms (250) after
 * the step. The gloves case is walked through its five steps with a decision; the consultants' case
 * shows the confirmation; the case menu and the Start agent dialog are opened once.
 */
export async function hexagonTour(page, visit) {
  await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
  await page.waitForSelector("#guide[open]", { timeout: 10000 });
  await visit("start screen with the guide");
  await page.keyboard.press("Escape");
  for (const [n, name] of [[1, "the tip"], [2, "like for like"], [3, "the gap"], [4, "your decision"]]) {
    await page.keyboard.press(String(n));
    await visit(`step ${n}: ${name}`);
  }
  await page.click(".option[data-recommended='true'] .option-approve");
  await visit("step 4: decided");
  await page.keyboard.press("5");
  // The recommended option in the gloves case allows two drafts; both are written before any is decided.
  await page.waitForFunction(() => document.querySelectorAll(".draft-actions").length >= 2, null, { timeout: 15000 });
  await visit("step 5: the drafts");
  const approve = page.locator(".draft-actions .vc-button:not(.vc-button--ghost)");
  for (let k = 0; k < 4 && await approve.count(); k++) {
    const left = await approve.count();
    await approve.first().click();
    await page.waitForFunction((n) => document.querySelectorAll(".draft-actions .vc-button:not(.vc-button--ghost)").length < n, left);
  }
  await visit("step 5: drafts decided");
  await page.click("#case-button");
  await visit("the case menu");
  await page.click('#case-menu [data-case="SC-CONSULT"]');
  await page.keyboard.press("2");
  await visit("the consultants' confirmation");
  await page.click("#start");
  await page.waitForSelector("#start-dialog[open]", { timeout: 5000 });
  await visit("Start agent: simulation or live");
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
