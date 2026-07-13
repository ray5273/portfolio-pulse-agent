#!/usr/bin/env python3
"""Daily price check for the cached weekly KRX portfolio and risk overlays."""
import json, math, os, re, subprocess, sys, urllib.parse, urllib.request
from datetime import datetime
from pathlib import Path

HOME = Path(os.environ.get("HERMES_HOME", Path.home() / ".hermes"))
NAME = "krx-weekly-regime-vol-portfolio"
CONFIG = HOME / "config" / NAME
CACHE = Path.home() / ".cache" / "krx-trend-portfolio-monitor"
LEDGER = CACHE / "weekly-rebalance-rs-backtest-through-2026-07-10.json"
RISK_LEDGER = CACHE / "weekly-mdd-overlay-backtest-through-2026-07-10.json"
KOSPI = CACHE / "kospi.json"
STATE = CONFIG / "state.json"
OUT = HOME / "artifacts" / NAME

def read(path, default):
    try: return json.loads(path.read_text())
    except FileNotFoundError: return default

def env():
    values = {}
    for line in (CONFIG / ".env").read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1); values[k.strip()] = v.strip().strip('"').strip("'")
    return values

def naver(ticker):
    query = urllib.parse.urlencode({"symbol": ticker, "requestType": 1, "startTime": "20260101", "endTime": "20300101", "timeframe": "day"})
    request = urllib.request.Request("https://api.finance.naver.com/siseJson.naver?" + query, headers={"User-Agent": "Mozilla/5.0", "Referer": "https://finance.naver.com/"})
    text = urllib.request.urlopen(request, timeout=20).read().decode("euc-kr", "ignore")
    rows = re.findall(r'\["(\d{8})",\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)', text)
    return [{"date": f"{d[:4]}-{d[4:6]}-{d[6:]}", "open": float(o), "close": float(c)} for d,o,_h,_l,c in rows if float(c) > 0]

def standard_deviation(values):
    if len(values) < 2: return None
    mean = sum(values) / len(values)
    return math.sqrt(sum((x - mean) ** 2 for x in values) / (len(values) - 1))

def regime(kospi, prior):
    closes = [float(x["close"]) for x in kospi if x.get("close") is not None]
    if len(closes) < 200: raise RuntimeError("KOSPI history has fewer than 200 closes")
    close, sma = closes[-1], sum(closes[-200:]) / 200
    distance = close / sma - 1
    on = prior.get("regimeOn", close >= sma)
    if distance >= .03: on = True
    elif distance <= -.03: on = False
    return close, sma, distance, on

def send(token, chat_id, message):
    body = urllib.parse.urlencode({"chat_id": chat_id, "text": message, "disable_web_page_preview": "true"}).encode()
    response = json.loads(urllib.request.urlopen(urllib.request.Request(f"https://api.telegram.org/bot{token}/sendMessage", data=body), timeout=30).read())
    if not response.get("ok"): raise RuntimeError("Telegram delivery failed")

