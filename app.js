const SVG_NS = "http://www.w3.org/2000/svg";

const state = {
  type: "bar",
  title: "Vẽ biểu đồ theo dữ liệu đã cho",
  labels: ["Tổ 1", "Tổ 2", "Tổ 3", "Tổ 4"],
  values1: [4, 6, 3, 5],
  values2: [5, 2, 4, 6],
  maxValue: 10,
  unit: 1,
  student: {
    values1: [4, 6, 3, 5],
    values2: [5, 2, 4, 6],
    pie: [25, 25, 25, 25],
    pictogramCells: [4, 6, 3, 5]
  }
};

const svg = document.getElementById("chartSvg");
const byId = (id) => document.getElementById(id);

function svgEl(name, attrs = {}, text = "") {
  const node = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  if (text) node.textContent = text;
  return node;
}

function clearSvg() {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
}

function parseNums(str) {
  return str.split(",").map(s => Number(String(s).trim())).filter(v => !Number.isNaN(v));
}

function parseLabels(str) {
  return str.split(",").map(s => String(s).trim()).filter(Boolean);
}

function syncStudentFromSource() {
  state.student.values1 = [...state.values1];
  state.student.values2 = [...state.values2];
  const n = Math.max(state.labels.length, 1);
  state.student.pie = Array.from({length: n}, () => Math.round(100 / n));
  state.student.pictogramCells = state.values1.map(v => Math.round(v / Math.max(state.unit, 1)));
}

function updatePreview() {
  const payload = {
    type: state.type,
    title: state.title,
    studentAnswer:
      state.type === "bar" ? { values: state.student.values1 } :
      state.type === "double_bar" ? { values1: state.student.values1, values2: state.student.values2 } :
      state.type === "line" ? { points: state.student.values1 } :
      state.type === "pie" ? { percents: state.student.pie, total: state.student.pie.reduce((a,b)=>a+b,0) } :
      { cells: state.student.pictogramCells, unit: state.unit }
  };
  byId("answerPreview").textContent = JSON.stringify(payload, null, 2);
}

function setHelp() {
  const map = {
    bar: "Kéo đỉnh cột để đổi chiều cao cột.",
    double_bar: "Kéo đỉnh từng cột của mỗi nhóm.",
    line: "Kéo các điểm trên hệ trục để thay đổi đường biểu diễn.",
    pie: "Kéo tay nắm ở viền hình tròn để chia quạt.",
    pictogram: "Bấm vào ô vuông để tô / bỏ tô như bài biểu đồ tranh."
  };
  byId("helpText").textContent = map[state.type];
}

function applyForm() {
  state.type = byId("chartType").value;
  state.title = byId("titleInput").value.trim() || "Vẽ biểu đồ theo dữ liệu đã cho";
  state.labels = parseLabels(byId("labelsInput").value);
  state.values1 = parseNums(byId("values1Input").value);
  state.values2 = parseNums(byId("values2Input").value);
  state.maxValue = Math.max(1, Number(byId("maxInput").value || 10));
  state.unit = Math.max(1, Number(byId("unitInput").value || 1));

  while (state.values1.length < state.labels.length) state.values1.push(0);
  while (state.values2.length < state.labels.length) state.values2.push(0);
  state.values1 = state.values1.slice(0, state.labels.length);
  state.values2 = state.values2.slice(0, state.labels.length);

  byId("paperTitle").textContent = state.title;
  syncStudentFromSource();
  setHelp();
  render();
}

function yFromValue(v, chartBottom, chartTop, maxValue) {
  const h = chartBottom - chartTop;
  return chartBottom - (v / maxValue) * h;
}
function valueFromY(y, chartBottom, chartTop, maxValue) {
  const h = chartBottom - chartTop;
  const raw = ((chartBottom - y) / h) * maxValue;
  return Math.max(0, Math.min(maxValue, Math.round(raw)));
}

