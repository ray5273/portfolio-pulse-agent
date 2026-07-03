function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
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

export function buildMockRows(ticker, runDate, count = 2800) {
  const rng = pseudoRandom(tickerSeed(ticker) * 1009);
  const rows = [];
  let close = 45000 + (tickerSeed(ticker) % 30) * 1200;
  const end = parseRunDate(runDate);
  let cursor = new Date(end);

  while (rows.length < count) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      const drift = (rng() - 0.46) * 0.025;
      const open = close * (1 + (rng() - 0.5) * 0.012);
      close = Math.max(1000, close * (1 + drift));
      const high = Math.max(open, close) * (1 + rng() * 0.018);
      const low = Math.min(open, close) * (1 - rng() * 0.018);
      const volume = Math.round(400000 + rng() * 2400000);
      rows.push({
        date: cursor.toISOString().slice(0, 10),
        open: Math.round(open),
        high: Math.round(high),
        low: Math.round(low),
        close: Math.round(close),
        volume
      });
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  return rows.reverse();
}

function parseNaverRows(text) {
  const rows = [];
  const rowRe = /\[\s*["'](\d{8})["']\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/g;
  let match;
  while ((match = rowRe.exec(text))) {
    const rawDate = match[1];
    rows.push({
      date: `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`,
      open: Number(match[2]),
      high: Number(match[3]),
      low: Number(match[4]),
      close: Number(match[5]),
      volume: Number(match[6])
    });
  }
  return rows.filter((row) => {
    return [row.open, row.high, row.low, row.close, row.volume].every(Number.isFinite);
  });
}

export async function fetchKrxRows(ticker, runDate) {
  const end = parseRunDate(runDate);
  const start = new Date(end);
  start.setDate(start.getDate() - 3840);
  const params = new URLSearchParams({
    symbol: ticker,
    requestType: "1",
    startTime: formatDate(start),
    endTime: formatDate(end),
    timeframe: "day"
  });
  const url = `https://api.finance.naver.com/siseJson.naver?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "krx-daily-chart-pulse/0.1"
    }
  });
  if (!response.ok) {
    throw new Error(`Naver Finance request failed with HTTP ${response.status}`);
  }
  const rows = parseNaverRows(await response.text());
  if (rows.length < 60) {
    throw new Error(`Not enough daily rows for ${ticker}; received ${rows.length}`);
  }
  return rows.slice(-2800);
}

export async function getRows({ ticker, runDate, dryRun }) {
  if (dryRun) return buildMockRows(ticker, runDate);
  return fetchKrxRows(ticker, runDate);
}
