---
name: us-daily-chart-pulse
description: Generate daily US stock chart artifacts and Hermes Telegram-ready portfolio pulse payloads without handling delivery secrets.
---

# us-daily-chart-pulse

Generate a daily US stock chart pulse for a configured watchlist and prepare Telegram-ready payload artifacts for Hermes delivery.

Telegram images are rendered by the vendored `ray5273/stock-analysis-skill` `kr-stock-analysis` `chart-basics.js` workflow: main trend (with MA5/20/60/120/200 and price labels), overlay, momentum, volume moving-average, structure, and pattern/wave charts — rendered on both a daily and a monthly (월봉, MA5/10/20/60개월) timeframe.

## When To Use

Use this skill when asked to run, summarize, schedule, or inspect the daily US stock portfolio pulse. The skill writes local artifacts and does not handle Telegram secrets directly.

## Command

From the repository root:

```bash
node skills/us-daily-chart-pulse/bin/daily-us-chart-pulse.js --watchlist examples/us-watchlist.example.json
```

For deterministic local testing:

```bash
node skills/us-daily-chart-pulse/bin/daily-us-chart-pulse.js --watchlist examples/us-watchlist.example.json --dry-run
```

For Hermes Telegram cron delivery:

```bash
node "$HERMES_HOME/skills/us-daily-chart-pulse/bin/daily-us-chart-pulse.js" --emit-hermes-send-batches
```

Useful options:

- `--watchlist <path>`: explicit watchlist path; omitted resolution is `US_WATCHLIST`, then `$HERMES_HOME/config/us-daily-chart-pulse/watchlist.json`, then the repo example for development/testing
- `--output-dir <path>`: base artifact directory, default `.tmp/us-portfolio-pulse`
- `--date <YYYY-MM-DD>`: run date
- `--only <tickers>`: comma-separated ticker filter
- `--emit-payload`: print a machine-readable run summary to stdout
- `--emit-hermes-report`: print a Markdown report to stdout with absolute `MEDIA:` PNG lines for Hermes
- `--emit-hermes-send-batches`: print a JSON array of per-ticker Hermes send batches

## Data

Live runs fetch Yahoo chart JSON rows without an API key:

```text
https://query1.finance.yahoo.com/v8/finance/chart/<ticker>?interval=1d&period1=<unix>&period2=<unix>
```

If Yahoo fails, rate-limits, returns malformed data, or returns fewer than 60 valid rows, the CLI falls back to Nasdaq historical JSON:

```text
https://api.nasdaq.com/api/quote/<ticker>/historical?assetclass=stocks&fromdate=YYYY-MM-DD&todate=YYYY-MM-DD&limit=9999
```

The CLI requires at least 60 valid daily OHLCV rows per ticker. US holidays are handled by reporting the latest available row date in generated payload metadata. `chart-data.json` records live data as `source: "yahoo-chart"` or `source: "nasdaq-historical"`.

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
- `chart-monthly.png`
- `chart-monthly-overlay.png`
- `chart-monthly-momentum.png`
- `chart-monthly-volume.png`
- `chart-monthly-structure.png`
- `chart-monthly-pattern.png`
- `chart-analysis-monthly.md`
- `chart-structure-zones.csv`
- `chart-pattern-waves.csv`
- `result.json`

The default root is `.tmp/us-portfolio-pulse/YYYY-MM-DD/<ticker>/`.

## Delivery

Do not ask for Telegram secrets. Hermes owns Telegram delivery and uses its configured home channel for `target="telegram"`. Use `--deliver local` in Hermes cron configuration so the cron final response is not automatically delivered to Telegram.

For Telegram image attachments in cron, attach `hermes-send-us-batches.py` as the job script. The script runs the CLI with `--emit-hermes-send-batches`, parses stdout as a JSON array, and calls Hermes' own `send_message` implementation with `target="telegram"` in array order. The message body is `batch.text` followed by twelve plain `MEDIA:/absolute/path/file.png` lines from `batch.media`, preserving media order.

Hermes cron should run with `--workdir "$HERMES_HOME"`. The sender script uses `$HERMES_HOME/config/us-daily-chart-pulse/watchlist.json` by default and writes artifacts under `$HERMES_HOME/artifacts/us-daily-chart-pulse`. `US_WATCHLIST` remains supported as an override; relative override paths are resolved from the Hermes config directory.

Each successful ticker batch includes `chart.png`, `chart-overlay.png`, `chart-momentum.png`, `chart-volume.png`, `chart-structure.png`, and `chart-pattern.png` in that order, immediately followed by the six monthly charts (`chart-monthly.png`, `chart-monthly-overlay.png`, `chart-monthly-momentum.png`, `chart-monthly-volume.png`, `chart-monthly-structure.png`, `chart-monthly-pattern.png`) — twelve images per ticker. The final response should be a short local summary such as `Sent N/M ticker batches`.