function drawAxes(chartLeft, chartTop, chartRight, chartBottom, maxValue, step=1) {
  svg.appendChild(svgEl("line", {x1: chartLeft, y1: chartBottom, x2: chartRight, y2: chartBottom, stroke: "#0f172a", "stroke-width": 2}));
  svg.appendChild(svgEl("line", {x1: chartLeft, y1: chartTop, x2: chartLeft, y2: chartBottom, stroke: "#0f172a", "stroke-width": 2}));
  for (let i = 0; i <= maxValue; i += step) {
    const y = yFromValue(i, chartBottom, chartTop, maxValue);
    svg.appendChild(svgEl("line", {x1: chartLeft - 6, y1: y, x2: chartRight, y2: y, stroke: i === 0 ? "#0f172a" : "#e2e8f0", "stroke-width": i === 0 ? 2 : 1}));
    svg.appendChild(svgEl("text", {x: chartLeft - 12, y: y + 4, "font-size": 14, "text-anchor": "end", fill: "#334155"}, String(i)));
  }
}

function makeDrag(node, onMove) {
  let dragging = false;
  node.addEventListener("pointerdown", (e) => {
    dragging = true;
    node.setPointerCapture(e.pointerId);
  });
  node.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
    onMove(loc.x, loc.y);
  });
  node.addEventListener("pointerup", (e) => {
    dragging = false;
    try { node.releasePointerCapture(e.pointerId); } catch {}
  });
}

function renderBar() {
  const chartLeft = 90, chartTop = 70, chartRight = 850, chartBottom = 500;
  drawAxes(chartLeft, chartTop, chartRight, chartBottom, state.maxValue, 1);
  const n = state.labels.length;
  const band = (chartRight - chartLeft) / n;
  const barW = Math.min(80, band * 0.45);

  state.labels.forEach((label, i) => {
    const x = chartLeft + band * i + (band - barW) / 2;
    const value = state.student.values1[i] ?? 0;
    const y = yFromValue(value, chartBottom, chartTop, state.maxValue);
    svg.appendChild(svgEl("rect", {x, y, width: barW, height: chartBottom - y, fill: "#60a5fa", stroke: "#1d4ed8"}));
    svg.appendChild(svgEl("text", {x: x + barW/2, y: chartBottom + 24, "text-anchor": "middle", "font-size": 16, fill: "#0f172a"}, label));
    svg.appendChild(svgEl("text", {x: x + barW/2, y: y - 8, "text-anchor": "middle", "font-size": 16, fill: "#0f172a"}, String(value)));
    const handle = svgEl("circle", {cx: x + barW/2, cy: y, r: 9, fill: "#1d4ed8", class: "handle"});
    makeDrag(handle, (_, py) => {
      state.student.values1[i] = valueFromY(py, chartBottom, chartTop, state.maxValue);
      render();
    });
    svg.appendChild(handle);
  });
}

function renderDoubleBar() {
  const chartLeft = 90, chartTop = 70, chartRight = 850, chartBottom = 500;
  drawAxes(chartLeft, chartTop, chartRight, chartBottom, state.maxValue, 1);
  const n = state.labels.length;
  const band = (chartRight - chartLeft) / n;
  const barW = Math.min(34, band * 0.22);

  state.labels.forEach((label, i) => {
    const baseX = chartLeft + band * i + band * 0.18;
    const v1 = state.student.values1[i] ?? 0;
    const v2 = state.student.values2[i] ?? 0;
    const y1 = yFromValue(v1, chartBottom, chartTop, state.maxValue);
    const y2 = yFromValue(v2, chartBottom, chartTop, state.maxValue);

    svg.appendChild(svgEl("rect", {x: baseX, y: y1, width: barW, height: chartBottom - y1, fill: "#60a5fa", stroke: "#1d4ed8"}));
    svg.appendChild(svgEl("rect", {x: baseX + barW + 12, y: y2, width: barW, height: chartBottom - y2, fill: "#f59e0b", stroke: "#b45309"}));
    svg.appendChild(svgEl("text", {x: baseX + barW + 6, y: chartBottom + 24, "text-anchor": "middle", "font-size": 16, fill: "#0f172a"}, label));

    const h1 = svgEl("circle", {cx: baseX + barW/2, cy: y1, r: 8, fill: "#1d4ed8", class: "handle"});
    makeDrag(h1, (_, py) => { state.student.values1[i] = valueFromY(py, chartBottom, chartTop, state.maxValue); render(); });
    svg.appendChild(h1);

    const h2 = svgEl("circle", {cx: baseX + barW + 12 + barW/2, cy: y2, r: 8, fill: "#b45309", class: "handle"});
    makeDrag(h2, (_, py) => { state.student.values2[i] = valueFromY(py, chartBottom, chartTop, state.maxValue); render(); });
    svg.appendChild(h2);
  });

  svg.appendChild(svgEl("rect", {x: 690, y: 55, width: 16, height: 16, fill: "#60a5fa"}));
  svg.appendChild(svgEl("text", {x: 712, y: 68, "font-size": 14, fill: "#0f172a"}, "Dãy 1"));
  svg.appendChild(svgEl("rect", {x: 770, y: 55, width: 16, height: 16, fill: "#f59e0b"}));
  svg.appendChild(svgEl("text", {x: 792, y: 68, "font-size": 14, fill: "#0f172a"}, "Dãy 2"));
}

