#!/usr/bin/env node
import { constants as fsConstants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = fileURLToPath(import.meta.url);
const SKILL_DIR = dirname(__dirname);
const BUNDLED_SYMBOLS = resolvePath(SKILL_DIR, "data/symbols.fixture.json");
const KRX_TICKER_RE = /^\d{6}$/;
const US_TICKER_RE = /^[A-Z][A-Z0-9.]{0,11}$/;
const KRX_MARKETS = new Set(["KOSPI", "KOSDAQ", "KONEX"]);
const US_MARKETS = new Set(["NASDAQ", "NYSE", "AMEX"]);

function usage() {
  return `watchlist-curator <lookup|resolve|propose|apply|doctor> [options]

Commands:
  lookup                        Find ticker/market candidates without writing watchlists.
  resolve                       Parse input and return proposed watchlist additions as JSON.
  propose                       Print a Korean confirmation message for a user to review.
  apply                         Merge confirmed entries into KRX/US watchlist JSON files.
  doctor                        Check Hermes skill/watchlist installation without modifying files.

Options:
  --input <text>                Loose user request text. If omitted, lookup/resolve reads stdin.
  --entries <json>              Confirmed entries JSON for apply. If omitted, apply reads stdin.
  --entries-base64 <base64>     UTF-8 JSON entries encoded as base64 for shell-safe apply.
  --from-resolve <path>         Apply from a full resolve JSON file.
  --json                        With propose, also print the structured resolve JSON.
  --market <auto|krx|us>        Candidate market scope. Default: auto.
  --watchlist-krx <path>        KRX watchlist path.
  --watchlist-us <path>         US watchlist path.
  --source-file <path>          Extra symbol fixture JSON file for deterministic tests.
  --offline                    Disable optional live lookup fallbacks.
  --help                       Show this help.
`;
}

function parseArgs(argv) {
  const args = [...argv];
  const command = args.shift();
  if (command === "--help" || command === "-h") {
    return {
      command: undefined,
      help: true,
      market: "auto",
      watchlistKrx: defaultWatchlistPath("krx"),
      watchlistUs: defaultWatchlistPath("us"),
      sourceFiles: [],
      offline: false
    };
  }
  const options = {
    command,
    market: "auto",
    watchlistKrx: defaultWatchlistPath("krx"),
    watchlistUs: defaultWatchlistPath("us"),
    sourceFiles: [],
    offline: false,
    json: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--offline") {
      options.offline = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--input") {
      options.input = requireValue(args, ++index, arg);
    } else if (arg === "--entries") {
      options.entries = requireValue(args, ++index, arg);
    } else if (arg === "--entries-base64") {
      options.entriesBase64 = requireValue(args, ++index, arg);
    } else if (arg === "--from-resolve") {
      options.fromResolve = requireValue(args, ++index, arg);
    } else if (arg === "--market") {
      options.market = requireValue(args, ++index, arg).toLowerCase();
    } else if (arg === "--watchlist-krx") {
      options.watchlistKrx = requireValue(args, ++index, arg);
    } else if (arg === "--watchlist-us") {
      options.watchlistUs = requireValue(args, ++index, arg);
    } else if (arg === "--source-file") {
      options.sourceFiles.push(requireValue(args, ++index, arg));
    } else {
      throw new Error(`Unknown option ${arg}`);
    }
  }

  if (!["lookup", "resolve", "propose", "apply", "doctor", undefined].includes(command)) {
    throw new Error(`Unknown command ${command}`);
  }
  if (!["auto", "krx", "us"].includes(options.market)) {
    throw new Error("--market must be auto, krx, or us");
  }
  return options;
}

function requireValue(args, index, name) {
  const value = args[index];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

function defaultWatchlistPath(market) {
  const hermesHome = process.env.HERMES_HOME || resolvePath(os.homedir(), ".hermes");
  const dir = market === "krx" ? "krx-daily-chart-pulse" : "us-daily-chart-pulse";
  return resolvePath(hermesHome, "config", dir, "watchlist.json");
}

async function readStdin() {
  let text = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) text += chunk;
  return text.trim();
}

async function readJsonFile(path, fallback = undefined) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (fallback !== undefined && error.code === "ENOENT") return fallback;
    throw new Error(`Failed to read JSON ${path}: ${error.message}`);
  }
}

async function loadWatchlist(path) {
  const parsed = await readJsonFile(path, []);
  if (!Array.isArray(parsed)) throw new Error(`Watchlist ${path} must be a JSON array`);
  return parsed.map((item, index) => normalizeWatchlistItem(item, index));
}

