function formatIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseRunDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid date ${value}; expected YYYY-MM-DD`);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function pseudoRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function tickerSeed(ticker) {
  return [...ticker].reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

export function buildMockRows(ticker, runDate, count = 1100) {
  const rng = pseudoRandom(tickerSeed(ticker) * 1009);
  const rows = [];
  let close = 65 + (tickerSeed(ticker) % 220);
  const end = parseRunDate(runDate);
  let cursor = new Date(end);

  while (rows.length < count) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      const drift = (rng() - 0.46) * 0.025;
      const open = close * (1 + (rng() - 0.5) * 0.012);
      close = Math.max(1, close * (1 + drift));
      const high = Math.max(open, close) * (1 + rng() * 0.018);
      const low = Math.min(open, close) * (1 - rng() * 0.018);
      const volume = Math.round(1200000 + rng() * 58000000);
      rows.push({
        date: cursor.toISOString().slice(0, 10),
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume
      });
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  return rows.reverse();
}

function unixSeconds(date) {
  return Math.floor(date.getTime() / 1000);
}

function validRow(row) {
  return row
    && /^\d{4}-\d{2}-\d{2}$/.test(row.date)
    && [row.open, row.high, row.low, row.close, row.volume].every(Number.isFinite);
}

function requireEnoughRows(ticker, source, rows) {
  if (rows.length < 60) {
    throw new Error(`${source} returned ${rows.length} valid daily rows for ${ticker}; expected at least 60`);
  }
  return rows.slice(-1100);
}

function parseYahooChartRows(ticker, payload) {
  const result = payload?.chart?.result?.[0];
  const timestamps = result?.timestamp;
  const quote = result?.indicators?.quote?.[0];
  if (!Array.isArray(timestamps) || !quote) {
    throw new Error("Yahoo chart response is missing timestamp or quote data");
  }

  const rows = timestamps.map((timestamp, index) => {
    const date = new Date(Number(timestamp) * 1000);
    return {
      date: formatIsoDate(date),
      open: Number(quote.open?.[index]),
      high: Number(quote.high?.[index]),
      low: Number(quote.low?.[index]),
      close: Number(quote.close?.[index]),
      volume: Number(quote.volume?.[index])
    };
  }).filter(validRow).sort((a, b) => a.date.localeCompare(b.date));

  return requireEnoughRows(ticker, "Yahoo chart", rows);
}

async function fetchYahooRows(ticker, runDate) {
  const end = parseRunDate(runDate);
  const start = new Date(end);
  start.setDate(start.getDate() - 1600);
  const period2 = new Date(end);
  period2.setDate(period2.getDate() + 1);
  const params = new URLSearchParams({
    interval: "1d",
    period1: String(unixSeconds(start)),
    period2: String(unixSeconds(period2))
  });
  const symbol = encodeURIComponent(String(ticker).trim().toUpperCase());
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });
  if (!response.ok) {
    throw new Error(`Yahoo chart request failed with HTTP ${response.status}`);
  }
  const payload = await response.json();
  const yahooError = payload?.chart?.error;
  if (yahooError) {
    throw new Error(`Yahoo chart error: ${yahooError.description || yahooError.code || "unknown error"}`);
  }
  return parseYahooChartRows(ticker, payload);
}

function normalizeNasdaqNumber(value) {
  if (value === null || value === undefined) return Number.NaN;
  const text = String(value).replace(/[$,]/g, "").trim();
  if (!text || /^n\/a$/i.test(text)) return Number.NaN;
  return Number(text);
}

function parseNasdaqDate(value) {
  const text = String(value || "").trim();
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match) return text;
  match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (match) {
    return `${match[3]}-${String(match[1]).padStart(2, "0")}-${String(match[2]).padStart(2, "0")}`;
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function parseNasdaqRows(ticker, payload) {
  const tableRows = payload?.data?.tradesTable?.rows;
  if (!Array.isArray(tableRows)) {
    throw new Error("Nasdaq historical response is missing tradesTable rows");
  }

  const rows = tableRows.map((row) => ({
    date: parseNasdaqDate(row.date),
    open: normalizeNasdaqNumber(row.open),
    high: normalizeNasdaqNumber(row.high),
    low: normalizeNasdaqNumber(row.low),
    close: normalizeNasdaqNumber(row.close || row.closeLast),
    volume: normalizeNasdaqNumber(row.volume)
  })).filter(validRow).sort((a, b) => a.date.localeCompare(b.date));

  return requireEnoughRows(ticker, "Nasdaq historical", rows);
}

async function fetchNasdaqRows(ticker, runDate) {
  const end = parseRunDate(runDate);
  const start = new Date(end);
  start.setDate(start.getDate() - 1600);
  const symbol = encodeURIComponent(String(ticker).trim().toUpperCase());
  const params = new URLSearchParams({
    assetclass: "stocks",
    fromdate: formatIsoDate(start),
    todate: formatIsoDate(end),
    limit: "9999"
  });
  const url = `https://api.nasdaq.com/api/quote/${symbol}/historical?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0"
    }
  });
  if (!response.ok) {
    throw new Error(`Nasdaq historical request failed with HTTP ${response.status}`);
  }
  return parseNasdaqRows(ticker, await response.json());
}

export async function fetchUsRowsWithSource(ticker, runDate) {
  if (process.env.US_FORCE_NASDAQ_FALLBACK) {
    return { rows: await fetchNasdaqRows(ticker, runDate), source: "nasdaq-historical" };
  }

  try {
    return { rows: await fetchYahooRows(ticker, runDate), source: "yahoo-chart" };
  } catch (yahooError) {
    try {
      return { rows: await fetchNasdaqRows(ticker, runDate), source: "nasdaq-historical" };
    } catch (nasdaqError) {
      throw new Error(
        `Yahoo chart failed (${yahooError.message}); Nasdaq historical fallback failed (${nasdaqError.message})`
      );
    }
  }
}

export async function fetchUsRows(ticker, runDate) {
  return (await fetchUsRowsWithSource(ticker, runDate)).rows;
}

export async function getRows({ ticker, runDate, dryRun }) {
  if (dryRun) return { rows: buildMockRows(ticker, runDate), source: "mock" };
  return fetchUsRowsWithSource(ticker, runDate);
}
