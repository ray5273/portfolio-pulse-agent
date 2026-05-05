#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="$ROOT_DIR/skills/krx-daily-chart-pulse"
TARGET="${HERMES_HOME:-$HOME/.hermes}/skills/krx-daily-chart-pulse"
SCRIPT_SOURCE="$ROOT_DIR/scripts/hermes-send-krx-batches.py"
SCRIPT_TARGET="${HERMES_HOME:-$HOME/.hermes}/scripts/hermes-send-krx-batches.py"

mkdir -p "$(dirname "$TARGET")"
rm -rf "$TARGET"
cp -R "$SOURCE" "$TARGET"
mkdir -p "$(dirname "$SCRIPT_TARGET")"
cp "$SCRIPT_SOURCE" "$SCRIPT_TARGET"
chmod +x "$SCRIPT_TARGET"

echo "Installed krx-daily-chart-pulse to $TARGET"
echo "Installed Hermes cron send script to $SCRIPT_TARGET"
if command -v hermes >/dev/null 2>&1; then
  hermes skills list || hermes skills inspect krx-daily-chart-pulse || true
fi
