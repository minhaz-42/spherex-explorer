#!/usr/bin/env python3
"""Set up and run SPHEREx Explorer with one command, on Windows, macOS or Linux.

    python start.py            development: API on :8000, web app with hot reload on :5173
    python start.py --prod     build the web app, then serve it and the API from :8000
    python start.py --setup    install dependencies only
    python start.py --test     run the backend tests

On Windows you can also double-click start.bat; on macOS, start.command.
Needs Python 3.10+ and Node.js 20.19+. Everything else is installed locally
(backend/.venv and frontend/node_modules), so nothing touches your system.
"""

from __future__ import annotations

import argparse
import hashlib
import os
import shutil
import signal
import socket
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
VENV = BACKEND / ".venv"
IS_WINDOWS = os.name == "nt"

MIN_PYTHON = (3, 10)
MIN_NODE = (20, 19, 0)


def say(message: str) -> None:
    print(f"> {message}", flush=True)


def fail(message: str) -> None:
    print(f"\nError: {message}\n", file=sys.stderr, flush=True)
    sys.exit(1)


# ---- environment ------------------------------------------------------------

def load_dotenv(path: Path) -> None:
    """Reads KEY=value lines from .env, without overriding real environment variables."""
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def check_python() -> None:
    if sys.version_info < MIN_PYTHON:
        fail(f"Python {'.'.join(map(str, MIN_PYTHON))} or newer is needed; this is {sys.version.split()[0]}. "
             "Install it from https://www.python.org/downloads/")


def find_node_tools() -> tuple[str, str]:
    node, npm = shutil.which("node"), shutil.which("npm")
    if not node or not npm:
        fail("Node.js isn't installed or isn't on your PATH. Install the LTS version from https://nodejs.org, "
             "then open a new terminal and run this again.")
    raw = subprocess.run([node, "--version"], capture_output=True, text=True).stdout.strip().lstrip("v")
    try:
        version = tuple(int(part) for part in raw.split(".")[:3])
    except ValueError:
        version = (0, 0, 0)
    if version < MIN_NODE:
        fail(f"Node.js {'.'.join(map(str, MIN_NODE))} or newer is needed; found {raw or 'an unknown version'}. "
             "Install the LTS version from https://nodejs.org")
    return node, npm


def venv_python() -> Path:
    return VENV / ("Scripts/python.exe" if IS_WINDOWS else "bin/python")


def fingerprint(*files: Path) -> str:
    digest = hashlib.sha256()
    for f in files:
        digest.update(f.read_bytes() if f.is_file() else b"")
    return digest.hexdigest()


def ensure_backend(dev: bool) -> Path:
    python = venv_python()
    if not python.is_file():
        say("Creating the Python environment in backend/.venv")
        subprocess.run([sys.executable, "-m", "venv", str(VENV)], check=True)
    requirements = BACKEND / ("requirements-dev.txt" if dev else "requirements.txt")
    stamp = VENV / ".installed"
    wanted = fingerprint(BACKEND / "requirements.txt", requirements)
    if not stamp.is_file() or stamp.read_text() != wanted:
        say(f"Installing Python packages from backend/{requirements.name}")
        subprocess.run([str(python), "-m", "pip", "install", "--disable-pip-version-check", "-q", "--upgrade", "pip"],
                       check=True)
        subprocess.run([str(python), "-m", "pip", "install", "--disable-pip-version-check", "-q", "-r",
                        str(requirements)], check=True, cwd=BACKEND)
        stamp.write_text(wanted)
    return python


def ensure_frontend(npm: str) -> None:
    modules = FRONTEND / "node_modules"
    stamp = modules / ".installed"
    wanted = fingerprint(FRONTEND / "package.json")
    if not stamp.is_file() or stamp.read_text() != wanted:
        say("Installing web app packages (npm install), this takes a minute the first time")
        subprocess.run([npm, "install", "--no-audit", "--no-fund"], check=True, cwd=FRONTEND)
        stamp.write_text(wanted)


