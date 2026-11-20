// A stand-in for Frankfurter's v1 API (api.frankfurter.dev): the ECB reference rates in their real
// response shape ({ amount, base, date, rates }), a server error, or a blocked request (as a venue's
// firewall would). Automated tests never call the real rate host.

/** A Playwright route handler: mode "ok" (rate per EUR), "fail" (HTTP 503) or "blocked" (aborted). */
export function frankfurterRoute({ mode = "ok", date = "2026-11-19", rates = { GBP: 0.83581 }, log = [] } = {}) {
  return async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    log.push(`${req.method()} ${u.pathname}${u.search}`);
    if (mode === "blocked") return route.abort("blockedbyclient");
    const cors = { "access-control-allow-origin": "*" };
    if (mode === "fail") return route.fulfill({ status: 503, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify({ message: "service unavailable" }) });
    const symbols = (u.searchParams.get("symbols") || "GBP").split(",");
    const body = { amount: 1.0, base: "EUR", date, rates: Object.fromEntries(symbols.filter((c) => rates[c]).map((c) => [c, rates[c]])) };
    return route.fulfill({ status: 200, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify(body) });
  };
}
