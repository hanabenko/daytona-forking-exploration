#!/usr/bin/env python3
"""Local live dashboard for the Daytona fork counter demo."""

from __future__ import annotations

import argparse
import errno
import json
import os
import queue
import re
import subprocess
import sys
import threading
import time
from datetime import datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


BASE_DIR = Path(__file__).resolve().parent
WEB_DIR = BASE_DIR / "web"
DEMO_SCRIPT = BASE_DIR / "daytona-fork-counter-demo.py"

subscribers: list[queue.Queue[dict[str, Any]]] = []
subscribers_lock = threading.Lock()
run_lock = threading.Lock()
run_active = False
last_events: list[dict[str, Any]] = []


def json_bytes(payload: Any) -> bytes:
    return json.dumps(payload, separators=(",", ":")).encode("utf-8")


def has_daytona_sdk() -> bool:
    try:
        import daytona  # noqa: F401
    except ModuleNotFoundError:
        return False
    return True


def auth_present() -> bool:
    return bool(os.environ.get("DAYTONA_API_KEY") or os.environ.get("DAYTONA_JWT_TOKEN"))


def preflight() -> dict[str, Any]:
    return {
        "script": str(DEMO_SCRIPT),
        "baseDir": str(BASE_DIR),
        "python": sys.executable,
        "daytonaSdk": has_daytona_sdk(),
        "auth": auth_present(),
        "canRunLive": has_daytona_sdk() and auth_present(),
    }


def emit(event_type: str, payload: dict[str, Any] | None = None) -> None:
    event = {
        "type": event_type,
        "at": datetime.now().isoformat(timespec="seconds"),
        "payload": payload or {},
    }
    last_events.append(event)
    del last_events[:-200]
    with subscribers_lock:
        for subscriber in list(subscribers):
            subscriber.put(event)


def emit_states_from_report(report_path: str) -> None:
    path = Path(report_path)
    if not path.is_absolute():
        path = BASE_DIR / path
    if not path.exists():
        return

    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.startswith("| ") or "Branch" in line or "---" in line:
            continue
        columns = [column.strip() for column in line.strip("|").split("|")]
        if len(columns) < 6:
            continue
        branch, sandbox_id, parent, counter, _pid, events = columns[:6]
        clean_sandbox_id = sandbox_id.strip("`")
        try:
            counter_value: int | str = int(counter)
        except ValueError:
            counter_value = counter
        emit(
            "state",
            {
                "id": branch,
                "sandboxId": clean_sandbox_id,
                "parent": None if parent == "-" else parent,
                "counter": counter_value,
                "events": [event.strip() for event in events.split(",") if event.strip()],
            },
        )


def parse_demo_line(line: str) -> None:
    emit("log", {"line": line.rstrip()})

    if "creating parent sandbox" in line:
        emit("node", {"id": "parent", "status": "running", "label": "parent"})
    elif match := re.search(r"created parent `([^`]+)` named `([^`]+)`", line):
        emit(
            "node",
            {
                "id": "parent",
                "status": "running",
                "sandboxId": match.group(1),
                "sandboxName": match.group(2),
            },
        )
    elif "parent server is live" in line:
        emit("node", {"id": "parent", "status": "warm"})
    elif match := re.search(r"forked parent -> `([^`]+)` as `([^`]+)`", line):
        emit(
            "node",
            {
                "id": match.group(1),
                "parent": "parent",
                "status": "forked",
                "sandboxId": match.group(2),
            },
        )
    elif match := re.search(r"mutating `([^`]+)` independently", line):
        emit("node", {"id": match.group(1), "status": "mutating"})
    elif match := re.search(r"forked `strategy-1` -> `([^`]+)` as `([^`]+)`", line):
        emit(
            "node",
            {
                "id": match.group(1),
                "parent": "strategy-1",
                "status": "forked",
                "sandboxId": match.group(2),
            },
        )
    elif "collecting state" in line:
        emit("phase", {"name": "collecting"})
    elif match := re.search(r"wrote report `([^`]+)`", line):
        report_path = match.group(1)
        emit_states_from_report(report_path)
        emit("report", {"path": report_path})


