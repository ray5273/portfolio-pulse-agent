#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { createKrFontRenderer } = require("./lib/kr-font-renderer");
const {
  normalizeBars: normalizeTechnicalBars,
  requireValidBars: requireValidTechnicalBars,
  buildMetrics: buildTechnicalMetrics,
} = require("./lib/technical-core");

const FONT_5X7 = {
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  ".": ["00000", "00000", "00000", "00000", "00000", "00110", "00110"],
  ",": ["00000", "00000", "00000", "00000", "00110", "00110", "00100"],
  ":": ["00000", "00110", "00110", "00000", "00110", "00110", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00100", "01000", "10000", "00000", "00000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "%": ["11001", "11010", "00100", "01000", "10110", "00110", "00000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "11100"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11100", "10010", "10001", "10001", "10001", "10010", "11100"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01110"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00001", "00001", "00001", "00001", "10001", "10001", "01110"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
};

const JAMO_5X5 = {
  "ㄱ": ["11110", "10000", "10000", "10000", "00000"],
  "ㄴ": ["10000", "10000", "10000", "11110", "00000"],
  "ㄷ": ["11110", "10000", "10000", "11110", "00000"],
  "ㄹ": ["11110", "10000", "11110", "00010", "11110"],
  "ㅁ": ["11110", "10010", "10010", "11110", "00000"],
  "ㅂ": ["11110", "10010", "11110", "10010", "11110"],
  "ㅅ": ["00100", "01010", "10001", "00000", "00000"],
  "ㅇ": ["01110", "10001", "10001", "01110", "00000"],
  "ㅈ": ["11111", "00100", "01010", "10001", "00000"],
  "ㅊ": ["00100", "11111", "01010", "10001", "00000"],
  "ㅋ": ["11110", "10000", "11100", "10000", "00000"],
  "ㅌ": ["11110", "10000", "11110", "10000", "11110"],
  "ㅍ": ["10010", "10010", "11110", "10010", "10010"],
  "ㅎ": ["11111", "00100", "01110", "10001", "01110"],
  "ㅏ": ["00100", "00100", "11100", "00100", "00100"],
  "ㅐ": ["01100", "01100", "11100", "01100", "01100"],
  "ㅑ": ["00100", "11100", "00100", "11100", "00100"],
  "ㅒ": ["01100", "11100", "01100", "11100", "01100"],
  "ㅓ": ["00100", "00100", "00111", "00100", "00100"],
  "ㅔ": ["00110", "00110", "00111", "00110", "00110"],
  "ㅕ": ["00100", "00111", "00100", "00111", "00100"],
  "ㅖ": ["00110", "00111", "00110", "00111", "00110"],
  "ㅗ": ["11111", "00100", "00100", "00000", "00000"],
  "ㅛ": ["11111", "01010", "01010", "00000", "00000"],
  "ㅜ": ["00000", "00000", "00100", "00100", "11111"],
  "ㅠ": ["00000", "00000", "01010", "01010", "11111"],
  "ㅡ": ["00000", "00000", "11111", "00000", "00000"],
  "ㅣ": ["00100", "00100", "00100", "00100", "00100"],
};

const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;
const HANGUL_INITIALS = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const HANGUL_MEDIALS = [
  ["ㅏ"], ["ㅐ"], ["ㅑ"], ["ㅒ"], ["ㅓ"], ["ㅔ"], ["ㅕ"], ["ㅖ"], ["ㅗ"], ["ㅗ", "ㅏ"], ["ㅗ", "ㅐ"], ["ㅗ", "ㅣ"],
  ["ㅛ"], ["ㅜ"], ["ㅜ", "ㅓ"], ["ㅜ", "ㅔ"], ["ㅜ", "ㅣ"], ["ㅠ"], ["ㅡ"], ["ㅡ", "ㅣ"], ["ㅣ"],
];
const HANGUL_FINALS = [
  [], ["ㄱ"], ["ㄲ"], ["ㄱ", "ㅅ"], ["ㄴ"], ["ㄴ", "ㅈ"], ["ㄴ", "ㅎ"], ["ㄷ"], ["ㄹ"], ["ㄹ", "ㄱ"], ["ㄹ", "ㅁ"], ["ㄹ", "ㅂ"],
  ["ㄹ", "ㅅ"], ["ㄹ", "ㅌ"], ["ㄹ", "ㅍ"], ["ㄹ", "ㅎ"], ["ㅁ"], ["ㅂ"], ["ㅂ", "ㅅ"], ["ㅅ"], ["ㅆ"], ["ㅇ"], ["ㅈ"], ["ㅊ"], ["ㅋ"], ["ㅌ"], ["ㅍ"], ["ㅎ"],
];
const KR_FONT_RENDERER = createKrFontRenderer();

function parseArgs(argv) {
  const result = {
    chartBars: 120,
    width: 1600,
    height: 1100,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--input") {
      result.input = argv[i + 1];
      i += 1;
    } else if (arg === "--png-out") {
      result.pngOut = argv[i + 1];
      i += 1;
    } else if (arg === "--image-path") {
      result.imagePath = argv[i + 1];
      i += 1;
    } else if (arg === "--chart-bars") {
      result.chartBars = Number(argv[i + 1]);
      i += 1;
    } else if (arg === "--width") {
      result.width = Number(argv[i + 1]);
      i += 1;
    } else if (arg === "--height") {
      result.height = Number(argv[i + 1]);
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return result;
}

function usage() {
  return [
    "Usage:",
    "  node chart-basics.js --input price-history.json [--png-out chart.png] [--image-path relative/path.png] [--chart-bars 120] [--width 1600] [--height 1100]",
    "",
    "Notes:",
    "  - The input JSON must include bars with date and close.",
    "  - high and low are required for Bollinger and Ichimoku overlays to be fully useful.",
    "  - volume is optional but recommended for volume panel and participation read.",
    "  - When --png-out is set, the script writes the main trend chart to that path and sibling overlay and momentum charts to *-overlay.png and *-momentum.png.",
    "  - The markdown output prints all three image snippets when PNG output is enabled.",
  ].join("\n");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
}

function requireNamedChartInput(data, options) {
  if (!options.pngOut) {
    return;
  }

  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (!name) {
    throw new Error(
      "PNG chart rendering requires a company name in the input JSON. Pass `--name \"회사명\"` to fetch-kr-chart.js so the PNG title shows the stock name.",
    );
  }
}

function lastFinite(values) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (Number.isFinite(values[index])) {
      return values[index];
    }
  }
  return null;
}

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return value.toFixed(digits);
}

function formatInteger(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return Math.round(value).toString();
}

function formatPercentRatio(value, digits = 1) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return `${(value * 100).toFixed(digits)}%`;
}

function formatAxisNumber(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return Math.round(value).toLocaleString("en-US");
}

function relationLabel(left, right) {
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return "insufficient-data";
  }
  if (left > right) {
    return "above";
  }
  if (left < right) {
    return "below";
  }
  return "at";
}

function classifyVolume(volumeRatio) {
  if (!Number.isFinite(volumeRatio)) {
    return "insufficient-data";
  }
  if (volumeRatio >= 1.5) {
    return "heavy";
  }
  if (volumeRatio <= 0.7) {
    return "light";
  }
  return "normal";
}

function classifyRsi(rsiValue) {
  if (!Number.isFinite(rsiValue)) {
    return "insufficient-data";
  }
  if (rsiValue >= 70) {
    return "overbought";
  }
  if (rsiValue <= 30) {
    return "oversold";
  }
  return "neutral";
}

function classifyMacd(macdData, latestIndex) {
  const macdValue = macdData.macd[latestIndex];
  const signalValue = macdData.signal[latestIndex];
  const histogramValue = macdData.histogram[latestIndex];
  const prevMacd = latestIndex > 0 ? macdData.macd[latestIndex - 1] : null;
  const prevSignal = latestIndex > 0 ? macdData.signal[latestIndex - 1] : null;
  const prevHistogram = latestIndex > 0 ? macdData.histogram[latestIndex - 1] : null;

  let crossState = "insufficient-data";
  if ([macdValue, signalValue, prevMacd, prevSignal].every(Number.isFinite)) {
    if (macdValue >= signalValue && prevMacd < prevSignal) {
      crossState = "bullish-cross";
    } else if (macdValue <= signalValue && prevMacd > prevSignal) {
      crossState = "bearish-cross";
    } else if (macdValue > signalValue) {
      crossState = "bullish";
    } else if (macdValue < signalValue) {
      crossState = "bearish";
    } else {
      crossState = "flat";
    }
  }

  let zeroState = "insufficient-data";
  if (Number.isFinite(macdValue)) {
    if (macdValue > 0) {
      zeroState = "above-zero";
    } else if (macdValue < 0) {
      zeroState = "below-zero";
    } else {
      zeroState = "at-zero";
    }
  }

  let histogramState = "insufficient-data";
  if ([histogramValue, prevHistogram].every(Number.isFinite)) {
    const latestMagnitude = Math.abs(histogramValue);
    const prevMagnitude = Math.abs(prevHistogram);
    if (latestMagnitude > prevMagnitude * 1.03) {
      histogramState = "expanding";
    } else if (latestMagnitude < prevMagnitude * 0.97) {
      histogramState = "contracting";
    } else {
      histogramState = "stable";
    }
  }

  return {
    macdValue,
    signalValue,
    histogramValue,
    crossState,
    zeroState,
    histogramState,
  };
}

function classifyAdx(adxData, latestIndex) {
  const adxValue = adxData.adx[latestIndex];
  const plusDiValue = adxData.plusDi[latestIndex];
  const minusDiValue = adxData.minusDi[latestIndex];
  const prevAdx = latestIndex > 0 ? adxData.adx[latestIndex - 1] : null;

  let directionState = "insufficient-data";
  if ([plusDiValue, minusDiValue].every(Number.isFinite)) {
    if (plusDiValue > minusDiValue) {
      directionState = "bullish";
    } else if (plusDiValue < minusDiValue) {
      directionState = "bearish";
    } else {
      directionState = "flat";
    }
  }

  let strengthState = "insufficient-data";
  if (Number.isFinite(adxValue)) {
    if (adxValue >= 25) {
      strengthState = "strong-trend";
    } else if (adxValue >= 20) {
      strengthState = "building-trend";
    } else {
      strengthState = "weak-trend";
    }
  }

  let slopeState = "insufficient-data";
  if ([adxValue, prevAdx].every(Number.isFinite)) {
    if (adxValue > prevAdx + 0.5) {
      slopeState = "rising";
    } else if (adxValue < prevAdx - 0.5) {
      slopeState = "falling";
    } else {
      slopeState = "flat";
    }
  }

  return {
    adxValue,
    plusDiValue,
    minusDiValue,
    directionState,
    strengthState,
    slopeState,
  };
}

