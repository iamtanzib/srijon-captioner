from __future__ import annotations
import argparse, json, shutil, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "source" / "premiere-plugin"
BUILD = ROOT / "build"

def main():
    ap = argparse.ArgumentParser(description="Build Srijon Captioner CCX from source/premiere-plugin")
    ap.add_argument("--version", help="Optional manifest version override, e.g. 1.2.14")
    ap.add_argument("--name", help="Optional output filename without path")
    args = ap.parse_args()

    if not SRC.exists():
        raise SystemExit(f"Missing source directory: {SRC}")
    BUILD.mkdir(parents=True, exist_ok=True)
    stage = BUILD / "staging-plugin"
    if stage.exists(): shutil.rmtree(stage)
    shutil.copytree(SRC, stage, ignore=shutil.ignore_patterns("__pycache__", "*.pyc", ".DS_Store"))

    manifest_path = stage / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if args.version:
        manifest["version"] = args.version
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    version = manifest.get("version", "dev")
    out_name = args.name or f"Srijon-Captioner-v{version}-DevBuild.ccx"
    out = BUILD / out_name
    if out.exists(): out.unlink()

    with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for p in sorted(stage.rglob("*")):
            if p.is_file():
                zf.write(p, p.relative_to(stage).as_posix())
    print(out)

if __name__ == "__main__":
    main()
