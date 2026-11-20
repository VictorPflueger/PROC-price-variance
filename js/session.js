// The options a person approved in earlier runs since the page was opened or last reset (review R13).
// The approved savings tile and the value pipeline count them, as their definition says ("in this
// session or before", PLAN.md section 5.5). Nothing is written anywhere: a reload or Reset starts the
// session again. A later decision on a group replaces an earlier one, and accepting the variance removes
// it. Only the live agent and the simulation player record here; the script checker (Diagnostics) never
// does. Pure module: no DOM, no storage.

const byGroup = new Map();

export const sessionApprovals = {
  /** The approvals of earlier decisions, one per group: [{ group, option, savings, bundle }]. */
  list: () => [...byGroup.values()].map((a) => ({ ...a })),
  /** A person's approving decision: an option with its figures, or "accept" (which removes the group's). */
  record({ group, option, savings = 0, bundle = 0 }) {
    if (!group || !option) return;
    if (option === "accept") byGroup.delete(group);
    else byGroup.set(group, { group, option, savings, bundle });
  },
  clear() { byGroup.clear(); }
};
