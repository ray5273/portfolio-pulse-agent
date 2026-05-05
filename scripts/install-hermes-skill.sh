#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HERMES_ROOT="${HERMES_HOME:-$HOME/.hermes}"
SOURCE="$ROOT_DIR/skills/krx-daily-chart-pulse"
TARGET="$HERMES_ROOT/skills/krx-daily-chart-pulse"
SCRIPT_SOURCE="$ROOT_DIR/scripts/hermes-send-krx-batches.py"
SCRIPT_TARGET="$HERMES_ROOT/scripts/hermes-send-krx-batches.py"
CONFIG_DIR="$HERMES_ROOT/config/krx-daily-chart-pulse"
CONFIG_WATCHLIST="$CONFIG_DIR/watchlist.json"
CONFIG_EXAMPLE="$CONFIG_DIR/watchlist.example.json"
LOCAL_WATCHLIST="$ROOT_DIR/examples/watchlist.local.json"
EXAMPLE_WATCHLIST="$ROOT_DIR/examples/watchlist.example.json"

mkdir -p "$(dirname "$TARGET")"
rm -rf "$TARGET"
cp -R "$SOURCE" "$TARGET"
mkdir -p "$(dirname "$SCRIPT_TARGET")"
cp "$SCRIPT_SOURCE" "$SCRIPT_TARGET"
chmod +x "$SCRIPT_TARGET"
mkdir -p "$CONFIG_DIR"

if [[ ! -e "$CONFIG_WATCHLIST" && -e "$LOCAL_WATCHLIST" ]]; then
  cp "$LOCAL_WATCHLIST" "$CONFIG_WATCHLIST"
  echo "Seeded Hermes watchlist config from $LOCAL_WATCHLIST"
fi

if [[ -e "$EXAMPLE_WATCHLIST" && ! -e "$CONFIG_EXAMPLE" ]]; then
  cp "$EXAMPLE_WATCHLIST" "$CONFIG_EXAMPLE"
fi

echo "Installed krx-daily-chart-pulse to $TARGET"
echo "Installed Hermes cron send script to $SCRIPT_TARGET"
echo "Hermes watchlist config directory: $CONFIG_DIR"
if command -v hermes >/dev/null 2>&1; then
  hermes skills list || hermes skills inspect krx-daily-chart-pulse || true
fi