def main():
    values = env()
    if not values.get("TELEGRAM_BOT_TOKEN") or not values.get("TELEGRAM_CHAT_ID"):
        raise RuntimeError("Dedicated Telegram credentials are missing")
    node = os.environ.get("HERMES_NODE", "/opt/homebrew/opt/node@22/bin/node")
    refresh = subprocess.run([node if Path(node).exists() else "node", str(HOME / "scripts" / "build-trend-monitor-cache.js")], text=True, capture_output=True)
    if refresh.returncode:
        raise RuntimeError("KOSPI/fundamentals cache refresh failed")
    prior = read(STATE, {})
    ledger = read(LEDGER, {})
    selections = ledger.get("strategies", {}).get("standard", {}).get("monthlySelections", [])
    if not selections: raise RuntimeError("Weekly portfolio ledger is unavailable")
    # Naver data is the daily source of truth for close-date and position prices.
    latest = max(selections, key=lambda x: x.get("executionDate", ""))
    tickers = [x["ticker"] for x in latest["holdings"]]
    names = {x["ticker"]: x["name"] for x in latest["holdings"]}
    histories = {ticker: naver(ticker) for ticker in tickers}
    common = set.intersection(*(set(x["date"] for x in rows) for rows in histories.values()))
    dates = sorted(common)
    if len(dates) < 61: raise RuntimeError("Insufficient common daily price history")
    as_of = dates[-1]
    active = [x for x in selections if x.get("executionDate", "") <= as_of]
    if not active: raise RuntimeError("No weekly portfolio was active on latest close")
    weekly = active[-1]
    if weekly["executionDate"] != latest["executionDate"]:
        tickers = [x["ticker"] for x in weekly["holdings"]]; names = {x["ticker"]: x["name"] for x in weekly["holdings"]}
        histories = {ticker: naver(ticker) for ticker in tickers}; common = set.intersection(*(set(x["date"] for x in rows) for rows in histories.values())); dates = sorted(common); as_of = dates[-1]
    by = {ticker: {x["date"]: x for x in rows} for ticker, rows in histories.items()}
    returns = []
    for before, today in zip(dates[-61:-1], dates[-60:]):
        returns.append(sum(by[t][today]["close"] / by[t][before]["close"] - 1 for t in tickers) / len(tickers))
    vol = (standard_deviation(returns) or 0) * math.sqrt(252)
    risk_events = read(RISK_LEDGER, {}).get("strategies", {}).get("minerviniRS__E", {}).get("events", [])
    weekly_risk = next((x for x in reversed(risk_events) if x.get("signalDate") == weekly["signalDate"]), None)
    if weekly_risk is None: raise RuntimeError("Weekly regime-vol allocation ledger is unavailable")
    # Refreshing KOSPI is handled by the existing cache helper before this script runs.
    close, sma, distance, on = regime(read(KOSPI, {}).get("bars", []), prior)
    # Match the backtest: set the volatility exposure at the weekly rebalance and
    # retain it until the next weekly signal. A daily regime OFF still exits to cash.
    weekly_equity = float(weekly_risk["exposure"])
    equity = weekly_equity if on else 0
    changes = []
    for t in tickers:
        row = by[t][as_of]; prior_row = by[t].get(dates[-2]); change = (row["close"] / prior_row["close"] - 1) * 100 if prior_row else 0
        changes.append(f"- {names[t]}({t}): {row['close']:,.0f}원 ({change:+.2f}%) · 목표 {equity * 100 / len(tickers):.2f}%")
    label = "ON" if on else "OFF"
    message = "\n".join([
        f"KRX 주간 레짐+변동성 포트폴리오 ({as_of})",
        f"주간 신호 {weekly['signalDate']} → 적용 {weekly['executionDate']} · 다음 주간 확인: 다음 5거래일 신호 후",
        f"KOSPI {close:,.2f} / SMA200 {sma:,.2f} / 괴리 {distance * 100:+.2f}% / {label}",
        f"주간 확정 60일 변동성 타기팅 · 참고 현재 60일 실현변동성 {vol * 100:.2f}%",
        f"목표 주식 {equity * 100:.2f}% · 현금 {(1-equity) * 100:.2f}%",
        "", "보유 10종목 (오늘 종가 / 목표 비중)", *changes,
    ])
    key = f"{as_of}:{weekly['signalDate']}"
    if prior.get("sentKey") != key:
        send(values["TELEGRAM_BOT_TOKEN"], values["TELEGRAM_CHAT_ID"], message)
        prior["sentKey"] = key
    OUT.joinpath(as_of).mkdir(parents=True, exist_ok=True)
    OUT.joinpath(as_of, "report.md").write_text(message + "\n")
    STATE.write_text(json.dumps({**prior, "asOf": as_of, "weeklySignal": weekly["signalDate"], "regimeOn": on, "equityPct": round(equity * 100, 4), "cashPct": round((1-equity) * 100, 4)}, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"summary": f"Weekly regime-vol portfolio checked for {as_of}", "success": True, "wakeAgent": False}, ensure_ascii=False))

if __name__ == "__main__":
    try: main()
    except Exception as exc:
        print(json.dumps({"summary": "Weekly regime-vol portfolio check failed", "success": False, "error": str(exc), "wakeAgent": True}, ensure_ascii=False)); sys.exit(1)
