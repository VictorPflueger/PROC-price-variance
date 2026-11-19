/*
 * PRICE VARIANCE AGENT: frozen reference figures (written by tools/build_world.mjs, for the checks only).
 */
window.REFERENCE_CASES = {
  "about": "Each scenario's figures as the engine computes them from data/world.js at the bundled rates of data/fx.js, frozen for the checks in tools/check_world.mjs. Never shown to the agent; the simulation recomputes every figure at playback.",
  "world_version": "1.0.0",
  "fx_version": "fx-fallback-2026-10-14",
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
        "spend": 109586.60306926587,
        "gap": 15236.603069265864,
        "justified": 698.625,
        "unexplained": 14537.978069265864,
        "index": 0.1326620012126566,
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
            "price": 0.07714641227706345,
            "share": 0.18248175182481752,
            "unexplained": 2036.6030692658617
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
            "residual": 2036.6030692658642,
            "index_after": 0.020977476283135895,
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
            "savings": 14537.978069265864,
            "bundle": 0,
            "one_off": 7200,
            "net": 7337.978069265864,
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
            "savings": 17373.878069265866,
            "bundle": 2835.9,
            "one_off": 9600,
            "net": 7773.878069265866,
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
        "spend": 313466.4336078687,
        "gap": 37466.43360786869,
        "justified": 0,
        "unexplained": 37466.43360786869,
        "index": 0.11952295235137483,
        "spread": 0.40144420886671073,
        "flagged": true,
        "benchmark": {
          "pair": "1010 / 30059",
          "price": 1150,
          "share": 0.5
        },
        "highest": {
          "pair": "2010 / 80004",
          "price": 1611.6608401967173
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
            "price": 1611.6608401967173,
            "share": 0.16666666666666666,
            "unexplained": 18466.433607868694
          }
        ],
        "options": {
          "H": {
            "applicable": true,
            "savings": 19000,
            "bundle": 0,
            "one_off": 2400,
            "net": 16600,
            "residual": 18466.43360786869,
            "index_after": 0.06271150630519687,
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
            "savings": 37466.43360786869,
            "bundle": 0,
            "one_off": 7200,
            "net": 30266.43360786869,
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
            "savings": 45746.43360786869,
            "bundle": 8280,
            "one_off": 9600,
            "net": 36146.43360786869,
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
        "spend": 489755.90448539436,
        "gap": 2135.9044853943265,
        "justified": 0,
        "unexplained": 2135.9044853943265,
        "index": 0.004361161276123061,
        "spread": 0.015752630376082353,
        "flagged": false,
        "benchmark": {
          "pair": "3010 / 30080",
          "price": 1.89,
          "share": 0.46511627906976744
        },
        "highest": {
          "pair": "2010 / 80003",
          "price": 1.9197724714107955
        },
        "pairs": [
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
          },
          {
            "pair": "2010 / 80003",
            "quantity": 18000,
            "price": 1.9197724714107955,
            "share": 0.06976744186046512,
            "unexplained": 535.9044853943255
          }
        ],
        "options": {
          "H": {
            "applicable": true,
            "savings": 1600.0000000000011,
            "bundle": 0,
            "one_off": 2400,
            "net": -799.9999999999989,
            "residual": 535.9044853943253,
            "index_after": 0.00109781420335224,
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
            "plants_not_covered": [
              "2010"
            ],
            "share_after": 0.9302325581395349
          },
          "R": {
            "applicable": true,
            "savings": 2135.9044853943265,
            "bundle": 0,
            "one_off": 7200,
            "net": -5064.095514605673,
            "residual": 0,
            "index_after": 0,
            "days_to_first_saving": 60,
            "plants": [
              "1010",
              "1020",
              "2010"
            ],
            "suppliers": [
              "30025",
              "30109",
              "80003"
            ]
          },
          "B": {
            "applicable": true,
            "savings": 16764.504485394325,
            "bundle": 14628.599999999999,
            "one_off": 9600,
            "net": 7164.5044853943255,
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
        "spend": 297985.3172957279,
        "gap": 18985.317295727917,
        "justified": 0,
        "unexplained": 18985.317295727917,
        "index": 0.06371225759719706,
        "spread": 0.41440823262045917,
        "flagged": true,
        "benchmark": {
          "pair": "1010 / 30109",
          "price": 12.4,
          "share": 0.4
        },
        "highest": {
          "pair": "2010 / 80003",
          "price": 17.538662084493694
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
            "price": 17.538662084493694,
            "share": 0.15555555555555556,
            "unexplained": 17985.317295727917
          }
        ],
        "options": {
          "H": {
            "applicable": true,
            "savings": 1000,
            "bundle": 0,
            "one_off": 1200,
            "net": -200,
            "residual": 17985.317295727917,
            "index_after": 0.06055961775988659,
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
            "savings": 18985.317295727917,
            "bundle": 0,
            "one_off": 4800,
            "net": 14185.317295727917,
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
            "savings": 27355.317295727917,
            "bundle": 8370,
            "one_off": 9600,
            "net": 17755.317295727917,
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
      "opportunity": 3968.1933993008197
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
