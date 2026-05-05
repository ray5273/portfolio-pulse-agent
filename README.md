# krx-daily-chart-pulse

Daily KRX chart pulse skill for Hermes/OpenClaw. The repository generates per-ticker chart artifacts and Telegram-ready payload files without storing or reading Telegram secrets. Delivery is delegated to Hermes.

Telegram image attachments use the vendored `ray5273/stock-analysis-skill` `kr-stock-analysis` `chart-basics.js` renderer: main trend, overlay, and momentum charts.

## Quick Start

```bash
bash scripts/smoke-test.sh
```

Run manually:

```bash
node skills/krx-daily-chart-pulse/bin/daily-krx-chart-pulse.js \
  --watchlist examples/watchlist.example.json \
  --dry-run \
  --emit-hermes-send-batches
```

Default artifacts are written to:

```text
.tmp/portfolio-pulse/YYYY-MM-DD/<ticker>/
```

Each ticker directory contains:

- `chart-data.json`
- `chart-analysis.md`
- `message.md`
- `send-payload.json`
- `chart.png`
- `chart-overlay.png`
- `chart-momentum.png`
- `result.json`

## CLI

```text
daily-krx-chart-pulse
  --watchlist <path>      Watchlist JSON file.
  --output-dir <path>     Base output directory. Defaults to .tmp/portfolio-pulse.
  --dry-run               Use deterministic local sample data and skip network calls.
  --date <YYYY-MM-DD>     Run date. Defaults to today.
  --only <tickers>        Comma-separated ticker filter, for example 005930,066970.
  --emit-payload          Print a JSON summary payload to stdout.
  --emit-hermes-report    Print a Markdown report to stdout with absolute MEDIA: PNG lines.
  --emit-hermes-send-batches
                          Print a JSON array of per-ticker Hermes send batches.
```

Use `--emit-payload` for machine-readable automation. Use `--emit-hermes-report` for a local Markdown report with `MEDIA:` lines. Use `--emit-hermes-send-batches` for Hermes Telegram cron delivery that sends each ticker sequentially from one cron job.

When `--watchlist` is omitted, the CLI resolves the watchlist in this order: `KRX_WATCHLIST`, `$HERMES_HOME/config/krx-daily-chart-pulse/watchlist.json`, then `examples/watchlist.example.json`. The repo example fallback is for development and tests; Hermes cron should use the config watchlist.

## Watchlist Format

```json
[
  {
    "ticker": "005930",
    "name": "Samsung Electronics",
    "market": "KOSPI"
  }
]
```

Required fields are `ticker` and `name`. Validation happens before any network call.

## Hermes Install

```bash
bash scripts/install-hermes-skill.sh
hermes skills list
```

The install script copies both the skill and the cron send script into Hermes:

- skill: `~/.hermes/skills/krx-daily-chart-pulse`
- cron script: `~/.hermes/scripts/hermes-send-krx-batches.py`
- watchlist config: `~/.hermes/config/krx-daily-chart-pulse/watchlist.json`

The install script creates `~/.hermes/config/krx-daily-chart-pulse/`. If `watchlist.json` does not exist and `examples/watchlist.local.json` exists, it copies that local file once as the initial config watchlist. Existing config watchlists are never overwritten. If there is no local seed, the installer copies only `watchlist.example.json` as a template and does not create a real portfolio watchlist.

The cron send script uses `$HERMES_HOME/config/krx-daily-chart-pulse/watchlist.json` by default and writes artifacts under `$HERMES_HOME/artifacts/krx-daily-chart-pulse`. `KRX_WATCHLIST` can override the watchlist; relative override paths are resolved from `$HERMES_HOME/config/krx-daily-chart-pulse/`.

Example cron:

```bash
hermes cron create "0 17 * * 1-5" \
  --name krx-daily-chart-pulse \
  --deliver local \
  --script hermes-send-krx-batches.py \
  --skill krx-daily-chart-pulse \
  --workdir "$HERMES_HOME" \
  "Read the Script Output JSON. Return its summary field exactly as the final local response. If failures is non-empty, return the summary followed by the first failure ticker and error."
```

Then run the returned job id:

```bash
hermes cron run <job_id> --accept-hooks
hermes cron tick --accept-hooks
```

The cron job stays as one Hermes job. Current Hermes cron sessions disable the interactive `messaging` toolset, so `scripts/hermes-send-krx-batches.py` runs as the cron pre-run script and calls Hermes' own `send_message` implementation sequentially for each ticker. Each call sends one text body plus three `MEDIA:/absolute/path/file.png` lines, which Hermes converts to native image attachments. The final cron response is local-only, for example `Sent 5/5 ticker batches`, so Telegram does not receive a duplicate final report.

Each successful ticker batch includes `chart.png`, `chart-overlay.png`, and `chart-momentum.png` in that order. Keep `MEDIA:` lines inside the per-ticker `send_message` body only; do not rely on final-response media extraction for Telegram delivery.

The chart renderer uses the vendored Noto Sans KR font from `ray5273/stock-analysis-skill`; high-quality Hangul rendering is performed by a repo-local Python venv at `.tmp/krx-chart-font-venv` with Pillow. The CLI creates that venv on first run and passes its Python to `chart-basics.js`. First run or `bash scripts/smoke-test.sh` may need network access to install Pillow; later runs reuse the local venv. If Pillow cannot be used and the renderer reports `external=false` or `pillow-missing`, ticker artifact generation fails instead of sending bitmap fallback Hangul charts.

## OpenClaw Install

```bash
bash scripts/install-openclaw-skill.sh
openclaw skills list
```

## Secret Safety

This repository does not require Telegram tokens or chat ids. `send-payload.json` and `result.json` keep relative local artifact paths. Absolute paths are computed only for Hermes-facing report or send-batch outputs, and delivery uses the configured Hermes home channel.