function renderLine() {
  const chartLeft = 90, chartTop = 70, chartRight = 850, chartBottom = 500;
  drawAxes(chartLeft, chartTop, chartRight, chartBottom, state.maxValue, 1);
  const n = state.labels.length;
  const band = (chartRight - chartLeft) / Math.max(n - 1, 1);

  const points = state.labels.map((label, i) => {
    const x = chartLeft + band * i;
    const y = yFromValue(state.student.values1[i] ?? 0, chartBottom, chartTop, state.maxValue);
    return {x, y, label, i};
  });

  const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  svg.appendChild(svgEl("path", {d, fill: "none", stroke: "#2563eb", "stroke-width": 3}));

  points.forEach((p) => {
    svg.appendChild(svgEl("text", {x: p.x, y: chartBottom + 24, "text-anchor": "middle", "font-size": 16, fill: "#0f172a"}, p.label));
    const pt = svgEl("circle", {cx: p.x, cy: p.y, r: 9, fill: "#1d4ed8", class: "line-point"});
    makeDrag(pt, (_px, py) => {
      state.student.values1[p.i] = valueFromY(py, chartBottom, chartTop, state.maxValue);
      render();
    });
    svg.appendChild(pt);
    svg.appendChild(svgEl("text", {x: p.x, y: p.y - 10, "text-anchor": "middle", "font-size": 15, fill: "#0f172a"}, String(state.student.values1[p.i] ?? 0)));
  });
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

function normalizePie(values) {
  const cleaned = values.map(v => Math.max(0, Math.round(v)));
  const total = cleaned.reduce((a,b)=>a+b,0);
  if (total === 100) return cleaned;
  if (total === 0) {
    const n = cleaned.length || 1;
    const base = Math.floor(100 / n);
    const arr = Array.from({length:n}, () => base);
    arr[0] += 100 - arr.reduce((a,b)=>a+b,0);
    return arr;
  }
  const scaled = cleaned.map(v => Math.round(v * 100 / total));
  const diff = 100 - scaled.reduce((a,b)=>a+b,0);
  if (scaled.length) scaled[0] += diff;
  return scaled;
}

function renderPie() {
  state.student.pie = normalizePie(state.student.pie);
  const cx = 340, cy = 280, r = 180;
  const colors = ["#60a5fa", "#f59e0b", "#34d399", "#f472b6", "#a78bfa", "#fb7185"];
  let angle = 0;
  const handles = [];

  state.labels.forEach((label, i) => {
    const sweep = (state.student.pie[i] / 100) * 360;
    const next = angle + sweep;
    svg.appendChild(svgEl("path", {
      d: arcPath(cx, cy, r, angle, next),
      fill: colors[i % colors.length],
      stroke: "#fff",
      "stroke-width": 2
    }));
    const mid = angle + sweep / 2;
    const p = polarToCartesian(cx, cy, r * 0.63, mid);
    svg.appendChild(svgEl("text", {x: p.x, y: p.y, "text-anchor": "middle", "font-size": 16, fill: "#0f172a"}, `${label} ${state.student.pie[i]}%`));
    handles.push({ angle: next, index: i });
    angle = next;
  });

  handles.slice(0, -1).forEach((h) => {
    const p = polarToCartesian(cx, cy, r, h.angle);
    const handle = svgEl("circle", {cx: p.x, cy: p.y, r: 10, fill: "#0f172a", class: "pie-handle"});
    makeDrag(handle, (px, py) => {
      let deg = Math.atan2(py - cy, px - cx) * 180 / Math.PI + 90;
      if (deg < 0) deg += 360;
      const prevAngles = [];
      let a = 0;
      for (let i = 0; i < state.student.pie.length; i++) {
        prevAngles.push(a);
        a += (state.student.pie[i] / 100) * 360;
      }
      const prevStart = prevAngles[h.index];
      let newBoundary = deg;
      const pairTotal = state.student.pie[h.index] + state.student.pie[h.index + 1];
      if (newBoundary < prevStart + 5) newBoundary = prevStart + 5;
      if (newBoundary > prevStart + pairTotal / 100 * 360 - 5) newBoundary = prevStart + pairTotal / 100 * 360 - 5;
      const firstPct = Math.round(((newBoundary - prevStart) / 360) * 100);
      state.student.pie[h.index] = Math.max(1, Math.min(pairTotal - 1, firstPct));
      state.student.pie[h.index + 1] = pairTotal - state.student.pie[h.index];
      render();
    });
    svg.appendChild(handle);
  });

  const total = state.student.pie.reduce((a,b)=>a+b,0);
  svg.appendChild(svgEl("text", {x: 700, y: 120, "font-size": 18, fill: total === 100 ? "#15803d" : "#b91c1c"}, `Tổng: ${total}%`));
  let y = 170;
  state.labels.forEach((label, i) => {
    svg.appendChild(svgEl("rect", {x: 680, y: y-14, width: 18, height: 18, fill: colors[i % colors.length]}));
    svg.appendChild(svgEl("text", {x: 706, y, "font-size": 16, fill: "#0f172a"}, `${label}: ${state.student.pie[i]}%`));
    y += 32;
  });
}

function renderPictogram() {
  const startX = 120, startY = 120;
  const rowGap = 92, cell = 26, gap = 6;
  const unit = state.unit;
  svg.appendChild(svgEl("text", {x: 120, y: 70, "font-size": 18, fill: "#0f172a"}, `Quy ước: 1 ô vuông = ${unit}`));

  state.labels.forEach((label, i) => {
    const y = startY + i * rowGap;
    svg.appendChild(svgEl("text", {x: 70, y: y + 20, "font-size": 16, "text-anchor": "end", fill: "#0f172a"}, label));
    const count = state.student.pictogramCells[i] ?? 0;
    const neededValue = state.values1[i] ?? 0;
    svg.appendChild(svgEl("text", {x: 720, y: y + 20, "font-size": 15, fill: "#475569"}, `Số ô tô: ${count} | Giá trị đề: ${neededValue}`));

    for (let k = 0; k < 16; k++) {
      const x = startX + k * (cell + gap);
      const rect = svgEl("rect", {
        x, y, width: cell, height: cell, rx: 3,
        fill: k < count ? "#2563eb" : "#fff",
        stroke: "#64748b",
        "stroke-width": 1.2,
        class: "picto-cell"
      });
      rect.addEventListener("click", () => {
        state.student.pictogramCells[i] = (k + 1 === count) ? k : (k + 1);
        render();
      });
      svg.appendChild(rect);
    }
  });
}

function render() {
  clearSvg();
  setHelp();
  updatePreview();

  if (state.type === "bar") renderBar();
  else if (state.type === "double_bar") renderDoubleBar();
  else if (state.type === "line") renderLine();
  else if (state.type === "pie") renderPie();
  else if (state.type === "pictogram") renderPictogram();
}

byId("applyBtn").addEventListener("click", applyForm);
byId("resetBtn").addEventListener("click", () => {
  syncStudentFromSource();
  render();
});
byId("submitBtn").addEventListener("click", () => {
  byId("submitMsg").textContent = "Đã ghi nhận bài làm trên màn hình. Bản này là web hóa phần thao tác giống bản off.";
});

applyForm();
