---
name: watchlist-curator
description: Resolve loose KRX/US ticker, market, exchange, and watchlist-addition requests through the Hermes watchlist curator CLI.
---

# watchlist-curator

Use this skill when a user asks to identify companies, tickers, markets, or exchanges for KRX/US stocks, or asks to add companies or tickers to the Hermes KRX or US daily chart pulse watchlists. Examples include "soil 주식시장과 티커 찾아줘", "S-Oil 티커 알려줘", "Circle 어느 거래소야", and "삼성전자랑 Circle 추가해줘".

## Immediate Action

For lookup text like `soil 주식`, `S-Oil 티커`, or `Circle 어느 거래소야`, immediately run this CLI through the terminal tool and show the `humanSummary`:

```bash
node /Users/sanghyeok/.hermes/skills/watchlist-curator/bin/watchlist-curator.js lookup --input "<user text>"
```

Do not use `search_files` for stock lookup text. Do not call a tool named `watchlist-curator`; it is not a tool.

## Safety Rule

Never edit a real watchlist on the first pass. Do not infer tickers or companies yourself. For lookup-only requests, run `lookup` and report candidates only. For add/register requests, run `propose`, show the CLI's `humanSummary` and `confirmationPrompt` exactly, then wait for explicit user confirmation. Only run `apply` after the user clearly confirms the exact entries.

`watchlist-curator` is a skill and CLI, not a callable Hermes tool. Do not call a tool named `watchlist-curator`; it does not exist. Use the terminal/process tool to run the Node CLI at `${HERMES_HOME:-$HOME/.hermes}/skills/watchlist-curator/bin/watchlist-curator.js`. If a user says only "soil 주식", "S-Oil 티커", or similar, treat it as a lookup request and run `lookup --input "<user text>"` immediately instead of asking which stock they mean.

After confirmation, prefer `applyArgsJson` over `applyCommand` whenever it is present. Parse `applyArgsJson` as a JSON array and run it as argv, for example `subprocess.run(args, check=True)` in Python. Do not rebuild the command with Python f-strings, manual quoting, or manual escaping. `applyCommand` is a shell fallback only.

Do not say nonexistent tools or skills are available. In particular, do not claim access to `search`, `web`, or `stock-analysis-skill` unless they are actually present in the current runtime. Browser or general web search is a last resort for unresolved candidates; ticker and market lookup should use this CLI first.

## Workflow

1. Do not parse or guess the requested companies yourself.
2. If the user is asking only to find or identify a ticker, market, exchange, KRX symbol, or US symbol, run `lookup` with the original user text. Do not ask for clarification first when the text contains a recognizable company name, alias, ticker, or partial alias such as `soil`:

```bash
node "${HERMES_HOME:-$HOME/.hermes}/skills/watchlist-curator/bin/watchlist-curator.js" lookup --input "<user text>"
```

From this repository during development:

```bash
node skills/watchlist-curator/bin/watchlist-curator.js lookup --input "<user text>" --offline \
  --watchlist-krx examples/watchlist.example.json \
  --watchlist-us examples/us-watchlist.example.json
```

Show the lookup `humanSummary` and, when useful for debugging or automation, the structured JSON. `lookup` is read-only and never prints an apply command.

3. If the user asks to add/register/put a company or ticker into a watchlist, run `propose`:

```bash
node "${HERMES_HOME:-$HOME/.hermes}/skills/watchlist-curator/bin/watchlist-curator.js" propose --input "<user text>"
```

From this repository during development:

```bash
node skills/watchlist-curator/bin/watchlist-curator.js propose --input "<user text>" --offline \
  --watchlist-krx examples/watchlist.example.json \
  --watchlist-us examples/us-watchlist.example.json
```

4. Show the CLI output to the user without rewriting the proposed entries:
   - Copy the complete `humanSummary` block.
   - Copy the complete `confirmationPrompt` block.
   - If the output includes `applyArgsJson` or an apply command, do not edit it.
5. If the user confirms the exact entries, run `applyArgsJson` as a parsed argv array when present. Use the printed `applyCommand` exactly as printed only if `applyArgsJson` is unavailable.
6. If the CLI reports `ambiguous` or `unresolved`, do not run `apply`.
   - For `ambiguous`, ask the user to choose one of the printed candidates.
   - For `unresolved`, perform web search only to present candidates with sources. Do not write candidates directly to a watchlist.

Use `lookup`, `propose --json`, or `resolve` when you need structured data for debugging. The JSON fields are:

   - `matches`: lookup-only resolved `{ entry, source, duplicate }` candidates.
   - `additions`: proposed normalized `{ ticker, name, market }` entries, preserving `memo` when supplied.
   - `duplicates`: requested names already present in the relevant watchlist.
   - `ambiguous`: multiple plausible matches; ask the user to choose.
   - `unresolved`: no deterministic match; perform web search and return candidates instead of guessing.
   - `humanSummary`: Korean text to show the user as-is.
   - `confirmationPrompt`: Korean confirmation prompt to show the user as-is.
   - `applyArgsJson`: argv array to run after confirmation. Empty means writing is forbidden. Prefer this field for Hermes/Python execution.
   - `applyCommand`: exact shell fallback command to run after confirmation. Empty means writing is forbidden.

## Normalization

- KRX tickers are six digits.
- KRX `.KS` or KOSPI symbols map to `KOSPI`.
- KRX `.KQ` or KOSDAQ symbols map to `KOSDAQ`.
- US tickers are uppercased and deduplicated case-insensitively.
- US markets normalize to `NASDAQ`, `NYSE`, or `AMEX`.
- The watchlist item shape is `{ "ticker": "...", "name": "...", "market": "..." }`; include `memo` only when the user supplied it.

## Source Strategy

The CLI includes a small bundled fixture set for deterministic common requests and local tests. When `--offline` is not set, unresolved entries may use live lookups:

- Yahoo Finance search for US exact symbols and company-name candidates.
- Nasdaq symbol directories for listed US equity candidates.
- Naver Finance autocomplete for KRX name candidates.

Live lookup can fail or rate-limit. If a name cannot be verified deterministically, do a normal web search, cite the source to the user, and present candidates rather than writing.

## Default Watchlists

Unless overridden, the CLI reads and writes:

- `${HERMES_HOME:-$HOME/.hermes}/config/krx-daily-chart-pulse/watchlist.json`
- `${HERMES_HOME:-$HOME/.hermes}/config/us-daily-chart-pulse/watchlist.json`

Use `--watchlist-krx` and `--watchlist-us` for tests or temporary copies.
