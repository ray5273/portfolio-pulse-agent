#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="$ROOT_DIR/skills/krx-daily-chart-pulse"
TARGET="${OPENCLAW_HOME:-$HOME/.openclaw}/workspace/skills/krx-daily-chart-pulse"

mkdir -p "$(dirname "$TARGET")"
rm -rf "$TARGET"
cp -R "$SOURCE" "$TARGET"

echo "Installed krx-daily-chart-pulse to $TARGET"
if command -v openclaw >/dev/null 2>&1; then
  openclaw skills list || openclaw skills info krx-daily-chart-pulse || true
fi
