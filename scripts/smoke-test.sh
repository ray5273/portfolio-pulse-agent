#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT_DIR/.tmp/smoke-portfolio-pulse"
RUN_DATE="2026-05-05"
CLI="$ROOT_DIR/skills/krx-daily-chart-pulse/bin/daily-krx-chart-pulse.js"
WATCHLIST="$ROOT_DIR/examples/watchlist.example.json"
SUMMARY="$OUT_DIR.summary.json"
HERMES_REPORT="$OUT_DIR.hermes-report.md"
HERMES_BATCHES="$OUT_DIR.hermes-send-batches.json"
STDERR_LOG="$OUT_DIR.stderr.log"

rm -rf "$OUT_DIR"
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
  import { readFileSync } from "node:fs";
  import path from "node:path";

  const [summaryPath, batchesPath, watchlistPath] = process.argv.slice(1);
  const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  const batches = JSON.parse(readFileSync(batchesPath, "utf8"));
  const watchlist = JSON.parse(readFileSync(watchlistPath, "utf8"));
  if (!Array.isArray(batches)) {
    throw new Error("Hermes send batches output is not a JSON array");
  }

  const okResults = summary.results.filter((result) => result.ok);
  if (batches.length !== okResults.length || batches.length !== summary.okCount) {
    throw new Error(`Expected ${okResults.length} send batches, found ${batches.length}`);
  }

  const watchlistOrder = new Map(watchlist.map((item, index) => [item.ticker, index]));
  const expectedTickers = okResults
    .map((result) => result.ticker)
    .sort((a, b) => watchlistOrder.get(a) - watchlistOrder.get(b));
  const actualTickers = batches.map((batch) => batch.ticker);
  if (actualTickers.join(",") !== expectedTickers.join(",")) {
    throw new Error(`Unexpected batch order: ${actualTickers.join(",")}`);
  }

  const expectedMedia = ["chart.png", "chart-overlay.png", "chart-momentum.png"];
  for (const batch of batches) {
    if (!batch.ticker || !batch.name || typeof batch.text !== "string") {
      throw new Error(`Invalid batch shape for ${batch.ticker || "unknown"}`);
    }
    if (!batch.text.includes(batch.ticker) || !batch.text.includes(batch.name) || !batch.text.includes("종가")) {
      throw new Error(`Batch text is missing ticker, name, or chart summary for ${batch.ticker}`);
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
      if (!mediaPath.endsWith(".png")) {
        throw new Error(`Media path is not a PNG for ${batch.ticker}: ${mediaPath}`);
      }
    });
  }
' "$SUMMARY" "$HERMES_BATCHES" "$WATCHLIST"

for ticker in 005930 066970; do
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
  for phrase in \
    "주가 추세 차트" \
    "보조지표 차트" \
    "모멘텀 차트" \
    "MACD" \
    "ADX"; do
    if ! grep -Fq "$phrase" "$ticker_dir/chart-analysis.md"; then
      echo "Missing chart analysis phrase for $ticker: $phrase" >&2
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
if [[ "$media_count" != "6" ]]; then
  echo "Expected 6 Hermes MEDIA PNG lines, found $media_count" >&2
  exit 1
fi

for phrase in \
  "- 성공: 2/2" \
  "- 실패: 0" \
  "- 드라이런: 예"; do
  if ! grep -Fq -- "$phrase" "$HERMES_REPORT"; then
    echo "Missing Korean Hermes report summary phrase: $phrase" >&2
    exit 1
  fi
done

if grep -R -E 'chart-(price|volume|pulse)\.png' "$OUT_DIR" "$SUMMARY" "$HERMES_REPORT" "$HERMES_BATCHES" >/tmp/krx-pulse-old-chart-ref.out; then
  echo "Old chart artifact reference found:" >&2
  cat /tmp/krx-pulse-old-chart-ref.out >&2
  exit 1
fi

INVALID="$OUT_DIR.invalid-watchlist.json"
printf '[{"ticker":"005930"}]\n' > "$INVALID"
if node "$CLI" --watchlist "$INVALID" --output-dir "$OUT_DIR-invalid" --dry-run >/tmp/krx-pulse-invalid.out 2>/tmp/krx-pulse-invalid.err; then
  echo "Invalid watchlist unexpectedly succeeded" >&2
  exit 1
fi

if grep -R -Ei '(bot[0-9]{6,}:[A-Za-z0-9_-]{20,}|TELEGRAM_(BOT_)?TOKEN=|chat_id["'\'']?[[:space:]]*[:=])' "$OUT_DIR" "$SUMMARY" "$HERMES_REPORT" "$HERMES_BATCHES" "$ROOT_DIR/examples" "$ROOT_DIR/README.md" >/tmp/krx-pulse-secret-scan.out; then
  echo "Potential Telegram secret material found:" >&2
  cat /tmp/krx-pulse-secret-scan.out >&2
  exit 1
fi

echo "Smoke test passed: $OUT_DIR/$RUN_DATE"
