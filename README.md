# portfolio-pulse-agent

Portfolio pulse agent for daily KRX and US chart pulse skills on Hermes/OpenClaw. The repository generates per-ticker chart artifacts and Telegram-ready payload files without storing or reading Telegram secrets. Delivery is delegated to Hermes.

Telegram image attachments use the vendored `ray5273/stock-analysis-skill` `kr-stock-analysis` `chart-basics.js` renderer: main trend, overlay, and momentum charts.

## Quick Start

```bash
bash scripts/smoke-test.sh
bash scripts/smoke-test-us.sh
```

Run manually:

```bash
node skills/krx-daily-chart-pulse/bin/daily-krx-chart-pulse.js \
  --watchlist examples/watchlist.example.json \
  --dry-run \
  --emit-hermes-send-batches

node skills/us-daily-chart-pulse/bin/daily-us-chart-pulse.js \
  --watchlist examples/us-watchlist.example.json \
  --dry-run \
  --emit-hermes-send-batches
```

Default artifacts are written to:

```text
.tmp/portfolio-pulse/YYYY-MM-DD/<ticker>/
.tmp/us-portfolio-pulse/YYYY-MM-DD/<ticker>/
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

The US skill has the same CLI contract under `daily-us-chart-pulse`. Its omitted watchlist resolution is `US_WATCHLIST`, `$HERMES_HOME/config/us-daily-chart-pulse/watchlist.json`, then `examples/us-watchlist.example.json`. Live US rows are fetched from Yahoo chart JSON without an API key, with Nasdaq historical JSON as the fallback; dry-run mode stays fully local.

## Watchlist Curator

Use `watchlist-curator` to look up KRX/US tickers and markets, or to turn loose add requests into confirmed watchlist entries. Lookup is read-only and reports candidates plus duplicate status:

```bash
node skills/watchlist-curator/bin/watchlist-curator.js lookup \
  --input "soil 주식시장과 티커 찾아줘" \
  --watchlist-krx examples/watchlist.example.json \
  --watchlist-us examples/us-watchlist.example.json \
  --offline
```

For deterministic fixtures, `soil` resolves to `010950 S-Oil (KOSPI), source=fixture`. `lookup` always prints a Korean `humanSummary` and structured JSON, never an `applyCommand`, and never writes watchlists.

For add requests, it proposes first and writes only after an explicit apply step:

```bash
node skills/watchlist-curator/bin/watchlist-curator.js propose \
  --input "삼성전자랑 Circle 추가해줘" \
  --watchlist-krx examples/watchlist.example.json \
  --watchlist-us examples/us-watchlist.example.json \
  --offline
```

`propose` prints a Korean `humanSummary`, a `confirmationPrompt`, and, only when every new entry is deterministic, `applyArgsJson` plus an exact shell fallback `applyCommand`. After reviewing and confirming the exact entries, Hermes/Python automation should parse `applyArgsJson` as a JSON array and run it as argv, for example with `subprocess.run(args, check=True)`. Do not reconstruct JSON-bearing commands with f-strings or manual escaping. For structured debugging, use `propose --json` or `resolve`.

```bash
node skills/watchlist-curator/bin/watchlist-curator.js apply \
  --watchlist-krx /path/to/krx/watchlist.json \
  --watchlist-us /path/to/us/watchlist.json \
  --entries-base64 W3sidGlja2VyIjoiQ1JDTCIsIm5hbWUiOiJDaXJjbGUgSW50ZXJuZXQgR3JvdXAiLCJtYXJrZXQiOiJOWVNFIn1d
```

`apply` also accepts legacy inline JSON with `--entries <json>` and a full resolver payload through stdin or `--from-resolve <path>`. Payloads with `okToApply=false`, `ambiguous`, or `unresolved` are rejected and never write to a watchlist.

Check a Hermes install without changing watchlists:

```bash
node skills/watchlist-curator/bin/watchlist-curator.js doctor
```

When paths are omitted, the curator uses `$HERMES_HOME/config/krx-daily-chart-pulse/watchlist.json` and `$HERMES_HOME/config/us-daily-chart-pulse/watchlist.json`.

`doctor` reports the current skill path, expected Hermes install path, fixture validity, default watchlist paths, and an offline `soil` lookup smoke test.

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
bash scripts/install-us-hermes-skill.sh
bash scripts/install-watchlist-curator-skill.sh
hermes skills list
```

The install script copies both the skill and the cron send script into Hermes:

- skill: `~/.hermes/skills/krx-daily-chart-pulse`
- cron script: `~/.hermes/scripts/hermes-send-krx-batches.py`
- watchlist config: `~/.hermes/config/krx-daily-chart-pulse/watchlist.json`

The US install script copies:

- skill: `~/.hermes/skills/us-daily-chart-pulse`
- cron script: `~/.hermes/scripts/hermes-send-us-batches.py`
- watchlist config: `~/.hermes/config/us-daily-chart-pulse/watchlist.json`

The watchlist curator install script copies:

- skill: `~/.hermes/skills/watchlist-curator`
- config directories for both KRX and US watchlists

It never creates or overwrites real `watchlist.json` files.

If `hermes skills list` shows `watchlist-curator` but `hermes skills inspect watchlist-curator` fails, reinstall with `bash scripts/install-watchlist-curator-skill.sh`, then run:

```bash
node skills/watchlist-curator/bin/watchlist-curator.js doctor
hermes skills list
hermes skills inspect watchlist-curator
```

Check that `doctor.skill.expectedHermesSkillFile` exists and that `doctor.lookupSmoke.ok` is `true`.

The install script creates `~/.hermes/config/krx-daily-chart-pulse/`. If `watchlist.json` does not exist and `examples/watchlist.local.json` exists, it copies that local file once as the initial config watchlist. Existing config watchlists are never overwritten. If there is no local seed, the installer copies only `watchlist.example.json` as a template and does not create a real portfolio watchlist.

The cron send script uses `$HERMES_HOME/config/krx-daily-chart-pulse/watchlist.json` by default and writes artifacts under `$HERMES_HOME/artifacts/krx-daily-chart-pulse`. `KRX_WATCHLIST` can override the watchlist; relative override paths are resolved from `$HERMES_HOME/config/krx-daily-chart-pulse/`.

The US cron send script uses `$HERMES_HOME/config/us-daily-chart-pulse/watchlist.json` by default and writes artifacts under `$HERMES_HOME/artifacts/us-daily-chart-pulse`. `US_WATCHLIST`, `US_DRY_RUN`, and `US_DATE` are supported for overrides and tests.

Example cron:

```bash
hermes cron create \
  --name krx-daily-chart-pulse \
  --deliver local \
  --script hermes-send-krx-batches.py \
  --skill krx-daily-chart-pulse \
  --workdir "$HERMES_HOME" \
  "0 17 * * 1-5" \
  "Read the Script Output JSON. Return its summary field exactly as the final local response. If failures is non-empty, return the summary followed by the first failure ticker and error."
```

Example US cron:

```bash
hermes cron create \
  --name us-daily-chart-pulse \
  --deliver local \
  --script hermes-send-us-batches.py \
  --skill us-daily-chart-pulse \
  --workdir "$HERMES_HOME" \
  "0 7 * * 2-6" \
  "Read the Script Output JSON. Return its summary field exactly as the final local response. If failures is non-empty, return the summary followed by the first failure ticker and error."
```

Then run the returned job id:

```bash
hermes --accept-hooks cron run <job_id>
hermes --accept-hooks cron tick
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
