from __future__ import annotations
import json, os, sys
from pathlib import Path
root = Path(__file__).resolve().parents[1]
runtime = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "SrijonCaptioner" / "runtime" / "whisperx-venv"
models = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "SrijonCaptioner" / "models"
config = {
    "python": str(runtime / "Scripts" / "python.exe"),
    "venv": str(runtime),
    "model_dir": str(models),
    "plugin_id": "com.srijon.captioner.local",
    "plugin_version": "1.2.14",
    "server_port": 8765,
}
(root / "build").mkdir(exist_ok=True)
(root / "build" / "runtime_config.json").write_text(json.dumps(config, indent=2)+"\n", encoding="utf-8")
print(root / "build" / "runtime_config.json")