function classifyMovingAverageStructure(close, maValues) {
  const { ma5, ma20, ma60, ma120 } = maValues;
  if (![close, ma5, ma20, ma60, ma120].every(Number.isFinite)) {
    return "insufficient-data";
  }
  if (close > ma5 && ma5 > ma20 && ma20 > ma60 && ma60 > ma120) {
    return "strong-bullish";
  }
  if (close < ma5 && ma5 < ma20 && ma20 < ma60 && ma60 < ma120) {
    return "strong-bearish";
  }
  if (close > ma20 && ma20 > ma60 && ma60 > ma120) {
    return "bullish";
  }
  if (close < ma20 && ma20 < ma60 && ma60 < ma120) {
    return "bearish";
  }
  if (close > ma20 && close < ma60) {
    return "rebound-inside-downtrend";
  }
  if (close < ma20 && close > ma60) {
    return "pullback-inside-uptrend";
  }
  return "mixed";
}

function classifyBollinger(latestClose, bollinger, bandwidthMedian60) {
  const upper = lastFinite(bollinger.upper);
  const middle = lastFinite(bollinger.middle);
  const lower = lastFinite(bollinger.lower);
  const bandwidth = lastFinite(bollinger.bandwidth);

  if (![latestClose, upper, middle, lower].every(Number.isFinite)) {
    return {
      state: "insufficient-data",
      bandPosition: null,
      bandwidth,
      bandwidthRegime: "insufficient-data",
      upper,
      middle,
      lower,
    };
  }

  const bandPosition = upper === lower ? 0.5 : (latestClose - lower) / (upper - lower);
  let state = "inside-bands";
  if (latestClose > upper) {
    state = "above-upper-band";
  } else if (latestClose < lower) {
    state = "below-lower-band";
  } else if (bandPosition >= 0.65) {
    state = "upper-half";
  } else if (bandPosition <= 0.35) {
    state = "lower-half";
  } else {
    state = "mid-band";
  }

  let bandwidthRegime = "normal";
  if (!Number.isFinite(bandwidth) || !Number.isFinite(bandwidthMedian60)) {
    bandwidthRegime = "insufficient-data";
  } else if (bandwidth >= bandwidthMedian60 * 1.25) {
    bandwidthRegime = "expanding";
  } else if (bandwidth <= bandwidthMedian60 * 0.8) {
    bandwidthRegime = "contracting";
  }

  return {
    state,
    bandPosition,
    bandwidth,
    bandwidthRegime,
    upper,
    middle,
    lower,
  };
}

function classifyIchimoku(latestClose, ichimoku, barsLength) {
  const latestIndex = barsLength - 1;
  const currentCloudIndex = latestIndex - ichimoku.shift;
  const tenkan = ichimoku.tenkan[latestIndex];
  const kijun = ichimoku.kijun[latestIndex];
  const currentCloudA = currentCloudIndex >= 0 ? ichimoku.senkouA[currentCloudIndex] : null;
  const currentCloudB = currentCloudIndex >= 0 ? ichimoku.senkouB[currentCloudIndex] : null;
  const futureCloudA = ichimoku.senkouA[latestIndex];
  const futureCloudB = ichimoku.senkouB[latestIndex];

  let cloudPosition = "insufficient-data";
  if ([latestClose, currentCloudA, currentCloudB].every(Number.isFinite)) {
    const cloudTop = Math.max(currentCloudA, currentCloudB);
    const cloudBottom = Math.min(currentCloudA, currentCloudB);
    if (latestClose > cloudTop) {
      cloudPosition = "above-cloud";
    } else if (latestClose < cloudBottom) {
      cloudPosition = "below-cloud";
    } else {
      cloudPosition = "inside-cloud";
    }
  }

  let tkCross = "insufficient-data";
  if ([tenkan, kijun].every(Number.isFinite)) {
    if (tenkan > kijun) {
      tkCross = "bullish";
    } else if (tenkan < kijun) {
      tkCross = "bearish";
    } else {
      tkCross = "flat";
    }
  }

  let futureCloudBias = "insufficient-data";
  if ([futureCloudA, futureCloudB].every(Number.isFinite)) {
    if (futureCloudA > futureCloudB) {
      futureCloudBias = "bullish";
    } else if (futureCloudA < futureCloudB) {
      futureCloudBias = "bearish";
    } else {
      futureCloudBias = "flat";
    }
  }

  return {
    tenkan,
    kijun,
    currentCloudA,
    currentCloudB,
    futureCloudA,
    futureCloudB,
    cloudPosition,
    tkCross,
    futureCloudBias,
  };
}

function classifyChartFlow(metrics) {
  let bullish = 0;
  let bearish = 0;

  if (metrics.movingAverageStructure === "strong-bullish") {
    bullish += 3;
  } else if (metrics.movingAverageStructure === "bullish") {
    bullish += 2;
  } else if (metrics.movingAverageStructure === "strong-bearish") {
    bearish += 3;
  } else if (metrics.movingAverageStructure === "bearish") {
    bearish += 2;
  } else if (metrics.movingAverageStructure === "rebound-inside-downtrend") {
    bullish += 1;
    bearish += 2;
  } else if (metrics.movingAverageStructure === "pullback-inside-uptrend") {
    bullish += 2;
    bearish += 1;
  }

  if (metrics.ichimoku.cloudPosition === "above-cloud") {
    bullish += 2;
  } else if (metrics.ichimoku.cloudPosition === "below-cloud") {
    bearish += 2;
  }

  if (metrics.ichimoku.tkCross === "bullish") {
    bullish += 1;
  } else if (metrics.ichimoku.tkCross === "bearish") {
    bearish += 1;
  }

  if (metrics.ichimoku.futureCloudBias === "bullish") {
    bullish += 1;
  } else if (metrics.ichimoku.futureCloudBias === "bearish") {
    bearish += 1;
  }

  if (metrics.bollinger.state === "above-upper-band" || metrics.bollinger.state === "upper-half") {
    bullish += 1;
  } else if (metrics.bollinger.state === "below-lower-band" || metrics.bollinger.state === "lower-half") {
    bearish += 1;
  }

  if (metrics.rsi14Value >= 60) {
    bullish += 1;
  } else if (metrics.rsi14Value <= 40) {
    bearish += 1;
  }

  if (metrics.macd.crossState === "bullish-cross") {
    bullish += 1;
  } else if (metrics.macd.crossState === "bearish-cross") {
    bearish += 1;
  } else if (metrics.macd.crossState === "bullish" && metrics.macd.zeroState === "above-zero") {
    bullish += 1;
  } else if (metrics.macd.crossState === "bearish" && metrics.macd.zeroState === "below-zero") {
    bearish += 1;
  }

  if (metrics.volumeRatio >= 1.2) {
    if (metrics.latestClose >= metrics.ma20Value) {
      bullish += 1;
    } else {
      bearish += 1;
    }
  }

  if (metrics.adx.strengthState === "strong-trend" || metrics.adx.strengthState === "building-trend") {
    if (metrics.adx.directionState === "bullish") {
      bullish += 1;
    } else if (metrics.adx.directionState === "bearish") {
      bearish += 1;
    }
  }

  if (bearish >= bullish + 3) {
    return "bearish continuation";
  }
  if (bullish >= bearish + 3) {
    return "bullish continuation";
  }
  if (bullish > bearish && metrics.latestClose < metrics.ma120Value) {
    return "technical rebound inside broader downtrend";
  }
  if (bearish > bullish && metrics.latestClose > metrics.ma120Value) {
    return "pullback inside broader uptrend";
  }
  return "range-bound or base-building";
}

function displayState(value) {
  const labels = {
    "insufficient-data": "데이터 부족",
    above: "상회",
    below: "하회",
    at: "일치",
    heavy: "증가",
    light: "감소",
    normal: "보통",
    overbought: "과열",
    oversold: "침체",
    neutral: "중립",
    bullish: "강세",
    bearish: "약세",
    flat: "횡보",
    "bullish-cross": "강세 전환",
    "bearish-cross": "약세 전환",
    "above-zero": "0선 상회",
    "below-zero": "0선 하회",
    "at-zero": "0선 부근",
    expanding: "확대",
    contracting: "축소",
    stable: "안정",
    rising: "상승",
    falling: "하락",
    "strong-trend": "강한 추세",
    "building-trend": "추세 형성",
    "weak-trend": "약한 추세",
    "strong-bullish": "강한 정배열",
    "strong-bearish": "강한 역배열",
    "rebound-inside-downtrend": "하락 추세 안의 반등",
    "pullback-inside-uptrend": "상승 추세 안의 눌림",
    mixed: "혼조",
    "inside-bands": "밴드 내부",
    "above-upper-band": "상단 밴드 돌파",
    "below-lower-band": "하단 밴드 이탈",
    "upper-half": "밴드 상단부",
    "lower-half": "밴드 하단부",
    "mid-band": "밴드 중간권",
    "above-cloud": "구름대 상회",
    "below-cloud": "구름대 하회",
    "inside-cloud": "구름대 내부",
    "bullish continuation": "강세 지속",
    "bearish continuation": "약세 지속",
    "technical rebound inside broader downtrend": "큰 하락 추세 안의 기술적 반등",
    "pullback inside broader uptrend": "큰 상승 추세 안의 눌림",
    "range-bound or base-building": "박스권 또는 바닥 다지기",
  };
  return labels[value] || value || "-";
}

function createRgbaBuffer(width, height, background) {
  const buffer = Buffer.alloc(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    buffer[offset] = background[0];
    buffer[offset + 1] = background[1];
    buffer[offset + 2] = background[2];
    buffer[offset + 3] = background[3];
  }
  return buffer;
}

function blendPixel(buffer, width, height, x, y, color) {
  if (x < 0 || x >= width || y < 0 || y >= height) {
    return;
  }
  const offset = (Math.floor(y) * width + Math.floor(x)) * 4;
  const alpha = (color[3] ?? 255) / 255;
  const invAlpha = 1 - alpha;
  buffer[offset] = Math.round(color[0] * alpha + buffer[offset] * invAlpha);
  buffer[offset + 1] = Math.round(color[1] * alpha + buffer[offset + 1] * invAlpha);
  buffer[offset + 2] = Math.round(color[2] * alpha + buffer[offset + 2] * invAlpha);
  buffer[offset + 3] = 255;
}

function fillRect(buffer, width, height, x, y, rectWidth, rectHeight, color) {
  const startX = Math.max(0, Math.floor(x));
  const startY = Math.max(0, Math.floor(y));
  const endX = Math.min(width, Math.ceil(x + rectWidth));
  const endY = Math.min(height, Math.ceil(y + rectHeight));

  for (let row = startY; row < endY; row += 1) {
    for (let col = startX; col < endX; col += 1) {
      blendPixel(buffer, width, height, col, row, color);
    }
  }
}

