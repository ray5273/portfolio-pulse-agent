#!/usr/bin/env node
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeTickerArtifacts } from "../lib/artifacts.js";
import { getRows } from "../lib/data.js";
import { ensureKrChartFontPython } from "../lib/font-runtime.js";
import { filterWatchlist, loadWatchlist } from "../lib/watchlist.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const hermesHome = path.resolve(process.env.HERMES_HOME || path.join(os.homedir(), ".hermes"));
const hermesConfigDir = path.join(hermesHome, "config/us-daily-chart-pulse");

function todayLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function usage() {
  return [
    "Usage: daily-us-chart-pulse [options]",
    "",
    "Options:",
    "  --watchlist <path>   Watchlist JSON path; defaults to US_WATCHLIST or Hermes config",
    "  --output-dir <path>  Base output directory",
    "  --dry-run            Use deterministic mock data",
    "  --date <YYYY-MM-DD>  Run date",
    "  --only <tickers>     Comma-separated ticker filter",
    "  --emit-payload       Print JSON run summary to stdout",
    "  --emit-hermes-report Print Markdown report with MEDIA lines for Hermes",
    "  --emit-hermes-send-batches",
    "                       Print JSON ticker send batches for Hermes send_message",
    "  --help               Show help"
  ].join("\n");
}

function expandHome(value) {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2));
  return value;
}

function resolvePath(value, baseDir = process.cwd()) {
  const expanded = expandHome(String(value));
  return path.resolve(path.isAbsolute(expanded) ? expanded : path.join(baseDir, expanded));
}

function resolveDefaultWatchlist() {
  const envWatchlist = String(process.env.US_WATCHLIST || "").trim();
  if (envWatchlist) return resolvePath(envWatchlist, hermesConfigDir);

  const hermesWatchlist = path.join(hermesConfigDir, "watchlist.json");
  if (existsSync(hermesWatchlist)) return hermesWatchlist;

  return path.join(repoRoot, "examples/us-watchlist.example.json");
}

function parseArgs(argv) {
  const args = {
    watchlist: undefined,
    outputDir: path.join(repoRoot, ".tmp/us-portfolio-pulse"),
    dryRun: false,
    date: todayLocal(),
    only: [],
    emitPayload: false,
    emitHermesReport: false,
    emitHermesSendBatches: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    }
    if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--emit-payload") {
      args.emitPayload = true;
    } else if (arg === "--emit-hermes-report") {
      args.emitHermesReport = true;
    } else if (arg === "--emit-hermes-send-batches") {
      args.emitHermesSendBatches = true;
    } else if (arg === "--watchlist") {
      args.watchlist = resolvePath(argv[++i]);
    } else if (arg === "--output-dir") {
      args.outputDir = argv[++i];
    } else if (arg === "--date") {
      args.date = argv[++i];
    } else if (arg === "--only") {
      args.only = String(argv[++i] || "").split(",");
    } else {
      throw new Error(`Unknown argument: ${arg}\n${usage()}`);
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
    throw new Error(`Invalid --date ${args.date}; expected YYYY-MM-DD`);
  }
  const emitModes = [args.emitPayload, args.emitHermesReport, args.emitHermesSendBatches].filter(Boolean).length;
  if (emitModes > 1) {
    throw new Error("--emit-payload, --emit-hermes-report, and --emit-hermes-send-batches cannot be used together");
  }

  args.watchlist ||= resolveDefaultWatchlist();
  args.outputDir = path.resolve(args.outputDir);
  return args;
}

function absFromResult(filePath) {
  return path.resolve(process.cwd(), filePath);
}

function signalLabel(signal) {
  if (signal === "bullish") return "강세";
  if (signal === "caution") return "주의";
  if (signal === "neutral") return "중립";
  if (!signal) return "알 수 없음";
  return String(signal);
}

