# Agent Instructions

## Hermes Runtime Verification

When changing Hermes skills, Hermes-installed files, or Hermes-facing tool behavior, verify both the local CLI and the real Hermes runtime.

For `watchlist-curator` changes, use this sequence:

```bash
npm run smoke:curator
bash scripts/install-watchlist-curator-skill.sh
hermes --accept-hooks gateway stop
hermes --accept-hooks gateway start
hermes -z "watchlist-curator 도구를 사용해서 soil 주식 조회해줘"
hermes -z "soil 주식"
hermes -z "soil 추가해줘"
```

Expected checks:

- `npm run smoke:curator` must pass.
- `hermes skills inspect watchlist-curator` must show the local skill preview.
- `hermes -z "watchlist-curator 도구를 사용해서 soil 주식 조회해줘"` must return `010950 S-Oil (KOSPI)` instead of “tool/skill not found”.
- `hermes -z "soil 주식"` must not ask what “soil stocks” means; it should resolve to `010950 S-Oil (KOSPI)`.
- `hermes -z "soil 추가해줘"` must propose adding `010950 S-Oil (KOSPI)` and wait for confirmation, not apply immediately.

If `hermes -z` fails under sandboxing with a permission error for `~/.hermes/logs/agent.log`, rerun the same command with escalated permissions. Do not treat a sandbox logging failure as a Hermes runtime failure.

After restarting the gateway, confirm it is running:

```bash
sed -n '1,220p' /Users/sanghyeok/.hermes/gateway_state.json
hermes logs --since 3m
```

The gateway state should show `gateway_state: "running"` and connected platform state. This catches stale gateway processes that still have old skill/tool state loaded.
