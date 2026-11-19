# Data sources

What the Price Variance Agent reads, what is invented and what is real, each with its date.
**Fictional company, no client data:** GlobalCorp SE, its plants, suppliers, materials, contracts, prices
and order lines are invented; the exchange rates are the European Central Bank's.

## 1. Live sources (called from the browser at run time)

| Source | Used for | Address | Since |
| --- | --- | --- | --- |
| Anthropic's Messages API | The live agent's model calls, with the visitor's own key | `https://api.anthropic.com/v1/messages` | Version 0.2.0 |
| ECB reference rates through Frankfurter | Today's or a dated rate as a labelled sensitivity (`open_ecb_rate`) | `https://api.frankfurter.dev/v1/` | Version 0.2.0 |

The page's security policy allows exactly these two hosts (TECH_NOTES.md section 6). Version 0.1.0 makes
no request to either: it has no run yet.

## 2. Exchange rates

`data/fx.js` holds one rate per currency for the whole analysis (brief section 6.3): rate to EUR = 1 /
the mean of the ECB's daily reference quotes of that currency per euro over the window.

| Currency | Source | Window | Daily quotes | Mean per euro | Rate to EUR | Built |
| --- | --- | --- | --- | --- | --- | --- |
| GBP | ECB Data Portal, series `EXR.D.GBP.EUR.SP00.A`, cross-checked day by day against Frankfurter's v1 time series | 20 Nov 2025 to 19 Nov 2026 | 255 | 0.8613667843137256 | 1.1609456252677857 | 19 Nov 2026, workflow `fx-snapshot.yml` |
| EUR | — | — | — | 1 | 1 | — |

The ECB publishes its reference rates on working days at around 16:00 CET and discourages their use for
transactions (ECB website, read on 19 Nov 2026); the method uses them as one comparable rate per window.
Before the first snapshot the app used the rate Rebate Hunter observed on 14 Oct 2026 (1 EUR = 0.84385
GBP), labelled as one day's rate. The cost meter converts dollars at 1 USD = 0.894 EUR, the brief's fixed
value.

## 3. The fictional company: what is invented and what is anchored

| Part | Origin |
| --- | --- |
| GlobalCorp SE and its company codes 1000 (Frankfurt am Main, EUR), 2000 (Birmingham, GBP) and 3000 (Lyon, EUR) | Rebate Hunter's fictional world, unchanged |
| Plants 1010 Frankfurt, 1020 Duisburg, 2010 Birmingham, 3010 Lyon | Invented here, shared with the Data Quality Agent |
| 124 supplier accounts | Rebate Hunter's fictional vendor accounts outside its five real corporate groups, one per duplicate-name group (`tools/source/accounts.json`); ids, names, cities, countries, currencies and categories kept, tax ids and bank digits dropped |
| Eight added accounts, ids from 80001 | Invented here: seven in the Birmingham area invoicing in pounds, and a distributor in Lyon |
| Material groups (fifteen, two levels) | Invented here (`tools/source/material_groups.json`), shared with the Data Quality Agent |
| 64 materials, 24 contracts, 1,538 order lines, 12 buyers | Invented by `tools/build_world.mjs` from a fixed seed; buyers by role and team, given name and initial only |
| Order texts | In the language of the plant that bought: German in Frankfurt and Duisburg, French in Lyon, English in Birmingham |
| The shoe's manufacturer and part number (Brekholt, BH-7730-S3) | Invented; no maker of that name found on 19 Nov 2026 |

Each scenario's pattern is planted on purpose; every other group varies within a few per cent, so none is
flagged at the default parameters. Day numbers count from the day the app is opened (day 0 is today).

## 4. The six scenarios: what is planted

Figures at the default parameters and the snapshot rate, frozen in `data/reference_cases.js` and checked by
`tools/check_world.mjs`.

