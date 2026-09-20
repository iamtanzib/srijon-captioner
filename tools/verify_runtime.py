from __future__ import annotations
import json, os, subprocess, sys, time, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVER = ROOT / "source" / "whisper-server" / "server.py"
MODEL_DIR = os.environ.get("SRIJON_CAPTIONER_MODEL_DIR") or str(Path(os.environ.get("LOCALAPPDATA", Path.home())) / "SrijonCaptioner" / "models")

print("Python:", sys.executable)
print("Version:", sys.version.split()[0])
try:
    import whisperx
    print("WhisperX: OK", getattr(whisperx, "__version__", "(version not exposed)"))
except Exception as e:
    raise SystemExit(f"WhisperX import FAILED: {e}")
try:
    import torch
    print("Torch:", torch.__version__)
    print("CUDA available:", torch.cuda.is_available())
    if torch.cuda.is_available(): print("CUDA device:", torch.cuda.get_device_name(0))
except Exception as e:
    raise SystemExit(f"Torch import FAILED: {e}")
try:
    import fastapi, uvicorn, pydantic
    print("Server deps: OK")
except Exception as e:
    raise SystemExit(f"Server dependency import FAILED: {e}")

if not SERVER.exists():
    raise SystemExit(f"Server file missing: {SERVER}")
env = os.environ.copy()
env["WHISPERX_MODEL_DIR"] = MODEL_DIR
print("Model dir:", MODEL_DIR)
proc = subprocess.Popen([sys.executable, str(SERVER)], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    health = None
    for _ in range(40):
        time.sleep(0.25)
        try:
            with urllib.request.urlopen("http://127.0.0.1:8765/health", timeout=1) as r:
                health = json.loads(r.read().decode("utf-8"))
                break
        except Exception:
            pass
    if not health:
        raise SystemExit("Local server did not become healthy on port 8765.")
    print("Server health:", json.dumps(health, indent=2))
    req = urllib.request.Request("http://127.0.0.1:8765/shutdown", data=b"{}", method="POST", headers={"Content-Type":"application/json"})
    try: urllib.request.urlopen(req, timeout=2).read()
    except Exception: pass
finally:
    try: proc.wait(timeout=4)
    except Exception:
        proc.kill()
print("VERIFY_RESULT=PASS")
