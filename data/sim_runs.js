// Simulation scripts, one per preset scenario: authored by hand ("source": "authored"), as no API key
// is used to build this prototype. A script plays the part of the model: every tool call it makes runs
// through the live toolbox at playback, so the engine recomputes every figure and every guardrail
// applies. Texts never type a figure: {{placeholders}} take each one from this run's engine results
// (js/sim_vars.js). tools/check_world.mjs plays every script on every path before a demo (AC-13).
// Format: js/simulation.js. Live runs saved with "Save run as simulation" become "source": "recorded"
// once curated.
(function () {
  const contractOfBenchmark = { tool: "erp_query", input: { product: "contract", filters: [{ field: "supplier", op: "eq", value: "{{group.benchmark_supplier}}" }] } };

  // Scenario 2: the steps after the person confirms the cluster, whole or split.
  const afterCluster = [
    { tool: "pv_compare", input: { group_id: "{{cluster.id}}" } },
    { say: "{{cluster.id}} is now a comparable group with the person-day as its base unit. I check three of its lines step by step, from the benchmark pair and the highest pair." },
    { tool: "pv_normalise", input: { line_id: "{{benchmark.line}}" } },
    { tool: "pv_normalise", input: { line_id: "{{benchmark.line2}}" } },
    { tool: "pv_normalise", input: { line_id: "{{highest.line}}" } },
    contractOfBenchmark,
    { if: "group.flagged", then: [
      { say: "No contract fixes {{group.benchmark_plant}}'s day rate, yet it is the group's best at volume: {{group.benchmark}}. {{group.highest_plant}} pays {{group.highest}}." },
      { alert: {
        title: "SAP finance consultants: {{group.highest_plant}} pays {{group.highest}}, the benchmark is {{group.benchmark}}",
        summary: "The cluster you confirmed compares the same role across plants at one base unit, the person-day. {{group.benchmark_plant}} buys most days at {{group.benchmark}}; {{group.highest_plant}} pays {{group.highest}}. Unexplained: {{group.opportunity}} a year, spread {{group.spread}}."
      } },
      { propose: true }
    ], else: [
      { say: "With only the lines you confirmed, the spread is {{group.spread}} and the unexplained variance {{group.opportunity}} a year: below materiality, so there is nothing to propose." },
      { report: { outcome: "nothing_found", markdown: "## SAP finance consultants: nothing material in the confirmed lines\n\nYou confirmed part of the proposed cluster as {{cluster.id}}. Its benchmark is {{group.benchmark}} ({{group.benchmark_pair}}), its spread {{group.spread}} and its unexplained variance {{group.opportunity}} a year, below the materiality of {{group.materiality}} and {{group.materiality_spread}}. Nothing is proposed." } }
    ] }
  ];

  window.SIM_RUNS = {
    "SC-GLOVES": {
      source: "authored",
      title: "Gloves at three sites",
      hypothesis: "Lyon buys the same nitrile gloves as Frankfurt, off contract and at a higher price.",
      steps: [
        { say: "Hypothesis: Lyon buys the same nitrile gloves as Frankfurt, off contract and at a higher price. I check it against the order lines before I believe it." },
        { tool: "erp_get_overview" },
        { tool: "erp_query", input: { product: "material", filters: [{ field: "description", op: "contains", value: "nitrile" }] } },
        { say: "One material number covers the gloves at every plant, so the engine may compare their lines directly." },
        { tool: "erp_query", input: { product: "po_line", filters: [{ field: "material", op: "eq", value: "20001001" }], sort: "-order_day", limit: 12 } },
        { board: { state: "checking", group_id: "20001001" } },
        { tool: "pv_compare", input: { group_id: "20001001" } },
        { say: "Revised: Lyon is not the only gap. Birmingham's price looks cheapest as booked, in pounds per case of a thousand, but its terms leave the freight out. I normalise its line step by step." },
        { tool: "pv_normalise", input: { line_id: "{{pair.2010/80001.line}}" } },
        { tool: "pv_normalise", input: { line_id: "{{pair.3010/80002.line}}" } },
        { tool: "pv_normalise", input: { line_id: "{{pair.1010/30024.line}}" } },
        { say: "Delivered and in euros, Birmingham pays {{pair.2010/80001.price}}, Lyon {{pair.3010/80002.price}}. Frankfurt's contract price of {{group.benchmark}} is the benchmark: the best price at volume." },
        contractOfBenchmark,
        { tool: "erp_get_record", input: { product: "po_line", id: "{{pair.3010/80002.line}}" } },
        { say: "Lyon orders from a local distributor without a contract. A few of its orders were urgent with a reason; the allowance covers part of those, and the rest stays unexplained." },
        { alert: {
          title: "Lyon pays {{pair.3010/80002.price}} for gloves Frankfurt buys at {{group.benchmark}}",
          summary: "One material at every plant. After price unit, case size, currency and delivery terms, the benchmark is Frankfurt's contract price of {{group.benchmark}}. Lyon buys off contract at {{pair.3010/80002.price}}; Birmingham, cheapest as booked, pays {{pair.2010/80001.price}} delivered. Unexplained: {{group.opportunity}} a year, spread {{group.spread}}."
        } },
        { propose: true }
      ],
      options: {
        texts: {
          H: { title: "Move Lyon and Duisburg to the contract supplier", description: "Order the gloves at {{option.H.plants_moved}} from supplier {{option.H.supplier}} under Frankfurt's contract price of {{group.benchmark}}.", residual_risk: "Birmingham stays as it is: the contract supplier does not deliver to the UK." },
          R: { title: "Renegotiate every price above the benchmark", description: "Ask the suppliers above the benchmark, Birmingham's included, to match {{group.benchmark}}.", residual_risk: "The savings need every supplier to agree." },
          B: { title: "One tender for all four plants", description: "Tender the group's whole volume of {{group.quantity}} at once, with a bundle discount of {{option.B.bundle}} a year (an assumption).", residual_risk: "A tender takes {{option.B.days}} days to a first saving and may change suppliers." }
        }
      },
      rejected: {
        H: "Option H is rejected: Lyon keeps its distributor for now. Nothing is drafted for it.",
        R: "Option R is rejected; nothing is drafted for it.",
        B: "Option B is rejected; nothing is drafted for it."
      }
    },

    "SC-CONSULT": {
      source: "authored",
      title: "Same consultant, different day rate",
      hypothesis: "The same SAP finance consulting is bought at different day rates in different company codes.",
      steps: [
        { say: "Hypothesis: the same SAP finance consulting is bought at different day rates. Service lines are free text, so nothing is comparable until a person confirms it." },
        { tool: "erp_get_overview" },
        { tool: "erp_query", input: { product: "po_line", filters: [{ field: "material_group", op: "eq", value: "SRV-CON" }, { field: "short_text", op: "contains", value: "SAP" }], limit: 20 } },
        { say: "The lines are free text in German, English and French, some priced per day and some per hour. Similar texts alone never make them comparable." },
        { tool: "pv_match", input: { material_group: "SRV-CON", text: "SAP FI/CO finance consultant" } },
        { board: { state: "checking", group_id: "{{candidate.1}}" } },
        { say: "Revised: the candidate holds lines from {{candidate.1.plants}}, not two plants as the tip suggests. Hours and days convert at a person-day of eight hours, never at SAP's day of twenty-four. Only you can say whether these are the same service." },
        { confirm: {
          candidate: "{{candidate.1}}",
          base_unit: "PD",
          note: "One material group and the same SAP FI/CO finance role in three languages, priced per day or per hour. The texts differ in seniority: confirm only if the roles are the same.",
          confirmed: afterCluster,
          split: afterCluster,
          rejected: [
            { say: "You rejected the cluster, so these lines stay incomparable and nothing is computed." },
            { report: { outcome: "stopped", markdown: "## SAP finance consultants: stopped at your confirmation\n\nThe agent proposed a cluster of free-text consulting lines from {{candidate.1.plants}}. You rejected it, so the lines are not comparable and no figure was computed for them. Nothing is proposed." } }
          ]
        } }
      ],
      options: {
        texts: {
          H: { title: "Move the consulting to the benchmark supplier", description: "Call off the role at {{option.H.plants_moved}} from supplier {{option.H.supplier}} at {{group.benchmark}}.", residual_risk: "Birmingham stays as it is: the supplier does not deliver to the UK." },
          R: { title: "Renegotiate every day rate above the benchmark", description: "Ask the consultancies above the benchmark to match {{group.benchmark}}.", residual_risk: "The savings need every consultancy to agree." },
          B: { title: "One framework tender for the role", description: "Tender the group's whole volume of {{group.quantity}} as one framework, with a bundle discount of {{option.B.bundle}} a year (an assumption).", residual_risk: "A tender takes {{option.B.days}} days to a first saving and may change consultancies." }
        }
      }
    },

    "SC-HOSES": {
      source: "authored",
      title: "Express is not a reason",
      hypothesis: "Duisburg's higher hose prices may come from urgent orders, as Duisburg says.",
      steps: [
        { say: "Hypothesis: Duisburg's higher hose prices come from urgent orders, as it says. I test that claim line by line." },
        { tool: "erp_get_overview" },
        { tool: "erp_query", input: { product: "material", filters: [{ field: "description", op: "contains", value: "hydraulic hose" }] } },
        { tool: "erp_query", input: { product: "po_line", filters: [{ field: "material", op: "eq", value: "20001003" }, { field: "plant", op: "eq", value: "1020" }, { field: "urgent", op: "eq", value: "true" }] } },
        { tool: "erp_query", input: { product: "po_line", filters: [{ field: "material", op: "eq", value: "20001003" }, { field: "plant", op: "eq", value: "1020" }, { field: "urgent", op: "eq", value: "false" }] } },
        { say: "Duisburg's urgent orders carry recorded reasons. But most of its lines are routine orders at the same price as the urgent ones." },
        { tool: "pv_compare", input: { group_id: "20001003" } },
        { tool: "pv_normalise", input: { line_id: "{{pair.1020/30093.urgent_line}}" } },
        { tool: "pv_normalise", input: { line_id: "{{pair.1020/30093.routine_line}}" } },
        { tool: "pv_normalise", input: { line_id: "{{benchmark.line}}" } },
        { alert: { title: "Duisburg pays {{group.highest}} for hoses Frankfurt buys at {{group.benchmark}}", summary: "Urgent orders explain {{group.justified}} of the gap; the rest is unexplained." }, expect: "refused" },
        { say: "Revised: the guardrail is right, I have not read the benchmark supplier's contract yet. I look it up before raising anything." },
        contractOfBenchmark,
        { say: "An urgent line with a recorded reason may pay up to the urgent allowance above the benchmark: that justifies {{group.justified}} of the gap. The routine orders have no reason at all." },
        { alert: {
          title: "Duisburg pays {{group.highest}} for hoses Frankfurt buys at {{group.benchmark}}",
          summary: "Urgent orders with a recorded reason explain {{group.justified}} of the gap, within the urgent allowance. Duisburg's routine orders pay the same price with no reason, so {{group.opportunity}} a year stays unexplained; the spread is {{group.spread}}."
        } },
        { propose: true }
      ],
      options: {
        texts: {
          H: { title: "Order Duisburg's hoses under Frankfurt's contract", description: "Move the lines above the benchmark at {{option.H.plants_moved}} to supplier {{option.H.supplier}} at {{group.benchmark}}; urgent orders keep their allowance.", residual_risk: "Express deliveries need the contract supplier's lead times to work." },
          R: { title: "Renegotiate Duisburg's and Lyon's prices", description: "Ask the suppliers above the benchmark to match {{group.benchmark}} for routine orders.", residual_risk: "The savings need every supplier to agree." }
        }
      },
      rejected: {
        H: "Option H is rejected; nothing is drafted for it.",
        R: "Option R is rejected; nothing is drafted for it.",
        B: "Option B is rejected; nothing is drafted for it."
      }
    },

    "SC-BOXES": {
      source: "authored",
      title: "It's the delivery terms",
      hypothesis: "Birmingham pays more than Lyon for the same corrugated boxes.",
      steps: [
        { say: "Hypothesis: Birmingham pays more than Lyon for the same corrugated boxes. First I check whether the prices are comparable at all: currency, unit and delivery terms." },
        { tool: "erp_get_overview" },
        { tool: "erp_query", input: { product: "material", filters: [{ field: "description", op: "contains", value: "corrugated" }] } },
        { tool: "erp_query", input: { product: "po_line", filters: [{ field: "material", op: "eq", value: "20001005" }, { field: "plant", op: "in", value: "2010,3010" }], sort: "-order_day", limit: 12 } },
        { tool: "pv_compare", input: { group_id: "20001005" } },
        { tool: "pv_normalise", input: { line_id: "{{pair.2010/80003.line}}" } },
        { tool: "pv_normalise", input: { line_id: "{{pair.3010/30080.line}}" } },
        { tool: "pv_normalise", input: { line_id: "{{pair.1010/30025.line}}" } },
        { tool: "erp_get_record", input: { product: "po_line", id: "{{pair.3010/30080.line}}" } },
        { say: "Revised: the UK price is delivered, while Lyon buys ex works and pays the freight itself. With the logistics uplift for ex-works terms, Lyon pays {{pair.3010/30080.price}} delivered and the UK {{pair.2010/80003.price}}." },
        contractOfBenchmark,
        { say: "The group's spread is {{group.spread}} and its unexplained variance {{group.opportunity}} a year, below the materiality of {{group.materiality}} and {{group.materiality_spread}}. There is nothing material to propose." },
        { report: { outcome: "nothing_found", markdown: "## Corrugated boxes: no material variance\n\nThe tip compared prices as booked. The UK's price is delivered, Lyon's is ex works, so the engine raises Lyon's by the logistics uplift before it compares them: Lyon pays {{pair.3010/30080.price}} delivered, the UK {{pair.2010/80003.price}}.\n\nThe benchmark is {{group.benchmark}} ({{group.benchmark_pair}}). The spread is {{group.spread}} and the unexplained variance {{group.opportunity}} a year, below the materiality of {{group.materiality}} and {{group.materiality_spread}}. Nothing is proposed; the group stays in the next sweep." } }
      ]
    },

    "SC-PALLETS": {
      source: "authored",
      title: "Pallets in pounds",
      hypothesis: "Birmingham pays more for pallets than the other plants even once the pounds are converted.",
      steps: [
        { say: "Hypothesis: Birmingham's pallets cost more than the other plants' even once the pounds are converted. The conversion decides it, so I check it at the window's rate and at today's." },
        { tool: "erp_get_overview" },
        { tool: "erp_query", input: { product: "material", filters: [{ field: "description", op: "contains", value: "pallet" }] } },
        { tool: "erp_query", input: { product: "po_line", filters: [{ field: "material", op: "eq", value: "20001006" }, { field: "plant", op: "eq", value: "2010" }], sort: "-order_day", limit: 10 } },
        { tool: "pv_compare", input: { group_id: "20001006" } },
        { tool: "pv_normalise", input: { line_id: "{{pair.2010/80003.line}}" } },
        { tool: "pv_normalise", input: { line_id: "{{benchmark.line}}" } },
        { tool: "pv_normalise", input: { line_id: "{{pair.3010/30080.line}}" } },
        contractOfBenchmark,
        { open: "open_ecb_rate", input: { currency: "GBP" }, result: { currency: "GBP", date: "2026-11-19", per_eur: 0.83581, rate_to_eur: 1 / 0.83581, source: "ECB via Frankfurter" } },
        { tool: "pv_compare", input: { group_id: "20001006", at_rate_of: "latest" } },
        { say: "Revised: the gap is not an artefact of the rate. At the window's mean rate Birmingham pays {{pair.2010/80003.price}}; {{sensitivity.label}} the group's unexplained variance is {{sensitivity.opportunity}} a year, so the finding holds." },
        { alert: {
          title: "Birmingham pays {{pair.2010/80003.price}} for pallets the other plants buy at {{group.benchmark}}",
          summary: "Converted at the window's mean ECB rate and delivered, Birmingham's pallets cost {{pair.2010/80003.price}} against Frankfurt's contract price of {{group.benchmark}}. Unexplained: {{group.opportunity}} a year, spread {{group.spread}}. As a sensitivity, {{sensitivity.label}}: {{sensitivity.opportunity}} a year."
        } },
        { propose: true }
      ],
      options: {
        texts: {
          H: { title: "Move Lyon to the contract supplier", description: "Order Lyon's pallets from supplier {{option.H.supplier}} at {{group.benchmark}}; the supplier does not deliver to the UK.", residual_risk: "Birmingham, the larger gap, stays as it is." },
          R: { title: "Renegotiate Birmingham's pallet price", description: "Ask the suppliers above the benchmark, Birmingham's first, to match {{group.benchmark}}.", residual_risk: "The savings need every supplier to agree, in pounds at a moving rate." },
          B: { title: "One pallet tender for all four plants", description: "Tender the group's whole volume of {{group.quantity}}, with a bundle discount of {{option.B.bundle}} a year (an assumption).", residual_risk: "A tender takes {{option.B.days}} days to a first saving." }
        }
      }
    },

    "SC-SHOES": {
      source: "authored",
      title: "Same shoe, two numbers",
      hypothesis: "Two material numbers are the same safety shoe, and the plants pay different prices for it.",
      steps: [
        { say: "Hypothesis: the two material numbers are the same shoe, and the plants pay different prices for it. A similar description is not enough; the manufacturer part number is." },
        { tool: "erp_get_overview" },
        { tool: "erp_query", input: { product: "material", filters: [{ field: "description", op: "contains", value: "safety shoe" }] } },
        { tool: "erp_get_record", input: { product: "material", id: "20001002" } },
        { say: "Revised: the second number, material 20001064, has a French description, so a text search misses it. The manufacturer part number ties both to one comparable group." },
        { tool: "erp_query", input: { product: "po_line", filters: [{ field: "material", op: "in", value: "20001002,20001064" }], sort: "-order_day", limit: 12 } },
        { tool: "pv_compare", input: { group_id: "MPN:Brekholt:BH-7730-S3" } },
        { tool: "pv_normalise", input: { line_id: "{{benchmark.line}}" } },
        { tool: "pv_normalise", input: { line_id: "{{highest.line}}" } },
        { tool: "pv_normalise", input: { line_id: "{{pair.1020/30135.line}}" } },
        contractOfBenchmark,
        { alert: {
          title: "Lyon pays {{group.highest}} for the safety shoe Frankfurt buys at {{group.benchmark}}",
          summary: "Two material numbers share manufacturer and part number, so the engine compares them as one group. Frankfurt and Duisburg buy under contract at {{group.benchmark}}; Lyon buys the same shoe under its own number at {{group.highest}}. Unexplained: {{group.opportunity}} a year, spread {{group.spread}}."
        } },
        { propose: true }
      ],
      options: {
        texts: {
          H: { title: "Order Lyon's shoes under the contract", description: "Move Lyon's lines to supplier {{option.H.supplier}} at {{group.benchmark}}, and retire the second material number.", residual_risk: "Lyon's buyers need the contract supplier's sizes and lead times." }
        }
      }
    }
  };
})();
