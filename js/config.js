// Central configuration. Every value here is documented and verified in TECH_NOTES.md.

export const APP = {
  id: "pv",
  name: "Price Variance Agent",
  fullName: "Procurement price variance",
  version: "2.1.0"
};

export const ANTHROPIC = {
  messagesUrl: "https://api.anthropic.com/v1/messages",
  modelsUrl: "https://api.anthropic.com/v1/models?limit=100",
  apiVersion: "2023-06-01",
  // Header that enables CORS for direct browser calls (verified by live probe, TECH_NOTES §3).
  browserHeader: "anthropic-dangerous-direct-browser-access",
  // This app's agent has no web search. The shared js/anthropic.js keeps its probe for it, so the
  // tool's definition and price stay here for that module.
  webSearchTool: { type: "web_search_20250305", name: "web_search", max_uses: 5 },
  webSearchUsdPer1000: 10,
  // Spend limits are set per workspace (not per key, and not on the Default Workspace), so the
  // advice is: a dedicated workspace with a monthly spend limit, and a key scoped to it (TECH_NOTES §3).
  consoleKeysUrl: "https://platform.claude.com/settings/keys",
  consoleWorkspacesUrl: "https://platform.claude.com/settings/workspaces"
};

// Prices in USD per million tokens (TECH_NOTES §1, verified 19 Nov 2026, the same as the sister apps').
// `probe` marks the cheap model Diagnostics uses for its one-off test.
export const MODELS = [
  {
    id: "claude-sonnet-5-5", label: "Sonnet 5.5", hint: "Balanced. Recommended for the demo.",
    effort: "medium", maxTokens: 16000,
    price: { input: 2.0, output: 10.0, cacheWrite: 2.5, cacheRead: 0.1 }
  },
  {
    id: "claude-haiku-5-5", label: "Haiku 5.5", hint: "Fastest and cheapest.", probe: true,
    effort: "medium", maxTokens: 12000,
    price: { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01,
      longPrompt: { thresholdTokens: 100000, input: 0.5, output: 2.5, cacheWrite: 0.625, cacheRead: 0.05 } }
  },
  {
    id: "claude-opus-5-5", label: "Opus 5.5", hint: "Deepest reasoning, highest cost.",
    effort: "high", maxTokens: 16000,
    price: { input: 4.0, output: 20.0, cacheWrite: 5.0, cacheRead: 0.2 }
  }
];
export const DEFAULT_MODEL = "claude-sonnet-5-5";

// Live-agent guardrails (brief §7, rule 10). A run stops at whichever limit it reaches first; the
// budget is checked before every model call as well as after each (PLAN.md B8).
export const AGENT = {
  maxSteps: 40,          // model calls per run, the retry of a cut turn included
  budgetEur: 3.0,        // hard cost cap per run
  idleTimeoutMs: 90000,  // no streamed data for this long counts as a failed request
  maxOutputTokens: 128000
};

// 1 USD in euros for the cost meter, as the brief fixes it (the sister apps' value). Fixed for a
// stable meter; the exchange rates of the analysis are in data/fx.js.
export const FX_USD_EUR = 0.894;

// Open data the live agent can read without a key (TECH_NOTES §4). The policy in index.html allows
// exactly this host besides the API; js/diagnostics.js checks that the two lists match.
export const OPEN_DATA = {
  frankfurter: {
    label: "ECB reference rates (Frankfurter)",
    source: "European Central Bank euro reference rates via the Frankfurter API (live)",
    base: "https://api.frankfurter.dev/v1",
    origin: "https://api.frankfurter.dev",
    probe: "https://api.frankfurter.dev/v1/latest?base=EUR&symbols=GBP"
  }
};

// Every browser storage key, all under this app's own prefix. GitHub Pages serves all of an
// account's project sites from one origin, so a sister app (Rebate Hunter uses "rh.") must never
// share a key with this one: no shared API key, intro flag, cost total or failure memory. The one
// shared key is Vici's theme choice, vc-theme.
const P = `${APP.id}.`;
export const STORAGE = {
  apiKey: `${P}anthropic.key`,          // sessionStorage: this tab only
  diagnostics: `${P}diag`,              // sessionStorage: data sources that failed recently
  model: `${P}model`,                   // sessionStorage
  speed: `${P}speed`,                   // sessionStorage
  sessionCost: `${P}sessionCostEur`,    // sessionStorage: live spend in this tab
  introSeen: `${P}introSeen`,           // localStorage: the intro opens by itself only on a first visit
  consoleText: `${P}consoleText`        // localStorage: larger console text for projectors
};

export const UI = {
  defaultScenario: "SC-GLOVES"
};
