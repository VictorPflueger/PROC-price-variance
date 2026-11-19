# Price Variance Agent

**Price Variance Agent** is a browser-only prototype of an agentic-AI assistant for procurement. It compares what GlobalCorp SE, a fictional industrial group, pays for the same item or service across plants, suppliers, countries and company codes. A deterministic engine brings every order line to one comparable price (price unit, unit of measure, currency at the ECB's euro reference rates, delivery terms), sets a benchmark from the best price the group already pays at volume, and separates the part of each gap that a documented reason explains from the part nothing explains. The agent checks the evidence, proposes costed ways to close the gap next to accepting it, waits for a person's decision and drafts the change requests and the negotiation brief.

Every figure comes from the engine, never from the model. Value is tracked in four separate stages, identified, approved, implemented and realised, and nothing reads as saved before later orders show it. Nothing is sent anywhere: drafts stay in an outbox.

**Fictional company, no client data.**

> **Status: Phase 0, planning.** There is no app in this repository yet. [PLAN.md](PLAN.md) describes the architecture, the world and its scenarios, the engine, the screens, the tests and the milestones.

## What it will offer

- **Two modes:** Simulation (scripted runs replayed offline, no key) and Live (Claude with the presenter's own API key, kept for the browser session only).
- **Honest data:** a fictional company generated in code, plus the public euro reference rates of the European Central Bank, read through Frankfurter.
- **People decide:** the agent proposes; a person confirms comparable items, decides on the options and approves every draft.

Live site, once deployed: <https://victorpflueger.github.io/PROC-price-variance/>

## Author

Built by Victor Pflüger, on [Vici](https://victorpflueger.github.io/ViciDesign/), his design system.
