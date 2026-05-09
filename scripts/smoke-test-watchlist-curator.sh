#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI="$ROOT_DIR/skills/watchlist-curator/bin/watchlist-curator.js"
OUT_DIR="$ROOT_DIR/.tmp/smoke-watchlist-curator"
KRX_WATCHLIST="$OUT_DIR/watchlist.krx.json"
US_WATCHLIST="$OUT_DIR/watchlist.us.json"
PROPOSE_OUT="$OUT_DIR/propose-soil.txt"
AMBIGUOUS_RESOLVE="$OUT_DIR/ambiguous-resolve.json"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"
cp "$ROOT_DIR/examples/watchlist.example.json" "$KRX_WATCHLIST"
cp "$ROOT_DIR/examples/us-watchlist.example.json" "$US_WATCHLIST"

node "$CLI" propose \
  --input "S-OIL" \
  --offline \
  --json \
  --watchlist-krx "$KRX_WATCHLIST" \
  --watchlist-us "$US_WATCHLIST" > "$PROPOSE_OUT"

node --input-type=module - "$PROPOSE_OUT" <<'NODE'
import { readFileSync } from "node:fs";

const text = readFileSync(process.argv[2], "utf8");
const marker = "구조화 JSON:\n";
const markerIndex = text.indexOf(marker);
if (markerIndex === -1) throw new Error("propose output is missing structured JSON");

const output = JSON.parse(text.slice(markerIndex + marker.length));
if (!output.okToApply) throw new Error("S-OIL should be ok to apply");
if (!Array.isArray(output.applyArgsJson) || output.applyArgsJson.length === 0) {
  throw new Error("applyArgsJson must be a non-empty array");
}
if (!output.applyArgsJson.includes("--entries-base64")) {
  throw new Error("applyArgsJson must use --entries-base64");
}
if (output.applyArgsJson.includes("--entries")) {
  throw new Error("applyArgsJson must not use inline --entries JSON");
}
if (!output.applyCommand.includes("--entries-base64")) {
  throw new Error("applyCommand must use --entries-base64");
}
if (output.applyCommand.includes("--entries '") || output.applyCommand.includes("[{")) {
  throw new Error("applyCommand must not contain inline JSON");
}
if (typeof output.applyEntriesJson !== "string" || !output.applyEntriesJson.includes("010950")) {
  throw new Error("applyEntriesJson should remain available for debugging");
}
NODE

python3 - "$PROPOSE_OUT" <<'PY'
import json
import subprocess
import sys

text = open(sys.argv[1], encoding="utf-8").read()
output = json.loads(text.split("구조화 JSON:\n", 1)[1])
args = output["applyArgsJson"]
if not isinstance(args, list):
    raise SystemExit("applyArgsJson is not a list")
subprocess.run(args, check=True)
PY

node --input-type=module - "$KRX_WATCHLIST" <<'NODE'
import { readFileSync } from "node:fs";

const watchlist = JSON.parse(readFileSync(process.argv[2], "utf8"));
if (!watchlist.some((entry) => entry.ticker === "010950" && entry.name === "S-Oil" && entry.market === "KOSPI")) {
  throw new Error("S-Oil was not applied from applyArgsJson");
}
NODE

cp "$ROOT_DIR/examples/watchlist.example.json" "$KRX_WATCHLIST"
cp "$ROOT_DIR/examples/us-watchlist.example.json" "$US_WATCHLIST"

node "$CLI" apply \
  --watchlist-krx "$KRX_WATCHLIST" \
  --watchlist-us "$US_WATCHLIST" \
  --entries '[{"ticker":"AAPL","name":"Apple","market":"NASDAQ"}]' > "$OUT_DIR/apply-entries.json"

node --input-type=module - "$US_WATCHLIST" <<'NODE'
import { readFileSync } from "node:fs";

const watchlist = JSON.parse(readFileSync(process.argv[2], "utf8"));
if (!watchlist.some((entry) => entry.ticker === "AAPL" && entry.name === "Apple" && entry.market === "NASDAQ")) {
  throw new Error("AAPL was not applied from legacy --entries JSON");
}
NODE

if printf '{"okToApply":false,"additions":[{"ticker":"NVDA","name":"NVIDIA","market":"NASDAQ"}]}\n' |
  node "$CLI" apply --watchlist-krx "$KRX_WATCHLIST" --watchlist-us "$US_WATCHLIST" > "$OUT_DIR/reject-stdin.out" 2> "$OUT_DIR/reject-stdin.err"; then
  echo "stdin okToApply=false payload unexpectedly applied" >&2
  exit 1
fi

node "$CLI" resolve \
  --input "alphabet" \
  --offline \
  --watchlist-krx "$KRX_WATCHLIST" \
  --watchlist-us "$US_WATCHLIST" > "$AMBIGUOUS_RESOLVE"

if node "$CLI" apply \
  --watchlist-krx "$KRX_WATCHLIST" \
  --watchlist-us "$US_WATCHLIST" \
  --from-resolve "$AMBIGUOUS_RESOLVE" > "$OUT_DIR/reject-from-resolve.out" 2> "$OUT_DIR/reject-from-resolve.err"; then
  echo "--from-resolve ambiguous payload unexpectedly applied" >&2
  exit 1
fi
