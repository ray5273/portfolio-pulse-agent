import { latestFinite } from "./indicators.js";

function pct(value) {
  if (!Number.isFinite(value)) return "n/a";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function krw(value) {
  if (!Number.isFinite(value)) return "n/a";
  return Math.round(value).toLocaleString("en-US");
}

function signalLabel(signal) {
  if (signal === "bullish") return "강세";
  if (signal === "caution") return "주의";
  if (signal === "neutral") return "중립";
  return signal || "n/a";
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
    `- 기준일: ${analysis.asOf}`,
    `- 신호: ${signalLabel(analysis.signal)}`,
    `- 점수: ${analysis.score}/100`,
    `- 종가: ${analysis.lastCloseText} (${analysis.changeText})`,
    `- SMA20 대비 모멘텀: ${analysis.momentumText}`,
    `- RSI14: ${analysis.rsiText}`,
    `- 20일 평균 대비 거래량: ${analysis.volumeRatioText}`,
    `- 60일 고점 대비 낙폭: ${analysis.drawdownText}`,
    "",
    "## 해석",
    "",
    buildRead(analysis),
    ""
  ].join("\n");
}

export function renderMessage(analysis, artifactPaths) {
  return [
    `${analysis.ticker} ${analysis.name}: ${signalLabel(analysis.signal)} (${analysis.score}/100)`,
    `종가 ${analysis.lastCloseText} (${analysis.changeText}), 모멘텀 ${analysis.momentumText}, RSI ${analysis.rsiText}, 거래량 ${analysis.volumeRatioText}.`,
    `차트: ${artifactPaths.main}, ${artifactPaths.overlay}, ${artifactPaths.momentum}`
  ].join("\n");
}

function buildRead(analysis) {
  if (analysis.signal === "bullish") {
    return "추세와 상대 위치가 우호적입니다. RSI 과열이 심해지지 않는 범위에서 거래량이 후속 흐름을 확인해 주는지 확인하세요.";
  }
  if (analysis.signal === "caution") {
    return "최근 추세 기준 대비 가격 흐름이 약합니다. 모멘텀과 낙폭이 개선되기 전까지는 포지션 규모를 보수적으로 유지하세요.";
  }
  return "구성이 엇갈립니다. 움직임을 지속 가능한 흐름으로 보기 전에 더 분명한 가격 확인이나 거래량 확대를 기다리세요.";
}
