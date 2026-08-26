#!/usr/bin/env python3
"""Regression check for the cosmetic collapse pass (src/content/collapse.js).

Loads tests/fixture/index.html in a headless Chromium with dist/chrome loaded as
an unpacked extension, then asserts that:

  * a real ad image (blocked by the shipped rulesets) gets collapsed, and
  * a captcha-style image that starts with src="" and is filled in later is
    never collapsed, and
  * a <video> whose <source> children cannot load is left alone.

Run `python scripts/build.py` (or assemble dist/chrome) first.

Needs the `websockets` package and a Chromium binary. Set CHROME to point at one;
otherwise the usual Playwright cache and a few common paths are tried. With no
browser available the check skips and exits 0 so it never blocks a machine that
cannot run one.
"""

import functools
import glob
import http.server
import json
import os
import shutil
import socketserver
import subprocess
import sys
import threading
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIXTURE_DIR = os.path.join(ROOT, "tests", "fixture")
EXT_DIR = os.environ.get("EXT_DIR", os.path.join(ROOT, "dist", "chrome"))
HTTP_PORT = int(os.environ.get("FIXTURE_PORT", "8777"))
CDP_PORT = int(os.environ.get("CDP_PORT", "9333"))
SETTLE_SECONDS = 6

CHROME_CANDIDATES = [
    os.path.expanduser("~/.cache/ms-playwright/chromium-*/chrome-linux/chrome"),
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
]

# Collected per element id: is it collapsed, and is it actually rendered?
PROBE_JS = r"""
(() => {
  const pick = (id) => {
    const el = document.getElementById(id);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      collapsed: el.hasAttribute("data-jab-collapsed"),
      display: cs.display,
      width: Math.round(r.width),
      height: Math.round(r.height),
      naturalWidth: el.naturalWidth === undefined ? null : el.naturalWidth,
      src: (el.currentSrc || el.getAttribute("src") || "").slice(0, 160),
      style: el.getAttribute("style") || ""
    };
  };
  const out = {};
  ["ad-img", "ad-slot", "captcha-img", "captcha-reload", "vid", "vid-slot"]
    .forEach((id) => { out[id] = pick(id); });
  return out;
})()
"""


def find_chrome():
    env = os.environ.get("CHROME")
    if env:
        return env if os.path.exists(env) else None
    for pattern in CHROME_CANDIDATES:
        hits = sorted(glob.glob(pattern))
        if hits:
            return hits[-1]
    return None


def serve_fixture():
    handler = functools.partial(QuietHandler, directory=FIXTURE_DIR)
    httpd = socketserver.TCPServer(("127.0.0.1", HTTP_PORT), handler)
    httpd.allow_reuse_address = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def wait_for_devtools():
    url = f"http://127.0.0.1:{CDP_PORT}/json/version"
    for _ in range(120):
        try:
            with urllib.request.urlopen(url, timeout=2) as r:
                return json.load(r)["webSocketDebuggerUrl"]
        except Exception:
            time.sleep(0.5)
    raise RuntimeError("Chromium did not expose a DevTools endpoint")


class CDP:
    """Minimal Chrome DevTools Protocol client: send a command, await its reply,
    and wait for named events. Enough for driving one page and one worker."""

    def __init__(self, ws):
        self.ws = ws
        self.next_id = 0
        self.replies = {}
        self.events = []

    async def _pump(self):
        raw = json.loads(await self.ws.recv())
        if raw.get("id") is not None:
            self.replies[raw["id"]] = raw
        else:
            self.events.append(raw)

    async def call(self, method, params=None, session=None, timeout=60):
        import asyncio
        self.next_id += 1
        msg_id = self.next_id
        msg = {"id": msg_id, "method": method, "params": params or {}}
        if session:
            msg["sessionId"] = session
        await self.ws.send(json.dumps(msg))
        deadline = time.time() + timeout
        while time.time() < deadline:
            if msg_id in self.replies:
                raw = self.replies.pop(msg_id)
                if "error" in raw:
                    raise RuntimeError(f"{method} failed: {raw['error']}")
                return raw.get("result", {})
            await asyncio.wait_for(self._pump(), timeout=max(1, deadline - time.time()))
        raise RuntimeError(f"{method} timed out")

    async def wait_event(self, method, timeout=60):
        import asyncio
        deadline = time.time() + timeout
        while time.time() < deadline:
            for i, ev in enumerate(self.events):
                if ev.get("method") == method:
                    return self.events.pop(i)
            await asyncio.wait_for(self._pump(), timeout=max(1, deadline - time.time()))
        raise RuntimeError(f"timed out waiting for {method}")


async def attach(cdp, target_id):
    result = await cdp.call("Target.attachToTarget", {"targetId": target_id, "flatten": True})
    return result["sessionId"]


async def find_worker_session(cdp):
    """Attach to the extension's service worker so we can drive chrome.storage."""
    await cdp.call("Target.setDiscoverTargets", {"discover": True})
    deadline = time.time() + 30
    while time.time() < deadline:
        targets = (await cdp.call("Target.getTargets"))["targetInfos"]
        for t in targets:
            if t["type"] == "service_worker" and t["url"].startswith("chrome-extension://"):
                return await attach(cdp, t["targetId"])
        import asyncio
        await asyncio.sleep(0.5)
    return None


