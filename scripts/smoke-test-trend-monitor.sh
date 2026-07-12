#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$(mktemp -d)"; trap 'rm -rf "$OUT"' EXIT
NODE="${HERMES_NODE:-/opt/homebrew/opt/node@22/bin/node}"
[[ -x "$NODE" ]] || NODE="$(command -v node)"
"$NODE" "$ROOT/skills/krx-trend-portfolio-monitor/bin/krx-trend-portfolio-monitor.js" --dry-run --date 2026-07-10 --output-dir "$OUT" --config "$OUT/monitor.json" --emit-payload > "$OUT/result.json"
"$NODE" --input-type=module - "$OUT/result.json" <<'NODE'
import {readFile} from 'node:fs/promises'; const x=JSON.parse(await readFile(process.argv[2]));
if(x.candidates.length!==10) throw Error('must cap candidates at 10');
if(x.candidates.some(v=>v.ticker==='999999')) throw Error('must exclude ETF');
if(x.candidates.some(v=>!Number.isFinite(v.score))) throw Error('must score RS/fundamentals');
if(!['ON','OFF','HOLD'].includes(x.regime.label)) throw Error('must calculate hysteresis regime');
if(x.monthlyTarget.length!==0) throw Error('daily candidates must not become monthly target off month-end');
NODE
TMPHOME="$OUT/hermes"
HERMES_HOME="$TMPHOME" bash "$ROOT/scripts/install-hermes-trend-portfolio-monitor.sh"
echo '{"keep":true}' > "$TMPHOME/config/krx-trend-portfolio-monitor/monitor.json"
HERMES_HOME="$TMPHOME" bash "$ROOT/scripts/install-hermes-trend-portfolio-monitor.sh"
test "$("$NODE" -e "console.log(require('fs').readFileSync(process.argv[1],'utf8'))" "$TMPHOME/config/krx-trend-portfolio-monitor/monitor.json")" = '{"keep":true}'
echo 'smoke:trend-monitor passed'
