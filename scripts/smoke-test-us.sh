#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT_DIR/.tmp/smoke-us-portfolio-pulse"
RUN_DATE="2026-05-05"
CLI="$ROOT_DIR/skills/us-daily-chart-pulse/bin/daily-us-chart-pulse.js"
WATCHLIST="$ROOT_DIR/examples/us-watchlist.example.json"
SUMMARY="$OUT_DIR.summary.json"
HERMES_REPORT="$OUT_DIR.hermes-report.md"
HERMES_BATCHES="$OUT_DIR.hermes-send-batches.json"
STDERR_LOG="$OUT_DIR.stderr.log"
HERMES_TEST_HOME="$ROOT_DIR/.tmp/hermes-home-us-smoke"
HERMES_INSTALL_HOME="$ROOT_DIR/.tmp/hermes-install-us-smoke"

rm -rf "$OUT_DIR" "$HERMES_TEST_HOME" "$HERMES_INSTALL_HOME"
mkdir -p "$(dirname "$OUT_DIR")"

node "$CLI" \
  --watchlist "$WATCHLIST" \
  --output-dir "$OUT_DIR" \
  --date "$RUN_DATE" \
  --dry-run \
  --emit-payload > "$SUMMARY" 2> "$STDERR_LOG"

node "$CLI" \
  --watchlist "$WATCHLIST" \
  --output-dir "$OUT_DIR" \
  --date "$RUN_DATE" \
  --dry-run \
  --emit-hermes-report > "$HERMES_REPORT" 2>> "$STDERR_LOG"

node "$CLI" \
  --watchlist "$WATCHLIST" \
  --output-dir "$OUT_DIR" \
  --date "$RUN_DATE" \
  --dry-run \
  --emit-hermes-send-batches > "$HERMES_BATCHES" 2>> "$STDERR_LOG"

"$ROOT_DIR/.tmp/krx-chart-font-venv/bin/python" -c 'import PIL'

if grep -Eqi '(pillow-missing|external=false)' "$STDERR_LOG" "$SUMMARY" "$HERMES_REPORT" "$HERMES_BATCHES"; then
  echo "Chart font renderer fallback diagnostic found:" >&2
  grep -Eih '(pillow-missing|external=false)' "$STDERR_LOG" "$SUMMARY" "$HERMES_REPORT" "$HERMES_BATCHES" >&2
  exit 1
fi

node --input-type=module -e '
  import { existsSync, readFileSync } from "node:fs";
  import path from "node:path";

  const [summaryPath, batchesPath] = process.argv.slice(1);
  const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  const batches = JSON.parse(readFileSync(batchesPath, "utf8"));
  const expectedTickers = ["GOOG", "CRCL", "MU", "TSLA"];
  if (summary.okCount !== 4 || summary.failCount !== 0) {
    throw new Error(`Expected 4 successful tickers, got ok=${summary.okCount} fail=${summary.failCount}`);
  }
  if (!Array.isArray(batches) || batches.length !== 4) {
    throw new Error(`Expected 4 send batches, found ${Array.isArray(batches) ? batches.length : "non-array"}`);
  }
  const actualTickers = batches.map((batch) => batch.ticker);
  if (actualTickers.join(",") !== expectedTickers.join(",")) {
    throw new Error(`Unexpected batch order: ${actualTickers.join(",")}`);
  }
  const expectedMedia = ["chart.png", "chart-overlay.png", "chart-momentum.png"];
  for (const batch of batches) {
    if (!batch.name || typeof batch.text !== "string" || !batch.text.includes(batch.ticker) || !batch.text.includes("종가")) {
      throw new Error(`Invalid batch text for ${batch.ticker}`);
    }
    if (!Array.isArray(batch.media) || batch.media.length !== 3) {
      throw new Error(`Expected 3 media files for ${batch.ticker}`);
    }
    batch.media.forEach((mediaPath, index) => {
      if (!path.isAbsolute(mediaPath)) {
        throw new Error(`Media path is not absolute for ${batch.ticker}: ${mediaPath}`);
      }
      if (path.basename(mediaPath) !== expectedMedia[index]) {
        throw new Error(`Unexpected media order for ${batch.ticker}: ${batch.media.join(",")}`);
      }
      if (!existsSync(mediaPath)) {
        throw new Error(`Media artifact does not exist: ${mediaPath}`);
      }
    });
  }
  for (const result of summary.results) {
    const chartData = JSON.parse(readFileSync(result.files.chartData, "utf8"));
    if (chartData.source !== "mock") {
      throw new Error(`Expected mock source for dry-run ${result.ticker}, got ${chartData.source}`);
    }
  }
' "$SUMMARY" "$HERMES_BATCHES"

for ticker in GOOG CRCL MU TSLA; do
  ticker_dir="$OUT_DIR/$RUN_DATE/$ticker"
  for file in \
    chart-data.json \
    chart-analysis.md \
    message.md \
    send-payload.json \
    chart.png \
    chart-overlay.png \
    chart-momentum.png \
    result.json; do
    if [[ ! -s "$ticker_dir/$file" ]]; then
      echo "Missing artifact: $ticker_dir/$file" >&2
      exit 1
    fi
  done
  if ! grep -Eq "^## $ticker .+" "$HERMES_REPORT"; then
    echo "Missing Hermes report section for ticker: $ticker" >&2
    exit 1
  fi
  for chart in chart.png chart-overlay.png chart-momentum.png; do
    if ! grep -Fqx "MEDIA:$ticker_dir/$chart" "$HERMES_REPORT"; then
      echo "Missing Hermes MEDIA line: MEDIA:$ticker_dir/$chart" >&2
      exit 1
    fi
  done
