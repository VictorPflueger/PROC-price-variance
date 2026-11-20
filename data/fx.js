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
  "version": "fx-2026-11-19",
  "status": "snapshot",
  "source": "European Central Bank, euro foreign exchange reference rates (daily series EXR.D.<currency>.EUR.SP00.A, ECB Data Portal), every day cross-checked against Frankfurter's v1 time series",
  "label": "mean of the ECB's daily reference rates, 20 Nov 2025 to 19 Nov 2026",
  "built": "2026-11-19",
  "window": {
    "first": "2025-11-20",
    "last": "2026-11-19",
    "days": 365
  },
  "currencies": {
    "EUR": {
      "rate_to_eur": 1
    },
    "GBP": {
      "mean_per_eur": 0.8613667843137256,
      "rate_to_eur": 1.1609456252677857,
      "observations": 255,
      "first": "2025-11-20",
      "last": "2026-11-19",
      "source": "ECB"
    }
  }
};
