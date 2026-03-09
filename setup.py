#!/usr/bin/env python3
"""
GC Data Templates — Setup Wizard Backend

Servidor HTTP local que serve o frontend React compilado e expõe uma API REST
para configuração e deploy de templates de data engineering.

Uso: python setup.py
Requisitos: Python 3.7+ (stdlib apenas, zero dependências externas)
"""

import http.server
import json
import locale
import mimetypes
import base64
import os
import platform
import queue
import re
import secrets
import signal
import socket
import string
import subprocess
import sys
import threading
import time
import webbrowser
from http import HTTPStatus
from pathlib import Path
from urllib.parse import parse_qs, urlparse

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
DIST_DIR = BASE_DIR / "setup-ui" / "dist"
WIZARD_JSON = BASE_DIR / "wizard.json"
TEMPLATES_DIR = BASE_DIR / "templates"
SCRIPTS_DIR = BASE_DIR / "scripts"

DEFAULT_PORT = 8000
MAX_PORT_ATTEMPTS = 20
SUBPROCESS_TIMEOUT = 10  # seconds for prerequisite checks

# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------


def detect_language():
    """Detect the system language, defaulting to 'en'."""
    try:
        lang, _ = locale.getdefaultlocale()
        if lang and lang.startswith("pt"):
            return "pt-BR"
    except Exception:
        pass
    return "en"


def get_system_info():
    """Gather system information for the /api/info endpoint."""
    system = platform.system()
    try:
        if system == "Linux":
            import distro  # noqa: F811 — optional, best-effort
            os_version = f"{distro.name()} {distro.version()}"
        else:
            os_version = platform.version()
    except Exception:
        os_version = platform.version()

    return {
        "os": system,
        "os_version": os_version,
        "arch": platform.machine(),
        "python_version": platform.python_version(),
        "lang": detect_language(),
        "home_dir": str(Path.home()),
        "cwd": str(BASE_DIR),
    }


def load_wizard_json():
    """Load and return the wizard.json contents."""
    if not WIZARD_JSON.exists():
        raise FileNotFoundError(f"wizard.json not found at {WIZARD_JSON}")
    with open(WIZARD_JSON, "r", encoding="utf-8") as f:
        return json.load(f)


def get_shell_command(action, wizard_config):
    """Return the appropriate shell command for the current OS."""
    system = platform.system()
    deploy_cfg = wizard_config.get("deploy", {})
    action_cfg = deploy_cfg.get(action, {})

    if system == "Windows":
        return action_cfg.get("command_windows", "")
    return action_cfg.get("command_unix", "")


def guess_mime(path):
    """Guess MIME type for a file path."""
    mime, _ = mimetypes.guess_type(str(path))
    return mime or "application/octet-stream"


# ---------------------------------------------------------------------------
# SSE helpers
# ---------------------------------------------------------------------------


def send_sse(wfile, data):
    """Send a single SSE event."""
    message = f"data: {json.dumps(data)}\n\n"
    wfile.write(message.encode("utf-8"))
    wfile.flush()


def _kill_process_tree(process):
    """Kill a subprocess and all its children (the entire process group)."""
    try:
        if platform.system() != "Windows":
            pgid = os.getpgid(process.pid)
            os.killpg(pgid, signal.SIGTERM)
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                os.killpg(pgid, signal.SIGKILL)
        else:
            process.kill()
    except (OSError, ProcessLookupError):
        pass
    # Final reap to avoid zombie processes
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        pass