function normalizeWatchlistItem(item, index) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    throw new Error(`Watchlist item ${index + 1} must be an object`);
  }
  const ticker = String(item.ticker || "").trim().toUpperCase();
  const name = String(item.name || "").trim();
  if (!ticker) throw new Error(`Watchlist item ${index + 1} is missing ticker`);
  if (!name) throw new Error(`Watchlist item ${index + 1} is missing name`);
  return { ...item, ticker, name, market: normalizeMarket(item.market, ticker) };
}

function normalizeMarket(rawMarket, ticker = "") {
  const text = String(rawMarket || "").trim().toUpperCase();
  if (text === "KS" || text === ".KS") return "KOSPI";
  if (text === "KQ" || text === ".KQ") return "KOSDAQ";
  if (text === "NAS" || text === "NMS" || text === "NGM" || text === "NCM") return "NASDAQ";
  if (text === "ASE" || text === "NYSE AMERICAN") return "AMEX";
  if (text.includes("NASDAQ")) return "NASDAQ";
  if (text.includes("NYSE AMERICAN")) return "AMEX";
  if (text.includes("NYSE")) return "NYSE";
  if (text && KRX_MARKETS.has(text)) return text;
  if (text && US_MARKETS.has(text)) return text;
  if (/\.KS$/i.test(ticker)) return "KOSPI";
  if (/\.KQ$/i.test(ticker)) return "KOSDAQ";
  return text || (KRX_TICKER_RE.test(ticker) ? "KOSPI" : "US");
}

function normalizeTicker(rawTicker, market = "") {
  const ticker = String(rawTicker || "").trim().toUpperCase();
  if (/^\d{6}\.KS$/.test(ticker) || /^\d{6}\.KQ$/.test(ticker)) return ticker.slice(0, 6);
  if (KRX_MARKETS.has(market)) return ticker.replace(/\.(KS|KQ)$/i, "");
  return ticker;
}

function entryCountry(entry) {
  const market = normalizeMarket(entry.market, entry.ticker);
  if (KRX_MARKETS.has(market) || KRX_TICKER_RE.test(String(entry.ticker || ""))) return "KR";
  if (US_MARKETS.has(market) || US_TICKER_RE.test(String(entry.ticker || "").toUpperCase())) return "US";
  return String(entry.country || "").toUpperCase();
}

function normalizeSymbolEntry(entry) {
  const market = normalizeMarket(entry.market, entry.ticker);
  const ticker = normalizeTicker(entry.ticker, market);
  const name = String(entry.name || "").trim();
  const aliases = Array.isArray(entry.aliases) ? entry.aliases.map((value) => String(value).trim()).filter(Boolean) : [];
  return {
    ticker,
    name,
    market,
    country: entry.country ? String(entry.country).toUpperCase() : entryCountry({ ...entry, ticker, market }),
    aliases,
    source: entry.source ? String(entry.source) : undefined
  };
}

async function loadSymbols(sourceFiles) {
  const files = [BUNDLED_SYMBOLS, ...sourceFiles];
  const entries = [];
  for (const file of files) {
    const parsed = await readJsonFile(file, []);
    if (!Array.isArray(parsed)) throw new Error(`Symbol source ${file} must be a JSON array`);
    entries.push(...parsed.map(normalizeSymbolEntry).filter((entry) => entry.ticker && entry.name));
  }
  return dedupeSymbolEntries(entries);
}

function dedupeSymbolEntries(entries) {
  const seen = new Set();
  const result = [];
  for (const entry of entries) {
    const key = `${entry.country}:${entry.ticker.toUpperCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }
  return result;
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[()［］[\]{}"'`]/g, " ")
    .replace(/\s+/g, " ");
}

function parseRequestedItems(input) {
  const original = String(input || "").trim();
  if (!original) return [];

  const memoMatch = /\b(?:memo|메모|note)\s*[:=]\s*(.+)$/i.exec(original);
  const memo = memoMatch ? memoMatch[1].trim() : "";
  let text = memoMatch ? original.slice(0, memoMatch.index) : original;
  text = text
    .replace(/(?:워치리스트|watchlist|관심종목|포트폴리오|portfolio)/gi, " ")
    .replace(/(?:추가해줘|추가해|추가|넣어줘|넣어|등록해줘|등록|add|please|pls|to my|to the)/gi, " ")
    .replace(/(?:찾아줘|찾아|알려줘|알려|확인해줘|확인|조회해줘|조회|검색해줘|검색|find|lookup|search)/gi, " ")
    .replace(/(?:주식\s*시장|증시|거래소(?:야|인가요|인가|이야)?|시장(?:이야|인가요|인가|야)?|exchange|exchanges|market|markets)/gi, " ")
    .replace(/(?:티커|심볼|종목코드|주식|종목|stock|stocks|ticker|tickers|symbol|symbols)/gi, " ")
    .replace(/(^|[\s,，、/+])(?:어느|어떤|어디|뭐야|뭐|인가요|인가|이야|야|상장)(?=$|[\s,，、/+])/g, "$1")
    .replace(/\b(?:listed|what|which|where|is|on)\b/gi, " ")
    .replace(/(^|[\s,，、/+])(?:한국|국내|코스피|코스닥|코넥스|krx|kospi|kosdaq|konex)(?=$|[\s,，、/+])/gi, "$1")
    .replace(/[+]/g, ",")
    .replace(/\b(?:and|with)\b/gi, ",")
    .replace(/(?:이랑|랑|하고|와|과|및)/g, ",")
    .replace(/[，、/]/g, ",");

  return text
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((query) => ({ query, memo }));
}

