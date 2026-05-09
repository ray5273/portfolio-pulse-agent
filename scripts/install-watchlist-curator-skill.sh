#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HERMES_ROOT="${HERMES_HOME:-$HOME/.hermes}"
SOURCE="$ROOT_DIR/skills/watchlist-curator"
TARGET="$HERMES_ROOT/skills/watchlist-curator"
KRX_CONFIG_DIR="$HERMES_ROOT/config/krx-daily-chart-pulse"
US_CONFIG_DIR="$HERMES_ROOT/config/us-daily-chart-pulse"

mkdir -p "$(dirname "$TARGET")"
rm -rf "$TARGET"
cp -R "$SOURCE" "$TARGET"
chmod +x "$TARGET/bin/watchlist-curator.js"

mkdir -p "$KRX_CONFIG_DIR" "$US_CONFIG_DIR"

echo "Installed watchlist-curator to $TARGET"
echo "Hermes KRX watchlist config directory: $KRX_CONFIG_DIR"
echo "Hermes US watchlist config directory: $US_CONFIG_DIR"
echo "Existing watchlist.json files were not created or overwritten."

if command -v hermes >/dev/null 2>&1; then
  hermes skills list || true
  INSPECT_OUTPUT="$(hermes skills inspect watchlist-curator 2>&1 || true)"
  printf '%s\n' "$INSPECT_OUTPUT"
  if printf '%s\n' "$INSPECT_OUTPUT" | grep -Eq "Error:|No skill named"; then
    echo "Warning: hermes skills inspect watchlist-curator failed."
    echo "Run: node $TARGET/bin/watchlist-curator.js doctor"
  fi
fi
