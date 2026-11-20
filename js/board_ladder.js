// The price ladder (brief §9): one row per plant–supplier pair, sorted by price; a hexagon at the pair's
// normalised price sized by its quantity, its lines as small hexagons, the benchmark as an ink line with
// its label, the unexplained part from the benchmark to each pair in the danger tone with a cross, the
// justified part hatched in the warning tone with its reason, and the euros a year at the row's end.
// Plants are told apart by the labels on their rows, never by colour. A line opens its normalisation
// steps; a pair opens its lines and contract. The lines the agent reads pulse in a fjord outline.
// Everything round is a hexagon (Vici's hexagon rule); every colour comes from css/board.css.

const NS = "http://www.w3.org/2000/svg";
const RAD = Math.PI / 180;

function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "dataset") Object.assign(el.dataset, v);
    else el.setAttribute(k, String(v));
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}

/** A flat-top hexagon of circumradius r, as polygon points (Vici's hexagon). */
export function hexPoints(cx, cy, r) {
  return Array.from({ length: 6 }, (_, k) => `${(cx + r * Math.cos(k * 60 * RAD)).toFixed(2)},${(cy + r * Math.sin(k * 60 * RAD)).toFixed(2)}`).join(" ");
}

/**
 * The ladder as an SVG element. model: ladderModel(); handlers: { onLine(id, el), onPair(id, el) }.
 */
