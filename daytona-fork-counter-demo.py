#!/usr/bin/env python3
"""Daytona sandbox forking demo.

The live demo creates a parent sandbox, starts a warm in-memory HTTP server,
forks the parent several times, mutates each fork independently, forks a fork,
and writes a markdown report under runs/.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import textwrap
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).resolve().parent
PORT = 8787


SERVER_CODE = r"""
import json
import os
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

BOOTED_AT = time.time()
STATE = {
    "branch": "parent",
    "counter": 100,
    "events": ["parent:boot", "parent:warm-cache", "parent:index-ready"],
}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def _send(self, payload):
        body = json.dumps(payload, sort_keys=True).encode("utf-8")
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path != "/state":
            self._send({"error": "unknown path", "path": parsed.path})
            return
        self._send({
            "branch": STATE["branch"],
            "counter": STATE["counter"],
            "events": list(STATE["events"]),
            "pid": os.getpid(),
            "uptime_seconds": round(time.time() - BOOTED_AT, 3),
        })

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/mutate":
            self._send({"error": "unknown path", "path": parsed.path})
            return
        query = parse_qs(parsed.query)
        branch = query.get("branch", [STATE["branch"]])[0]
        event = query.get("event", ["mutation"])[0]
        delta = int(query.get("delta", ["1"])[0])
        STATE["branch"] = branch
        STATE["counter"] += delta
        STATE["events"].append(event)
        self._send({
            "branch": STATE["branch"],
            "counter": STATE["counter"],
            "events": list(STATE["events"]),
            "pid": os.getpid(),
        })