function renderHermesReport(summary) {
  const okResults = summary.results.filter((result) => result.ok);
  const failedResults = summary.results.filter((result) => !result.ok);
  const payloadByTicker = new Map(summary.payloads.map((payload) => [payload.ticker, payload]));
  const lines = [
    `# US Daily Chart Pulse - ${summary.runDate}`,
    "",
    `- 성공: ${summary.okCount}/${summary.total}`,
    `- 실패: ${summary.failCount}`,
    `- 드라이런: ${summary.dryRun ? "예" : "아니오"}`,
    ""
  ];

  for (const result of okResults) {
    const payload = payloadByTicker.get(result.ticker);
    lines.push(`## ${result.ticker} ${result.name}`, "");
    if (payload?.text) {
      lines.push(payload.text, "");
    } else {
      lines.push(`신호: ${signalLabel(result.signal)}`, `점수: ${result.score}/100`, "");
    }
    lines.push(
      `MEDIA:${absFromResult(result.files.main)}`,
      `MEDIA:${absFromResult(result.files.overlay)}`,
      `MEDIA:${absFromResult(result.files.momentum)}`,
      `MEDIA:${absFromResult(result.files.volume)}`,
      `MEDIA:${absFromResult(result.files.structure)}`,
      `MEDIA:${absFromResult(result.files.pattern)}`,
      `MEDIA:${absFromResult(result.files.mainWeekly)}`,
      `MEDIA:${absFromResult(result.files.overlayWeekly)}`,
      `MEDIA:${absFromResult(result.files.momentumWeekly)}`,
      `MEDIA:${absFromResult(result.files.volumeWeekly)}`,
      `MEDIA:${absFromResult(result.files.structureWeekly)}`,
      `MEDIA:${absFromResult(result.files.patternWeekly)}`,
      ""
    );
  }

  if (failedResults.length > 0) {
    lines.push("## 실패", "");
    for (const result of failedResults) {
      lines.push(`- ${result.ticker} ${result.name}: ${result.error}`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function fallbackText(result) {
  return [
    `${result.ticker} ${result.name}: ${signalLabel(result.signal)}`,
    `점수: ${Number.isFinite(result.score) ? `${result.score}/100` : "n/a"}`
  ].join("\n");
}

function buildHermesSendBatches(summary) {
  const payloadByTicker = new Map(summary.payloads.map((payload) => [payload.ticker, payload]));
  return summary.results
    .filter((result) => result.ok)
    .map((result) => {
      const payload = payloadByTicker.get(result.ticker);
      return {
        ticker: result.ticker,
        name: result.name,
        text: payload?.text || fallbackText(result),
        media: [
          absFromResult(result.files.main),
          absFromResult(result.files.overlay),
          absFromResult(result.files.momentum),
          absFromResult(result.files.volume),
          absFromResult(result.files.structure),
          absFromResult(result.files.pattern),
          absFromResult(result.files.mainWeekly),
          absFromResult(result.files.overlayWeekly),
          absFromResult(result.files.momentumWeekly),
          absFromResult(result.files.volumeWeekly),
          absFromResult(result.files.structureWeekly),
          absFromResult(result.files.patternWeekly)
        ]
      };
    });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const loaded = await loadWatchlist(args.watchlist);
  const watchlist = filterWatchlist(loaded, args.only);
  await mkdir(path.join(args.outputDir, args.date), { recursive: true });
  let chartPythonPromise;
  const getChartPython = () => {
    chartPythonPromise ||= ensureKrChartFontPython();
    return chartPythonPromise;
  };

  const results = [];
  const payloads = [];
  for (const item of watchlist) {
    try {
      const chartPython = await getChartPython();
      const { rows, source } = await getRows({
        ticker: item.ticker,
        runDate: args.date,
        dryRun: args.dryRun
      });
      const { result, payload } = await writeTickerArtifacts({
        item,
        rows,
        outputRoot: args.outputDir,
        runDate: args.date,
        dryRun: args.dryRun,
        source,
        chartPython
      });
      results.push(result);
      payloads.push(payload);
      if (!args.emitHermesReport && !args.emitHermesSendBatches) {
        console.error(`[ok] ${item.ticker} ${item.name} -> ${result.outputDir}`);
      }
    } catch (error) {
      const failure = {
        ok: false,
        ticker: item.ticker,
        name: item.name,
        runDate: args.date,
        error: error.message
      };
      results.push(failure);
      if (!args.emitHermesReport && !args.emitHermesSendBatches) {
        console.error(`[fail] ${item.ticker} ${item.name}: ${error.message}`);
      }
    }
  }

  const okCount = results.filter((result) => result.ok).length;
  const summary = {
    version: 1,
    ok: okCount > 0,
    runDate: args.date,
    dryRun: args.dryRun,
    watchlist: path.relative(process.cwd(), args.watchlist),
    outputDir: path.relative(process.cwd(), path.join(args.outputDir, args.date)),
    total: results.length,
    okCount,
    failCount: results.length - okCount,
    results,
    payloads
  };

  if (args.emitPayload) {
    console.log(JSON.stringify(summary, null, 2));
  } else if (args.emitHermesReport) {
    process.stdout.write(renderHermesReport(summary));
  } else if (args.emitHermesSendBatches) {
    console.log(JSON.stringify(buildHermesSendBatches(summary), null, 2));
    for (const result of results.filter((result) => !result.ok)) {
      console.error(`[fail] ${result.ticker} ${result.name}: ${result.error}`);
    }
  } else {
    console.error(`[summary] ${okCount}/${results.length} succeeded; output ${summary.outputDir}`);
  }

  if (okCount === 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`[fatal] ${error.message}`);
  process.exit(1);
});