function drawLine(buffer, width, height, x0, y0, x1, y1, color, thickness = 1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);

  for (let step = 0; step <= steps; step += 1) {
    const x = Math.round(x0 + (dx * step) / steps);
    const y = Math.round(y0 + (dy * step) / steps);
    for (let offsetX = -Math.floor(thickness / 2); offsetX <= Math.floor(thickness / 2); offsetX += 1) {
      for (let offsetY = -Math.floor(thickness / 2); offsetY <= Math.floor(thickness / 2); offsetY += 1) {
        blendPixel(buffer, width, height, x + offsetX, y + offsetY, color);
      }
    }
  }
}

function drawSeries(buffer, width, height, points, color, thickness = 2) {
  let previous = null;
  for (const point of points) {
    if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
      if (previous) {
        drawLine(buffer, width, height, previous.x, previous.y, point.x, point.y, color, thickness);
      }
      previous = point;
    } else {
      previous = null;
    }
  }
}

function drawVerticalBand(buffer, width, height, x, y1, y2, color, thickness = 2) {
  const top = Math.min(y1, y2);
  const bottom = Math.max(y1, y2);
  fillRect(buffer, width, height, x - Math.floor(thickness / 2), top, thickness, bottom - top + 1, color);
}

function drawFilledBand(buffer, width, height, upperPoints, lowerPoints, color) {
  for (let index = 0; index < upperPoints.length; index += 1) {
    const upper = upperPoints[index];
    const lower = lowerPoints[index];
    if (upper && lower && Number.isFinite(upper.x) && Number.isFinite(upper.y) && Number.isFinite(lower.y)) {
      drawVerticalBand(buffer, width, height, Math.round(upper.x), upper.y, lower.y, color, 2);
    }
  }
}

function glyphWidth() {
  return 5;
}

function clamp(value, minValue, maxValue) {
  return Math.min(Math.max(value, minValue), maxValue);
}

function containsHangul(text) {
  return /[\uac00-\ud7a3]/.test(String(text || ""));
}

function loadExternalTextMask(text, scale = 1) {
  if (!containsHangul(text)) {
    return null;
  }
  return KR_FONT_RENDERER.loadMask(text, scale);
}

process.on("exit", () => KR_FONT_RENDERER.report());

function drawAlphaMask(buffer, width, height, x, y, mask, color) {
  if (!mask || mask.width <= 0 || mask.height <= 0) {
    return;
  }

  const alphaScale = color[3] === undefined ? 255 : color[3];
  for (let row = 0; row < mask.height; row += 1) {
    for (let col = 0; col < mask.width; col += 1) {
      const alpha = mask.alpha[row * mask.width + col];
      if (alpha > 0) {
        blendPixel(buffer, width, height, x + col, y + row, [
          color[0],
          color[1],
          color[2],
          Math.round((alpha * alphaScale) / 255),
        ]);
      }
    }
  }
}

function isHangulSyllable(character) {
  if (!character) {
    return false;
  }
  const code = character.codePointAt(0);
  return code >= HANGUL_BASE && code <= HANGUL_END;
}

function normalizeConsonantParts(jamo) {
  const doubled = {
    "ㄲ": ["ㄱ", "ㄱ"],
    "ㄸ": ["ㄷ", "ㄷ"],
    "ㅃ": ["ㅂ", "ㅂ"],
    "ㅆ": ["ㅅ", "ㅅ"],
    "ㅉ": ["ㅈ", "ㅈ"],
  };
  return doubled[jamo] || [jamo];
}

function decomposeHangulSyllable(character) {
  if (!isHangulSyllable(character)) {
    return null;
  }

  const syllableIndex = character.codePointAt(0) - HANGUL_BASE;
  const initialIndex = Math.floor(syllableIndex / 588);
  const medialIndex = Math.floor((syllableIndex % 588) / 28);
  const finalIndex = syllableIndex % 28;

  const initials = normalizeConsonantParts(HANGUL_INITIALS[initialIndex]).slice(0, 2);
  const medials = HANGUL_MEDIALS[medialIndex].slice(0, 2);
  const finals = HANGUL_FINALS[finalIndex]
    .flatMap((jamo) => normalizeConsonantParts(jamo))
    .slice(0, 2);

  return { initials, medials, finals };
}

function hangulGlyphWidth() {
  return 17;
}

function drawBitmap(buffer, width, height, x, y, bitmap, color, scale = 1) {
  bitmap.forEach((row, rowIndex) => {
    for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
      if (row[columnIndex] === "1") {
        fillRect(
          buffer,
          width,
          height,
          x + columnIndex * scale,
          y + rowIndex * scale,
          scale,
          scale,
          color,
        );
      }
    }
  });
}

function drawHangulGlyph(buffer, width, height, x, y, character, color, scale = 1) {
  const parts = decomposeHangulSyllable(character);
  if (!parts) {
    drawBitmap(buffer, width, height, x, y, FONT_5X7["?"], color, scale);
    return hangulGlyphWidth();
  }

  const initialXs = parts.initials.length > 1 ? [0, 3] : [0];
  const medialXs = parts.medials.length > 1 ? [6, 12] : [6];
  const finalXs = parts.finals.length > 1 ? [3, 9] : [6];

  parts.initials.forEach((jamo, index) => {
    const bitmap = JAMO_5X5[jamo];
    if (bitmap) {
      drawBitmap(buffer, width, height, x + initialXs[index] * scale, y, bitmap, color, scale);
    }
  });

  parts.medials.forEach((jamo, index) => {
    const bitmap = JAMO_5X5[jamo];
    if (bitmap) {
      drawBitmap(buffer, width, height, x + medialXs[index] * scale, y, bitmap, color, scale);
    }
  });

  parts.finals.forEach((jamo, index) => {
    const bitmap = JAMO_5X5[jamo];
    if (bitmap) {
      drawBitmap(buffer, width, height, x + finalXs[index] * scale, y + 6 * scale, bitmap, color, scale);
    }
  });

  return hangulGlyphWidth();
}

function measureCharacterWidth(character) {
  return isHangulSyllable(character) ? hangulGlyphWidth() : glyphWidth();
}

function measureText(text, scale = 1) {
  const externalMask = loadExternalTextMask(text, scale);
  if (externalMask) {
    return externalMask.width;
  }

  if (!text) {
    return 0;
  }
  const characters = Array.from(String(text));
  return characters.reduce((sum, character, index) => {
    const width = measureCharacterWidth(character);
    return sum + width * scale + (index === characters.length - 1 ? 0 : scale);
  }, 0);
}

function drawText(buffer, width, height, x, y, text, color, scale = 1, align = "left") {
  const externalMask = loadExternalTextMask(text, scale);
  const characters = Array.from(String(text));
  let cursorX = x;
  const totalWidth = externalMask ? externalMask.width : measureText(text, scale);
  if (align === "center") {
    cursorX -= Math.round(totalWidth / 2);
  } else if (align === "right") {
    cursorX -= totalWidth;
  }

  if (externalMask) {
    drawAlphaMask(buffer, width, height, Math.round(cursorX), Math.round(y), externalMask, color);
    return;
  }

  for (const character of characters) {
    if (isHangulSyllable(character)) {
      cursorX += drawHangulGlyph(buffer, width, height, cursorX, y, character, color, scale) * scale + scale;
      continue;
    }

    const glyphKey = /[a-z]/.test(character) ? character.toUpperCase() : character;
    const glyph = FONT_5X7[glyphKey] || FONT_5X7["?"];
    drawBitmap(buffer, width, height, cursorX, y, glyph, color, scale);
    cursorX += (glyphWidth() + 1) * scale;
  }
}

function drawLegendItem(buffer, width, height, x, y, color, label) {
  fillRect(buffer, width, height, x, y + 4, 16, 6, color);
  drawText(buffer, width, height, x + 24, y, label, [51, 65, 85, 255], 2);
  return x + 24 + measureText(label, 2) + 22;
}

function drawValueCallout(buffer, width, height, rightEdge, y, label, theme, panelTop, panelHeight) {
  const paddingX = 8;
  const boxHeight = 24;
  const boxWidth = measureText(label, 2) + paddingX * 2;
  const boxLeft = rightEdge - boxWidth;
  const boxTop = clamp(Math.round(y - boxHeight / 2), panelTop + 4, panelTop + panelHeight - boxHeight - 4);
  const fillColor = [255, 255, 255, 230];

  fillRect(buffer, width, height, boxLeft, boxTop, boxWidth, boxHeight, fillColor);
  drawLine(buffer, width, height, boxLeft, boxTop, boxLeft + boxWidth, boxTop, theme.border, 1);
  drawLine(buffer, width, height, boxLeft, boxTop + boxHeight, boxLeft + boxWidth, boxTop + boxHeight, theme.border, 1);
  drawLine(buffer, width, height, boxLeft, boxTop, boxLeft, boxTop + boxHeight, theme.border, 1);
  drawLine(buffer, width, height, boxLeft + boxWidth, boxTop, boxLeft + boxWidth, boxTop + boxHeight, theme.border, 1);
  drawText(buffer, width, height, boxLeft + paddingX, boxTop + 4, label, theme.close, 2);
}

function drawCandlesticks(buffer, width, height, bars, xForSlot, minValue, maxValue, top, panelHeight, theme) {
  const candleWidth = Math.max(4, Math.floor((width * 0.00042)));
  bars.forEach((bar, index) => {
    if (!Number.isFinite(bar.open) || !Number.isFinite(bar.high) || !Number.isFinite(bar.low) || !Number.isFinite(bar.close)) {
      return;
    }

    const x = xForSlot(index);
    const highY = valueToY(bar.high, minValue, maxValue, top, panelHeight);
    const lowY = valueToY(bar.low, minValue, maxValue, top, panelHeight);
    const openY = valueToY(bar.open, minValue, maxValue, top, panelHeight);
    const closeY = valueToY(bar.close, minValue, maxValue, top, panelHeight);
    const isUp = bar.close >= bar.open;
    const wickColor = isUp ? theme.candleUp : theme.candleDown;
    const bodyColor = isUp ? theme.candleUpFill : theme.candleDownFill;
    const bodyTop = Math.min(openY, closeY);
    const bodyBottom = Math.max(openY, closeY);
    const bodyHeight = Math.max(2, Math.round(bodyBottom - bodyTop));

    drawLine(buffer, width, height, x, highY, x, lowY, wickColor, 1);
    fillRect(
      buffer,
      width,
      height,
      x - Math.floor(candleWidth / 2),
      Math.round(bodyTop),
      candleWidth,
      bodyHeight,
      bodyColor,
    );
    drawLine(
      buffer,
      width,
      height,
      x - Math.floor(candleWidth / 2),
      Math.round(bodyTop),
      x + Math.floor(candleWidth / 2),
      Math.round(bodyTop),
      wickColor,
      1,
    );
    drawLine(
      buffer,
      width,
      height,
      x - Math.floor(candleWidth / 2),
      Math.round(bodyTop + bodyHeight),
      x + Math.floor(candleWidth / 2),
      Math.round(bodyTop + bodyHeight),
      wickColor,
      1,
    );
  });
}