def stream_process(wfile, cmd, timeout=600, idle_timeout=120):
    """Execute *cmd* in a subprocess and stream output as SSE events.

    Safeguards against hanging:
    - *timeout*: global maximum wall-clock time (default 600 s / 10 min).
    - *idle_timeout*: max seconds without any output (default 120 s / 2 min).
    - Detects SSE client disconnect and kills the process immediately.
    - Uses a background reader thread + queue to avoid pipe-buffer deadlocks.
    - Kills the entire process group (not just the shell) on Unix.
    """
    popen_kwargs = dict(
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        cwd=str(BASE_DIR),
        shell=True,
    )
    # On Unix, create a new process group so _kill_process_tree can kill
    # docker compose (child of the shell) and all its descendants.
    if platform.system() != "Windows":
        popen_kwargs["preexec_fn"] = os.setsid

    try:
        process = subprocess.Popen(cmd, **popen_kwargs)
    except Exception as exc:
        send_sse(wfile, {"type": "log", "line": f"[ERROR] Failed to start process: {exc}"})
        send_sse(wfile, {"type": "done", "success": False})
        return

    # Read stdout in a daemon thread so the pipe buffer never fills up.
    output_queue = queue.Queue()

    def _reader():
        try:
            for line in iter(process.stdout.readline, ""):
                output_queue.put(line)
        except ValueError:
            pass  # stdout closed
        output_queue.put(None)  # sentinel → EOF

    read_thread = threading.Thread(target=_reader, daemon=True)
    read_thread.start()

    start = time.monotonic()
    last_activity = start
    timed_out = False

    try:
        while True:
            now = time.monotonic()

            # Global timeout
            if now - start > timeout:
                timed_out = True
                _kill_process_tree(process)
                send_sse(wfile, {
                    "type": "log",
                    "line": f"[TIMEOUT] Process exceeded {timeout}s limit — killed",
                })
                break

            # Idle timeout (no output for too long)
            if now - last_activity > idle_timeout:
                timed_out = True
                _kill_process_tree(process)
                send_sse(wfile, {
                    "type": "log",
                    "line": f"[TIMEOUT] No output for {idle_timeout}s — killed",
                })
                break

            # Read next line from queue (1 s poll keeps timeouts responsive)
            try:
                line = output_queue.get(timeout=1.0)
            except queue.Empty:
                continue

            if line is None:
                break  # process finished naturally

            stripped = line.rstrip("\n\r")
            if stripped:
                last_activity = time.monotonic()
                send_sse(wfile, {"type": "log", "line": stripped})

    except (BrokenPipeError, ConnectionResetError):
        # Client disconnected — kill process and bail out
        _kill_process_tree(process)
        return

    # Normal exit: reap process if it hasn't been killed yet
    if not timed_out:
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            _kill_process_tree(process)

    try:
        send_sse(wfile, {
            "type": "done",
            "success": not timed_out and process.returncode == 0,
        })
    except (BrokenPipeError, ConnectionResetError):
        pass


# ---------------------------------------------------------------------------
# Request handler
# ---------------------------------------------------------------------------