function scoreSymbol(query, symbol) {
  const q = normalizeText(query);
  const ticker = normalizeText(symbol.ticker);
  const name = normalizeText(symbol.name);
  const aliases = symbol.aliases.map(normalizeText);
  if (!q) return 0;
  if (q === ticker) return 120;
  if (aliases.includes(q)) return 110;
  if (q === name) return 105;
  if (name.startsWith(q)) return 80;
  if (aliases.some((alias) => alias.startsWith(q))) return 78;
  if (name.includes(q)) return 55;
  if (aliases.some((alias) => alias.includes(q))) return 52;
  return 0;
}

function marketAllows(symbol, market) {
  if (market === "auto") return true;
  return market === "krx" ? symbol.country === "KR" : symbol.country === "US";
}

function candidateFromSymbol(symbol, requested) {
  const entry = {
    ticker: symbol.ticker,
    name: symbol.name,
    market: symbol.market
  };
  if (requested.memo) entry.memo = requested.memo;
  return {
    ...entry,
    source: "fixture",
    requested: requested.query
  };
}

async function resolveOne(requested, symbols, options) {
  const scored = symbols
    .filter((symbol) => marketAllows(symbol, options.market))
    .map((symbol) => ({ symbol, score: scoreSymbol(requested.query, symbol) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.symbol.ticker.localeCompare(b.symbol.ticker));

  if (scored.length > 0) {
    const topScore = scored[0].score;
    const tied = scored.filter((item) => item.score === topScore);
    if (tied.length === 1 && topScore >= 80) {
      return { status: "resolved", candidate: candidateFromSymbol(tied[0].symbol, requested) };
    }
    return {
      status: "ambiguous",
      requested: requested.query,
      candidates: scored.slice(0, 5).map((item) => candidateFromSymbol(item.symbol, requested))
    };
  }

  if (!options.offline) {
    const liveCandidates = await liveLookup(requested, options);
    if (liveCandidates.length === 1) {
      return { status: "resolved", candidate: liveCandidates[0] };
    }
    if (liveCandidates.length > 1) {
      return { status: "ambiguous", requested: requested.query, candidates: liveCandidates };
    }
  }

  return {
    status: "unresolved",
    requested: requested.query,
    reason: "No deterministic match. Perform a web search and return candidates instead of guessing."
  };
}

async function liveLookup(requested, options) {
  const query = requested.query.trim();
  if (!query) return [];
  const lookups = [];
  if (options.market === "auto" || options.market === "us") {
    lookups.push(lookupNasdaqSymbolDirectories(query, requested));
    lookups.push(lookupYahooExactSymbol(query, requested));
    lookups.push(lookupYahooSearch(query, requested));
  }
  if (options.market === "auto" || options.market === "krx") lookups.push(lookupNaverAutocomplete(query, requested));
  const results = await Promise.allSettled(lookups);
  return dedupeSymbolEntries(results.flatMap((result) => result.status === "fulfilled" ? result.value : []))
    .map((entry) => ({
      ticker: entry.ticker,
      name: entry.name,
      market: entry.market,
      ...(requested.memo ? { memo: requested.memo } : {}),
      source: entry.source || "live",
      requested: requested.query
    }));
}

async function lookupNasdaqSymbolDirectories(query, requested) {
  const [nasdaq, other] = await Promise.all([
    fetchSymbolDirectory("https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt", parseNasdaqListedRow),
    fetchSymbolDirectory("https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt", parseOtherListedRow)
  ]);
  const q = normalizeText(query);
  return [...nasdaq, ...other]
    .filter((entry) => {
      const ticker = normalizeText(entry.ticker);
      const name = normalizeText(entry.name);
      return ticker === q || name === q || name.startsWith(q) || name.includes(q);
    })
    .slice(0, 8)
    .map((entry) => normalizeSymbolEntry({
      ...entry,
      country: "US",
      aliases: [requested.query],
      source: "nasdaq-symbol-directory"
    }));
}

async function fetchSymbolDirectory(url, parseRow) {
  const response = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!response.ok) return [];
  const text = await response.text();
  return text
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line && !/^File Creation Time:/i.test(line))
    .map(parseRow)
    .filter(Boolean);
}

