#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HERMES_ROOT="${HERMES_HOME:-$HOME/.hermes}"
NAME=krx-trend-portfolio-monitor
mkdir -p "$HERMES_ROOT/skills" "$HERMES_ROOT/scripts" "$HERMES_ROOT/config/$NAME"
rm -rf "$HERMES_ROOT/skills/$NAME"
cp -R "$ROOT_DIR/skills/$NAME" "$HERMES_ROOT/skills/$NAME"
cp "$ROOT_DIR/scripts/hermes-send-krx-trend-portfolio.py" "$HERMES_ROOT/scripts/hermes-send-krx-trend-portfolio.py"
chmod +x "$HERMES_ROOT/scripts/hermes-send-krx-trend-portfolio.py"
if [[ ! -e "$HERMES_ROOT/config/$NAME/monitor.example.json" ]]; then cp "$ROOT_DIR/skills/$NAME/monitor.example.json" "$HERMES_ROOT/config/$NAME/monitor.example.json"; fi
if [[ -e "$HERMES_ROOT/config/$NAME/.env" ]]; then chmod 600 "$HERMES_ROOT/config/$NAME/.env"; fi
echo "Installed $NAME; preserve monitor.json, state.json, delivery-state.json, and .env."