ThreadingHTTPServer(("127.0.0.1", 8787), Handler).serve_forever()
"""


@dataclass
class BranchState:
    name: str
    sandbox_id: str
    parent: str
    state: dict[str, Any]


class Recorder:
    def __init__(self) -> None:
        self.started = time.perf_counter()
        self.lines: list[str] = []

    def step(self, message: str) -> None:
        elapsed = time.perf_counter() - self.started
        line = f"- `{elapsed:7.3f}s` {message}"
        print(line)
        self.lines.append(line)


def response_text(response: Any) -> str:
    return getattr(response, "result", "") or getattr(
        getattr(response, "artifacts", None), "stdout", ""
    )


def exec_checked(sandbox: Any, command: str, *, timeout: int | None = None) -> str:
    response = sandbox.process.exec(command, timeout=timeout)
    exit_code = getattr(response, "exit_code", 0)
    output = response_text(response).strip()
    if exit_code != 0:
        raise RuntimeError(
            f"Command failed in sandbox {sandbox.id} with exit {exit_code}: {command}\n{output}"
        )
    return output


def curl_json(sandbox: Any, method: str, path: str, *, timeout: int = 20) -> dict[str, Any]:
    command = f"curl -fsS -X {method} 'http://127.0.0.1:{PORT}{path}'"
    return json.loads(exec_checked(sandbox, command, timeout=timeout))


def wait_for_server(sandbox: Any, recorder: Recorder) -> None:
    for attempt in range(1, 16):
        try:
            state = curl_json(sandbox, "GET", "/state", timeout=5)
            recorder.step(
                f"parent server is live with counter={state['counter']} pid={state['pid']}"
            )
            return
        except Exception:
            time.sleep(1)
    raise RuntimeError("server did not become ready")


def write_report(path: Path, recorder: Recorder, states: list[BranchState], *, kept: bool) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    table = [
        "| Branch | Sandbox ID | Parent | Counter | Server PID | Events |",
        "| --- | --- | --- | ---: | ---: | --- |",
    ]
    for item in states:
        events = ", ".join(item.state["events"])
        table.append(
            f"| {item.name} | `{item.sandbox_id}` | {item.parent} | "
            f"{item.state['counter']} | {item.state['pid']} | {events} |"
        )

    body = "\n".join(
        [
            "# Daytona Fork Counter Demo Run",
            "",
            f"Date: {datetime.now().isoformat(timespec='seconds')}",
            "",
            "## What This Demonstrates",
            "",
            "A parent sandbox hosted a long-running Python process with in-memory state. "
            "Daytona forked that started sandbox into independent children, then one child "
            "was forked again. Each branch began with the same warm state and diverged "
            "without affecting its parent or siblings.",
            "",
            "## Timeline",
            "",
            *recorder.lines,
            "",
            "## Fork Tree",
            "",
            "```text",
            "parent",
            "|-- strategy-1",
            "|   `-- strategy-1-refine",
            "|-- strategy-2",
            "`-- strategy-3",
            "```",
            "",
            "## Observed State",
            "",
            *table,
            "",
            "## Cleanup",
            "",
            "Sandboxes were kept for dashboard inspection." if kept else "Sandboxes were deleted in reverse fork-tree order.",
            "",
            "## Aha",
            "",
            "A normal fresh container could reproduce the filesystem, but it would not preserve "
            "the already-running HTTP server's in-memory state at the branch point. Daytona "
            "forking turns that live state into a cheap search tree.",
            "",
        ]
    )
    path.write_text(body, encoding="utf-8")


def write_dry_run_report(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    body = textwrap.dedent(
        f"""\
        # Daytona Fork Counter Demo Dry Run

        Date: {datetime.now().isoformat(timespec='seconds')}

        ## Planned Live Steps

        1. Create a parent Daytona sandbox with auto-stop disabled.
        2. Write `fork_server.py` inside the sandbox.
        3. Start `fork_server.py` as a long-running process on `127.0.0.1:{PORT}`.
        4. Query `/state` to prove the parent process is live and warmed.
        5. Fork the started parent into `strategy-1`, `strategy-2`, and `strategy-3`.
        6. Mutate each child through the inherited HTTP process.
        7. Fork `strategy-1` into `strategy-1-refine`.
        8. Query all branches and write a markdown table.

        ## Expected Fork Tree

        ```text
        parent
        |-- strategy-1
        |   `-- strategy-1-refine
        |-- strategy-2
        `-- strategy-3
        ```

        ## Why This Shows Forking

        The server's `events` list and `counter` live in process memory. If the branch was
        created by a normal fresh container, the server would restart from initial state.
        With Daytona sandbox forking, every child starts from the same live warmed process
        state and then diverges independently.

        ## Missing For Live Run In This Session

        - `DAYTONA_API_KEY` or Daytona CLI profile.
        - Python package `daytona`.
        """
    )
    path.write_text(body, encoding="utf-8")
    print(f"Wrote {path}")


def run_live(args: argparse.Namespace) -> Path:
    if not os.environ.get("DAYTONA_API_KEY") and not os.environ.get("DAYTONA_JWT_TOKEN"):
        raise SystemExit(
            "Missing DAYTONA_API_KEY or DAYTONA_JWT_TOKEN. Run with --dry-run for a local report preview."
        )

    try:
        from daytona import CreateSandboxFromSnapshotParams, Daytona
    except ModuleNotFoundError as exc:
        raise SystemExit(
            "Missing Python SDK. Install it with: python3 -m pip install daytona"
        ) from exc

    recorder = Recorder()
    suffix = datetime.now().strftime("%Y%m%d-%H%M%S")
    prefix = f"fork-counter-{suffix}"
    created: list[Any] = []
    states: list[BranchState] = []
    kept = args.keep

    daytona = Daytona()

    try:
        recorder.step("creating parent sandbox")
        parent = daytona.create(
            CreateSandboxFromSnapshotParams(
                name=f"{prefix}-parent",
                auto_stop_interval=0,
                labels={"demo": "fork-counter", "role": "parent"},
            ),
            timeout=120,
        )
        created.append(parent)
        recorder.step(f"created parent `{parent.id}` named `{parent.name}`")

        recorder.step("installing in-memory HTTP server in parent")
        exec_checked(
            parent,
            f"cat > /tmp/fork_server.py <<'PY'\n{SERVER_CODE}\nPY",
            timeout=20,
        )

        recorder.step("starting parent server as a long-running process")
        exec_checked(
            parent,
            "nohup python3 /tmp/fork_server.py > /tmp/fork_server.log 2>&1 &",
            timeout=10,
        )
        wait_for_server(parent, recorder)

        recorder.step("forking parent into three strategy branches")
        children: dict[str, Any] = {}
        for label in ["strategy-1", "strategy-2", "strategy-3"]:
            child = parent._experimental_fork(name=f"{prefix}-{label}")
            created.append(child)
            children[label] = child
            recorder.step(f"forked parent -> `{label}` as `{child.id}`")

        mutations = {
            "strategy-1": ("strategy-1:small-targeted-fix", 7),
            "strategy-2": ("strategy-2:larger-refactor", 21),
            "strategy-3": ("strategy-3:test-first-path", 13),
        }
        for label, child in children.items():
            event, delta = mutations[label]
            recorder.step(f"mutating `{label}` independently")
            curl_json(
                child,
                "POST",
                f"/mutate?branch={label}&event={event}&delta={delta}",
            )

        recorder.step("forking the best-looking child again")
        grandchild = children["strategy-1"]._experimental_fork(
            name=f"{prefix}-strategy-1-refine"
        )
        created.append(grandchild)
        curl_json(
            grandchild,
            "POST",
            "/mutate?branch=strategy-1-refine&event=strategy-1:second-pass&delta=3",
        )
        recorder.step(f"forked `strategy-1` -> `strategy-1-refine` as `{grandchild.id}`")

        recorder.step("collecting state from parent, children, and grandchild")
        states.append(
            BranchState("parent", parent.id, "-", curl_json(parent, "GET", "/state"))
        )
        for label, child in children.items():
            states.append(
                BranchState(label, child.id, "parent", curl_json(child, "GET", "/state"))
            )
        states.append(
            BranchState(
                "strategy-1-refine",
                grandchild.id,
                "strategy-1",
                curl_json(grandchild, "GET", "/state"),
            )
        )

        report_path = BASE_DIR / "runs" / f"{prefix}.md"
        write_report(report_path, recorder, states, kept=kept)
        recorder.step(f"wrote report `{report_path}`")
        return report_path
    finally:
        if not kept and created:
            recorder.step("cleaning up sandboxes in reverse fork-tree order")
            for sandbox in reversed(created):
                try:
                    sandbox.delete(timeout=120)
                    recorder.step(f"deleted `{sandbox.id}`")
                except Exception as exc:
                    recorder.step(f"cleanup failed for `{getattr(sandbox, 'id', '?')}`: {exc}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--keep", action="store_true", help="leave sandboxes running for dashboard inspection")
    parser.add_argument("--dry-run", action="store_true", help="write a local markdown preview without Daytona auth")
    args = parser.parse_args()

    if args.dry_run:
        path = BASE_DIR / "runs" / f"dry-run-{datetime.now().strftime('%Y%m%d-%H%M%S')}.md"
        write_dry_run_report(path)
        return 0

    path = run_live(args)
    print(f"Wrote {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
