// Entry point: checks that the data loaded, starts the presenter and removes the boot screen. The app is
// imported dynamically, so a file that fails to load is reported on the boot screen instead of a blank
// page. Browsers never run this module from file://; the boot screen explains that case on its own.

const REQUIRED = [["FX", "data/fx.js"], ["WORLD", "data/world.js"], ["SCENARIOS", "data/scenarios.js"], ["SIM_RUNS", "data/sim_runs.js"]];

boot().catch((err) => {
  console.error("[Price Variance Agent] Start-up failed:", err);
  const el = document.getElementById("boot");
  if (!el) return;
  el.dataset.state = "failed";
  document.getElementById("boot-status").textContent = "The Price Variance Agent could not start.";
  const detail = document.getElementById("boot-detail");
  detail.textContent = String(err?.message || err);
  detail.hidden = false;
});

async function boot() {
  const missing = REQUIRED.filter(([name]) => !window[name]).map(([, file]) => file);
  if (missing.length) throw new Error(`These data files did not load: ${missing.join(", ")}. Deploy them next to index.html and reload.`);
  let app;
  try {
    app = await import("./app.js");
  } catch (err) {
    throw new Error(`A program file failed to load (${err?.message || err}). Check that the js/ folder was deployed completely.`);
  }
  await app.start();
  document.documentElement.dataset.boot = "ready";
  const el = document.getElementById("boot");
  el.dataset.state = "done";
  setTimeout(() => el.remove(), 300);
  // A last resort: an error the page did not expect says so, in the browser's console and on screen.
  const report = (message) => {
    if (!message || message === "Script error.") return;
    window.Vici?.toast?.({ title: "Something went wrong", message: String(message).replace(/sk-ant-[A-Za-z0-9_-]{8,}/g, "sk-ant-[hidden]").slice(0, 200), tone: "danger" });
  };
  window.addEventListener("error", (e) => report(e.message || e.error?.message));
  window.addEventListener("unhandledrejection", (e) => { if (e.reason?.name !== "AbortError" && typeof e.reason !== "symbol") report(e.reason?.message || e.reason); });
}