def set_run_active(value: bool) -> None:
    global run_active
    with run_lock:
        run_active = value


def is_run_active() -> bool:
    with run_lock:
        return run_active


def run_live(keep: bool) -> None:
    set_run_active(True)
    emit("reset", {})
    emit("phase", {"name": "live"})
    emit("preflight", preflight())

    cmd = [sys.executable, str(DEMO_SCRIPT)]
    if keep:
        cmd.append("--keep")

    try:
        process = subprocess.Popen(
            cmd,
            cwd=str(BASE_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env=os.environ.copy(),
        )
        assert process.stdout is not None
        for line in process.stdout:
            parse_demo_line(line)
        code = process.wait()
        if code == 0:
            emit("done", {"mode": "live", "exitCode": code})
        else:
            emit("error", {"mode": "live", "exitCode": code})
    except Exception as exc:
        emit("error", {"mode": "live", "message": str(exc)})
    finally:
        set_run_active(False)


def run_demo_mode() -> None:
    set_run_active(True)
    emit("reset", {})
    emit("phase", {"name": "demo"})
    emit("preflight", preflight())

    sequence = [
        (0.2, "node", {"id": "parent", "status": "running", "label": "parent", "sandboxId": "parent-live-state"}),
        (0.5, "log", {"line": "- `  0.502s` creating parent sandbox"}),
        (0.7, "node", {"id": "parent", "status": "warm", "counter": 100, "pid": 4217}),
        (0.4, "log", {"line": "- `  1.188s` parent server is live with counter=100 pid=4217"}),
        (0.5, "node", {"id": "strategy-1", "parent": "parent", "status": "forked", "sandboxId": "strategy-1-fork"}),
        (0.25, "node", {"id": "strategy-2", "parent": "parent", "status": "forked", "sandboxId": "strategy-2-fork"}),
        (0.25, "node", {"id": "strategy-3", "parent": "parent", "status": "forked", "sandboxId": "strategy-3-fork"}),
        (0.5, "log", {"line": "- `  2.343s` forked parent into three strategy branches"}),
        (0.5, "node", {"id": "strategy-1", "status": "mutating", "counter": 107}),
        (0.25, "node", {"id": "strategy-2", "status": "mutating", "counter": 121}),
        (0.25, "node", {"id": "strategy-3", "status": "mutating", "counter": 113}),
        (0.5, "node", {"id": "strategy-1-refine", "parent": "strategy-1", "status": "forked", "sandboxId": "strategy-1-refine-fork", "counter": 110}),
        (0.4, "phase", {"name": "collecting"}),
        (0.4, "state", {"id": "parent", "counter": 100, "events": ["parent:boot", "parent:warm-cache", "parent:index-ready"]}),
        (0.2, "state", {"id": "strategy-1", "counter": 107, "events": ["parent:boot", "parent:warm-cache", "parent:index-ready", "strategy-1:small-targeted-fix"]}),
        (0.2, "state", {"id": "strategy-2", "counter": 121, "events": ["parent:boot", "parent:warm-cache", "parent:index-ready", "strategy-2:larger-refactor"]}),
        (0.2, "state", {"id": "strategy-3", "counter": 113, "events": ["parent:boot", "parent:warm-cache", "parent:index-ready", "strategy-3:test-first-path"]}),
        (0.2, "state", {"id": "strategy-1-refine", "counter": 110, "events": ["parent:boot", "parent:warm-cache", "parent:index-ready", "strategy-1:small-targeted-fix", "strategy-1:second-pass"]}),
        (0.3, "report", {"path": "runs/demo-mode-preview.md"}),
        (0.2, "done", {"mode": "demo", "exitCode": 0}),
    ]

    try:
        for delay, event_type, payload in sequence:
            time.sleep(delay)
            emit(event_type, payload)
    finally:
        set_run_active(False)


class Handler(BaseHTTPRequestHandler):
    server_version = "DaytonaForkDemo/1.0"

    def log_message(self, fmt: str, *args: Any) -> None:
        return

    def send_json(self, payload: Any, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json_bytes(payload)
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def serve_file(self, path: Path, content_type: str) -> None:
        if not path.exists():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        body = path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("content-type", content_type)
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/":
            self.serve_file(WEB_DIR / "index.html", "text/html; charset=utf-8")
        elif parsed.path == "/styles.css":
            self.serve_file(WEB_DIR / "styles.css", "text/css; charset=utf-8")
        elif parsed.path == "/app.js":
            self.serve_file(WEB_DIR / "app.js", "application/javascript; charset=utf-8")
        elif parsed.path == "/api/preflight":
            self.send_json({**preflight(), "running": is_run_active()})
        elif parsed.path == "/events":
            self.handle_events()
        else:
            self.send_error(HTTPStatus.NOT_FOUND)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path != "/api/start":
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        if is_run_active():
            self.send_json({"error": "run already active"}, HTTPStatus.CONFLICT)
            return

        length = int(self.headers.get("content-length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            self.send_json({"error": "invalid JSON"}, HTTPStatus.BAD_REQUEST)
            return

        mode = payload.get("mode", "demo")
        keep = bool(payload.get("keep", True))
        if mode == "live":
            if not preflight()["canRunLive"]:
                self.send_json({"error": "missing Daytona auth or Python SDK", "preflight": preflight()}, HTTPStatus.BAD_REQUEST)
                return
            target = run_live
            args = (keep,)
        elif mode == "demo":
            target = run_demo_mode
            args = ()
        else:
            self.send_json({"error": "unknown mode"}, HTTPStatus.BAD_REQUEST)
            return

        threading.Thread(target=target, args=args, daemon=True).start()
        self.send_json({"started": True, "mode": mode})

    def handle_events(self) -> None:
        subscriber: queue.Queue[dict[str, Any]] = queue.Queue()
        with subscribers_lock:
            subscribers.append(subscriber)

        self.send_response(HTTPStatus.OK)
        self.send_header("content-type", "text/event-stream")
        self.send_header("cache-control", "no-cache")
        self.send_header("connection", "keep-alive")
        self.end_headers()

        try:
            for event in last_events[-30:]:
                self.write_sse(event)
            self.write_sse({"type": "connected", "at": datetime.now().isoformat(timespec="seconds"), "payload": {}})
            while True:
                try:
                    event = subscriber.get(timeout=20)
                    self.write_sse(event)
                except queue.Empty:
                    self.write_sse({"type": "heartbeat", "at": datetime.now().isoformat(timespec="seconds"), "payload": {}})
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            with subscribers_lock:
                if subscriber in subscribers:
                    subscribers.remove(subscriber)

    def write_sse(self, event: dict[str, Any]) -> None:
        self.wfile.write(f"event: {event['type']}\n".encode("utf-8"))
        self.wfile.write(b"data: ")
        self.wfile.write(json_bytes(event))
        self.wfile.write(b"\n\n")
        self.wfile.flush()


class QuietThreadingHTTPServer(ThreadingHTTPServer):
    def handle_error(self, request: Any, client_address: Any) -> None:
        exc_type, _exc, _tb = sys.exc_info()
        if exc_type in {BrokenPipeError, ConnectionResetError}:
            return
        super().handle_error(request, client_address)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument(
        "--strict-port",
        action="store_true",
        help="fail instead of trying the next port when the requested port is busy",
    )
    args = parser.parse_args()

    server = None
    selected_port = args.port
    ports = [args.port] if args.strict_port else range(args.port, args.port + 20)
    for port in ports:
        try:
            server = QuietThreadingHTTPServer((args.host, port), Handler)
            selected_port = port
            break
        except OSError as exc:
            if exc.errno != errno.EADDRINUSE or args.strict_port:
                raise

    if server is None:
        raise SystemExit(
            f"No free port found from {args.port} to {args.port + 19}. "
            "Stop an existing server or pass --port with another value."
        )

    if selected_port != args.port:
        print(f"Port {args.port} is busy; using {selected_port} instead.")
    print(f"Daytona fork demo dashboard: http://{args.host}:{selected_port}")
    print(f"Demo script: {DEMO_SCRIPT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