function parseNasdaqListedRow(line) {
  const parts = line.split("|");
  const ticker = String(parts[0] || "").trim().toUpperCase();
  const name = String(parts[1] || "").replace(/\s+-\s+.*$/, "").trim();
  if (!US_TICKER_RE.test(ticker) || !name || parts[3] === "Y") return null;
  return { ticker, name, market: "NASDAQ" };
}

function parseOtherListedRow(line) {
  const parts = line.split("|");
  const ticker = String(parts[0] || "").trim().toUpperCase();
  const name = String(parts[1] || "").replace(/\s+-\s+.*$/, "").trim();
  const market = normalizeOtherListedExchange(parts[2]);
  if (!US_TICKER_RE.test(ticker) || !name || !market || parts[6] === "Y") return null;
  return { ticker, name, market };
}

function normalizeOtherListedExchange(value) {
  const exchange = String(value || "").trim().toUpperCase();
  if (exchange === "N") return "NYSE";
  if (exchange === "A") return "AMEX";
  if (exchange === "Q") return "NASDAQ";
  return "";
}

async function lookupYahooExactSymbol(query, requested) {
  const symbol = String(query || "").trim().toUpperCase();
  if (!US_TICKER_RE.test(symbol)) return [];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${new URLSearchParams({
    interval: "1d",
    range: "5d"
  })}`;
  const response = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!response.ok) return [];
  const payload = await response.json();
  if (payload?.chart?.error) return [];
  const meta = payload?.chart?.result?.[0]?.meta;
  const ticker = String(meta?.symbol || symbol).trim().toUpperCase();
  const market = normalizeMarket(meta?.fullExchangeName || meta?.exchangeName, ticker);
  const name = String(meta?.longName || meta?.shortName || "").trim();
  if (!US_TICKER_RE.test(ticker) || !US_MARKETS.has(market) || !name) return [];
  return [normalizeSymbolEntry({
    ticker,
    name,
    market,
    country: "US",
    aliases: [requested.query],
    source: "yahoo-chart"
  })];
}

async function lookupYahooSearch(query, requested) {
  const url = `https://query2.finance.yahoo.com/v1/finance/search?${new URLSearchParams({
    q: query,
    quotesCount: "8",
    newsCount: "0"
  })}`;
  const response = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!response.ok) return [];
  const payload = await response.json();
  const quotes = Array.isArray(payload?.quotes) ? payload.quotes : [];
  return quotes
    .filter((quote) => quote.quoteType === "EQUITY")
    .map((quote) => {
      const symbol = String(quote.symbol || "").toUpperCase();
      const exchange = normalizeMarket(quote.exchDisp || quote.exchange, symbol);
      return normalizeSymbolEntry({
        ticker: symbol,
        name: quote.shortname || quote.longname || symbol,
        market: exchange,
        country: KRX_TICKER_RE.test(symbol.replace(/\.(KS|KQ)$/i, "")) ? "KR" : "US",
        aliases: [requested.query],
        source: "yahoo-search"
      });
    })
    .filter((entry) => {
      if (entry.country === "KR") return KRX_MARKETS.has(entry.market);
      return US_MARKETS.has(entry.market) && US_TICKER_RE.test(entry.ticker);
    });
}

async function lookupNaverAutocomplete(query, requested) {
  const url = `https://ac.finance.naver.com/ac?${new URLSearchParams({
    q: query,
    q_enc: "UTF-8",
    st: "111",
    r_lt: "111"
  })}`;
  const response = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!response.ok) return [];
  const text = await response.text();
  const matches = [...text.matchAll(/"([0-9]{6})"\s*,\s*"([^"]+)"/g)];
  return matches.slice(0, 8).map((match) => normalizeSymbolEntry({
    ticker: match[1],
    name: match[2],
    market: "KOSPI",
    country: "KR",
    aliases: [requested.query],
    source: "naver-autocomplete"
  }));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function splitExisting(items) {
  return {
    krx: new Set(items.krx.map((item) => item.ticker)),
    us: new Set(items.us.map((item) => item.ticker.toUpperCase()))
  };
}

function isDuplicate(entry, existing) {
  if (KRX_MARKETS.has(entry.market) || KRX_TICKER_RE.test(entry.ticker)) return existing.krx.has(entry.ticker);
  return existing.us.has(entry.ticker.toUpperCase());
}

function cleanCandidate(candidate) {
  const entry = {
    ticker: normalizeTicker(candidate.ticker, normalizeMarket(candidate.market, candidate.ticker)),
    name: String(candidate.name || "").trim(),
    market: normalizeMarket(candidate.market, candidate.ticker)
  };
  if (candidate.memo) entry.memo = String(candidate.memo).trim();
  return entry;
}

function validateCandidate(entry) {
  if (!entry.ticker) throw new Error("Confirmed entry is missing ticker");
  if (!entry.name) throw new Error(`Confirmed entry ${entry.ticker} is missing name`);
  if (KRX_MARKETS.has(entry.market)) {
    if (!KRX_TICKER_RE.test(entry.ticker)) throw new Error(`KRX ticker must be six digits: ${entry.ticker}`);
  } else if (US_MARKETS.has(entry.market)) {
    if (!US_TICKER_RE.test(entry.ticker)) throw new Error(`US ticker is invalid: ${entry.ticker}`);
  } else {
    throw new Error(`Unsupported market for ${entry.ticker}: ${entry.market}`);
  }
}

async function buildResolveOutput(options) {
  const input = options.input ?? await readStdin();
  const requested = parseRequestedItems(input);
  const [symbols, krxWatchlist, usWatchlist] = await Promise.all([
    loadSymbols(options.sourceFiles),
    loadWatchlist(options.watchlistKrx),
    loadWatchlist(options.watchlistUs)
  ]);
  const existing = splitExisting({ krx: krxWatchlist, us: usWatchlist });
  const resolved = [];
  const duplicates = [];
  const ambiguous = [];
  const unresolved = [];

  for (const item of requested) {
    const result = await resolveOne(item, symbols, options);
    if (result.status === "resolved") {
      const entry = cleanCandidate(result.candidate);
      validateCandidate(entry);
      if (isDuplicate(entry, existing)) {
        duplicates.push({ requested: item.query, entry });
      } else {
        resolved.push({ requested: item.query, entry, source: result.candidate.source || "fixture" });
        if (KRX_MARKETS.has(entry.market)) {
          existing.krx.add(entry.ticker);
        } else {
          existing.us.add(entry.ticker.toUpperCase());
        }
      }
    } else if (result.status === "ambiguous") {
      ambiguous.push({
        requested: result.requested,
        candidates: result.candidates.map(cleanCandidate)
      });
    } else {
      unresolved.push(result);
    }
  }

  const okToApply = outputCanApply(resolved, ambiguous, unresolved);
  const output = {
    okToApply,
    input,
    requested: requested.map((item) => item.query),
    additions: resolved.map((item) => item.entry),
    duplicates,
    ambiguous,
    unresolved,
    watchlists: {
      krx: options.watchlistKrx,
      us: options.watchlistUs
    },
    nextStep: okToApply
      ? "Show this proposed diff to the user and run apply only after explicit confirmation."
      : "Do not write watchlists. Ask the user to choose from candidates or provide a ticker."
  };
  output.applyEntriesJson = okToApply ? JSON.stringify(output.additions) : "";
  output.applyArgsJson = okToApply ? buildApplyArgs(output, options) : [];
  output.applyCommand = okToApply ? buildApplyCommand(output.applyArgsJson) : "";
  output.humanSummary = buildHumanSummary(output);
  output.confirmationPrompt = buildConfirmationPrompt(output);
  return output;
}

async function buildLookupOutput(options) {
  const input = options.input ?? await readStdin();
  const requested = parseRequestedItems(input);
  const [symbols, krxWatchlist, usWatchlist] = await Promise.all([
    loadSymbols(options.sourceFiles),
    loadWatchlist(options.watchlistKrx),
    loadWatchlist(options.watchlistUs)
  ]);
  const existing = splitExisting({ krx: krxWatchlist, us: usWatchlist });
  const matches = [];
  const ambiguous = [];
  const unresolved = [];

  for (const item of requested) {
    const result = await resolveOne(item, symbols, options);
    if (result.status === "resolved") {
      const candidate = cleanLookupCandidate(result.candidate, existing);
      validateCandidate(candidate.entry);
      matches.push({
        requested: item.query,
        ...candidate
      });
    } else if (result.status === "ambiguous") {
      ambiguous.push({
        requested: result.requested,
        candidates: result.candidates.map((candidate) => cleanLookupCandidate(candidate, existing))
      });
    } else {
      unresolved.push({
        requested: result.requested,
        reason: "No deterministic ticker/market candidate was found."
      });
    }
  }

  const output = {
    okToApply: false,
    mode: "lookup",
    writesWatchlist: false,
    input,
    requested: requested.map((item) => item.query),
    matches,
    duplicates: matches.filter((item) => item.duplicate),
    ambiguous,
    unresolved,
    watchlists: {
      krx: options.watchlistKrx,
      us: options.watchlistUs
    },
    nextStep: "Lookup is read-only. To add a candidate, run propose and wait for explicit user confirmation before apply."
  };
  output.humanSummary = buildLookupHumanSummary(output);
  return output;
}

function cleanLookupCandidate(candidate, existing) {
  const entry = cleanCandidate(candidate);
  return {
    entry,
    source: candidate.source || "fixture",
    duplicate: isDuplicate(entry, existing)
  };
}

async function resolveCommand(options) {
  printJson(await buildResolveOutput(options));
}

async function lookupCommand(options) {
  const output = await buildLookupOutput(options);
  process.stdout.write(formatLookup(output));
}

async function proposeCommand(options) {
  const output = await buildResolveOutput(options);
  process.stdout.write(formatProposal(output));
  if (options.json) {
    process.stdout.write("\n\n구조화 JSON:\n");
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  }
}

function buildApplyArgs(output, options) {
  return [
    "node",
    CLI_PATH,
    "apply",
    "--watchlist-krx",
    options.watchlistKrx,
    "--watchlist-us",
    options.watchlistUs,
    "--entries-base64",
    entriesToBase64(output.additions)
  ];
}

function buildApplyCommand(args) {
  return args.map(shellQuote).join(" ");
}

function entriesToBase64(entries) {
  return Buffer.from(JSON.stringify(entries), "utf8").toString("base64");
}

function shellQuote(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:=+-]+$/.test(text)) return text;
  return `'${text.replace(/'/g, "'\\''")}'`;
}