function buildCrcTable() {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let current = index;
    for (let bit = 0; bit < 8; bit += 1) {
      if (current & 1) {
        current = 0xedb88320 ^ (current >>> 1);
      } else {
        current >>>= 1;
      }
    }
    table[index] = current >>> 0;
  }
  return table;
}

const CRC_TABLE = buildCrcTable();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index += 1) {
    crc = CRC_TABLE[(crc ^ buffer[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function encodePng(width, height, rgbaBuffer) {
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let row = 0; row < height; row += 1) {
    const rawOffset = row * (stride + 1);
    raw[rawOffset] = 0;
    rgbaBuffer.copy(raw, rawOffset + 1, row * stride, row * stride + stride);
  }

  return Buffer.concat([
    header,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", zlib.deflateSync(raw)),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pickTickIndices(length, count) {
  if (length <= 0) {
    return [];
  }
  const target = Math.min(count, length);
  const indices = new Set([0, length - 1]);
  if (target > 2) {
    for (let slot = 1; slot < target - 1; slot += 1) {
      indices.add(Math.round((slot * (length - 1)) / (target - 1)));
    }
  }
  return [...indices].sort((a, b) => a - b);
}

function dateLabel(dateString) {
  return dateString.slice(5);
}

function valueToY(value, minValue, maxValue, top, height) {
  return top + ((maxValue - value) / (maxValue - minValue)) * height;
}

function nonNullPoint(x, value, minValue, maxValue, top, height) {
  if (!Number.isFinite(value)) {
    return null;
  }
  return {
    x,
    y: valueToY(value, minValue, maxValue, top, height),
  };
}

function mapSeriesToPoints(series, xForSlot, slotOffset, minValue, maxValue, top, height, totalSlots) {
  const points = Array.from({ length: totalSlots }, () => null);
  series.forEach((value, index) => {
    const slot = index + slotOffset;
    if (slot >= 0 && slot < totalSlots && Number.isFinite(value)) {
      points[slot] = nonNullPoint(xForSlot(slot), value, minValue, maxValue, top, height);
    }
  });
  return points;
}

function appendSuffixToPath(targetPath, suffix) {
  const extension = path.extname(targetPath);
  if (extension) {
    return `${targetPath.slice(0, -extension.length)}-${suffix}${extension}`;
  }
  return `${targetPath}-${suffix}.png`;
}

function buildChartPngs(data, bars, metrics, options) {
  const width = options.width;
  const height = options.height;
  const chartBars = Math.max(30, options.chartBars);
  const barsWindow = bars.slice(-Math.min(chartBars, bars.length));
  const startIndex = bars.length - barsWindow.length;
  const leadSlots = 26;
  const totalSlots = barsWindow.length + leadSlots;

  const theme = {
    background: [248, 250, 252, 255],
    panel: [255, 255, 255, 255],
    border: [203, 213, 225, 255],
    grid: [226, 232, 240, 255],
    text: [30, 41, 59, 255],
    muted: [100, 116, 139, 255],
    close: [30, 64, 175, 255],
    lastPriceGuide: [30, 64, 175, 110],
    candleUp: [220, 38, 38, 255],
    candleUpFill: [248, 113, 113, 180],
    candleDown: [37, 99, 235, 255],
    candleDownFill: [96, 165, 250, 180],
    ma5: [34, 197, 94, 255],
    ma20: [239, 68, 68, 255],
    ma60: [249, 115, 22, 255],
    ma120: [147, 51, 234, 255],
    bollinger: [15, 23, 42, 255],
    bollingerFill: [15, 23, 42, 28],
    tenkan: [192, 38, 211, 255],
    kijun: [217, 119, 6, 255],
    senkouA: [34, 197, 94, 220],
    senkouB: [239, 68, 68, 220],
    cloudBull: [34, 197, 94, 42],
    cloudBear: [239, 68, 68, 42],
    volumeUp: [34, 197, 94, 255],
    volumeDown: [239, 68, 68, 255],
    rsi: [124, 58, 237, 255],
    rsiGuide: [148, 163, 184, 255],
    macd: [37, 99, 235, 255],
    signal: [249, 115, 22, 255],
    histogramPositive: [34, 197, 94, 220],
    histogramNegative: [239, 68, 68, 220],
    zeroGuide: [148, 163, 184, 255],
    adx: [30, 41, 59, 255],
    plusDi: [34, 197, 94, 255],
    minusDi: [239, 68, 68, 255],
    adxGuide: [148, 163, 184, 255],
  };

  const margin = { left: 100, right: 120, top: 84, bottom: 78 };
  const plotWidth = width - margin.left - margin.right;
  const headerHeight = 92;
  const gap = 26;
  const basePlotHeight = height - margin.top - margin.bottom - headerHeight;
  const dualPanelHeight = basePlotHeight - gap;
  const mainVolumeHeight = Math.max(90, Math.min(150, Math.round(dualPanelHeight * 0.22)));
  const mainPriceHeight = dualPanelHeight - mainVolumeHeight;
  const overlayRsiHeight = Math.max(90, Math.min(150, Math.round(dualPanelHeight * 0.22)));
  const overlayPriceHeight = dualPanelHeight - overlayRsiHeight;
  const momentumHistogramHeight = Math.max(80, Math.min(120, Math.round(dualPanelHeight * 0.22)));
  const momentumAdxHeight = Math.max(90, Math.min(140, Math.round(dualPanelHeight * 0.28)));
  const momentumLineHeight = dualPanelHeight - momentumHistogramHeight - momentumAdxHeight - gap;

  const priceSeries = {
    close: barsWindow.map((bar) => bar.close),
    ma5: metrics.ma5Series.slice(startIndex),
    ma20: metrics.ma20Series.slice(startIndex),
    ma60: metrics.ma60Series.slice(startIndex),
    ma120: metrics.ma120Series.slice(startIndex),
    bbUpper: metrics.bollingerSeriesData.upper.slice(startIndex),
    bbLower: metrics.bollingerSeriesData.lower.slice(startIndex),
    tenkan: metrics.ichimokuSeriesData.tenkan.slice(startIndex),
    kijun: metrics.ichimokuSeriesData.kijun.slice(startIndex),
    macd: metrics.macdSeriesData.macd.slice(startIndex),
    signal: metrics.macdSeriesData.signal.slice(startIndex),
    histogram: metrics.macdSeriesData.histogram.slice(startIndex),
    adx: metrics.adxSeriesData.adx.slice(startIndex),
    plusDi: metrics.adxSeriesData.plusDi.slice(startIndex),
    minusDi: metrics.adxSeriesData.minusDi.slice(startIndex),
  };

  const volumeMax = Math.max(...barsWindow.map((bar) => (Number.isFinite(bar.volume) ? bar.volume : 0)), 1);
  const buildPriceRange = (seriesCollection) => {
    const values = [];
    barsWindow.forEach((bar) => {
      ["high", "low", "close"].forEach((key) => {
        if (Number.isFinite(bar[key])) {
          values.push(bar[key]);
        }
      });
    });
    seriesCollection.forEach((series) => {
      series.forEach((value) => {
        if (Number.isFinite(value)) {
          values.push(value);
        }
      });
    });
    let priceMin = Math.min(...values);
    let priceMax = Math.max(...values);
    if (priceMin === priceMax) {
      priceMin -= 1;
      priceMax += 1;
    }
    const pricePadding = (priceMax - priceMin) * 0.08;
    return {
      min: priceMin - pricePadding,
      max: priceMax + pricePadding,
    };
  };

  const drawPriceAxis = (buffer, panelTop, panelHeight, priceMin, priceMax) => {
    for (let tick = 0; tick <= 4; tick += 1) {
      const y = panelTop + (panelHeight * tick) / 4;
      drawLine(buffer, width, height, margin.left, y, margin.left + plotWidth, y, theme.grid, 1);
      const value = priceMax - ((priceMax - priceMin) * tick) / 4;
      drawText(buffer, width, height, margin.left + plotWidth + 10, y - 7, formatAxisNumber(value), theme.muted, 2);
    }
  };

  const drawVolumeAxis = (buffer, panelTop, panelHeight) => {
    for (let tick = 0; tick <= 2; tick += 1) {
      const y = panelTop + (panelHeight * tick) / 2;
      drawLine(buffer, width, height, margin.left, y, margin.left + plotWidth, y, theme.grid, 1);
      const value = Math.round(volumeMax - (volumeMax * tick) / 2);
      drawText(buffer, width, height, margin.left + plotWidth + 10, y - 7, formatAxisNumber(value), theme.muted, 2);
    }
  };

  const drawRsiAxis = (buffer, panelTop, panelHeight) => {
    [30, 50, 70].forEach((level) => {
      const y = valueToY(level, 0, 100, panelTop, panelHeight);
      drawLine(buffer, width, height, margin.left, y, margin.left + plotWidth, y, theme.rsiGuide, 1);
      drawText(buffer, width, height, margin.left + plotWidth + 10, y - 7, String(level), theme.muted, 2);
    });
  };

  const drawAdxAxis = (buffer, panelTop, panelHeight) => {
    [20, 25, 40].forEach((level) => {
      const y = valueToY(level, 0, 60, panelTop, panelHeight);
      drawLine(buffer, width, height, margin.left, y, margin.left + plotWidth, y, theme.adxGuide, 1);
      drawText(buffer, width, height, margin.left + plotWidth + 10, y - 7, String(level), theme.muted, 2);
    });
  };

  const buildIndicatorRange = (seriesCollection, options = {}) => {
    const values = [];
    seriesCollection.forEach((series) => {
      series.forEach((value) => {
        if (Number.isFinite(value)) {
          values.push(value);
        }
      });
    });
    if (options.includeZero) {
      values.push(0);
    }
    if (values.length === 0) {
      return { min: -1, max: 1 };
    }
    let minValue = Math.min(...values);
    let maxValue = Math.max(...values);
    if (minValue === maxValue) {
      minValue -= 1;
      maxValue += 1;
    }
    const padding = (maxValue - minValue) * 0.12;
    return {
      min: minValue - padding,
      max: maxValue + padding,
    };
  };

  const drawZeroGuide = (buffer, panelTop, panelHeight, range, color = theme.zeroGuide) => {
    if (!(range.min <= 0 && range.max >= 0)) {
      return;
    }
    const y = valueToY(0, range.min, range.max, panelTop, panelHeight);
    drawLine(buffer, width, height, margin.left, y, margin.left + plotWidth, y, color, 1);
    drawText(buffer, width, height, margin.left + plotWidth + 10, y - 7, "0", theme.muted, 2);
  };

  const drawDateTicks = (buffer, xForSlot, chartBottom, labelBottom, totalSlotsForGrid) => {
    const dateTickIndices = pickTickIndices(barsWindow.length, 6);
    dateTickIndices.forEach((index) => {
      const x = xForSlot(index);
      drawLine(buffer, width, height, x, margin.top + headerHeight, x, chartBottom, theme.grid, 1);
      drawText(buffer, width, height, x, labelBottom, dateLabel(barsWindow[index].date), theme.muted, 2, "center");
    });
    if (totalSlotsForGrid > barsWindow.length) {
      const latestX = xForSlot(barsWindow.length - 1);
      drawLine(buffer, width, height, latestX, margin.top + headerHeight, latestX, chartBottom, theme.border, 1);
    }
  };

  const writePng = (outputPath, rgbaBuffer) => {
    const png = encodePng(width, height, rgbaBuffer);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, png);
  };

  const chartPaths = {
    mainOutput: path.resolve(options.pngOut),
    overlayOutput: path.resolve(appendSuffixToPath(options.pngOut, "overlay")),
    momentumOutput: path.resolve(appendSuffixToPath(options.pngOut, "momentum")),
    mainImagePath: options.imagePath || path.basename(options.pngOut),
    overlayImagePath: options.imagePath
      ? appendSuffixToPath(options.imagePath, "overlay")
      : appendSuffixToPath(path.basename(options.pngOut), "overlay"),
    momentumImagePath: options.imagePath
      ? appendSuffixToPath(options.imagePath, "momentum")
      : appendSuffixToPath(path.basename(options.pngOut), "momentum"),
  };

  const buildMomentumChart = () => {
    const buffer = createRgbaBuffer(width, height, theme.background);
    const totalSlotsForMomentum = barsWindow.length;
    const chartTitle = String(data.name || data.ticker || "UNKNOWN");
    const xForSlot = (slot) => {
      if (totalSlotsForMomentum <= 1) {
        return margin.left + plotWidth / 2;
      }
      return margin.left + (plotWidth * slot) / (totalSlotsForMomentum - 1);
    };

    const macdTop = margin.top + headerHeight;
    const histogramTop = macdTop + momentumLineHeight + gap;
    const adxTop = histogramTop + momentumHistogramHeight + gap;
    const macdRange = buildIndicatorRange([priceSeries.macd, priceSeries.signal], { includeZero: true });
    const histogramRange = buildIndicatorRange([priceSeries.histogram], { includeZero: true });
    const adxRange = { min: 0, max: 60 };

    fillRect(buffer, width, height, margin.left, macdTop, plotWidth, momentumLineHeight, theme.panel);
    fillRect(buffer, width, height, margin.left, histogramTop, plotWidth, momentumHistogramHeight, theme.panel);
    fillRect(buffer, width, height, margin.left, adxTop, plotWidth, momentumAdxHeight, theme.panel);

    drawLine(buffer, width, height, margin.left, macdTop, margin.left + plotWidth, macdTop, theme.border, 1);
    drawLine(buffer, width, height, margin.left, macdTop + momentumLineHeight, margin.left + plotWidth, macdTop + momentumLineHeight, theme.border, 1);
    drawLine(buffer, width, height, margin.left, histogramTop, margin.left + plotWidth, histogramTop, theme.border, 1);
    drawLine(buffer, width, height, margin.left, histogramTop + momentumHistogramHeight, margin.left + plotWidth, histogramTop + momentumHistogramHeight, theme.border, 1);
    drawLine(buffer, width, height, margin.left, adxTop, margin.left + plotWidth, adxTop, theme.border, 1);
    drawLine(buffer, width, height, margin.left, adxTop + momentumAdxHeight, margin.left + plotWidth, adxTop + momentumAdxHeight, theme.border, 1);
    drawLine(buffer, width, height, margin.left, macdTop, margin.left, adxTop + momentumAdxHeight, theme.border, 1);
    drawLine(buffer, width, height, margin.left + plotWidth, macdTop, margin.left + plotWidth, adxTop + momentumAdxHeight, theme.border, 1);

    drawText(buffer, width, height, margin.left, margin.top + 4, chartTitle, theme.text, 3);
    drawText(buffer, width, height, margin.left, margin.top + 34, `${data.ticker || "UNKNOWN"} MACD 모멘텀`, theme.muted, 2);
    drawText(buffer, width, height, margin.left + plotWidth, margin.top + 10, `기준일 ${metrics.latest.date}`, theme.muted, 2, "right");

    let legendX = margin.left;
    const legendY = margin.top + 56;
    legendX = drawLegendItem(buffer, width, height, legendX, legendY, theme.macd, "MACD");
    legendX = drawLegendItem(buffer, width, height, legendX, legendY, theme.signal, "Signal");
    legendX = drawLegendItem(buffer, width, height, legendX, legendY, theme.histogramPositive, "Histogram +");
    legendX = drawLegendItem(buffer, width, height, legendX, legendY, theme.histogramNegative, "Histogram -");
    legendX = drawLegendItem(buffer, width, height, legendX, legendY, theme.adx, "ADX");
    legendX = drawLegendItem(buffer, width, height, legendX, legendY, theme.plusDi, "+DI");
    drawLegendItem(buffer, width, height, legendX, legendY, theme.minusDi, "-DI");

    drawText(buffer, width, height, margin.left - 56, macdTop + 6, "MACD", theme.muted, 2);
    drawText(buffer, width, height, margin.left - 86, histogramTop + 6, "Histogram", theme.muted, 2);
    drawText(buffer, width, height, margin.left - 60, adxTop + 6, "ADX/DMI", theme.muted, 2);

    drawPriceAxis(buffer, macdTop, momentumLineHeight, macdRange.min, macdRange.max);
    drawPriceAxis(buffer, histogramTop, momentumHistogramHeight, histogramRange.min, histogramRange.max);
    drawAdxAxis(buffer, adxTop, momentumAdxHeight);
    drawZeroGuide(buffer, macdTop, momentumLineHeight, macdRange);
    drawZeroGuide(buffer, histogramTop, momentumHistogramHeight, histogramRange);
    drawDateTicks(buffer, xForSlot, adxTop + momentumAdxHeight, adxTop + momentumAdxHeight + 14, totalSlotsForMomentum);
    drawText(buffer, width, height, margin.left + plotWidth / 2, adxTop + momentumAdxHeight + 42, "날짜", theme.muted, 2, "center");

    const macdPoints = mapSeriesToPoints(priceSeries.macd, xForSlot, 0, macdRange.min, macdRange.max, macdTop, momentumLineHeight, totalSlotsForMomentum);
    const signalPoints = mapSeriesToPoints(priceSeries.signal, xForSlot, 0, macdRange.min, macdRange.max, macdTop, momentumLineHeight, totalSlotsForMomentum);
    const histogramPoints = mapSeriesToPoints(
      priceSeries.histogram,
      xForSlot,
      0,
      histogramRange.min,
      histogramRange.max,
      histogramTop,
      momentumHistogramHeight,
      totalSlotsForMomentum,
    );
    const adxPoints = mapSeriesToPoints(priceSeries.adx, xForSlot, 0, adxRange.min, adxRange.max, adxTop, momentumAdxHeight, totalSlotsForMomentum);
    const plusDiPoints = mapSeriesToPoints(priceSeries.plusDi, xForSlot, 0, adxRange.min, adxRange.max, adxTop, momentumAdxHeight, totalSlotsForMomentum);
    const minusDiPoints = mapSeriesToPoints(priceSeries.minusDi, xForSlot, 0, adxRange.min, adxRange.max, adxTop, momentumAdxHeight, totalSlotsForMomentum);
    const histogramZeroY = valueToY(0, histogramRange.min, histogramRange.max, histogramTop, momentumHistogramHeight);

    const histogramBarWidth = Math.max(4, Math.floor(plotWidth / Math.max(totalSlotsForMomentum * 1.9, 1)));
    priceSeries.histogram.forEach((value, index) => {
      const point = histogramPoints[index];
      if (!point || !Number.isFinite(value)) {
        return;
      }
      const topY = Math.min(point.y, histogramZeroY);
      const barHeight = Math.max(2, Math.abs(point.y - histogramZeroY));
      fillRect(
        buffer,
        width,
        height,
        point.x - histogramBarWidth / 2,
        topY,
        histogramBarWidth,
        barHeight,
        value >= 0 ? theme.histogramPositive : theme.histogramNegative,
      );
    });

    drawSeries(buffer, width, height, macdPoints, theme.macd, 3);
    drawSeries(buffer, width, height, signalPoints, theme.signal, 3);
    drawSeries(buffer, width, height, adxPoints, theme.adx, 3);
    drawSeries(buffer, width, height, plusDiPoints, theme.plusDi, 2);
    drawSeries(buffer, width, height, minusDiPoints, theme.minusDi, 2);

    const latestMacdPoint = macdPoints[barsWindow.length - 1];
    if (latestMacdPoint) {
      fillRect(buffer, width, height, latestMacdPoint.x - 4, latestMacdPoint.y - 4, 8, 8, theme.macd);
      drawValueCallout(
        buffer,
        width,
        height,
        margin.left + plotWidth - 8,
        latestMacdPoint.y,
        `MACD ${formatAxisNumber(metrics.macd.macdValue)}`,
        theme,
        macdTop,
        momentumLineHeight,
      );
    }

    const latestSignalPoint = signalPoints[barsWindow.length - 1];
    if (latestSignalPoint) {
      fillRect(buffer, width, height, latestSignalPoint.x - 4, latestSignalPoint.y - 4, 8, 8, theme.signal);
    }

    const latestAdxPoint = adxPoints[barsWindow.length - 1];
    if (latestAdxPoint) {
      fillRect(buffer, width, height, latestAdxPoint.x - 4, latestAdxPoint.y - 4, 8, 8, theme.adx);
    }

    writePng(chartPaths.momentumOutput, buffer);
  };

  const buildMainTrendChart = () => {
    const buffer = createRgbaBuffer(width, height, theme.background);
    const totalSlotsForMain = barsWindow.length;
    const chartTitle = String(data.name || data.ticker || "UNKNOWN");
    const xForSlot = (slot) => {
      if (totalSlotsForMain <= 1) {
        return margin.left + plotWidth / 2;
      }
      return margin.left + (plotWidth * slot) / (totalSlotsForMain - 1);
    };

    const priceTop = margin.top + headerHeight;
    const volumeTop = priceTop + mainPriceHeight + gap;
    const priceRange = buildPriceRange([
      priceSeries.close,
      priceSeries.ma5,
      priceSeries.ma20,
      priceSeries.ma60,
      priceSeries.ma120,
    ]);

    fillRect(buffer, width, height, margin.left, priceTop, plotWidth, mainPriceHeight, theme.panel);
    fillRect(buffer, width, height, margin.left, volumeTop, plotWidth, mainVolumeHeight, theme.panel);

    drawLine(buffer, width, height, margin.left, priceTop, margin.left + plotWidth, priceTop, theme.border, 1);
    drawLine(buffer, width, height, margin.left, priceTop + mainPriceHeight, margin.left + plotWidth, priceTop + mainPriceHeight, theme.border, 1);
    drawLine(buffer, width, height, margin.left, volumeTop, margin.left + plotWidth, volumeTop, theme.border, 1);
    drawLine(buffer, width, height, margin.left, volumeTop + mainVolumeHeight, margin.left + plotWidth, volumeTop + mainVolumeHeight, theme.border, 1);
    drawLine(buffer, width, height, margin.left, priceTop, margin.left, volumeTop + mainVolumeHeight, theme.border, 1);
    drawLine(buffer, width, height, margin.left + plotWidth, priceTop, margin.left + plotWidth, volumeTop + mainVolumeHeight, theme.border, 1);

    drawText(buffer, width, height, margin.left, margin.top + 4, chartTitle, theme.text, 3);
    drawText(buffer, width, height, margin.left, margin.top + 34, `${data.ticker || "UNKNOWN"} 주가 추세`, theme.muted, 2);
    drawText(buffer, width, height, margin.left + plotWidth, margin.top + 10, `기준일 ${metrics.latest.date}`, theme.muted, 2, "right");

    const legendY = margin.top + 56;
    let legendX = margin.left;
    legendX = drawLegendItem(buffer, width, height, legendX, legendY, theme.candleUpFill, "캔들");
    legendX = drawLegendItem(buffer, width, height, legendX, legendY, theme.close, "종가선");
    legendX = drawLegendItem(buffer, width, height, legendX, legendY, theme.ma5, "5일선");
    legendX = drawLegendItem(buffer, width, height, legendX, legendY, theme.ma20, "20일선");
    legendX = drawLegendItem(buffer, width, height, legendX, legendY, theme.ma60, "60일선");
    drawLegendItem(buffer, width, height, legendX, legendY, theme.ma120, "120일선");

    drawText(buffer, width, height, margin.left - 54, priceTop + 6, "주가", theme.muted, 2);
    drawText(buffer, width, height, margin.left - 72, volumeTop + 6, "거래량", theme.muted, 2);

    drawPriceAxis(buffer, priceTop, mainPriceHeight, priceRange.min, priceRange.max);
    drawVolumeAxis(buffer, volumeTop, mainVolumeHeight);
    drawDateTicks(buffer, xForSlot, volumeTop + mainVolumeHeight, volumeTop + mainVolumeHeight + 14, totalSlotsForMain);
    drawText(buffer, width, height, margin.left + plotWidth / 2, volumeTop + mainVolumeHeight + 42, "날짜", theme.muted, 2, "center");

    const closePoints = mapSeriesToPoints(priceSeries.close, xForSlot, 0, priceRange.min, priceRange.max, priceTop, mainPriceHeight, totalSlotsForMain);
    const ma5Points = mapSeriesToPoints(priceSeries.ma5, xForSlot, 0, priceRange.min, priceRange.max, priceTop, mainPriceHeight, totalSlotsForMain);
    const ma20Points = mapSeriesToPoints(priceSeries.ma20, xForSlot, 0, priceRange.min, priceRange.max, priceTop, mainPriceHeight, totalSlotsForMain);
    const ma60Points = mapSeriesToPoints(priceSeries.ma60, xForSlot, 0, priceRange.min, priceRange.max, priceTop, mainPriceHeight, totalSlotsForMain);
    const ma120Points = mapSeriesToPoints(priceSeries.ma120, xForSlot, 0, priceRange.min, priceRange.max, priceTop, mainPriceHeight, totalSlotsForMain);

    drawCandlesticks(buffer, width, height, barsWindow, xForSlot, priceRange.min, priceRange.max, priceTop, mainPriceHeight, theme);
    drawSeries(buffer, width, height, closePoints, theme.close, 1);
    drawSeries(buffer, width, height, ma120Points, theme.ma120, 2);
    drawSeries(buffer, width, height, ma60Points, theme.ma60, 2);
    drawSeries(buffer, width, height, ma20Points, theme.ma20, 2);
    drawSeries(buffer, width, height, ma5Points, theme.ma5, 2);

    const latestClosePoint = closePoints[barsWindow.length - 1];
    if (latestClosePoint) {
      drawLine(
        buffer,
        width,
        height,
        margin.left,
        latestClosePoint.y,
        margin.left + plotWidth,
        latestClosePoint.y,
        theme.lastPriceGuide,
        1,
      );
      fillRect(buffer, width, height, latestClosePoint.x - 4, latestClosePoint.y - 4, 8, 8, theme.close);
      drawValueCallout(
        buffer,
        width,
        height,
        margin.left + plotWidth - 8,
        latestClosePoint.y,
        `현재가 ${formatAxisNumber(metrics.latestClose)}`,
        theme,
        priceTop,
        mainPriceHeight,
      );
    }

    const volumeBarWidth = Math.max(3, Math.floor(plotWidth / Math.max(barsWindow.length * 1.8, 1)));
    barsWindow.forEach((bar, index) => {
      if (!Number.isFinite(bar.volume)) {
        return;
      }
      const x = xForSlot(index);
      const previousClose = index === 0 ? bar.close : barsWindow[index - 1].close;
      const color = bar.close >= previousClose ? theme.volumeUp : theme.volumeDown;
      const barHeight = Math.max(2, Math.round((bar.volume / volumeMax) * (mainVolumeHeight - 4)));
      fillRect(buffer, width, height, x - volumeBarWidth / 2, volumeTop + mainVolumeHeight - barHeight, volumeBarWidth, barHeight, color);
    });

    writePng(chartPaths.mainOutput, buffer);
  };

  const buildOverlayChart = () => {
    const buffer = createRgbaBuffer(width, height, theme.background);
    const chartTitle = String(data.name || data.ticker || "UNKNOWN");
    const xForSlot = (slot) => {
      if (totalSlots <= 1) {
        return margin.left + plotWidth / 2;
      }
      return margin.left + (plotWidth * slot) / (totalSlots - 1);
    };

    const priceTop = margin.top + headerHeight;
    const rsiTop = priceTop + overlayPriceHeight + gap;
    const priceRange = buildPriceRange([
      priceSeries.close,
      priceSeries.bbUpper,
      priceSeries.bbLower,
      priceSeries.tenkan,
      priceSeries.kijun,
      metrics.ichimokuSeriesData.senkouA.slice(startIndex),
      metrics.ichimokuSeriesData.senkouB.slice(startIndex),
    ]);

    fillRect(buffer, width, height, margin.left, priceTop, plotWidth, overlayPriceHeight, theme.panel);
    fillRect(buffer, width, height, margin.left, rsiTop, plotWidth, overlayRsiHeight, theme.panel);

    drawLine(buffer, width, height, margin.left, priceTop, margin.left + plotWidth, priceTop, theme.border, 1);
    drawLine(buffer, width, height, margin.left, priceTop + overlayPriceHeight, margin.left + plotWidth, priceTop + overlayPriceHeight, theme.border, 1);
    drawLine(buffer, width, height, margin.left, rsiTop, margin.left + plotWidth, rsiTop, theme.border, 1);
    drawLine(buffer, width, height, margin.left, rsiTop + overlayRsiHeight, margin.left + plotWidth, rsiTop + overlayRsiHeight, theme.border, 1);
    drawLine(buffer, width, height, margin.left, priceTop, margin.left, rsiTop + overlayRsiHeight, theme.border, 1);
    drawLine(buffer, width, height, margin.left + plotWidth, priceTop, margin.left + plotWidth, rsiTop + overlayRsiHeight, theme.border, 1);

    drawText(buffer, width, height, margin.left, margin.top + 4, chartTitle, theme.text, 3);
    drawText(buffer, width, height, margin.left, margin.top + 34, `${data.ticker || "UNKNOWN"} 보조지표`, theme.muted, 2);
    drawText(buffer, width, height, margin.left + plotWidth, margin.top + 10, `기준일 ${metrics.latest.date}`, theme.muted, 2, "right");

    const legendRow1Y = margin.top + 52;
    const legendRow2Y = margin.top + 72;
    let legendX = margin.left;
    legendX = drawLegendItem(buffer, width, height, legendX, legendRow1Y, theme.close, "종가선");
    legendX = drawLegendItem(buffer, width, height, legendX, legendRow1Y, theme.bollinger, "볼린저밴드");
    legendX = drawLegendItem(buffer, width, height, legendX, legendRow1Y, theme.tenkan, "전환선");
    drawLegendItem(buffer, width, height, legendX, legendRow1Y, theme.kijun, "기준선");

    legendX = margin.left;
    legendX = drawLegendItem(buffer, width, height, legendX, legendRow2Y, theme.senkouA, "일목 선행1");
    drawLegendItem(buffer, width, height, legendX, legendRow2Y, theme.senkouB, "일목 선행2");

    drawText(buffer, width, height, margin.left - 54, priceTop + 6, "주가", theme.muted, 2);
    drawText(buffer, width, height, margin.left - 86, rsiTop + 6, "상대강도", theme.muted, 2);

    drawPriceAxis(buffer, priceTop, overlayPriceHeight, priceRange.min, priceRange.max);
    drawRsiAxis(buffer, rsiTop, overlayRsiHeight);
    drawDateTicks(buffer, xForSlot, rsiTop + overlayRsiHeight, rsiTop + overlayRsiHeight + 14, totalSlots);
    drawText(buffer, width, height, margin.left + plotWidth / 2, rsiTop + overlayRsiHeight + 42, "날짜", theme.muted, 2, "center");

    const closePoints = mapSeriesToPoints(priceSeries.close, xForSlot, 0, priceRange.min, priceRange.max, priceTop, overlayPriceHeight, totalSlots);
    const bbUpperPoints = mapSeriesToPoints(priceSeries.bbUpper, xForSlot, 0, priceRange.min, priceRange.max, priceTop, overlayPriceHeight, totalSlots);
    const bbLowerPoints = mapSeriesToPoints(priceSeries.bbLower, xForSlot, 0, priceRange.min, priceRange.max, priceTop, overlayPriceHeight, totalSlots);
    const tenkanPoints = mapSeriesToPoints(priceSeries.tenkan, xForSlot, 0, priceRange.min, priceRange.max, priceTop, overlayPriceHeight, totalSlots);
    const kijunPoints = mapSeriesToPoints(priceSeries.kijun, xForSlot, 0, priceRange.min, priceRange.max, priceTop, overlayPriceHeight, totalSlots);
    const senkouAPoints = mapSeriesToPoints(metrics.ichimokuSeriesData.senkouA.slice(startIndex), xForSlot, 26, priceRange.min, priceRange.max, priceTop, overlayPriceHeight, totalSlots);
    const senkouBPoints = mapSeriesToPoints(metrics.ichimokuSeriesData.senkouB.slice(startIndex), xForSlot, 26, priceRange.min, priceRange.max, priceTop, overlayPriceHeight, totalSlots);
    const rsiPoints = mapSeriesToPoints(metrics.rsi14Series.slice(startIndex), xForSlot, 0, 0, 100, rsiTop, overlayRsiHeight, totalSlots);

    drawFilledBand(buffer, width, height, bbUpperPoints, bbLowerPoints, theme.bollingerFill);

    const cloudUpperPoints = [];
    const cloudLowerPoints = [];
    const cloudColors = [];
    for (let index = 0; index < totalSlots; index += 1) {
      const aPoint = senkouAPoints[index];
      const bPoint = senkouBPoints[index];
      if (aPoint && bPoint) {
        cloudUpperPoints[index] = aPoint.y <= bPoint.y ? aPoint : bPoint;
        cloudLowerPoints[index] = aPoint.y > bPoint.y ? aPoint : bPoint;
        cloudColors[index] = aPoint.y <= bPoint.y ? theme.cloudBull : theme.cloudBear;
      } else {
        cloudUpperPoints[index] = null;
        cloudLowerPoints[index] = null;
        cloudColors[index] = null;
      }
    }

    for (let index = 0; index < totalSlots; index += 1) {
      if (cloudUpperPoints[index] && cloudLowerPoints[index]) {
        drawVerticalBand(
          buffer,
          width,
          height,
          Math.round(cloudUpperPoints[index].x),
          cloudUpperPoints[index].y,
          cloudLowerPoints[index].y,
          cloudColors[index],
          3,
        );
      }
    }

    drawSeries(buffer, width, height, bbUpperPoints, theme.bollinger, 2);
    drawSeries(buffer, width, height, bbLowerPoints, theme.bollinger, 2);
    drawSeries(buffer, width, height, senkouAPoints, theme.senkouA, 2);
    drawSeries(buffer, width, height, senkouBPoints, theme.senkouB, 2);
    drawSeries(buffer, width, height, tenkanPoints, theme.tenkan, 2);
    drawSeries(buffer, width, height, kijunPoints, theme.kijun, 2);
    drawSeries(buffer, width, height, closePoints, theme.close, 3);
    drawSeries(buffer, width, height, rsiPoints, theme.rsi, 3);

    const latestClosePoint = closePoints[barsWindow.length - 1];
    if (latestClosePoint) {
      drawLine(
        buffer,
        width,
        height,
        margin.left,
        latestClosePoint.y,
        margin.left + plotWidth,
        latestClosePoint.y,
        theme.lastPriceGuide,
        1,
      );
      fillRect(buffer, width, height, latestClosePoint.x - 4, latestClosePoint.y - 4, 8, 8, theme.close);
      drawValueCallout(
        buffer,
        width,
        height,
        margin.left + plotWidth - 8,
        latestClosePoint.y,
        `현재가 ${formatAxisNumber(metrics.latestClose)}`,
        theme,
        priceTop,
        overlayPriceHeight,
      );
    }

    const latestRsiPoint = rsiPoints[barsWindow.length - 1];
    if (latestRsiPoint) {
      fillRect(buffer, width, height, latestRsiPoint.x - 4, latestRsiPoint.y - 4, 8, 8, theme.rsi);
    }

    writePng(chartPaths.overlayOutput, buffer);
  };

  buildMainTrendChart();
  buildOverlayChart();
  buildMomentumChart();

  return {
    imagePaths: {
      main: chartPaths.mainImagePath,
      overlay: chartPaths.overlayImagePath,
      momentum: chartPaths.momentumImagePath,
    },
    chartBarsUsed: barsWindow.length,
    leadBarsUsed: leadSlots,
  };
}

function renderRead(metrics) {
  const formatLevel = (value) => (Number.isFinite(value) ? formatAxisNumber(value) : "n/a");
  const aboveLevels = ([
    metrics.ichimoku.tenkan,
    metrics.ma20Value,
    metrics.ichimoku.kijun,
    metrics.breakoutLevel,
    metrics.ichimoku.currentCloudA,
    metrics.ichimoku.currentCloudB,
  ])
    .filter((value) => Number.isFinite(value) && value > metrics.latestClose)
    .sort((left, right) => left - right);
  const belowLevels = ([
    metrics.breakdownLevel,
    metrics.bollinger.lower,
    metrics.ma120Value,
    metrics.ichimoku.currentCloudA,
    metrics.ichimoku.currentCloudB,
  ])
    .filter((value) => Number.isFinite(value) && value < metrics.latestClose)
    .sort((left, right) => right - left);
  const nearestRecovery = aboveLevels.length > 0 ? aboveLevels[0] : null;
  const nextRecovery = aboveLevels.length > 1 ? aboveLevels[1] : null;
  const nearestSupport = belowLevels.length > 0 ? belowLevels[0] : null;

  const trendLine = (() => {
    if (metrics.movingAverageStructure === "strong-bullish") {
      return `- 추세 구조: 주가가 MA5, MA20, MA60, MA120을 모두 상회해 이동평균 배열이 완전한 강세입니다.`;
    }
    if (metrics.movingAverageStructure === "strong-bearish") {
      return `- 추세 구조: 주가가 MA5, MA20, MA60, MA120을 모두 하회해 이동평균 배열이 뚜렷한 약세입니다.`;
    }
    if (metrics.movingAverageStructure === "rebound-inside-downtrend") {
      return `- 추세 구조: 주가가 MA20 위로 올라왔지만 아직 MA60 아래라 큰 하락 추세 안의 반등 시도로 봅니다.`;
    }
    if (metrics.movingAverageStructure === "pullback-inside-uptrend") {
      return `- 추세 구조: 주가가 MA20 아래지만 MA60 위에 있어 추세 이탈보다는 상승 추세 안의 눌림에 가깝습니다.`;
    }
    if (metrics.movingAverageStructure === "bullish") {
      return `- 추세 구조: 주가가 중장기 이동평균 위에 있어 큰 흐름은 여전히 우호적입니다.`;
    }
    if (metrics.movingAverageStructure === "bearish") {
      return `- 추세 구조: 주가가 MA20, MA60, MA120 아래라 반등이 추세 회복으로 인정되려면 추가 확인이 필요합니다.`;
    }
    return `- 추세 구조: 이동평균 배열이 혼재되어 추세 확인은 아직 제한적입니다.`;
  })();

  const volatilityLine = (() => {
    let bandText = "주가가 Bollinger 밴드 중간권에 있습니다";
    if (metrics.bollinger.state === "above-upper-band") {
      bandText = "주가가 Bollinger 상단 밴드 위로 밀고 올라갑니다";
    } else if (metrics.bollinger.state === "below-lower-band") {
      bandText = "주가가 Bollinger 하단 밴드 아래로 눌려 있습니다";
    } else if (metrics.bollinger.state === "upper-half") {
      bandText = "주가가 Bollinger 밴드 상단부에 있습니다";
    } else if (metrics.bollinger.state === "lower-half") {
      bandText = "주가가 Bollinger 밴드 하단부에 있습니다";
    }

    let widthText = "밴드 폭은 안정적입니다";
    if (metrics.bollinger.bandwidthRegime === "expanding") {
      widthText = "밴드 폭이 확대되어 변동성이 커지고 있습니다";
    } else if (metrics.bollinger.bandwidthRegime === "contracting") {
      widthText = "밴드 폭이 축소되어 변동성이 압축되고 있습니다";
    }

    return `- 변동성: ${bandText}. ${widthText}.`;
  })();

  const cloudLine = (() => {
    const cloudText =
      metrics.ichimoku.cloudPosition === "above-cloud"
        ? "주가가 현재 구름대 위에 있습니다"
        : metrics.ichimoku.cloudPosition === "below-cloud"
          ? "주가가 현재 구름대 아래에 있습니다"
          : metrics.ichimoku.cloudPosition === "inside-cloud"
            ? "주가가 현재 구름대 안에 있습니다"
            : "현재 구름대 위치를 확인하기 어렵습니다";
    const tkText =
      metrics.ichimoku.tkCross === "bullish"
        ? "전환선이 기준선 위에 있습니다"
        : metrics.ichimoku.tkCross === "bearish"
          ? "전환선이 기준선 아래에 있습니다"
          : metrics.ichimoku.tkCross === "flat"
            ? "전환선과 기준선이 비슷합니다"
            : "전환선/기준선 위치를 확인하기 어렵습니다";
    const futureText =
      metrics.ichimoku.futureCloudBias === "bullish"
        ? "선행 구름은 강세입니다"
        : metrics.ichimoku.futureCloudBias === "bearish"
          ? "선행 구름은 약세입니다"
          : metrics.ichimoku.futureCloudBias === "flat"
            ? "선행 구름은 중립적입니다"
            : "선행 구름을 확인하기 어렵습니다";
    return `- 일목균형: ${cloudText}. ${tkText}. ${futureText}.`;
  })();

  const momentumLine = (() => {
    const rsiText =
      metrics.rsiState === "overbought"
        ? `RSI14는 ${formatNumber(metrics.rsi14Value)}로 과열권입니다`
        : metrics.rsiState === "oversold"
          ? `RSI14는 ${formatNumber(metrics.rsi14Value)}로 침체권입니다`
          : metrics.rsiState === "neutral"
            ? `RSI14는 ${formatNumber(metrics.rsi14Value)}로 중립권입니다`
            : "RSI14를 확인하기 어렵습니다";
    const macdCrossText =
      metrics.macd.crossState === "bullish-cross"
        ? "MACD가 Signal을 상향 돌파했습니다"
        : metrics.macd.crossState === "bearish-cross"
          ? "MACD가 Signal을 하향 이탈했습니다"
          : metrics.macd.crossState === "bullish"
            ? "MACD가 Signal 위를 유지합니다"
            : metrics.macd.crossState === "bearish"
              ? "MACD가 Signal 아래에 머뭅니다"
              : "MACD와 Signal 관계 확인이 제한적입니다";
    const zeroText =
      metrics.macd.zeroState === "above-zero"
        ? "MACD는 0선 위입니다"
        : metrics.macd.zeroState === "below-zero"
          ? "MACD는 0선 아래입니다"
          : metrics.macd.zeroState === "at-zero"
            ? "MACD는 0선 부근입니다"
            : "";
    const histogramText =
      metrics.macd.histogramState === "expanding"
        ? "히스토그램 모멘텀이 확대되고 있습니다"
        : metrics.macd.histogramState === "contracting"
          ? "히스토그램 모멘텀이 축소되고 있습니다"
          : metrics.macd.histogramState === "stable"
            ? "히스토그램 모멘텀은 안정적입니다"
            : "히스토그램 흐름을 확인하기 어렵습니다";
    const adxText =
      metrics.adx.strengthState === "strong-trend"
        ? `ADX는 강한 추세를 가리키며 ${
            metrics.adx.directionState === "bullish"
              ? "+DI가 우위입니다"
              : metrics.adx.directionState === "bearish"
                ? "-DI가 우위입니다"
                : "방향선은 겹쳐 있습니다"
          }`
        : metrics.adx.strengthState === "building-trend"
          ? `ADX는 추세 형성을 가리키며 ${
              metrics.adx.directionState === "bullish"
                ? "+DI가 소폭 앞섭니다"
                : metrics.adx.directionState === "bearish"
                  ? "-DI가 소폭 앞섭니다"
                  : "방향선은 아직 근접해 있습니다"
            }`
          : metrics.adx.strengthState === "weak-trend"
            ? "ADX는 아직 약한 추세 환경을 가리킵니다"
            : "ADX 추세 강도를 확인하기 어렵습니다";
    const adxSlopeText =
      metrics.adx.slopeState === "rising"
        ? "추세 강도는 상승 중입니다"
        : metrics.adx.slopeState === "falling"
          ? "추세 강도는 둔화 중입니다"
          : metrics.adx.slopeState === "flat"
            ? "추세 강도는 횡보 중입니다"
            : "추세 강도 기울기를 확인하기 어렵습니다";
    const volumeText =
      metrics.volumeRegime === "heavy"
        ? "거래량은 20일 평균보다 많습니다"
        : metrics.volumeRegime === "light"
          ? "거래량은 20일 평균보다 적습니다"
          : metrics.volumeRegime === "normal"
            ? "거래량은 20일 평균에 가깝습니다"
            : "거래량 비교를 확인하기 어렵습니다";
    const macdSummary = zeroText ? `${macdCrossText}. ${zeroText}` : macdCrossText;
    return `- 모멘텀과 참여도: ${rsiText}. ${macdSummary}. ${histogramText}. ${adxText}. ${adxSlopeText}. ${volumeText}.`;
  })();

  const practicalLine = (() => {
    const recoveryText = Number.isFinite(nearestRecovery)
      ? `1차 회복 확인 가격은 ${formatLevel(nearestRecovery)}`
      : "단기 회복 가격을 확인하기 어렵습니다";
    const nextRecoveryText = Number.isFinite(nextRecovery)
      ? `다음은 ${formatLevel(nextRecovery)}`
      : null;
    const supportText = Number.isFinite(nearestSupport)
      ? `가까운 지지 확인 가격은 ${formatLevel(nearestSupport)}`
      : "지지 확인 가격을 확인하기 어렵습니다";
    const breakoutText = Number.isFinite(metrics.breakoutLevel)
      ? `20일 돌파 기준은 ${formatLevel(metrics.breakoutLevel)}`
      : "20일 돌파 기준을 확인하기 어렵습니다";
    const breakdownText = Number.isFinite(metrics.breakdownLevel)
      ? `20일 이탈 기준은 ${formatLevel(metrics.breakdownLevel)}`
      : "20일 이탈 기준을 확인하기 어렵습니다";

    let flowText = "차트 기준 흐름은 박스권 또는 바닥 다지기입니다";
    if (metrics.chartFlow === "bullish continuation") {
      flowText = "차트 기준 흐름은 강세 지속입니다";
    } else if (metrics.chartFlow === "bearish continuation") {
      flowText = "차트 기준 흐름은 약세 지속입니다";
    } else if (metrics.chartFlow === "technical rebound inside broader downtrend") {
      flowText = "차트 기준 흐름은 큰 하락 추세 안의 기술적 반등입니다";
    } else if (metrics.chartFlow === "pullback inside broader uptrend") {
      flowText = "차트 기준 흐름은 큰 상승 추세 안의 눌림입니다";
    }

    return `- 실전 체크리스트: ${supportText}; ${recoveryText}${nextRecoveryText ? `, ${nextRecoveryText}` : ""}; ${breakoutText}; ${breakdownText}; ${flowText}.`;
  })();

  console.log(trendLine);
  console.log(volatilityLine);
  console.log(cloudLine);
  console.log(momentumLine);
  console.log(practicalLine);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.input) {
    console.log(usage());
    process.exit(args.help ? 0 : 1);
  }

  if (!Number.isInteger(args.chartBars) || args.chartBars < 30) {
    throw new Error("--chart-bars must be an integer of at least 30.");
  }
  if (!Number.isInteger(args.width) || args.width < 800) {
    throw new Error("--width must be an integer of at least 800.");
  }
  if (!Number.isInteger(args.height) || args.height < 700) {
    throw new Error("--height must be an integer of at least 700.");
  }

  const data = readJson(args.input);
  requireNamedChartInput(data, args);
  const bars = normalizeTechnicalBars(data.bars || []);
  requireValidTechnicalBars(bars);
  const metrics = buildTechnicalMetrics(bars);
  const pngInfo = args.pngOut ? buildChartPngs(data, bars, metrics, args) : null;

  console.log(`# 고급 차트 분석: ${data.ticker || "Unknown"}`);
  console.log("");
  if (data.name) {
    console.log(`- 종목명: ${data.name}`);
  }
  console.log(`- 최근 일자: ${metrics.latest.date}`);
  console.log(`- 최근 종가: ${formatNumber(metrics.latestClose)}`);
  console.log(`- 이동평균 구조: ${displayState(metrics.movingAverageStructure)}`);
  console.log(`- Bollinger 해석: ${displayState(metrics.bollinger.state)}`);
  console.log(`- Ichimoku 해석: ${displayState(metrics.ichimoku.cloudPosition)}`);
  console.log(`- RSI 상태: ${displayState(metrics.rsiState)}`);
  console.log(`- MACD 상태: ${displayState(metrics.macd.crossState)} / ${displayState(metrics.macd.zeroState)}`);
  console.log(`- ADX 상태: ${displayState(metrics.adx.strengthState)} / ${displayState(metrics.adx.directionState)} / ${displayState(metrics.adx.slopeState)}`);
  console.log(`- 거래량 상태: ${displayState(metrics.volumeRegime)}`);
  console.log(`- 차트 기준 흐름: ${displayState(metrics.chartFlow)}`);
  console.log("");

  if (pngInfo) {
    console.log("## 차트 이미지");
    console.log("");
    console.log(`![${data.name || data.ticker || "차트"} 주가 추세 차트](${pngInfo.imagePaths.main})`);
    console.log("");
    console.log(`![${data.name || data.ticker || "차트"} 보조지표 차트](${pngInfo.imagePaths.overlay})`);
    console.log("");
    console.log(`![${data.name || data.ticker || "차트"} 모멘텀 차트](${pngInfo.imagePaths.momentum})`);
    console.log("");
    console.log(
      `주가 추세 차트는 위아래 꼬리가 있는 OHLC 캔들과 MA5, MA20, MA60, MA120, 거래량을 함께 보여줍니다. 보조지표 차트는 Bollinger Bands, Ichimoku 구름대, RSI14를 분리해 보여주며 선행 구름 표시를 위해 ${pngInfo.leadBarsUsed}개 미래 구간을 확보합니다. 모멘텀 차트는 MACD, Signal, Histogram, ADX/DMI에 집중해 교차, 모멘텀 가속, 추세 강도를 보기 쉽게 합니다.`,
    );
    console.log("");
  }

  console.log("## 지표");
  console.log("");
  console.log("| 항목 | 값 |");
  console.log("| --- | --- |");
  console.log(`| MA 5 | ${formatNumber(metrics.ma5Value)} |`);
  console.log(`| MA 20 | ${formatNumber(metrics.ma20Value)} |`);
  console.log(`| MA 60 | ${formatNumber(metrics.ma60Value)} |`);
  console.log(`| MA 120 | ${formatNumber(metrics.ma120Value)} |`);
  console.log(`| Bollinger 상단 | ${formatNumber(metrics.bollinger.upper)} |`);
  console.log(`| Bollinger 중심 | ${formatNumber(metrics.bollinger.middle)} |`);
  console.log(`| Bollinger 하단 | ${formatNumber(metrics.bollinger.lower)} |`);
  console.log(`| Bollinger 폭 | ${formatPercentRatio(metrics.bollinger.bandwidth, 2)} |`);
  console.log(`| 전환선 | ${formatNumber(metrics.ichimoku.tenkan)} |`);
  console.log(`| 기준선 | ${formatNumber(metrics.ichimoku.kijun)} |`);
  console.log(`| 현재 구름 A | ${formatNumber(metrics.ichimoku.currentCloudA)} |`);
  console.log(`| 현재 구름 B | ${formatNumber(metrics.ichimoku.currentCloudB)} |`);
  console.log(`| 선행 구름 A | ${formatNumber(metrics.ichimoku.futureCloudA)} |`);
  console.log(`| 선행 구름 B | ${formatNumber(metrics.ichimoku.futureCloudB)} |`);
  console.log(`| RSI 14 | ${formatNumber(metrics.rsi14Value)} |`);
  console.log(`| MACD | ${formatNumber(metrics.macd.macdValue)} |`);
  console.log(`| MACD Signal | ${formatNumber(metrics.macd.signalValue)} |`);
  console.log(`| MACD Histogram | ${formatNumber(metrics.macd.histogramValue)} |`);
  console.log(`| MACD 상태 | ${displayState(metrics.macd.crossState)} / ${displayState(metrics.macd.zeroState)} |`);
  console.log(`| Histogram 상태 | ${displayState(metrics.macd.histogramState)} |`);
  console.log(`| ADX 14 | ${formatNumber(metrics.adx.adxValue)} |`);
  console.log(`| +DI | ${formatNumber(metrics.adx.plusDiValue)} |`);
  console.log(`| -DI | ${formatNumber(metrics.adx.minusDiValue)} |`);
  console.log(`| ADX 상태 | ${displayState(metrics.adx.strengthState)} / ${displayState(metrics.adx.directionState)} / ${displayState(metrics.adx.slopeState)} |`);
  console.log(`| 20일 평균 거래량 | ${formatInteger(metrics.avgVolume20)} |`);
  console.log(`| 20일 평균 대비 거래량 | ${formatPercentRatio(metrics.volumeRatio, 1)} |`);
  console.log(`| 20일 돌파 기준 | ${formatNumber(metrics.breakoutLevel)} |`);
  console.log(`| 20일 이탈 기준 | ${formatNumber(metrics.breakdownLevel)} |`);
  console.log("");

  console.log("## 해석");
  console.log("");
  renderRead(metrics);
}

try {
  main();
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