class WizardHandler(http.server.BaseHTTPRequestHandler):
    """HTTP request handler for the setup wizard."""

    wizard_config = None  # set at server startup

    # Suppress default logging to stderr (we print our own)
    def log_message(self, format, *args):  # noqa: A002
        pass

    # ----- helpers -----

    def _send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _send_error(self, status, message):
        self._send_json({"error": message}, status=status)

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8"))

    def _start_sse(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

    # ----- CORS preflight -----

    def do_OPTIONS(self):  # noqa: N802
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    # ----- GET routes -----

    def do_GET(self):  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        if path == "/api/info":
            return self._handle_info()
        if path == "/api/status":
            return self._handle_status()
        if path == "/api/prerequisites":
            return self._handle_prerequisites()
        if path == "/api/prerequisites/stream":
            return self._handle_prerequisites_stream()
        if path == "/api/services/logs":
            return self._handle_services_logs()

        # Serve static files from dist/
        self._serve_static(parsed.path)

    # ----- POST routes -----

    def do_POST(self):  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        if path == "/api/config":
            return self._handle_config()
        if path == "/api/deploy":
            return self._handle_deploy()
        if path == "/api/test":
            return self._handle_test()
        if path == "/api/cleanup":
            return self._handle_cleanup()
        if path == "/api/services/start":
            return self._handle_services_start()
        if path == "/api/services/stop":
            return self._handle_services_stop()
        if path == "/api/services/restart":
            return self._handle_services_restart()
        if path == "/api/config/reset":
            return self._handle_config_reset()

        self._send_error(404, "Not found")

    # ----- API implementations -----

    def _handle_info(self):
        try:
            # Quick filesystem check (no Docker calls) so the frontend
            # can decide whether to show the wizard or the existing-setup
            # screen without waiting for the slow /api/status endpoint.
            has_env = (BASE_DIR / ".env").exists()
            has_compose = (BASE_DIR / "docker-compose.yml").exists()

            data = {
                "template": self.wizard_config,
                "system": get_system_info(),
                "has_config": has_env or has_compose,
            }
            self._send_json(data)
        except Exception as exc:
            self._send_error(500, str(exc))

    def _handle_prerequisites(self):
        try:
            prereqs = self.wizard_config.get("prerequisites", [])
            results = []
            for prereq in prereqs:
                name = prereq.get("name", "Unknown")
                check_cmd = prereq.get("check", "")
                required = prereq.get("required", True)
                install_url = prereq.get("install_url", "")

                status = "missing"
                version = None

                if check_cmd:
                    try:
                        result = subprocess.run(
                            check_cmd,
                            shell=True,
                            capture_output=True,
                            text=True,
                            timeout=SUBPROCESS_TIMEOUT,
                        )
                        if result.returncode == 0:
                            status = "ok"
                            version = result.stdout.strip().split("\n")[0]
                    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
                        pass

                entry = {
                    "name": name,
                    "check": check_cmd,
                    "status": status,
                    "version": version,
                    "required": required,
                }
                # Resolve install_url per OS
                if isinstance(install_url, dict):
                    entry["install_url"] = install_url.get(platform.system(), "")
                elif install_url:
                    entry["install_url"] = install_url

                results.append(entry)

            all_ok = all(
                r["status"] == "ok" for r in results if r["required"]
            )
            self._send_json({"results": results, "all_ok": all_ok})
        except Exception as exc:
            self._send_error(500, str(exc))

    def _handle_prerequisites_stream(self):
        """SSE endpoint that checks each prerequisite one-by-one and streams results."""
        try:
            self._start_sse()
            prereqs = self.wizard_config.get("prerequisites", [])

            # First, send the full list so frontend knows what to expect
            items = []
            for prereq in prereqs:
                install_url = prereq.get("install_url", "")
                if isinstance(install_url, dict):
                    install_url = install_url.get(platform.system(), "")
                items.append({
                    "name": prereq.get("name", "Unknown"),
                    "required": prereq.get("required", True),
                    "install_url": install_url,
                })
            send_sse(self.wfile, {"type": "init", "items": items})

            # Check each one sequentially and stream the result
            all_required_ok = True
            for i, prereq in enumerate(prereqs):
                name = prereq.get("name", "Unknown")
                check_cmd = prereq.get("check", "")
                required = prereq.get("required", True)

                # Notify frontend we're now checking this item
                send_sse(self.wfile, {"type": "checking", "index": i, "name": name})

                status = "missing"
                version = None

                if check_cmd:
                    try:
                        result = subprocess.run(
                            check_cmd,
                            shell=True,
                            capture_output=True,
                            text=True,
                            timeout=SUBPROCESS_TIMEOUT,
                        )
                        if result.returncode == 0:
                            status = "ok"
                            version = result.stdout.strip().split("\n")[0]
                    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
                        pass

                if required and status != "ok":
                    all_required_ok = False

                # Send result for this specific item
                send_sse(self.wfile, {
                    "type": "result",
                    "index": i,
                    "name": name,
                    "status": status,
                    "version": version,
                })

                # Minimum visible delay so user sees the step-by-step progression
                time.sleep(0.8)

            # Final summary
            send_sse(self.wfile, {"type": "done", "all_ok": all_required_ok})

        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as exc:
            try:
                send_sse(self.wfile, {"type": "error", "message": str(exc)})
            except Exception:
                pass

    @staticmethod
    def _generate_fernet_key():
        """Generate a Fernet-compatible key using stdlib only."""
        return base64.urlsafe_b64encode(secrets.token_bytes(32)).decode()

    def _handle_status(self):
        """Check if existing configuration and containers are present."""
        try:
            has_env = (BASE_DIR / ".env").exists()
            has_compose = (BASE_DIR / "docker-compose.yml").exists()

            containers = []
            is_running = False

            if has_compose:
                try:
                    # Use 'docker ps' instead of 'docker compose ps' because
                    # the latter can be extremely slow (>10s) on some systems.
                    # Filter by the compose project name (= directory name).
                    project = BASE_DIR.name
                    cmd = (
                        f'docker ps -a --filter "label=com.docker.compose.project={project}" '
                        f'--format "{{{{json .}}}}"'
                    )
                    result = subprocess.run(
                        cmd,
                        shell=True,
                        capture_output=True,
                        text=True,
                        encoding="utf-8",
                        errors="replace",
                        timeout=5,
                        cwd=str(BASE_DIR),
                    )
                    if result.returncode == 0 and result.stdout.strip():
                        for line in result.stdout.strip().splitlines():
                            line = line.strip()
                            if not line:
                                continue
                            try:
                                c = json.loads(line)
                                # docker ps uses different field names than
                                # docker compose ps — map them.
                                state_str = c.get("State", c.get("state", ""))
                                containers.append({
                                    "name": c.get("Names", c.get("Name", c.get("name", ""))),
                                    "service": c.get("Labels", "").split("com.docker.compose.service=")[-1].split(",")[0] if "com.docker.compose.service=" in c.get("Labels", "") else c.get("Names", ""),
                                    "status": c.get("Status", c.get("status", "")),
                                    "state": state_str,
                                    "ports": c.get("Ports", c.get("ports", "")),
                                })
                            except (json.JSONDecodeError, TypeError):
                                continue
                        is_running = any(
                            c["state"].lower() == "running" for c in containers if c.get("state")
                        )
                except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
                    pass

            self._send_json({
                "has_env": has_env,
                "has_compose": has_compose,
                "has_config": has_env or has_compose,
                "containers": containers,
                "is_running": is_running,
            })
        except Exception as exc:
            self._send_error(500, str(exc))

    def _handle_services_start(self):
        """Start containers with docker compose up -d."""
        try:
            self._start_sse()
            stream_process(self.wfile, "docker compose up -d", timeout=300, idle_timeout=120)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as exc:
            try:
                self._start_sse()
                send_sse(self.wfile, {"type": "log", "line": f"[ERROR] {exc}"})
                send_sse(self.wfile, {"type": "done", "success": False})
            except Exception:
                pass

    def _handle_services_stop(self):
        """Stop containers with docker compose stop."""
        try:
            result = subprocess.run(
                "docker compose stop",
                shell=True,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=60,
                cwd=str(BASE_DIR),
            )
            self._send_json({
                "status": "ok" if result.returncode == 0 else "error",
                "message": result.stdout.strip() or result.stderr.strip(),
            })
        except subprocess.TimeoutExpired:
            self._send_error(504, "Stop timed out")
        except Exception as exc:
            self._send_error(500, str(exc))

    def _handle_services_restart(self):
        """Restart containers with docker compose restart."""
        try:
            result = subprocess.run(
                "docker compose restart",
                shell=True,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=120,
                cwd=str(BASE_DIR),
            )
            self._send_json({
                "status": "ok" if result.returncode == 0 else "error",
                "message": result.stdout.strip() or result.stderr.strip(),
            })
        except subprocess.TimeoutExpired:
            self._send_error(504, "Restart timed out")
        except Exception as exc:
            self._send_error(500, str(exc))

    def _handle_services_logs(self):
        """Stream docker compose logs as SSE."""
        try:
            self._start_sse()
            stream_process(self.wfile, "docker compose logs --tail=100 --no-color", timeout=60, idle_timeout=30)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as exc:
            try:
                self._start_sse()
                send_sse(self.wfile, {"type": "log", "line": f"[ERROR] {exc}"})
                send_sse(self.wfile, {"type": "done", "success": False})
            except Exception:
                pass

    def _handle_config_reset(self):
        """Delete generated config files so the wizard can start fresh."""
        try:
            deleted = []
            for target in ["docker-compose.yml", ".env", "profiles.yml"]:
                path = BASE_DIR / target
                if path.exists():
                    path.unlink()
                    deleted.append(target)
            self._send_json({"status": "ok", "deleted": deleted})
        except Exception as exc:
            self._send_error(500, str(exc))

    def _handle_config(self):
        try:
            body = self._read_body()
            values = body.get("values", {})
            if not values:
                self._send_error(400, "No values provided")
                return

            # Auto-generate Fernet key if set to "auto"
            if values.get("airflow_fernet_key", "").lower() == "auto":
                values["airflow_fernet_key"] = self._generate_fernet_key()

            config_templates = self.wizard_config.get("config_templates", [])
            files_generated = []

            for tpl_cfg in config_templates:
                source = BASE_DIR / tpl_cfg["source"]
                target = BASE_DIR / tpl_cfg["target"]

                if not source.exists():
                    continue

                # Ensure target directory exists
                target.parent.mkdir(parents=True, exist_ok=True)

                with open(source, "r", encoding="utf-8") as f:
                    content = f.read()

                # Use $-style placeholders: ${var_name}
                tmpl = string.Template(content)
                try:
                    rendered = tmpl.substitute(values)
                except (KeyError, ValueError):
                    # Fall back to safe_substitute for missing keys
                    rendered = tmpl.safe_substitute(values)

                with open(target, "w", encoding="utf-8", newline="\n") as f:
                    f.write(rendered)

                files_generated.append(tpl_cfg["target"])

            # Build a human-readable summary
            summary = {}
            for step in self.wizard_config.get("steps", []):
                for field in step.get("fields", []):
                    fid = field["id"]
                    if fid in values:
                        val = values[fid]
                        # For select fields, resolve the label
                        if field.get("type") == "select" and field.get("options"):
                            for opt in field["options"]:
                                if opt["value"] == val:
                                    label = opt.get("label", {})
                                    val = label.get("en", val) if isinstance(label, dict) else val
                                    break
                        summary[fid] = val

            self._send_json({
                "status": "ok",
                "files_generated": files_generated,
                "summary": summary,
            })
        except Exception as exc:
            self._send_error(500, str(exc))

    def _handle_deploy(self):
        try:
            cmd = get_shell_command("deploy", self.wizard_config)
            if not cmd:
                self._start_sse()
                send_sse(self.wfile, {"type": "log", "line": "[ERROR] No deploy command configured"})
                send_sse(self.wfile, {"type": "done", "success": False})
                return
            self._start_sse()
            stream_process(self.wfile, cmd)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as exc:
            try:
                self._start_sse()
                send_sse(self.wfile, {"type": "log", "line": f"[ERROR] {exc}"})
                send_sse(self.wfile, {"type": "done", "success": False})
            except Exception:
                pass

    def _handle_test(self):
        try:
            cmd = get_shell_command("test", self.wizard_config)
            if not cmd:
                self._start_sse()
                send_sse(self.wfile, {"type": "log", "line": "[ERROR] No test command configured"})
                send_sse(self.wfile, {"type": "done", "success": False})
                return
            self._start_sse()
            stream_process(self.wfile, cmd)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as exc:
            try:
                self._start_sse()
                send_sse(self.wfile, {"type": "log", "line": f"[ERROR] {exc}"})
                send_sse(self.wfile, {"type": "done", "success": False})
            except Exception:
                pass

    def _handle_cleanup(self):
        try:
            cmd = get_shell_command("cleanup", self.wizard_config)
            if not cmd:
                self._send_json({"status": "error", "message": "No cleanup command configured"}, status=400)
                return

            result = subprocess.run(
                cmd,
                shell=True,
                capture_output=True,
                text=True,
                timeout=60,
                cwd=str(BASE_DIR),
            )
            if result.returncode == 0:
                self._send_json({
                    "status": "ok",
                    "message": "All containers and volumes removed",
                })
            else:
                self._send_json({
                    "status": "error",
                    "message": result.stderr.strip() or result.stdout.strip(),
                }, status=500)
        except subprocess.TimeoutExpired:
            self._send_error(504, "Cleanup timed out")
        except Exception as exc:
            self._send_error(500, str(exc))

    # ----- Static file server -----

    def _serve_static(self, request_path):
        """Serve files from setup-ui/dist/. Falls back to index.html for SPA routing."""
        if not DIST_DIR.exists():
            self._send_error(500, "Frontend not built. Run: cd setup-ui && npm run build")
            return

        # Normalize path
        clean = request_path.lstrip("/")
        if not clean or clean == "/":
            clean = "index.html"

        filepath = DIST_DIR / clean

        # SPA fallback: if file not found, serve index.html
        if not filepath.exists() or not filepath.is_file():
            filepath = DIST_DIR / "index.html"

        if not filepath.exists():
            self._send_error(404, "Not found")
            return

        # Security: ensure the resolved path is within DIST_DIR
        try:
            filepath.resolve().relative_to(DIST_DIR.resolve())
        except ValueError:
            self._send_error(403, "Forbidden")
            return

        mime = guess_mime(filepath)
        try:
            content = filepath.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "public, max-age=3600")
            self.end_headers()
            self.wfile.write(content)
        except Exception as exc:
            self._send_error(500, str(exc))


