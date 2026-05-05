import { readFile } from "node:fs/promises";

const TICKER_RE = /^[0-9A-Z.]{3,12}$/;

export async function loadWatchlist(path) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`Failed to read watchlist ${path}: ${error.message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Watchlist must be a JSON array");
  }

  const seen = new Set();
  const items = parsed.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`Watchlist item ${index + 1} must be an object`);
    }
    const ticker = String(item.ticker || "").trim().toUpperCase();
    const name = String(item.name || "").trim();
    if (!ticker) throw new Error(`Watchlist item ${index + 1} is missing required field ticker`);
    if (!name) throw new Error(`Watchlist item ${index + 1} is missing required field name`);
    if (!TICKER_RE.test(ticker)) throw new Error(`Watchlist item ${index + 1} has invalid ticker ${ticker}`);
    if (seen.has(ticker)) throw new Error(`Duplicate ticker in watchlist: ${ticker}`);
    seen.add(ticker);
    return {
      ...item,
      ticker,
      name,
      market: item.market ? String(item.market).trim() : "KRX"
    };
  });

  if (items.length === 0) throw new Error("Watchlist must include at least one ticker");
  return items;
}

export function filterWatchlist(items, only) {
  if (!only || only.length === 0) return items;
  const wanted = new Set(only.map((value) => value.trim().toUpperCase()).filter(Boolean));
  const filtered = items.filter((item) => wanted.has(item.ticker));
  if (filtered.length === 0) {
    throw new Error(`--only did not match any watchlist ticker: ${[...wanted].join(",")}`);
  }
  return filtered;
}
