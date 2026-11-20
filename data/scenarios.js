/*
 * PRICE VARIANCE AGENT: the six tips (written by tools/build_world.mjs).
 *
 * Each scenario is a short, unverified tip, written the way a first hint arrives. In Live mode the agent
 * gets the tip ("seed") and nothing else. group_id is the comparable group the board shows when the
 * scenario is chosen (null for scenario 2, whose group exists only after a person confirms a cluster); the
 * agent never sees it.
 */
window.SCENARIOS = [
  {
    "id": "SC-GLOVES",
    "number": 1,
    "title": "Gloves at three sites",
    "short": "Gloves",
    "category": "MRO supplies",
    "seed": "Lyon seems to pay far more for nitrile gloves than Frankfurt.",
    "group_id": "20001001",
    "start_here": true
  },
  {
    "id": "SC-CONSULT",
    "number": 2,
    "title": "Same consultant, different day rate",
    "short": "Consultants",
    "category": "Consulting",
    "seed": "Our SAP finance consultants cost very different amounts depending on who orders them.",
    "group_id": null,
    "material_group": "SRV-CON"
  },
  {
    "id": "SC-HOSES",
    "number": 3,
    "title": "Express is not a reason",
    "short": "Hoses",
    "category": "MRO supplies",
    "seed": "Duisburg says its higher prices for hydraulic hoses come from urgent orders.",
    "group_id": "20001003"
  },
  {
    "id": "SC-BOXES",
    "number": 4,
    "title": "It's the delivery terms",
    "short": "Boxes",
    "category": "Packaging",
    "seed": "The UK pays 6% more for corrugated boxes than Lyon.",
    "group_id": "20001005"
  },
  {
    "id": "SC-PALLETS",
    "number": 5,
    "title": "Pallets in pounds",
    "short": "Pallets",
    "category": "Packaging",
    "seed": "Birmingham's pallet prices look high, but they are in pounds.",
    "group_id": "20001006"
  },
  {
    "id": "SC-SHOES",
    "number": 6,
    "title": "Same shoe, two numbers",
    "short": "Shoes",
    "category": "MRO supplies",
    "seed": "Our safety shoes are on two different material numbers.",
    "group_id": "MPN:Brekholt:BH-7730-S3"
  }
];