function buildHumanSummary(output) {
  const lines = [];
  if (output.additions.length > 0) {
    lines.push("추가 예정:");
    for (const entry of output.additions) lines.push(`- ${formatEntry(entry)}`);
  } else {
    lines.push("추가 예정 항목이 없습니다.");
  }
  if (output.duplicates.length > 0) {
    lines.push("이미 watchlist에 있는 항목:");
    for (const duplicate of output.duplicates) lines.push(`- ${duplicate.requested}: ${formatEntry(duplicate.entry)}`);
  }
  if (output.ambiguous.length > 0) {
    lines.push("선택이 필요한 모호한 항목:");
    for (const item of output.ambiguous) lines.push(`- ${item.requested}: ${item.candidates.map(formatEntry).join(" / ")}`);
  }
  if (output.unresolved.length > 0) {
    lines.push("확인되지 않은 항목:");
    for (const item of output.unresolved) lines.push(`- ${item.requested}: 웹 검색으로 후보를 확인해야 합니다.`);
  }
  if (!output.okToApply) {
    if (output.ambiguous.length > 0 || output.unresolved.length > 0) {
      lines.push("쓰기 금지: 모호하거나 확인되지 않은 항목이 있어 apply 명령을 제공하지 않습니다.");
    } else {
      lines.push("쓰기 생략: 새로 추가할 항목이 없어 apply 명령을 제공하지 않습니다.");
    }
  }
  return lines.join("\n");
}