done

media_count="$(grep -Ec '^MEDIA:/.+\.png$' "$HERMES_REPORT")"
if [[ "$media_count" != "12" ]]; then
  echo "Expected 12 Hermes MEDIA PNG lines, found $media_count" >&2
  exit 1
fi

for phrase in \
  "- 성공: 4/4" \
  "- 실패: 0" \
  "- 드라이런: 예"; do
  if ! grep -Fq -- "$phrase" "$HERMES_REPORT"; then
    echo "Missing Hermes report summary phrase: $phrase" >&2
    exit 1
  fi
done

mkdir -p \
  "$HERMES_TEST_HOME/skills" \
  "$HERMES_TEST_HOME/scripts" \
  "$HERMES_TEST_HOME/config/us-daily-chart-pulse" \
  "$HERMES_TEST_HOME/.tmp"
cp -R "$ROOT_DIR/skills/us-daily-chart-pulse" "$HERMES_TEST_HOME/skills/us-daily-chart-pulse"
cp "$ROOT_DIR/scripts/hermes-send-us-batches.py" "$HERMES_TEST_HOME/scripts/hermes-send-us-batches.py"
cp "$WATCHLIST" "$HERMES_TEST_HOME/config/us-daily-chart-pulse/watchlist.json"
cp -R "$ROOT_DIR/.tmp/krx-chart-font-venv" "$HERMES_TEST_HOME/.tmp/krx-chart-font-venv"

SENDER_BATCHES="$HERMES_TEST_HOME/sender-batches.json"
HERMES_HOME="$HERMES_TEST_HOME" \
US_WATCHLIST="watchlist.json" \
US_DRY_RUN=1 \
US_DATE="$RUN_DATE" \
python3 - "$HERMES_TEST_HOME/scripts/hermes-send-us-batches.py" > "$SENDER_BATCHES" <<'PY'
import json
import runpy
import sys

module = runpy.run_path(sys.argv[1])
print(json.dumps(module["build_batches"](), ensure_ascii=False, indent=2))
PY

node --input-type=module -e '
  import { readFileSync } from "node:fs";
  import path from "node:path";

  const [batchesPath, hermesHome, runDate] = process.argv.slice(1);
  const batches = JSON.parse(readFileSync(batchesPath, "utf8"));
  if (!Array.isArray(batches) || batches.length !== 4) {
    throw new Error(`Expected 4 sender batches, found ${Array.isArray(batches) ? batches.length : "non-array"}`);
  }
  if (batches.map((batch) => batch.ticker).join(",") !== "GOOG,CRCL,MU,TSLA") {
    throw new Error(`Unexpected sender order: ${batches.map((batch) => batch.ticker).join(",")}`);
  }
  const artifactRoot = path.join(hermesHome, "artifacts/us-daily-chart-pulse", runDate);
  for (const batch of batches) {
    for (const mediaPath of batch.media) {
      if (!mediaPath.startsWith(`${artifactRoot}${path.sep}`)) {
        throw new Error(`Sender media path is outside Hermes artifacts: ${mediaPath}`);
      }
    }
  }
' "$SENDER_BATCHES" "$HERMES_TEST_HOME" "$RUN_DATE"

HERMES_HOME="$HERMES_INSTALL_HOME" PATH="/usr/bin:/bin:/usr/sbin:/sbin" bash "$ROOT_DIR/scripts/install-us-hermes-skill.sh" >/tmp/us-pulse-install.out
if [[ ! -x "$HERMES_INSTALL_HOME/scripts/hermes-send-us-batches.py" ]]; then
  echo "Installed Hermes sender script is missing or not executable" >&2
  exit 1
fi
if [[ ! -d "$HERMES_INSTALL_HOME/skills/us-daily-chart-pulse" ]]; then
  echo "Installed Hermes skill is missing" >&2
  exit 1
fi
if ! cmp -s "$ROOT_DIR/examples/us-watchlist.local.json" "$HERMES_INSTALL_HOME/config/us-daily-chart-pulse/watchlist.json"; then
  echo "Installer did not seed config watchlist from examples/us-watchlist.local.json" >&2
  exit 1
fi
if [[ ! -s "$HERMES_INSTALL_HOME/config/us-daily-chart-pulse/watchlist.example.json" ]]; then
  echo "Installer did not copy us-watchlist.example.json template" >&2
  exit 1
fi

printf '[{"ticker":"MSFT","name":"Do Not Overwrite","market":"NASDAQ"}]\n' > "$HERMES_INSTALL_HOME/config/us-daily-chart-pulse/watchlist.json"
HERMES_HOME="$HERMES_INSTALL_HOME" PATH="/usr/bin:/bin:/usr/sbin:/sbin" bash "$ROOT_DIR/scripts/install-us-hermes-skill.sh" >/tmp/us-pulse-install-rerun.out
if ! grep -Fq "Do Not Overwrite" "$HERMES_INSTALL_HOME/config/us-daily-chart-pulse/watchlist.json"; then
  echo "Installer overwrote an existing config watchlist" >&2
  exit 1
fi

echo "US smoke test passed: $OUT_DIR/$RUN_DATE"