| # | Tip | What is planted | Engine result |
| --- | --- | --- | --- |
| 1 | "Lyon seems to pay far more for nitrile gloves than Frankfurt." | Frankfurt 600,000 EA on contract at €6.90 per box of 100, DAP; Lyon 450,000 EA off contract from a local distributor at €9.80, 15 % urgent with a reason; Birmingham 250 cases of 1,000 at £62.00 FCA; Duisburg 500 boxes at €720.00 per 100 boxes and a 20,000 EA bargain at €6.00 | Benchmark €6.90 per 100 EA (Frankfurt); opportunity €14,146 a year (€699 justified); spread 42.0 %; flagged |
| 2 | "Our SAP finance consultants cost very different amounts depending on who orders them." | Free-text lines: Frankfurt 120 days at €1,150; Duisburg 160 hours at €150; Lyon 60 days at €1,450; Birmingham 320 hours at £170 | No group until a person confirms the cluster; then 240 person-days, opportunity €36,155 a year, spread 37.3 % |
| 3 | "Duisburg says its higher prices for hydraulic hoses come from urgent orders." | Frankfurt 2,000 on contract at €38.00; Duisburg 2,400 at €44.50, 720 of them urgent with a reason; Lyon 600 at €38.40 | €4,104 justified by urgency; opportunity €11,736 a year; spread 17.1 %; flagged |
| 4 | "The UK pays 6% more for corrugated boxes than Lyon." | Lyon 120,000 at €1.80 ex works; Birmingham 18,000 at £1.62 delivered; Frankfurt 80,000 at €1.90 and Duisburg 40,000 at €1.91 delivered | With the 5 % uplift Lyon pays €1.89 delivered: opportunity €1,600, spread 1.1 %; not flagged, nor at the rate 5 % lower or higher |
| 5 | "Birmingham's pallet prices look high, but they are in pounds." | Frankfurt 9,000 and Duisburg 6,000 at €12.40 on contract; Lyon 4,000 at €12.65; Birmingham 3,500 at £14.80 delivered | Opportunity €17,737 a year, spread 38.6 %; flagged at the rate and 5 % either side |
| 6 | "Our safety shoes are on two different material numbers." | A German material bought by Frankfurt (1,200) and Duisburg (500) at €61.50 on contract, a French material bought by Lyon (700) at €78.00, the same manufacturer and part number | One group of two material numbers; opportunity €11,550 a year, spread 26.8 %; flagged |

The value pipeline's past cases: Duisburg's cable ties, moved from one supplier to another (option H,
approved on day −120 for €8,000 a year, implemented on day −90), with one later line to a third supplier
(leakage): €2,100 realised to date, €100 missed; the group is analysed only on the lines after day −90.
Lyon's stretch film: option H approved on day −12 for €3,400 a year, not implemented.

## 5. Method assumptions

The parameters of brief section 6.6, each an assumption shown as such: analysis window 365 days;
benchmark minimum share 10 %; urgent allowance 15 %; logistics uplift 5 % for Incoterms groups E and F;
person-day 8 hours; materiality €5,000 a year and 5 % spread; day rate €1,200; harmonise 1 day per moved
plant; renegotiate 2 days per supplier; tender 8 days; bundle discount 3 % of the group's quantity at the
benchmark; lead times 30, 60 and 90 days. The opportunity of a group is its unexplained variance over the
last 365 days, read as euros a year at the current volume.

## 6. Standards and system fields

| Item | Source | Status |
| --- | --- | --- |
| Incoterms 2020: eleven rules in force since 1 January 2020; groups E (EXW), F (FCA, FAS, FOB), C (CPT, CIP, CFR, CIF), D (DAP, DPU, DDP) | ICC's Incoterms page and a German chamber of commerce's summary (read on 19 Nov 2026) | Verified |
| Net price and price unit of a purchase-order item: EKPO-NETPR, EKPO-PEINH; order price unit EKPO-BPRME | SAP knowledge-base previews (19 Nov 2026) | Verified |
| Order header and Incoterms (EKKO, EKKO-INCO1), unit conversions (MARM), manufacturer part number (MARA-MFRPN) | Typical source fields | Not verified yet; checked before version 1.0.0 |

## 7. What the app does not use

No real company's prices, no real person in the data, no order or bank data, no third-party script, style or font, no
web search, no analytics and no cookies. Nothing leaves the page except a model call and a rate request in
a live run.