function buildConfirmationPrompt(output) {
  if (output.additions.length === 0 && output.ambiguous.length === 0 && output.unresolved.length === 0) {
    return "요청한 항목은 모두 이미 watchlist에 있어 수정하지 않습니다.";
  }
  if (!output.okToApply) {
    return "모호한 항목은 후보 중 하나를 선택하고, 확인되지 않은 항목은 정확한 티커와 거래소를 알려주세요. 현재 상태에서는 watchlist를 수정하지 않습니다.";
  }
  return "위 추가 예정 항목을 watchlist에 적용할까요? 정확히 맞으면 확인이라고 답해주세요.";
}

function formatProposal(output) {
  const lines = ["humanSummary:", output.humanSummary, "", "confirmationPrompt:", output.confirmationPrompt];
  if (output.applyArgsJson.length > 0) {
    lines.push("", "applyArgsJson:", JSON.stringify(output.applyArgsJson, null, 2));
  }
  if (output.applyCommand) lines.push("", "applyCommand:", output.applyCommand);
  return `${lines.join("\n")}\n`;
}

function buildLookupHumanSummary(output) {
  const lines = [];
  if (output.matches.length > 0) {
    lines.push("조회 결과:");
    for (const item of output.matches) {
      const duplicateText = item.duplicate ? ", watchlist=already-present" : ", watchlist=not-present";
      lines.push(`- ${item.requested}: ${formatEntry(item.entry)}, source=${item.source}${duplicateText}`);
    }
  } else {
    lines.push("조회 결과가 없습니다.");
  }
  if (output.ambiguous.length > 0) {
    lines.push("여러 후보가 있어 하나로 고르지 않았습니다:");
    for (const item of output.ambiguous) {
      lines.push(`- ${item.requested}: ${item.candidates.map(formatLookupCandidate).join(" / ")}`);
    }
  }
  if (output.unresolved.length > 0) {
    lines.push("확인되지 않은 항목:");
    for (const item of output.unresolved) lines.push(`- ${item.requested}: 후보 없음`);
  }
  lines.push("쓰기 금지: lookup은 watchlist를 수정하지 않습니다. 추가하려면 propose로 확인 절차를 시작하세요.");
  return lines.join("\n");
}

