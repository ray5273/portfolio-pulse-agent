import { mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { analyzeTicker, renderMessage } from "./analysis.js";
import { buildIndicators } from "./indicators.js";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const chartBasicsPath = path.resolve(__dirname, "../vendor/kr-stock-analysis/scripts/chart-basics.js");

function rel(base, target) {
  return path.relative(process.cwd(), path.resolve(base, target)) || ".";
}

async function writeJson(file, value) {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function tickerForChartBasics(item) {
  if (item.ticker.includes(".")) return item.ticker;
  const market = String(item.market || "").trim().toUpperCase();
  if (market === "KOSPI") return `${item.ticker}.KS`;
  if (market === "KOSDAQ") return `${item.ticker}.KQ`;
  return item.ticker;
}

function rejectFontFallback(stderr) {
  const diagnostics = String(stderr || "");
  if (/(external=false|pillow-missing)/i.test(diagnostics)) {
    throw new Error(`chart-basics font renderer fallback is not allowed: ${diagnostics.trim()}`);
  }
}

async function renderChartBasics({ inputPath, outputPath, chartPython }) {
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [
        chartBasicsPath,
        "--input",
        inputPath,
        "--png-out",
        outputPath,
        "--image-path",
        path.basename(outputPath)
      ],
      {
        env: {
          ...process.env,
          ...(chartPython ? { KR_STOCK_CHART_PYTHON: chartPython } : {})
        },
        maxBuffer: 32 * 1024 * 1024
      }
    );
    rejectFontFallback(stderr);
    return stdout;
  } catch (error) {
    const details = [error.message, error.stderr && String(error.stderr).trim()].filter(Boolean).join("\n");
    throw new Error(`chart-basics rendering failed: ${details}`);
  }
}

export async function writeTickerArtifacts({ item, rows, outputRoot, runDate, dryRun, chartPython }) {
  if (!item.name) {
    throw new Error(`Ticker ${item.ticker} is missing required name for PNG chart rendering`);
  }

  const tickerDir = path.join(outputRoot, runDate, item.ticker);
  await mkdir(tickerDir, { recursive: true });

  const indicators = buildIndicators(rows);
  const analysis = analyzeTicker({
    ticker: item.ticker,
    name: item.name,
    rows,
    indicators
  });

  const artifactPaths = {
    main: path.join(tickerDir, "chart.png"),
    overlay: path.join(tickerDir, "chart-overlay.png"),
    momentum: path.join(tickerDir, "chart-momentum.png"),
    volume: path.join(tickerDir, "chart-volume.png"),
    structure: path.join(tickerDir, "chart-structure.png"),
    pattern: path.join(tickerDir, "chart-pattern.png")
  };

  const chartDataPath = path.join(tickerDir, "chart-data.json");
  await writeJson(chartDataPath, {
    ticker: tickerForChartBasics(item),
    name: item.name,
    market: item.market,
    runDate,
    dryRun,
    source: dryRun ? "mock" : "naver-finance",
    bars: rows,
    rows,
    indicators
  });

  const analysisMarkdown = await renderChartBasics({
    inputPath: chartDataPath,
    outputPath: artifactPaths.main,
    chartPython
  });

  const relativeArtifacts = {
    main: rel(process.cwd(), artifactPaths.main),
    overlay: rel(process.cwd(), artifactPaths.overlay),
    momentum: rel(process.cwd(), artifactPaths.momentum),
    volume: rel(process.cwd(), artifactPaths.volume),
    structure: rel(process.cwd(), artifactPaths.structure),
    pattern: rel(process.cwd(), artifactPaths.pattern)
  };
  const message = renderMessage(analysis, relativeArtifacts);
  const payload = {
    version: 1,
    delivery: {
      type: "telegram",
      handledBy: "hermes",
      secrets: "not-in-repo"
    },
    ticker: item.ticker,
    name: item.name,
    market: item.market,
    runDate,
    text: message,
    artifacts: [
      { kind: "main-trend-chart", path: relativeArtifacts.main },
      { kind: "overlay-chart", path: relativeArtifacts.overlay },
      { kind: "momentum-chart", path: relativeArtifacts.momentum },
      { kind: "structure-chart", path: relativeArtifacts.structure },
      { kind: "pattern-wave-chart", path: relativeArtifacts.pattern },
      { kind: "analysis", path: rel(process.cwd(), path.join(tickerDir, "chart-analysis.md")) }
    ],
    meta: {
      signal: analysis.signal,
      score: analysis.score,
      asOf: analysis.asOf,
      dryRun
    }
  };

  await writeFile(path.join(tickerDir, "chart-analysis.md"), analysisMarkdown, "utf8");
  await writeFile(path.join(tickerDir, "message.md"), `${message}\n`, "utf8");
  await writeJson(path.join(tickerDir, "send-payload.json"), payload);

  const result = {
    ok: true,
    ticker: item.ticker,
    name: item.name,
    runDate,
    outputDir: rel(process.cwd(), tickerDir),
    signal: analysis.signal,
    score: analysis.score,
    files: {
      chartData: rel(process.cwd(), chartDataPath),
      analysis: rel(process.cwd(), path.join(tickerDir, "chart-analysis.md")),
      message: rel(process.cwd(), path.join(tickerDir, "message.md")),
      payload: rel(process.cwd(), path.join(tickerDir, "send-payload.json")),
      main: relativeArtifacts.main,
      overlay: relativeArtifacts.overlay,
      momentum: relativeArtifacts.momentum,
      volume: relativeArtifacts.volume,
      structure: relativeArtifacts.structure,
      pattern: relativeArtifacts.pattern
    }
  };
  await writeJson(path.join(tickerDir, "result.json"), result);
  return { result, payload };
}
