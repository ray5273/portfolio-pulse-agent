import { latestFinite } from "./indicators.js";

function pct(value) {
  if (!Number.isFinite(value)) return "n/a";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function krw(value) {
  if (!Number.isFinite(value)) return "n/a";
  return Math.round(value).toLocaleString("en-US");
}

export function analyzeTicker({ ticker, name, rows, indicators }) {
  const latest = rows[rows.length - 1];
  const previous = rows[rows.length - 2] || latest;
  const close = latest.close;
  const previousClose = previous.close;
  const changePct = previousClose ? ((close / previousClose) - 1) * 100 : 0;
  const sma20 = latestFinite(indicators.sma20);
  const sma60 = latestFinite(indicators.sma60);
  const rsi14 = latestFinite(indicators.rsi14);
  const volume20 = latestFinite(indicators.volume20);
  const volumeRatio = volume20 ? latest.volume / volume20 : null;
  const last60 = rows.slice(-60);
  const high60 = Math.max(...last60.map((row) => row.high));
  const low60 = Math.min(...last60.map((row) => row.low));
  const drawdown = high60 ? ((close / high60) - 1) * 100 : 0;
  const rangePosition = high60 === low60 ? 50 : ((close - low60) / (high60 - low60)) * 100;
  const momentum = sma20 ? ((close / sma20) - 1) * 100 : 0;

  let score = 50;
  if (sma20 && close > sma20) score += 12;
  if (sma60 && close > sma60) score += 10;
  if (sma20 && sma60 && sma20 > sma60) score += 8;
  if (changePct > 0) score += 5;
  if (volumeRatio && volumeRatio > 1.5 && changePct > 0) score += 8;
  if (rsi14 && rsi14 > 70) score -= 8;
  if (rsi14 && rsi14 < 35) score -= 5;
  if (drawdown < -12) score -= 12;
  if (rangePosition > 80) score += 5;
  score = Math.max(0, Math.min(100, Math.round(score)));

  let signal = "neutral";
  if (score >= 70) signal = "bullish";
  else if (score <= 40) signal = "caution";

  return {
    ticker,
    name,
    asOf: latest.date,
    signal,
    score,
    close,
    previousClose,
    changePct,
    sma20,
    sma60,
    rsi14,
    volumeRatio,
    high60,
    low60,
    drawdown,
    rangePosition,
    momentum,
    lastCloseText: krw(close),
    changeText: pct(changePct),
    momentumText: pct(momentum),
    drawdownText: pct(drawdown),
    volumeRatioText: Number.isFinite(volumeRatio) ? `${volumeRatio.toFixed(2)}x` : "n/a",
    rsiText: Number.isFinite(rsi14) ? rsi14.toFixed(1) : "n/a"
  };
}

export function renderAnalysisMarkdown(analysis) {
  return [
    `# ${analysis.ticker} ${analysis.name}`,
    "",
    `- As of: ${analysis.asOf}`,
    `- Signal: ${analysis.signal}`,
    `- Score: ${analysis.score}/100`,
    `- Close: ${analysis.lastCloseText} (${analysis.changeText})`,
    `- Momentum vs SMA20: ${analysis.momentumText}`,
    `- RSI14: ${analysis.rsiText}`,
    `- Volume ratio vs 20D average: ${analysis.volumeRatioText}`,
    `- Drawdown from 60D high: ${analysis.drawdownText}`,
    "",
    "## Read",
    "",
    buildRead(analysis),
    ""
  ].join("\n");
}

export function renderMessage(analysis, artifactPaths) {
  return [
    `${analysis.ticker} ${analysis.name}: ${analysis.signal.toUpperCase()} (${analysis.score}/100)`,
    `Close ${analysis.lastCloseText} (${analysis.changeText}), momentum ${analysis.momentumText}, RSI ${analysis.rsiText}, volume ${analysis.volumeRatioText}.`,
    `Artifacts: ${artifactPaths.main}, ${artifactPaths.overlay}, ${artifactPaths.momentum}`
  ].join("\n");
}

function buildRead(analysis) {
  if (analysis.signal === "bullish") {
    return "Trend and relative position are constructive. Watch whether volume confirms follow-through without an overbought RSI extension.";
  }
  if (analysis.signal === "caution") {
    return "Price action is weak relative to recent trend references. Keep position sizing conservative until momentum and drawdown improve.";
  }
  return "Setup is mixed. Wait for clearer price confirmation or volume expansion before treating the move as durable.";
}
