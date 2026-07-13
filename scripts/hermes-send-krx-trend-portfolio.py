#!/usr/bin/env python3
"""Hermes-owned Telegram sender; no bot credential handling here."""
import json, os, subprocess, sys
from pathlib import Path

HOME=Path(os.environ.get('HERMES_HOME',str(Path.home()/'.hermes'))).expanduser()
CONFIG=HOME/'config/krx-trend-portfolio-monitor'
STATE=CONFIG/'delivery-state.json'
NODE=os.environ.get('HERMES_NODE','/opt/homebrew/opt/node@22/bin/node')
CLI=HOME/'skills/krx-trend-portfolio-monitor/bin/krx-trend-portfolio-monitor.js'
def load(p,default):
    try:return json.loads(p.read_text())
    except FileNotFoundError:return default
def load_hermes_env():
    env_file = HOME / ".env"
    if not env_file.exists():
        return
    for raw in env_file.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip(chr(34)).strip(chr(39)))


def sender():
    sys.path.insert(0,str(HOME/'hermes-agent'))
    from tools.send_message_tool import send_message_tool
    return send_message_tool
def main():
    load_hermes_env()
    cmd=[NODE if Path(NODE).exists() else 'node',str(CLI),'--config',str(CONFIG/'monitor.json'),'--output-dir',str(HOME/'artifacts/krx-trend-portfolio-monitor'),'--emit-hermes-send-batch']
    if os.environ.get('KRX_TREND_DRY_RUN','').lower() in ('1','true','yes'):cmd.append('--dry-run')
    if os.environ.get('KRX_TREND_DATE'):cmd += ['--date',os.environ['KRX_TREND_DATE']]
    refresh=subprocess.run([NODE if Path(NODE).exists() else 'node',str(HOME/'scripts/build-trend-monitor-cache.js')],text=True,capture_output=True)
    if refresh.returncode: raise RuntimeError(f'Cache refresh failed: {refresh.stderr.strip()}')
    run=subprocess.run(cmd,text=True,capture_output=True)
    if run.returncode:
        print(json.dumps({'summary':'Trend monitor generation failed','success':False,'error':run.stderr.strip(),'wakeAgent':True},ensure_ascii=False));return 1
    batch=json.loads(run.stdout)[0]; state=load(STATE,{})
    if state.get(batch['idempotencyKey'])=='sent':
        print(json.dumps({'summary':'Already sent','success':True,'duplicate':True,'wakeAgent':False},ensure_ascii=False));return 0
    response=json.loads(sender()({'action':'send','target':'telegram','message':batch['text']}))
    if not response.get('success'):
        print(json.dumps({'summary':'Telegram delivery failed','success':False,'error':response.get('error',response),'wakeAgent':True},ensure_ascii=False));return 1
    state[batch['idempotencyKey']]='sent'; STATE.parent.mkdir(parents=True,exist_ok=True); STATE.write_text(json.dumps(state,ensure_ascii=False,indent=2)); print(json.dumps({'summary':'Sent KRX trend portfolio monitor','success':True,'wakeAgent':True},ensure_ascii=False));return 0
if __name__=='__main__':raise SystemExit(main())
