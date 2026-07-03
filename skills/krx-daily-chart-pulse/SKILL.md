---
name: krx-daily-chart-pulse
description: Generate daily KRX chart artifacts and Hermes Telegram-ready portfolio pulse payloads without handling delivery secrets.
---

# krx-daily-chart-pulse

Generate a daily KRX chart pulse for a configured watchlist and prepare Telegram-ready payload artifacts for Hermes delivery.

Telegram images are rendered by the vendored `ray5273/stock-analysis-skill` `kr-stock-analysis` `chart-basics.js` workflow: main trend (with MA5/20/60/120/200 and price labels), overlay, momentum, volume moving-average, structure, and pattern/wave charts — rendered on both a daily and a weekly (주봉, MA5/10/20/60주) timeframe.

## When To Use

Use this skill when asked to run, summarize, schedule, or inspect the daily Korean stock portfolio pulse. The skill writes local artifacts and does not handle Telegram secrets directly.

## Command

From the repository root:

```bash
node skills/krx-daily-chart-pulse/bin/daily-krx-chart-pulse.js --watchlist examples/watchlist.example.json
```

For deterministic local testing:

```bash
node skills/krx-daily-chart-pulse/bin/daily-krx-chart-pulse.js --watchlist examples/watchlist.example.json --dry-run
```

For Hermes Telegram cron delivery:

```bash
node "$HERMES_HOME/skills/krx-daily-chart-pulse/bin/daily-krx-chart-pulse.js" --emit-hermes-send-batches
```

Useful options:

- `--watchlist <path>`: explicit watchlist path; omitted resolution is `KRX_WATCHLIST`, then `$HERMES_HOME/config/krx-daily-chart-pulse/watchlist.json`, then the repo example for development/testing
- `--output-dir <path>`: base artifact directory, default `.tmp/portfolio-pulse`
- `--date <YYYY-MM-DD>`: run date
- `--only <tickers>`: comma-separated ticker filter
- `--emit-payload`: print a machine-readable run summary to stdout
- `--emit-hermes-report`: print a Markdown report to stdout with absolute `MEDIA:` PNG lines for Hermes
- `--emit-hermes-send-batches`: print a JSON array of per-ticker Hermes send batches

## Output Contract

For each ticker, write:

- `chart-data.json`
- `chart-analysis.md`
- `message.md`
- `send-payload.json`
- `chart.png`
- `chart-overlay.png`
- `chart-momentum.png`
- `chart-volume.png`
- `chart-structure.png`
- `chart-pattern.png`
- `chart-weekly.png`
- `chart-weekly-overlay.png`
- `chart-weekly-momentum.png`
- `chart-weekly-volume.png`
- `chart-weekly-structure.png`
- `chart-weekly-pattern.png`
- `chart-analysis-weekly.md`
- `chart-structure-zones.csv`
- `chart-pattern-waves.csv`
- `result.json`

The default root is `.tmp/portfolio-pulse/YYYY-MM-DD/<ticker>/`.

## Delivery

Do not ask for Telegram secrets. Hermes owns Telegram delivery and uses its configured home channel for `target="telegram"`. Use `--deliver local` in Hermes cron configuration so the cron final response is not automatically delivered to Telegram.

For Telegram image attachments in cron, attach `hermes-send-krx-batches.py` as the job script. Current Hermes cron sessions disable the interactive `messaging` toolset, so the script runs the CLI with `--emit-hermes-send-batches`, parses stdout as a JSON array, and calls Hermes' own `send_message` implementation with `target="telegram"` in array order. The message body is `batch.text` followed by twelve plain `MEDIA:/absolute/path/file.png` lines from `batch.media`, preserving media order. It waits for one ticker send to succeed before sending the next ticker.

Hermes cron should run with `--workdir "$HERMES_HOME"`. The sender script uses `$HERMES_HOME/config/krx-daily-chart-pulse/watchlist.json` by default and writes artifacts under `$HERMES_HOME/artifacts/krx-daily-chart-pulse`. `KRX_WATCHLIST` remains supported as an override; relative override paths are resolved from the Hermes config directory.

Each successful ticker batch includes `chart.png`, `chart-overlay.png`, `chart-momentum.png`, `chart-volume.png`, `chart-structure.png`, and `chart-pattern.png` in that order, immediately followed by the six weekly charts (`chart-weekly.png`, `chart-weekly-overlay.png`, `chart-weekly-momentum.png`, `chart-weekly-volume.png`, `chart-weekly-structure.png`, `chart-weekly-pattern.png`) — twelve images per ticker. `MEDIA:` lines are still converted by Hermes into native image attachments, but they should appear inside each per-ticker `send_message` call, not in the cron final response. The final response should be a short local summary such as `Sent N/M ticker batches`.

`send-payload.json` and `result.json` intentionally keep relative artifact paths. Absolute paths are emitted only in Hermes-facing report or send-batch outputs.

The Noto Sans KR file is vendored from `ray5273/stock-analysis-skill`, but high-quality Hangul text masks require the repo-local `.tmp/krx-chart-font-venv` Pillow helper. The CLI prepares that venv automatically before rendering and passes it to `chart-basics.js`; first run or smoke test may need network access to install Pillow. Renderer diagnostics containing `external=false` or `pillow-missing` are treated as artifact failures so broken Hangul fallback charts are not delivered.