function formatLookup(output) {
  return `humanSummary:\n${output.humanSummary}\n\n구조화 JSON:\n${JSON.stringify(output, null, 2)}\n`;
}

function formatLookupCandidate(candidate) {
  const duplicateText = candidate.duplicate ? ", watchlist=already-present" : ", watchlist=not-present";
  return `${formatEntry(candidate.entry)}, source=${candidate.source}${duplicateText}`;
}

function formatEntry(entry) {
  return `${entry.ticker} ${entry.name} (${entry.market})`;
}

function outputCanApply(resolved, ambiguous, unresolved) {
  return resolved.length > 0 && ambiguous.length === 0 && unresolved.length === 0;
}

function parseEntriesPayload(text) {
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    if (parsed.okToApply === false) throw new Error("Resolve payload is not ok to apply");
    if (Array.isArray(parsed.ambiguous) && parsed.ambiguous.length > 0) {
      throw new Error("Resolve payload contains ambiguous entries and cannot be applied");
    }
    if (Array.isArray(parsed.unresolved) && parsed.unresolved.length > 0) {
      throw new Error("Resolve payload contains unresolved entries and cannot be applied");
    }
    if (Array.isArray(parsed.additions)) {
      if ("okToApply" in parsed && parsed.okToApply !== true) throw new Error("Resolve payload is not ok to apply");
      return parsed.additions;
    }
    if (Array.isArray(parsed.entries)) return parsed.entries;
  }
  throw new Error("Apply input must be an array, or an object with additions/entries array");
}

async function applyCommand(options) {
  const text = await readApplyPayload(options);
  if (!text.trim()) {
    throw new Error("apply requires --entries JSON, --entries-base64 JSON, --from-resolve JSON, or JSON on stdin");
  }
  const entries = parseEntriesPayload(text).map(cleanCandidate);
  if (entries.length === 0) throw new Error("No confirmed entries to apply");
  entries.forEach(validateCandidate);

  const [krxWatchlist, usWatchlist] = await Promise.all([
    loadWatchlist(options.watchlistKrx),
    loadWatchlist(options.watchlistUs)
  ]);

  const existing = splitExisting({ krx: krxWatchlist, us: usWatchlist });
  const appended = [];
  const duplicates = [];
  for (const entry of entries) {
    if (isDuplicate(entry, existing)) {
      duplicates.push(entry);
      continue;
    }
    if (KRX_MARKETS.has(entry.market)) {
      krxWatchlist.push(entry);
      existing.krx.add(entry.ticker);
      appended.push({ watchlist: "krx", entry });
    } else {
      usWatchlist.push(entry);
      existing.us.add(entry.ticker.toUpperCase());
      appended.push({ watchlist: "us", entry });
    }
  }

  if (appended.some((item) => item.watchlist === "krx")) {
    await writeWatchlist(options.watchlistKrx, krxWatchlist);
  }
  if (appended.some((item) => item.watchlist === "us")) {
    await writeWatchlist(options.watchlistUs, usWatchlist);
  }

  printJson({
    applied: appended,
    duplicates,
    watchlists: {
      krx: options.watchlistKrx,
      us: options.watchlistUs
    }
  });
}

async function readApplyPayload(options) {
  if (options.fromResolve) return readFile(options.fromResolve, "utf8");
  if (options.entries !== undefined) return options.entries;
  if (options.entriesBase64 !== undefined) return decodeEntriesBase64(options.entriesBase64);
  return readStdin();
}

function decodeEntriesBase64(value) {
  const text = String(value).trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(text) || text.length % 4 !== 0) {
    throw new Error("--entries-base64 must be valid base64-encoded UTF-8 JSON");
  }
  return Buffer.from(text, "base64").toString("utf8");
}

async function writeWatchlist(path, items) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

