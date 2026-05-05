#!/usr/bin/env python3
import json
import os
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path("/Users/sanghyeok/workspace/kr-portfolio-pulse-agent")
LOCAL_WATCHLIST = REPO_ROOT / "examples/watchlist.local.json"
DEFAULT_WATCHLIST = REPO_ROOT / "examples/watchlist.example.json"
CLI = REPO_ROOT / "skills/krx-daily-chart-pulse/bin/daily-krx-chart-pulse.js"


def hermes_home() -> Path:
    return Path(os.environ.get("HERMES_HOME", str(Path.home() / ".hermes"))).expanduser()


def load_send_message_tool():
    agent_root = hermes_home() / "hermes-agent"
    sys.path.insert(0, str(agent_root))
    from tools.send_message_tool import send_message_tool

    return send_message_tool


def build_batches() -> list[dict]:
    watchlist_override = os.environ.get("KRX_WATCHLIST", "").strip()
    if watchlist_override:
        watchlist = Path(watchlist_override).expanduser()
    else:
        watchlist = LOCAL_WATCHLIST if LOCAL_WATCHLIST.exists() else DEFAULT_WATCHLIST
    if not watchlist.is_absolute():
        watchlist = REPO_ROOT / watchlist

    result = subprocess.run(
        [
            "node",
            str(CLI),
            "--watchlist",
            str(watchlist),
            "--emit-hermes-send-batches",
        ],
        cwd=str(REPO_ROOT),
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