export function renderLadder(model, { onLine, onPair } = {}) {
  const { width, height, rows, left, right, top } = model;
  const root = svg("svg", {
    class: "ladder", width, height, viewBox: `0 0 ${width} ${height}`,
    role: "group", "aria-label": `Price ladder of ${model.label}: ${rows.length} plant–supplier pairs, normalised prices in ${model.axisUnit}${model.benchmark ? `; benchmark ${model.benchmark.text}` : ""}`,
    dataset: { group: model.groupId, compared: String(model.compared), compact: String(model.compact) }
  });
  root.append(svg("defs", {},
    svg("pattern", { id: "hatch-justified", width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" },
      svg("rect", { class: "hatch-bg", width: 6, height: 6 }),
      svg("line", { class: "hatch-line", x1: 0, y1: 0, x2: 0, y2: 6 })),
    svg("pattern", { id: "cross-unexplained", width: 10, height: 10, patternUnits: "userSpaceOnUse" },
      svg("rect", { class: "cross-bg", width: 10, height: 10 }),
      svg("path", { class: "cross-line", d: "M2.5 2.5 L7.5 7.5 M7.5 2.5 L2.5 7.5" }))));

  // Axis: ticks in the display unit, gridlines across the rows.
  const axis = svg("g", { class: "ladder-axis", "aria-hidden": "true" });
  for (const t of model.ticks) {
    axis.append(svg("line", { class: "grid", x1: t.x, x2: t.x, y1: top - 6, y2: height - 18 }), svg("text", { class: "tick", x: t.x, y: height - 4, "text-anchor": "middle" }, t.label));
  }
  axis.append(svg("text", { class: "axis-unit", x: right, y: 14, "text-anchor": "end" }, model.axisUnit));
  root.append(axis);

  // Rows.
  for (const r of rows) {
    const g = svg("g", {
      class: "ladder-row", tabindex: 0, role: "button",
      "aria-label": `${r.city}, ${r.supplierName}: ${r.priceText} delivered, ${r.shareText} of the quantity${r.isBenchmark && model.compared ? ", the benchmark" : ""}${r.above ? `, ${r.unexplainedText} a year unexplained${r.justified > 0 ? `, ${r.justifiedText} justified` : ""}` : ""}. Opens its lines and contract.`,
      dataset: {
        pair: r.id, price: r.price, quantity: r.quantity, share: r.share, unexplained: r.unexplained, justified: r.justified,
        benchmark: String(r.isBenchmark), highest: String(r.isHighest), state: r.state || ""
      }
    });
    const yTop = r.cy - model.rowH / 2;
    g.append(svg("rect", { class: "row-band", x: 0, y: yTop + 2, width, height: model.rowH - 4 }));
    // Label: plant (bold), supplier, tags.
    const label = svg("text", { class: "row-label", x: 8, y: r.cy - (model.compact ? 0 : 5), "dominant-baseline": model.compact ? "middle" : "auto" },
      svg("tspan", { class: "row-plant" }, r.city), svg("tspan", { class: "row-supplier", dx: 6 }, r.supplierName));
    g.append(label);
    if (!model.compact) g.append(svg("text", { class: "row-tags", x: 8, y: r.cy + 13 }, `${r.tags.join(" · ")} · ${r.shareText}`));
    // Gap: unexplained (danger, crossed) from the benchmark, then justified (warning, hatched).
    if (r.above) {
      const h = Math.max(8, Math.min(14, model.rowH * 0.28));
      if (r.unexplained > 0) g.append(svg("rect", { class: "gap-unexplained", x: r.xb, y: r.cy - h / 2, width: Math.max(1, r.xSplit - r.xb), height: h }));
      if (r.justified > 0) g.append(svg("rect", { class: "gap-justified", x: r.xSplit, y: r.cy - h / 2, width: Math.max(1, r.x - r.xSplit), height: h }));
    }
    // Lines as small hexagons, then the pair's hexagon sized by quantity.
    if (!model.compact) {
      for (const l of r.lines) {
        const lg = svg("g", {
          class: "ladder-line", tabindex: 0, role: "button",
          "aria-label": `Line ${l.id}: ${l.priceText}${l.urgent ? ", urgent with a reason" : ""}. Opens its normalisation.`,
          dataset: { line: l.id, price: l.price, mark: l.mark || "" }
        },
        svg("polygon", { class: "line-pulse", points: hexPoints(l.x, l.y, 7.5) }),
        svg("polygon", { class: "line-hex", points: hexPoints(l.x, l.y, 4.2) }));
        lg.addEventListener("click", (e) => { e.stopPropagation(); onLine?.(l.id, lg); });
        lg.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onLine?.(l.id, lg); } });
        g.append(lg);
      }
    }
    g.append(svg("polygon", { class: "pair-pulse", points: hexPoints(r.x, r.cy, r.r + 4) }), svg("polygon", { class: "pair-hex", points: hexPoints(r.x, r.cy, r.r) }));
    if (r.state === "approved") g.append(svg("path", { class: "pair-mark mark-approved", d: `M${r.x - r.r * 0.45} ${r.cy + 0.5} L${r.x - r.r * 0.12} ${r.cy + r.r * 0.32} L${r.x + r.r * 0.5} ${r.cy - r.r * 0.3}` }));
    else if (r.above && r.unexplained > 0) g.append(svg("path", { class: "pair-mark mark-above", d: `M${r.x - r.r * 0.36} ${r.cy - r.r * 0.36} L${r.x + r.r * 0.36} ${r.cy + r.r * 0.36} M${r.x + r.r * 0.36} ${r.cy - r.r * 0.36} L${r.x - r.r * 0.36} ${r.cy + r.r * 0.36}` }));
    // The row's end: the money and its state, always with a word or a mark.
    const vx = width - 8;
    let value;
    if (r.state === "approved") value = svg("text", { class: "row-value value-approved", x: vx, y: r.cy, "text-anchor": "end", "dominant-baseline": "middle" }, "✓ approved");
    else if (r.state === "justified") value = svg("text", { class: "row-value value-justified", x: vx, y: r.cy, "text-anchor": "end", "dominant-baseline": "middle" }, "accepted");
    else if (!model.compared) value = svg("text", { class: "row-value value-neutral", x: vx, y: r.cy, "text-anchor": "end", "dominant-baseline": "middle" }, r.priceText);
    else if (r.isBenchmark) value = svg("text", { class: "row-value value-benchmark", x: vx, y: r.cy, "text-anchor": "end", "dominant-baseline": "middle" }, "benchmark");
    else if (!r.above) value = svg("text", { class: "row-value value-below", x: vx, y: r.cy, "text-anchor": "end", "dominant-baseline": "middle" }, "at or below");
    else {
      value = svg("text", { class: "row-value value-above", x: vx, y: r.cy - (r.justified > 0 && !model.compact ? 6 : 0), "text-anchor": "end", "dominant-baseline": "middle" }, `✕ ${r.unexplainedText} a year`);
      if (r.justified > 0 && !model.compact) g.append(svg("text", { class: "row-sub value-justified", x: vx, y: r.cy + 10, "text-anchor": "end", "dominant-baseline": "middle" }, `${r.justifiedText} justified (urgent)`));
    }
    g.append(value);
    g.addEventListener("click", () => onPair?.(r.id, g));
    g.addEventListener("keydown", (e) => { if (e.target === g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onPair?.(r.id, g); } });
    root.append(g);
  }

  // The benchmark: an ink line with its label, drawn over the rows.
  if (model.benchmark) {
    const b = model.benchmark;
    const anchor = b.x > (left + right) / 2 ? "end" : "start";
    root.append(svg("g", { class: "ladder-benchmark", "aria-hidden": "true", dataset: { price: b.price, pair: b.pair } },
      svg("line", { x1: b.x, x2: b.x, y1: top - 14, y2: height - 18 }),
      svg("text", { x: b.x + (anchor === "start" ? 6 : -6), y: top - 18, "text-anchor": anchor }, `Benchmark ${b.text}`)));
  }
  return root;
}