async function doctorCommand(options) {
  const hermesHome = process.env.HERMES_HOME || resolvePath(os.homedir(), ".hermes");
  const installedCli = resolvePath(hermesHome, "skills/watchlist-curator/bin/watchlist-curator.js");
  const installedSkillDir = dirname(dirname(installedCli));
  const installedSkillMd = resolvePath(installedSkillDir, "SKILL.md");
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  const [skillInstalled, skillMdInstalled, fixture, soilSmoke, krx, us] = await Promise.all([
    pathExists(installedCli),
    pathExists(installedSkillMd),
    inspectFixture(BUNDLED_SYMBOLS),
    runSoilLookupSmoke(options),
    inspectWatchlist(options.watchlistKrx),
    inspectWatchlist(options.watchlistUs)
  ]);
  const report = {
    ok: nodeMajor >= 18 && skillInstalled && skillMdInstalled && fixture.validJson && fixture.hasSoil && soilSmoke.ok && krx.exists && krx.validJson && krx.writable && us.exists && us.validJson && us.writable,
    node: {
      version: process.version,
      ok: nodeMajor >= 18,
      required: ">=18"
    },
    hermesHome,
    skill: {
      currentPath: CLI_PATH,
      currentSkillDir: SKILL_DIR,
      expectedHermesPath: installedCli,
      expectedHermesSkillFile: installedSkillMd,
      installed: skillInstalled,
      skillFileInstalled: skillMdInstalled,
      currentIsHermesInstall: resolvePath(CLI_PATH) === installedCli
    },
    fixture,
    lookupSmoke: soilSmoke,
    watchlists: { krx, us },
    hermesInspect: {
      listCommand: "hermes skills list",
      inspectCommand: "hermes skills inspect watchlist-curator",
      note: "If list shows watchlist-curator but inspect fails, reinstall with scripts/install-watchlist-curator-skill.sh and verify the expected Hermes skill file exists."
    },
    note: "doctor only reads metadata and validates JSON; it does not modify watchlists."
  };
  printJson(report);
}

async function inspectFixture(path) {
  const result = {
    path,
    exists: await pathExists(path),
    validJson: false,
    array: false,
    count: 0,
    hasSoil: false
  };
  if (!result.exists) {
    result.message = "fixture file does not exist";
    return result;
  }
  try {
    const parsed = await readJsonFile(path);
    result.validJson = true;
    result.array = Array.isArray(parsed);
    result.count = result.array ? parsed.length : 0;
    result.hasSoil = result.array && parsed.some((entry) => normalizeTicker(entry.ticker, entry.market) === "010950");
    if (!result.array) result.message = "fixture JSON must be an array";
  } catch (error) {
    result.message = error.message;
  }
  return result;
}

async function runSoilLookupSmoke(options) {
  try {
    const symbols = await loadSymbols(options.sourceFiles);
    const result = await resolveOne({ query: "soil", memo: "" }, symbols, { ...options, offline: true, market: "auto" });
    const entry = result.status === "resolved" ? cleanCandidate(result.candidate) : null;
    return {
      ok: Boolean(entry && entry.ticker === "010950" && entry.name === "S-Oil" && entry.market === "KOSPI"),
      input: "soil",
      expected: { ticker: "010950", name: "S-Oil", market: "KOSPI" },
      actual: entry,
      source: result.status === "resolved" ? result.candidate.source || "fixture" : undefined,
      status: result.status
    };
  } catch (error) {
    return {
      ok: false,
      input: "soil",
      message: error.message
    };
  }
}

async function inspectWatchlist(path) {
  const exists = await pathExists(path);
  const writable = await pathWritable(path, exists);
  const result = {
    path,
    exists,
    writable,
    validJson: false,
    array: false,
    count: 0
  };
  if (!exists) {
    result.message = "watchlist file does not exist";
    return result;
  }
  try {
    const parsed = await readJsonFile(path);
    result.validJson = true;
    result.array = Array.isArray(parsed);
    result.count = result.array ? parsed.length : 0;
    if (!result.array) result.message = "watchlist JSON must be an array";
  } catch (error) {
    result.message = error.message;
  }
  return result;
}

async function pathExists(path) {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function pathWritable(path, exists) {
  try {
    await access(exists ? path : dirname(path), fsConstants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || !options.command) {
    process.stdout.write(usage());
    return;
  }
  if (options.command === "resolve") await resolveCommand(options);
  if (options.command === "lookup") await lookupCommand(options);
  if (options.command === "propose") await proposeCommand(options);
  if (options.command === "apply") await applyCommand(options);
  if (options.command === "doctor") await doctorCommand(options);
}

main().catch((error) => {
  process.stderr.write(`watchlist-curator: ${error.message}\n`);
  process.exitCode = 1;
});
