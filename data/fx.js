/*
 * PRICE VARIANCE AGENT: exchange rates, the data product fx_rate (written by tools/build_fx.mjs).
 *
 * One rate per currency for the whole analysis: rate_to_eur = 1 / the mean of the ECB's daily reference
 * quotes of that currency per euro over the window, with its first and last date (brief section 6.3).
 * A rate fetched in a live run is only ever a labelled sensitivity beside these rates.
 * status "snapshot": built from the ECB Data Portal and cross-checked day by day against Frankfurter.
 * status "fallback": one day's rate, labelled as such, until the snapshot workflow has run.
 */
window.FX = {
  "version": "fx-fallback-2026-10-14",
  "status": "fallback",
  "source": "European Central Bank euro reference rate of 14 Oct 2026 (1 EUR = 0.84385 GBP), as Rebate Hunter's TECH_NOTES section 4 observed it through Frankfurter's v1 API; not a window mean",
  "label": "ECB reference rate of 14 Oct 2026, one day's rate (fallback until the window's mean is built)",
  "built": "2026-10-14",
  "window": {
    "first": null,
    "last": null,
    "days": 365
  },
  "currencies": {
    "EUR": {
      "rate_to_eur": 1
    },
    "GBP": {
      "mean_per_eur": 0.84385,
      "rate_to_eur": 1.1850447354387628,
      "observations": 1,
      "first": "2026-10-14",
      "last": "2026-10-14"
    }
  }
};