def port_is_free(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        if not IS_WINDOWS:
            # Match uvicorn, so a port that was just released isn't reported as busy.
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind((host, port))
        except OSError:
            return False
    return True


def require_port(host: str, port: int, flag: str) -> None:
    if not port_is_free(host, port):
        fail(f"Port {port} is already in use. Stop whatever is using it, or pick another with {flag} <port>.")


# ---- processes --------------------------------------------------------------

def spawn(cmd: list[str], cwd: Path, env: dict[str, str] | None = None) -> subprocess.Popen:
    kwargs: dict = {"cwd": cwd, "env": {**os.environ, **(env or {})}}
    if IS_WINDOWS:
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        kwargs["start_new_session"] = True  # lets us stop the whole process tree
    return subprocess.Popen(cmd, **kwargs)


def stop(proc: subprocess.Popen) -> None:
    if proc.poll() is not None:
        return
    if IS_WINDOWS:
        subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"], capture_output=True)
    else:
        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except ProcessLookupError:
            return
    try:
        proc.wait(timeout=8)
    except subprocess.TimeoutExpired:
        proc.kill()


def _interrupt(signum, frame) -> None:
    raise KeyboardInterrupt


def supervise(procs: list[subprocess.Popen], url: str, open_browser: bool) -> int:
    # Ctrl+C, closing the terminal, or `kill` all stop the servers too.
    signal.signal(signal.SIGINT, signal.default_int_handler)
    if not IS_WINDOWS:
        signal.signal(signal.SIGTERM, _interrupt)
        signal.signal(signal.SIGHUP, _interrupt)
    say(f"Ready soon at {url}  (press Ctrl+C to stop)")
    if open_browser:
        time.sleep(2.5)
        webbrowser.open(url)
    try:
        while all(p.poll() is None for p in procs):
            time.sleep(0.4)
        return next(p.returncode for p in procs if p.poll() is not None) or 0
    except KeyboardInterrupt:
        print()
        say("Stopping")
        return 0
    finally:
        for p in procs:
            stop(p)


def uvicorn_cmd(python: Path, host: str, port: int, reload: bool) -> list[str]:
    cmd = [str(python), "-m", "uvicorn", "app.main:app", "--host", host, "--port", str(port)]
    return cmd + ["--reload", "--reload-dir", "app"] if reload else cmd


# ---- commands ---------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Set up and run SPHEREx Explorer.")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--prod", action="store_true", help="build the web app and serve everything from one port")
    mode.add_argument("--setup", action="store_true", help="install dependencies and stop")
    mode.add_argument("--test", action="store_true", help="run the backend tests")
    parser.add_argument("--host", default=os.environ.get("SPHEREX_HOST", "127.0.0.1"))
    parser.add_argument("--api-port", type=int, default=int(os.environ.get("SPHEREX_API_PORT", "8000")))
    parser.add_argument("--web-port", type=int, default=int(os.environ.get("SPHEREX_WEB_PORT", "5173")))
    parser.add_argument("--open", action="store_true", help="open the app in your browser")
    load_dotenv(ROOT / ".env")
    args = parser.parse_args()

    check_python()

    if args.test:
        python = ensure_backend(dev=True)
        return subprocess.run([str(python), "-m", "pytest", "-q"], cwd=BACKEND).returncode

    _, npm = find_node_tools()
    python = ensure_backend(dev=False)
    ensure_frontend(npm)

    if args.setup:
        say("Setup complete. Run `python start.py` to start the app.")
        return 0

    if args.prod:
        say("Building the web app")
        subprocess.run([npm, "run", "build"], check=True, cwd=FRONTEND)
        require_port(args.host, args.api_port, "--api-port")
        server = spawn(uvicorn_cmd(python, args.host, args.api_port, reload=False), BACKEND)
        return supervise([server], f"http://{args.host}:{args.api_port}", args.open)

    require_port(args.host, args.api_port, "--api-port")
    require_port(args.host, args.web_port, "--web-port")
    api = spawn(uvicorn_cmd(python, args.host, args.api_port, reload=True), BACKEND)
    web = spawn(
        [npm, "run", "dev", "--", "--host", args.host, "--port", str(args.web_port), "--strictPort"],
        FRONTEND,
        env={"SPHEREX_API_URL": f"http://127.0.0.1:{args.api_port}"},
    )
    return supervise([api, web], f"http://localhost:{args.web_port}", args.open)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except subprocess.CalledProcessError as exc:
        fail(f"A setup step failed ({' '.join(map(str, exc.cmd[:3]))} ...). The output above says why.")