# ---------------------------------------------------------------------------
# Server setup
# ---------------------------------------------------------------------------


class WizardServer(http.server.ThreadingHTTPServer):
    """Threaded HTTP server — each request runs in its own thread so the main
    loop stays responsive to Ctrl+C, even during long-running SSE streams."""
    allow_reuse_address = True
    daemon_threads = True  # threads die when main thread exits


def find_free_port(start=DEFAULT_PORT, attempts=MAX_PORT_ATTEMPTS):
    """Find an available port starting from *start*."""
    for offset in range(attempts):
        port = start + offset
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(("", port))
                return port
        except OSError:
            continue
    raise RuntimeError(f"No free port found in range {start}-{start + attempts - 1}")


def print_banner(port):
    """Print the startup banner."""
    print()
    print("  ╔══════════════════════════════════════════╗")
    print("  ║  GC Data Templates — Setup Wizard        ║")
    print(f"  ║  Running on http://localhost:{port:<13}║")
    print("  ║  Press Ctrl+C to stop                    ║")
    print("  ╚══════════════════════════════════════════╝")
    print()


def main():
    # Load wizard configuration
    try:
        wizard_config = load_wizard_json()
    except FileNotFoundError as exc:
        print(f"[ERROR] {exc}")
        sys.exit(1)
    except json.JSONDecodeError as exc:
        print(f"[ERROR] Invalid wizard.json: {exc}")
        sys.exit(1)

    # Attach config to handler class
    WizardHandler.wizard_config = wizard_config

    # Find available port
    try:
        port = find_free_port()
    except RuntimeError as exc:
        print(f"[ERROR] {exc}")
        sys.exit(1)

    # ThreadingHTTPServer: requests run in daemon threads, so the main
    # thread's serve_forever(poll_interval) can be interrupted by Ctrl+C.
    server = WizardServer(("", port), WizardHandler)

    print_banner(port)

    # Open browser after a short delay
    url = f"http://localhost:{port}"
    threading.Timer(0.5, lambda: webbrowser.open(url)).start()

    # serve_forever with a short poll so Ctrl+C is caught quickly
    try:
        server.serve_forever(poll_interval=0.25)
    except KeyboardInterrupt:
        print("\n  Shutting down...")
    finally:
        server.server_close()
        print("  Server stopped.")


if __name__ == "__main__":
    main()
