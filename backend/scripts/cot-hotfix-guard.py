#!/usr/bin/env python3
"""
CoT (Chain-of-Thought) Hotfix Guard
====================================
Monitors dist/llm.js and dist/dailyNotify.js for the CoT leak regression.
When the prewarm/auto-publish routine rebuilds dist/, it overwrites the
hotfix and reintroduces the `return reasoning` leak that exposes LLM
chain-of-thought to users (ZEMA-3219).

This guard detects the regression and re-applies the hotfix automatically,
then restarts the backend so the fix takes effect.

Idempotent: safe to run repeatedly. Logs every action.
Scheduled via launchd com.taronyang.cot-hotfix-guard (every 5 min).
"""

import os
import re
import subprocess
import sys
from datetime import datetime

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST_DIR = os.path.join(BACKEND_DIR, "dist")
LLM_JS = os.path.join(DIST_DIR, "llm.js")
DAILY_NOTIFY_JS = os.path.join(DIST_DIR, "dailyNotify.js")
LOG_FILE = os.path.join(BACKEND_DIR, "logs", "cot-hotfix-guard.log")
LAUNCH_LABEL = "com.taronyang.backend"
USER_UID = int(os.popen("id -u").read().strip())


def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    try:
        os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
        with open(LOG_FILE, "a") as f:
            f.write(line + "\n")
    except Exception:
        pass


def read_file(path):
    try:
        with open(path, "r") as f:
            return f.read()
    except FileNotFoundError:
        log(f"ERROR: file not found: {path}")
        return None


def write_file(path, content):
    with open(path, "w") as f:
        f.write(content)


STRIP_COT_FUNC = """function stripChainOfThought(text) {
    if (typeof text !== 'string') return text;
    return text
        .replace(/<(?:think|reason|thought|analysis|reflection|scratchpad)[\\s\\S]*?<\\/(?:think|reason|thought|analysis|reflection|scratchpad)>/gi, '')
        .replace(/<(?:think|reason|thought|analysis|reflection|scratchpad)[^>]*>[\\s\\S]*$/gi, '')
        .replace(/^\\s*(?:think|reason|thought|analysis|reflection|scratchpad)\\s*:\\s*[\\s\\S]*$/gim, '')
        .replace(/^\\s*\\*\\*\\s*(?:think|reason|thought|analysis|reflection|scratchpad)\\s*\\*\\*\\s*:\\s*[\\s\\S]*$/gim, '')
        .replace(/```(?:think|reason|thought|analysis|reflection|scratchpad)[\\s\\S]*?```/gi, '')
        .replace(/^#{1,3}\\s*(?:think|reason|thought|analysis|reflection|scratchpad)\\s*$/gim, '')
        .trim();
}
"""


def fix_llm_js():
    """Fix dist/llm.js: change `return reasoning;` to `continue;`"""
    content = read_file(LLM_JS)
    if content is None:
        return False
    if "return reasoning;" not in content:
        return False
    log(
        "ALERT: dist/llm.js has CoT leak — `return reasoning;` found. Re-applying hotfix..."
    )
    fixed = content.replace("return reasoning;", "continue;")
    if "return reasoning;" in fixed:
        log("ERROR: failed to replace all `return reasoning;` occurrences in llm.js")
        return False
    write_file(LLM_JS, fixed)
    log("FIXED: dist/llm.js — `return reasoning;` → `continue;`")
    return True


def fix_daily_notify_js():
    """Fix dist/dailyNotify.js: add stripChainOfThought function + wrap horoscope call."""
    content = read_file(DAILY_NOTIFY_JS)
    if content is None:
        return False
    changed = False

    # 1. Insert stripChainOfThought function if missing
    if "function stripChainOfThought" not in content:
        log(
            "ALERT: dist/dailyNotify.js missing stripChainOfThought function. Re-inserting..."
        )
        anchor = 'const logger_1 = require("./logger");'
        if anchor not in content:
            log(
                f"ERROR: cannot find anchor '{anchor}' in dailyNotify.js — manual fix required"
            )
        else:
            content = content.replace(anchor, anchor + "\n" + STRIP_COT_FUNC, 1)
            changed = True
            log("FIXED: dist/dailyNotify.js — stripChainOfThought function inserted")

    # 2. Wrap the horoscope call if not already wrapped
    if "const rawHoroscope = await (0, llm_1.callLlm)" not in content:
        log(
            "ALERT: dist/dailyNotify.js horoscope call not wrapped with stripChainOfThought. Wrapping..."
        )
        # Match: const horoscope = await (0, llm_1.callLlm)(<args>);
        pattern = r"const horoscope = await \(0, llm_1\.callLlm\)\(([^;]+)\);"
        match = re.search(pattern, content)
        if match:
            args = match.group(1)
            old_line = match.group(0)
            new_lines = (
                f"const rawHoroscope = await (0, llm_1.callLlm)({args});\n"
                f"        const horoscope = stripChainOfThought(rawHoroscope);"
            )
            content = content.replace(old_line, new_lines, 1)
            changed = True
            log(
                "FIXED: dist/dailyNotify.js — horoscope call wrapped with stripChainOfThought"
            )
        else:
            log(
                "ERROR: cannot find `const horoscope = await (0, llm_1.callLlm)` pattern — manual fix required"
            )

    if changed:
        write_file(DAILY_NOTIFY_JS, content)
    return changed


def restart_backend():
    """Restart the backend via launchctl so it reloads the fixed dist."""
    log("Restarting backend to load hotfix...")
    result = subprocess.run(
        ["launchctl", "kickstart", "-k", f"gui/{USER_UID}/{LAUNCH_LABEL}"],
        capture_output=True,
        text=True,
        timeout=30,
    )
    if result.returncode == 0:
        log("Backend restart triggered successfully")
    else:
        log(
            f"WARNING: backend restart returned exit {result.returncode}: {result.stderr.strip()}"
        )


def verify_health():
    """Quick health check after restart."""
    import time

    time.sleep(3)
    try:
        result = subprocess.run(
            [
                "curl",
                "-s",
                "-o",
                "/dev/null",
                "-w",
                "%{http_code}",
                "http://localhost:8000/api/health",
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )
        code = result.stdout.strip()
        if code == "200":
            log("Health check: OK (200)")
        else:
            log(f"WARNING: health check returned {code}")
    except Exception as e:
        log(f"WARNING: health check failed: {e}")


def main():
    log("--- CoT hotfix guard run ---")
    if not os.path.isdir(DIST_DIR):
        log(f"ERROR: dist directory not found: {DIST_DIR}")
        sys.exit(1)

    llm_fixed = fix_llm_js()
    notify_fixed = fix_daily_notify_js()

    if llm_fixed or notify_fixed:
        log("Hotfix was re-applied — restarting backend...")
        restart_backend()
        verify_health()
    else:
        log("OK: CoT hotfix intact in both dist/llm.js and dist/dailyNotify.js")

    log("--- guard run complete ---\n")


if __name__ == "__main__":
    main()
