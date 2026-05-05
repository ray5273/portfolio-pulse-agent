#!/usr/bin/env python3
import json
import os
import subprocess
import sys
from pathlib import Path


def hermes_home() -> Path:
    return Path(os.environ.get("HERMES_HOME", str(Path.home() / ".hermes"))).expanduser()


def config_dir() -> Path:
    return hermes_home() / "config/krx-daily-chart-pulse"


def resolve_watchlist() -> Path:
    watchlist_override = os.environ.get("KRX_WATCHLIST", "").strip()
    if watchlist_override:
        watchlist = Path(watchlist_override).expanduser()
        return watchlist if watchlist.is_absolute() else config_dir() / watchlist
    return config_dir() / "watchlist.json"


def cli_path() -> Path:
    return hermes_home() / "skills/krx-daily-chart-pulse/bin/daily-krx-chart-pulse.js"


def output_dir() -> Path:
    return hermes_home() / "artifacts/krx-daily-chart-pulse"


def load_send_message_tool():
    agent_root = hermes_home() / "hermes-agent"
    sys.path.insert(0, str(agent_root))
    from tools.send_message_tool import send_message_tool

    return send_message_tool


def build_batches() -> list[dict]:
    watchlist = resolve_watchlist()
    command = [
        "node",
        str(cli_path()),
        "--watchlist",
        str(watchlist),
        "--output-dir",
        str(output_dir()),
        "--emit-hermes-send-batches",
    ]
    if os.environ.get("KRX_DRY_RUN", "").strip().lower() in {"1", "true", "yes"}:
        command.append("--dry-run")
    run_date = os.environ.get("KRX_DATE", os.environ.get("KRX_RUN_DATE", "")).strip()
    if run_date:
        command.extend(["--date", run_date])

    result = subprocess.run(
        command,
        cwd=str(hermes_home()),
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(
            "CLI batch generation failed "
            f"(exit {result.returncode}) for watchlist {watchlist}:\n{result.stderr.strip()}"
        )
    return json.loads(result.stdout)


def batch_message(batch: dict) -> str:
    media_lines = [f"MEDIA:{path}" for path in batch["media"]]
    return "\n".join([batch["text"], *media_lines])


def main() -> int:
    send_message_tool = load_send_message_tool()
    batches = build_batches()
    sent = 0
    failures = []

    for batch in batches:
        response = send_message_tool(
            {
                "action": "send",
                "target": "telegram",
                "message": batch_message(batch),
            }
        )
        parsed = json.loads(response)
        if parsed.get("success"):
            sent += 1
        else:
            failures.append(
                {
                    "ticker": batch.get("ticker"),
                    "error": parsed.get("error") or parsed,
                }
            )
            break

    summary = {
        "summary": f"Sent {sent}/{len(batches)} ticker batches",
        "sent": sent,
        "total": len(batches),
        "failures": failures,
        "wakeAgent": True,
    }
    print(json.dumps(summary, ensure_ascii=False))
    return 0 if sent == len(batches) else 1


if __name__ == "__main__":
    raise SystemExit(main())
