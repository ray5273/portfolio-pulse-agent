import { RasterCanvas } from "./canvas.js";

const COLORS = {
  ink: "#111827",
  muted: "#6b7280",
  grid: "#e5e7eb",
  panel: "#f8fafc",
  green: "#0f9f6e",
  red: "#dc2626",
  blue: "#2563eb",
  amber: "#d97706",
  purple: "#7c3aed"
};

function extent(values) {
  const filtered = values.filter((value) => Number.isFinite(value));
  return [Math.min(...filtered), Math.max(...filtered)];
}

function scaleValue(value, min, max, low, high) {
  if (max === min) return (low + high) / 2;
  return low + ((value - min) / (max - min)) * (high - low);
}

function drawFrame(canvas, title, subtitle) {
  canvas.rect(0, 0, canvas.width, canvas.height, "#ffffff");
  canvas.rect(0, 0, canvas.width, 48, COLORS.panel);
  canvas.text(title, 24, 16, COLORS.ink, 2);
  canvas.text(subtitle, 24, 34, COLORS.muted, 1);
  canvas.strokeRect(0, 0, canvas.width - 1, canvas.height - 1, COLORS.grid);
}

function drawGrid(canvas, area) {
  for (let i = 0; i <= 4; i += 1) {
    const y = area.y + (area.height / 4) * i;
    canvas.line(area.x, y, area.x + area.width, y, COLORS.grid);
  }
  for (let i = 0; i <= 5; i += 1) {
    const x = area.x + (area.width / 5) * i;
    canvas.line(x, area.y, x, area.y + area.height, COLORS.grid);
  }
}

function drawLineSeries(canvas, rows, values, area, min, max, color, thickness = 2) {
  let previous = null;
  rows.forEach((row, index) => {
    const value = values[index];
    if (!Number.isFinite(value)) {
      previous = null;
      return;
    }
    const x = scaleValue(index, 0, rows.length - 1, area.x, area.x + area.width);
    const y = scaleValue(value, min, max, area.y + area.height, area.y);
    if (previous) canvas.line(previous.x, previous.y, x, y, color, thickness);
    previous = { x, y };
  });
}

export function renderPriceChart({ ticker, name, rows, indicators, analysis }) {
  const canvas = new RasterCanvas(960, 540);
  drawFrame(canvas, `${ticker} PRICE`, `${name} CLOSE ${analysis.lastCloseText} SCORE ${analysis.score}`);
  const area = { x: 72, y: 76, width: 820, height: 390 };
  drawGrid(canvas, area);

  const closes = rows.map((row) => row.close);
  const highs = rows.map((row) => row.high);
  const lows = rows.map((row) => row.low);
  const [minPrice, maxPrice] = extent([...lows, ...highs]);
  const padding = (maxPrice - minPrice) * 0.08 || 1;
  const min = minPrice - padding;
  const max = maxPrice + padding;

  drawLineSeries(canvas, rows, closes, area, min, max, COLORS.blue, 3);
  drawLineSeries(canvas, rows, indicators.sma20, area, min, max, COLORS.amber, 2);
  drawLineSeries(canvas, rows, indicators.sma60, area, min, max, COLORS.purple, 2);

  canvas.text(`HIGH ${Math.round(maxPrice)}`, 734, 86, COLORS.muted, 1);
  canvas.text(`LOW ${Math.round(minPrice)}`, 746, 452, COLORS.muted, 1);
  canvas.text("CLOSE", 74, 482, COLORS.blue, 1);
  canvas.text("SMA20", 150, 482, COLORS.amber, 1);
  canvas.text("SMA60", 230, 482, COLORS.purple, 1);
  return canvas.toPng();
}

export function renderVolumeChart({ ticker, name, rows, analysis }) {
  const canvas = new RasterCanvas(960, 540);
  drawFrame(canvas, `${ticker} VOLUME`, `${name} VOLUME RATIO ${analysis.volumeRatioText}`);
  const area = { x: 72, y: 76, width: 820, height: 390 };
  drawGrid(canvas, area);

  const volumes = rows.map((row) => row.volume);
  const [, maxVolume] = extent(volumes);
  const barWidth = Math.max(2, Math.floor(area.width / rows.length) - 1);
  rows.forEach((row, index) => {
    const x = scaleValue(index, 0, rows.length - 1, area.x, area.x + area.width);
    const barHeight = scaleValue(row.volume, 0, maxVolume || 1, 0, area.height);
    const color = row.close >= row.open ? COLORS.green : COLORS.red;
    canvas.rect(x - barWidth / 2, area.y + area.height - barHeight, barWidth, barHeight, color);
  });

  canvas.text(`MAX ${Math.round(maxVolume / 1000)}K`, 734, 86, COLORS.muted, 1);
  canvas.text("UP/DOWN DAILY VOLUME", 72, 482, COLORS.muted, 1);
  return canvas.toPng();
}

export function renderPulseChart({ ticker, name, rows, analysis }) {
  const canvas = new RasterCanvas(960, 540);
  drawFrame(canvas, `${ticker} PULSE`, `${name} ${analysis.signal.toUpperCase()} TREND`);
  const area = { x: 72, y: 96, width: 820, height: 330 };
  drawGrid(canvas, area);

  const closes = rows.map((row) => row.close);
  const base = closes[0] || 1;
  const normalized = closes.map((close) => ((close / base) - 1) * 100);
  const [minPulse, maxPulse] = extent(normalized);
  const min = Math.min(-5, minPulse - 2);
  const max = Math.max(5, maxPulse + 2);
  drawLineSeries(canvas, rows, normalized, area, min, max, analysis.score >= 55 ? COLORS.green : COLORS.red, 3);

  const zeroY = scaleValue(0, min, max, area.y + area.height, area.y);
  canvas.line(area.x, zeroY, area.x + area.width, zeroY, "#94a3b8", 2);

  canvas.text(`MOM ${analysis.momentumText}`, 80, 452, COLORS.ink, 2);
  canvas.text(`RSI ${analysis.rsiText}`, 330, 452, COLORS.ink, 2);
  canvas.text(`DD ${analysis.drawdownText}`, 520, 452, COLORS.ink, 2);
  return canvas.toPng();
}
