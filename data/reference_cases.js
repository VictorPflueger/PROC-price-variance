/*
 * PRICE VARIANCE AGENT: frozen reference figures (written by tools/build_world.mjs, for the checks only).
 */
window.REFERENCE_CASES = {
  "about": "Each scenario's figures as the engine computes them from data/world.js at the bundled rates of data/fx.js, frozen for the checks in tools/check_world.mjs. Never shown to the agent; the simulation recomputes every figure at playback.",
  "world_version": "1.0.0",
  "fx_version": "fx-2026-11-19",
  "method_version": "1.0.0",
  "cases": {
    "SC-GLOVES": {
      "number": 1,
      "group_id": "20001001",
      "figures": {
        "group": "20001001",
        "kind": "material",
        "base_unit": "EA",
        "display_quantity": 100,
        "lines": 31,
        "excluded": [
          "no conversion from PAL to EA"
        ],
        "cancelled": 0,
        "quantity": 1370000,
        "spend": 109194.3900512332,
        "gap": 14844.390051233213,
        "justified": 698.625,
        "unexplained": 14145.765051233213,
        "index": 0.12954662821593788,
        "spread": 0.4202898550724637,
        "flagged": true,
        "benchmark": {
          "pair": "1010 / 30024",
          "price": 0.069,
          "share": 0.43795620437956206
        },
        "highest": {
          "pair": "3010 / 80002",
          "price": 0.098
        },
        "pairs": [
          {
            "pair": "1020 / 30062",
            "quantity": 20000,
            "price": 0.06,
            "share": 0.014598540145985401,
            "unexplained": 0
          },
          {
            "pair": "1010 / 30024",
            "quantity": 600000,
            "price": 0.069,
            "share": 0.43795620437956206,
            "unexplained": 0
          },
          {
            "pair": "1020 / 30024",
            "quantity": 50000,
            "price": 0.07200000000000001,
            "share": 0.0364963503649635,
            "unexplained": 150.00000000000014
          },
          {
            "pair": "2010 / 80001",
            "quantity": 250000,
            "price": 0.07557756020493285,
            "share": 0.18248175182481752,
            "unexplained": 1644.3900512332111
          },
          {
            "pair": "3010 / 80002",
            "quantity": 450000,
            "price": 0.098,
            "share": 0.3284671532846715,
            "unexplained": 12351.375
          }
        ],
        "options": {
          "H": {
            "applicable": true,
            "savings": 12501.375,
            "bundle": 0,
            "one_off": 2400,
            "net": 10101.375,
            "residual": 1644.390051233213,
            "index_after": 0.017006296166914705,
            "days_to_first_saving": 30,
            "plants": [
              "1020",
              "3010"
            ],
            "suppliers": [
              "30024",
              "80002"
            ],
            "plants_moved": [
              "1020",
              "3010"
            ],
            "plants_not_covered": [
              "2010"
            ],
            "share_after": 0.8029197080291971
          },
          "R": {
            "applicable": true,
            "savings": 14145.765051233213,
            "bundle": 0,
            "one_off": 7200,
            "net": 6945.765051233213,
            "residual": 0,
            "index_after": 0,
            "days_to_first_saving": 60,
            "plants": [
              "1020",
              "2010",
              "3010"
            ],
            "suppliers": [
              "30024",
              "80001",
              "80002"
            ]
          },
          "B": {
            "applicable": true,
            "savings": 16981.665051233213,
            "bundle": 2835.9,
            "one_off": 9600,
            "net": 7381.665051233213,
            "residual": 0,
            "index_after": 0,
            "days_to_first_saving": 90,
            "plants": [
              "1010",
              "1020",
              "2010",
              "3010"
            ],
            "suppliers": [
              "30024",
              "30062",
              "80001",
              "80002"
            ]
          }
        }
      },
      "flagged_at_rate_minus_5_pct": true,
      "flagged_at_rate_plus_5_pct": true
    },
    "SC-CONSULT": {
      "number": 2,
      "group_id": "CL-01",
      "cluster": {
        "id": "CL-01",
        "base_unit": "PD",
        "material_group": "SRV-CON",
        "line_ids": [
          "4500010091-00010",
          "4500010127-00010",
          "4500010212-00010",
          "4500010327-00010",
          "4500010391-00010",
          "4500010532-00010",
          "4500010626-00010",
          "4500010631-00010",
          "4500010855-00010",
          "4500010884-00010",
          "4500010976-00010",
          "4500011006-00010",
          "4500011192-00010",
          "4500011301-00010",
          "4500011377-00010",
          "4500011400-00010",
          "4500011444-00010"
        ]
      },
      "figures": {
        "group": "CL-01",
        "kind": "cluster",
        "base_unit": "PD",
        "display_quantity": 1,
        "lines": 17,
        "excluded": [],
        "cancelled": 0,
        "quantity": 240,
        "spend": 312155.44201456755,
        "gap": 36155.44201456754,
        "justified": 0,
        "unexplained": 36155.44201456754,
        "index": 0.11582512155235868,
        "spread": 0.37294439162103354,
        "flagged": true,
        "benchmark": {
          "pair": "1010 / 30059",
          "price": 1150,
          "share": 0.5
        },
        "highest": {
          "pair": "2010 / 80004",
          "price": 1578.8860503641886
        },
        "pairs": [
          {
            "pair": "1010 / 30059",
            "quantity": 120,
            "price": 1150,
            "share": 0.5,
            "unexplained": 0
          },
          {
            "pair": "1020 / 30044",
            "quantity": 20,
            "price": 1200,
            "share": 0.08333333333333333,
            "unexplained": 1000
          },
          {
            "pair": "3010 / 30128",
            "quantity": 60,
            "price": 1450,
            "share": 0.25,
            "unexplained": 18000
          },
          {
            "pair": "2010 / 80004",
            "quantity": 40,
            "price": 1578.8860503641886,
            "share": 0.16666666666666666,
            "unexplained": 17155.442014567543
          }
        ],
        "options": {
          "H": {
            "applicable": true,
            "savings": 19000,
            "bundle": 0,
            "one_off": 2400,
            "net": 16600,
            "residual": 17155.44201456754,
            "index_after": 0.05851995070149524,
            "days_to_first_saving": 30,
            "plants": [
              "1020",
              "3010"
            ],
            "suppliers": [
              "30044",
              "30059",
              "30128"
            ],
            "plants_moved": [
              "1020",
              "3010"
            ],
            "plants_not_covered": [
              "2010"
            ],
            "share_after": 0.8333333333333334
          },
          "R": {
            "applicable": true,
            "savings": 36155.44201456754,
            "bundle": 0,
            "one_off": 7200,
            "net": 28955.44201456754,
            "residual": 0,
            "index_after": 0,
            "days_to_first_saving": 60,
            "plants": [
              "1020",
              "2010",
              "3010"
            ],
            "suppliers": [
              "30044",
              "30128",
              "80004"
            ]
          },
          "B": {
            "applicable": true,
            "savings": 44435.44201456754,
            "bundle": 8280,
            "one_off": 9600,
            "net": 34835.44201456754,
            "residual": 0,
            "index_after": 0,
            "days_to_first_saving": 90,
            "plants": [
              "1010",
              "1020",
              "2010",
              "3010"
            ],
            "suppliers": [
              "30044",
              "30059",
              "30128",
              "80004"
            ]
          }
        }
      },
      "flagged_at_rate_minus_5_pct": true,
      "flagged_at_rate_plus_5_pct": true
    },
    "SC-HOSES": {
      "number": 3,
      "group_id": "20001003",
      "figures": {
        "group": "20001003",
        "kind": "material",
        "base_unit": "EA",
        "display_quantity": 1,
        "lines": 23,
        "excluded": [],
        "cancelled": 0,
        "quantity": 5000,
        "spend": 205840,
        "gap": 15840,
        "justified": 4104,
        "unexplained": 11736,
        "index": 0.05701515740380878,
        "spread": 0.17105263157894737,
        "flagged": true,
        "benchmark": {
          "pair": "1010 / 30065",
          "price": 38,
          "share": 0.4
        },
        "highest": {
          "pair": "1020 / 30093",
          "price": 44.5
        },
        "pairs": [
          {
            "pair": "1010 / 30065",
            "quantity": 2000,
            "price": 38,
            "share": 0.4,
            "unexplained": 0
          },
          {
            "pair": "3010 / 30063",
            "quantity": 600,
            "price": 38.4,
            "share": 0.12,
            "unexplained": 239.99999999999915
          },
          {
            "pair": "1020 / 30093",
            "quantity": 2400,
            "price": 44.5,
            "share": 0.48,
            "unexplained": 11496
          }
        ],
        "options": {
          "H": {
            "applicable": true,
            "savings": 11736,
            "bundle": 0,
            "one_off": 2400,
            "net": 9336,
            "residual": 0,
            "index_after": 0,
            "days_to_first_saving": 30,
            "plants": [
              "1020",
              "3010"
            ],
            "suppliers": [
              "30063",
              "30065",
              "30093"
            ],
            "plants_moved": [
              "1020",
              "3010"
            ],
            "plants_not_covered": [],
            "share_after": 1
          },
          "R": {
            "applicable": true,
            "savings": 11736,
            "bundle": 0,
            "one_off": 4800,
            "net": 6936,
            "residual": 0,
            "index_after": 0,
            "days_to_first_saving": 60,
            "plants": [
              "1020",
              "3010"
            ],
            "suppliers": [
              "30063",
              "30093"
            ]
          },
          "B": {
            "applicable": true,
            "savings": 17436,
            "bundle": 5700,
            "one_off": 9600,
            "net": 7836,
            "residual": 0,
            "index_after": 0,
            "days_to_first_saving": 90,
            "plants": [
              "1010",
              "1020",
              "3010"
            ],
            "suppliers": [
              "30063",
              "30065",
              "30093"
            ]
          }
        }
      },
      "flagged_at_rate_minus_5_pct": true,
      "flagged_at_rate_plus_5_pct": true
    },
    "SC-BOXES": {
      "number": 4,
      "group_id": "20001005",
      "figures": {
        "group": "20001005",
        "kind": "material",
        "base_unit": "EA",
        "display_quantity": 1,
        "lines": 32,
        "excluded": [],
        "cancelled": 0,
        "quantity": 258000,
        "spend": 489053.17443280865,
        "gap": 1600.0000000000011,
        "justified": 0,
        "unexplained": 1600.0000000000011,
        "index": 0.0032716278794338474,
        "spread": 0.010582010582010592,
        "flagged": false,
        "benchmark": {
          "pair": "3010 / 30080",
          "price": 1.89,
          "share": 0.46511627906976744
        },
        "highest": {
          "pair": "1020 / 30109",
          "price": 1.91
        },
        "pairs": [
          {
            "pair": "2010 / 80003",
            "quantity": 18000,
            "price": 1.8807319129338131,
            "share": 0.06976744186046512,
            "unexplained": 0
          },
          {
            "pair": "3010 / 30080",
            "quantity": 120000,
            "price": 1.89,
            "share": 0.46511627906976744,
            "unexplained": 0
          },
          {
            "pair": "1010 / 30025",
            "quantity": 80000,
            "price": 1.9,
            "share": 0.31007751937984496,
            "unexplained": 800.0000000000008
          },
          {
            "pair": "1020 / 30109",
            "quantity": 40000,
            "price": 1.91,
            "share": 0.15503875968992248,
            "unexplained": 800.0000000000008
          }
        ],
        "options": {
          "H": {
            "applicable": true,
            "savings": 1600.0000000000011,
            "bundle": 0,
            "one_off": 2400,
            "net": -799.9999999999989,
            "residual": 0,
            "index_after": 0,
            "days_to_first_saving": 30,
            "plants": [
              "1010",
              "1020"
            ],
            "suppliers": [
              "30025",
              "30080",
              "30109"
            ],
            "plants_moved": [
              "1010",
              "1020"
            ],
            "plants_not_covered": [],
            "share_after": 0.9302325581395349
          },
          "R": {
            "applicable": true,
            "savings": 1600.0000000000011,
            "bundle": 0,
            "one_off": 4800,
            "net": -3199.999999999999,
            "residual": 0,
            "index_after": 0,
            "days_to_first_saving": 60,
            "plants": [
              "1010",
              "1020"
            ],
            "suppliers": [
              "30025",
              "30109"
            ]
          },
          "B": {
            "applicable": true,
            "savings": 16228.6,
            "bundle": 14628.599999999999,
            "one_off": 9600,
            "net": 6628.6,
            "residual": 0,
            "index_after": 0,
            "days_to_first_saving": 90,
            "plants": [
              "1010",
              "1020",
              "2010",
              "3010"
            ],
            "suppliers": [
              "30025",
              "30080",
              "30109",
              "80003"
            ]
          }
        }
      },
      "flagged_at_rate_minus_5_pct": false,
      "flagged_at_rate_plus_5_pct": false
    },
    "SC-PALLETS": {
      "number": 5,
      "group_id": "20001006",
      "figures": {
        "group": "20001006",
        "kind": "material",
        "base_unit": "EA",
        "display_quantity": 1,
        "lines": 30,
        "excluded": [],
        "cancelled": 0,
        "quantity": 22500,
        "spend": 296736.9833888713,
        "gap": 17736.983388871304,
        "justified": 0,
        "unexplained": 17736.983388871304,
        "index": 0.0597734168026745,
        "spread": 0.3856447785454214,
        "flagged": true,
        "benchmark": {
          "pair": "1010 / 30109",
          "price": 12.4,
          "share": 0.4
        },
        "highest": {
          "pair": "2010 / 80003",
          "price": 17.181995253963226
        },
        "pairs": [
          {
            "pair": "1010 / 30109",
            "quantity": 9000,
            "price": 12.4,
            "share": 0.4,
            "unexplained": 0
          },
          {
            "pair": "1020 / 30109",
            "quantity": 6000,
            "price": 12.4,
            "share": 0.26666666666666666,
            "unexplained": 0
          },
          {
            "pair": "3010 / 30080",
            "quantity": 4000,
            "price": 12.65,
            "share": 0.17777777777777778,
            "unexplained": 1000
          },
          {
            "pair": "2010 / 80003",
            "quantity": 3500,
            "price": 17.181995253963226,
            "share": 0.15555555555555556,
            "unexplained": 16736.983388871304
          }
        ],
        "options": {
          "H": {
            "applicable": true,
            "savings": 1000,
            "bundle": 0,
            "one_off": 1200,
            "net": -200,
            "residual": 16736.983388871304,
            "index_after": 0.0565941506438627,
            "days_to_first_saving": 30,
            "plants": [
              "3010"
            ],
            "suppliers": [
              "30080",
              "30109"
            ],
            "plants_moved": [
              "3010"
            ],
            "plants_not_covered": [
              "2010"
            ],
            "share_after": 0.8444444444444444
          },
          "R": {
            "applicable": true,
            "savings": 17736.983388871304,
            "bundle": 0,
            "one_off": 4800,
            "net": 12936.983388871304,
            "residual": 0,
            "index_after": 0,
            "days_to_first_saving": 60,
            "plants": [
              "2010",
              "3010"
            ],
            "suppliers": [
              "30080",
              "80003"
            ]
          },
          "B": {
            "applicable": true,
            "savings": 26106.983388871304,
            "bundle": 8370,
            "one_off": 9600,
            "net": 16506.983388871304,
            "residual": 0,
            "index_after": 0,
            "days_to_first_saving": 90,
            "plants": [
              "1010",
              "1020",
              "2010",
              "3010"
            ],
            "suppliers": [
              "30080",
              "30109",
              "80003"
            ]
          }
        }
      },
      "flagged_at_rate_minus_5_pct": true,
      "flagged_at_rate_plus_5_pct": true
    },
    "SC-SHOES": {
      "number": 6,
      "group_id": "MPN:Brekholt:BH-7730-S3",
      "figures": {
        "group": "MPN:Brekholt:BH-7730-S3",
        "kind": "mpn",
        "base_unit": "EA",
        "display_quantity": 1,
        "lines": 18,
        "excluded": [],
        "cancelled": 0,
        "quantity": 2400,
        "spend": 159150,
        "gap": 11550,
        "justified": 0,
        "unexplained": 11550,
        "index": 0.07257304429783223,
        "spread": 0.2682926829268293,
        "flagged": true,
        "benchmark": {
          "pair": "1010 / 30135",
          "price": 61.5,
          "share": 0.5
        },
        "highest": {
          "pair": "3010 / 80002",
          "price": 78
        },
        "pairs": [
          {
            "pair": "1010 / 30135",
            "quantity": 1200,
            "price": 61.5,
            "share": 0.5,
            "unexplained": 0
          },
          {
            "pair": "1020 / 30135",
            "quantity": 500,
            "price": 61.5,
            "share": 0.20833333333333334,
            "unexplained": 0
          },
          {
            "pair": "3010 / 80002",
            "quantity": 700,
            "price": 78,
            "share": 0.2916666666666667,
            "unexplained": 11550
          }
        ],
        "options": {
          "H": {
            "applicable": true,
            "savings": 11550,
            "bundle": 0,
            "one_off": 1200,
            "net": 10350,
            "residual": 0,
            "index_after": 0,
            "days_to_first_saving": 30,
            "plants": [
              "3010"
            ],
            "suppliers": [
              "30135",
              "80002"
            ],
            "plants_moved": [
              "3010"
            ],
            "plants_not_covered": [],
            "share_after": 1
          },
          "R": {
            "applicable": true,
            "savings": 11550,
            "bundle": 0,
            "one_off": 2400,
            "net": 9150,
            "residual": 0,
            "index_after": 0,
            "days_to_first_saving": 60,
            "plants": [
              "3010"
            ],
            "suppliers": [
              "80002"
            ]
          },
          "B": {
            "applicable": true,
            "savings": 15978,
            "bundle": 4428,
            "one_off": 9600,
            "net": 6378,
            "residual": 0,
            "index_after": 0,
            "days_to_first_saving": 90,
            "plants": [
              "1010",
              "1020",
              "3010"
            ],
            "suppliers": [
              "30135",
              "80002"
            ]
          }
        }
      },
      "flagged_at_rate_minus_5_pct": true,
      "flagged_at_rate_plus_5_pct": true
    }
  },
  "past_cases": {
    "implemented": {
      "entry": "VL-01",
      "group": "20001004",
      "plant": "1020",
      "baseline": 0.05,
      "baseline_lines": 9,
      "realised": 2100.0000000000005,
      "leakage_lines": 1,
      "leakage_quantity": 20000,
      "missed": 99.99999999999994,
      "analysed_after_implementation": {
        "flagged": false,
        "opportunity": 105.99999999999997,
        "lines": 8
      },
      "without_the_rule": {
        "flagged": true,
        "opportunity": 6754,
        "lines": 23
      }
    },
    "approved": {
      "entry": "VL-02",
      "group": "20001007",
      "plant": "3010",
      "flagged": false,
      "opportunity": 3594.657191650676
    }
  },
  "pipeline": {
    "approved": 11400,
    "implemented": 8000,
    "realised": 2100.0000000000005,
    "leakage_lines": 1,
    "leakage_missed": 99.99999999999994
  }
};