async def run(ws_url, page_url):
    import asyncio
    import websockets

    async with websockets.connect(ws_url, max_size=64 * 1024 * 1024) as ws:
        cdp = CDP(ws)
        target = await cdp.call("Target.createTarget", {"url": "about:blank"})
        page = await attach(cdp, target["targetId"])
        await cdp.call("Page.enable", {}, page)
        await cdp.call("Runtime.enable", {}, page)
        await cdp.call("Page.navigate", {"url": page_url}, page)
        await cdp.wait_event("Page.loadEventFired", timeout=90)
        await asyncio.sleep(SETTLE_SECONDS)

        found = (await cdp.call(
            "Runtime.evaluate",
            {"expression": PROBE_JS, "returnByValue": True}, page))["result"]["value"]

        # Second phase: pausing the collapse pass must undo it without a reload.
        after = None
        worker = await find_worker_session(cdp)
        if worker:
            res = await cdp.call(
                "Runtime.evaluate",
                {"expression": "chrome.storage.local.set({collapseEnabled: false})",
                 "awaitPromise": True}, worker)
            if "exceptionDetails" in res:
                raise RuntimeError(f"storage.set in the service worker failed: {res['exceptionDetails']}")
            # The content script reacts via storage.onChanged; poll instead of
            # guessing how long that round trip takes.
            deadline = time.time() + 10
            while True:
                after = (await cdp.call(
                    "Runtime.evaluate",
                    {"expression": PROBE_JS, "returnByValue": True}, page))["result"]["value"]
                slot = after.get("ad-slot") or {}
                if not slot.get("collapsed") or time.time() > deadline:
                    break
                await asyncio.sleep(0.5)

        return found, after


def check_restore(after):
    """After the collapse pass is switched off, the page must come back without a
    reload. A genuinely broken <img> still computes to display:none via the UA
    stylesheet, so the wrapper is the honest signal here."""
    failures = []
    ad = after.get("ad-img")
    slot = after.get("ad-slot")
    if ad:
        if ad["collapsed"] or "display" in ad["style"]:
            failures.append(
                f"#ad-img should have been restored after collapseEnabled=false, got {ad}")
    if slot:
        if slot["collapsed"] or slot["display"] == "none":
            failures.append(
                f"#ad-slot should have been restored after collapseEnabled=false, got {slot}")
    return failures


def check(found):
    failures = []

    def require(cond, message):
        if not cond:
            failures.append(message)

    ad = found.get("ad-img")
    require(ad is not None, "#ad-img is missing from the fixture")
    if ad:
        require(ad["collapsed"],
                f"#ad-img should have been collapsed, got {ad}")
        require(ad["display"] == "none",
                f"#ad-img should be display:none, got {ad['display']}")
    slot = found.get("ad-slot")
    if slot:
        require(slot["collapsed"],
                f"#ad-slot (the reserved-space wrapper) should have collapsed too, got {slot}")

    cap = found.get("captcha-img")
    require(cap is not None, "#captcha-img is missing from the fixture")
    if cap:
        require(not cap["collapsed"],
                f"#captcha-img must not be collapsed (this is the bank-login bug), got {cap}")
        require(cap["display"] != "none",
                f"#captcha-img must stay visible, got display:{cap['display']}")
        require(cap["naturalWidth"] and cap["naturalWidth"] > 0,
                f"#captcha-img should have decoded its replacement image, got {cap}")

    reload_icon = found.get("captcha-reload")
    if reload_icon:
        require(not reload_icon["collapsed"],
                f"#captcha-reload (a data: URI) must not be collapsed, got {reload_icon}")

    vid = found.get("vid")
    vid_slot = found.get("vid-slot")
    if vid:
        require(not vid["collapsed"],
                f"<video> must not be collapsed because a <source> errored, got {vid}")
    if vid_slot:
        require(not vid_slot["collapsed"],
                f"#vid-slot must not be collapsed, got {vid_slot}")

    return failures


def main():
    if not os.path.isdir(EXT_DIR):
        print(f"FAIL: extension build not found at {EXT_DIR}")
        print("      run `python scripts/build.py` first")
        return 1

    try:
        import websockets  # noqa: F401
    except ImportError:
        print("SKIP: the `websockets` package is not installed")
        return 0

    chrome = find_chrome()
    if not chrome:
        print("SKIP: no Chromium binary found (set CHROME=/path/to/chrome)")
        return 0

    import asyncio

    profile = os.path.join(ROOT, ".check-collapse-profile")
    shutil.rmtree(profile, ignore_errors=True)

    httpd = serve_fixture()
    proc = subprocess.Popen(
        [chrome,
         f"--disable-extensions-except={EXT_DIR}",
         f"--load-extension={EXT_DIR}",
         "--headless=new", "--no-sandbox", "--disable-gpu",
         f"--remote-debugging-port={CDP_PORT}",
         f"--user-data-dir={profile}",
         "--no-first-run", "--window-size=1400,1200", "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    try:
        ws_url = wait_for_devtools()
        found, after = asyncio.run(run(ws_url, f"http://127.0.0.1:{HTTP_PORT}/index.html"))
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
        httpd.shutdown()
        shutil.rmtree(profile, ignore_errors=True)

    failures = check(found)
    if after is None:
        print("NOTE: extension service worker not reachable; skipped the restore check")
    else:
        failures += check_restore(after)
    if failures:
        print("FAIL")
        for f in failures:
            print(f"  - {f}")
        return 1

    print("PASS: ad slot collapsed, captcha and <video> left alone")
    for key in ("ad-img", "captcha-img", "vid"):
        print(f"  {key}: {found[key]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
