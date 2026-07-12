---
name: krx-trend-portfolio-monitor
description: Recalculate a KRX top-300 trend-following watchlist daily and deliver only monthly target-portfolio changes through Hermes Telegram.
---

# KRX Trend Portfolio Monitor

Daily candidates are monitoring only. The actual 10-stock target changes only after month-end close and applies at the next trading-day open. The universe must be KOSPI/KOSDAQ top-300 common shares; ETFs, ETNs, REITs, SPACs, and preferred shares are excluded.

```bash
node "$HERMES_HOME/skills/krx-trend-portfolio-monitor/bin/krx-trend-portfolio-monitor.js" --emit-hermes-send-batch
```

Options: `--dry-run`, `--date YYYY-MM-DD`, `--config path`, `--output-dir path`, `--emit-payload`, and `--emit-hermes-send-batch`.

The scoring contract is price RS (3m 40%, 6m 30%, 12m 30%) and fundamental improvement (EPS 50%, revenue 50%), combined 50:50 by cross-sectional rank. Regime uses KOSPI SMA200 with ±3% hysteresis and 60-session 18% volatility targeting. Inputs must never include future prices or DART disclosures received after the as-of date.

Hermes delivery is owned by `hermes-send-krx-trend-portfolio.py`, which calls only Hermes `send_message_tool(target="telegram")`. Do not create Telegram credentials in this skill. A non-trading day produces no normal message; an expected trading-day data failure produces an error payload.

## Persistent cache

The shared, non-Git cache is `~/.cache/krx-trend-portfolio-monitor/` on both the research machine and the Hermes Mac mini. It contains `top300.json`, adjusted daily bars under `kr-strategy-backtest/2026-07-10/normalized/`, and DART filing panels under `kr-strategy-backtest/dart-quarterly-panel/`. Set these paths in `monitor.json`; do not use a temporary workspace path. Sync with rsync before enabling live runs, and refresh only the latest price sessions and newly received DART filings thereafter.
