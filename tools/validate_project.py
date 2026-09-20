from pathlib import Path
import json, re, sys

ROOT = Path(__file__).resolve().parents[1]
PLUGIN = ROOT / "source" / "premiere-plugin"
SERVER_A = PLUGIN / "server.py"
SERVER_B = ROOT / "source" / "whisper-server" / "server.py"
INDEX = PLUGIN / "index.js"
INDEX_HTML = PLUGIN / "index.html"
STYLES = PLUGIN / "styles.css"
MANIFEST = PLUGIN / "manifest.json"
LAUNCHER = PLUGIN / "start_server_auto.bat"
HIDDEN_LAUNCHER = PLUGIN / "start_server_hidden.vbs"
NOTIFIER = PLUGIN / "notify_complete.vbs"

errors = []

def require(cond, msg):
    if not cond:
        errors.append(msg)

require(SERVER_A.exists() and SERVER_B.exists(), "server.py copy missing")
if SERVER_A.exists() and SERVER_B.exists():
    require(SERVER_A.read_bytes() == SERVER_B.read_bytes(), "server.py copies differ")

js = INDEX.read_text(encoding="utf-8") if INDEX.exists() else ""
html = INDEX_HTML.read_text(encoding="utf-8") if INDEX_HTML.exists() else ""
css = STYLES.read_text(encoding="utf-8") if STYLES.exists() else ""
sv = SERVER_A.read_text(encoding="utf-8") if SERVER_A.exists() else ""
launcher = LAUNCHER.read_text(encoding="utf-8") if LAUNCHER.exists() else ""
hidden_launcher = HIDDEN_LAUNCHER.read_text(encoding="utf-8") if HIDDEN_LAUNCHER.exists() else ""
manifest = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}

require(manifest.get("id") == "com.srijon.captioner.local", "plugin id changed")
require(manifest.get("version") == "1.2.14", "source manifest is not v1.2.14")
require(manifest.get("main") == "index.html", "panel entrypoint is not index.html")
bound_ids = set(re.findall(r'\$\("([A-Za-z0-9_-]+)"\)', js))
html_ids = set(re.findall(r'id="([^"]+)"', html))
missing_ui_ids = sorted(bound_ids - html_ids)
require(not missing_ui_ids, "index.html is missing JS-bound IDs: " + ", ".join(missing_ui_ids))
require("#0172FE" in css, "required #0172FE UI accent missing")
require("<button" not in html.lower(), "native button tags can be restyled by Premiere UXP")
require(html.count("uiButton") >= 20, "custom UXP-safe action surfaces missing")
require("overflow-y: scroll" in css, "explicit UXP panel scroll container missing")
require("ensurePanelViewport" in js, "panel viewport lifecycle guard missing")
require("wireNumberInputWheelGuards" in js, "numeric wheel-mutation guard missing")
require("wireDisclosureControls" in js and html.count("data-disclosure") >= 3, "UXP-safe disclosure controls missing")
require("<details" not in html.lower() and "<summary" not in html.lower(), "unsupported native disclosure markup found")
require("testServerConnection" in js and "is-checking" in css, "interactive server-test feedback missing")
require(not re.search(r"\b(?:animation|transition)\s*:", css) and not re.search(r"position\s*:\s*sticky", css), "unsupported Premiere UXP motion/sticky CSS found")
require('id="activityBar"' in html and html.find('id="activityBar"') < html.find('class="sourceBlock"'), "activity strip is not at the top of the workflow")
require(html.find('timingBlock') < html.find('id="rebuildBtn"') < html.find('class="metricRow"'), "Rebuild action is not beside Timing and density")
require("assertCaptionOutput" in js, "caption output contract assertion missing")
require("items[i].end = items[i + 1].start" in js, "final zero-gap handoff pass missing")
require("forced-alignment-required" in sv, "forced-alignment timing mode marker missing")
require("extract_true_words" in sv, "extract_true_words missing")
require("approximate_words" not in sv, "approximate word timing fallback found")
require("buildWordLevelJsonObject" in js, "Word-Level JSON builder missing")
require('srijon-word-transcript-v1' in js, "Word JSON schema id missing")
require("saveWordJson" in js and "copyWordJson" in js, "Word JSON export actions missing")
require("captionSettingsFileTag" in js and "namedOutputStem" in js and "nextRevisionedOutput" in js, "settings-aware revision naming missing")
require("projectOutputFolder" in js and "autoSaveAndImportSrt" in js, "project-side automatic SRT delivery missing")
require('projectOutputFolder(project, "Captions")' in js and 'projectOutputFolder(project, "Word Data")' in js, "predictable project output folders missing")
require("nativeFs.writeFileSync" in js and "project.importFiles([output.path]" in js, "verified native save/import path missing")
require("Auto-save + Import" in html and "Auto-save JSON" in html, "automatic delivery labels missing")
require("activeCaptionJob" in js and "beginCaptionJob" in js and "guardNoActiveCaptionJob" in js, "panel caption-job mutex missing")
require("activeDeliveryAction" in js and "beginDeliveryAction" in js, "delivery-action mutex missing")
require("validatedWhisperSettings" in js and "health.busy" in js, "caption-job preflight/busy checks missing")
require("exclusive_caption_job" in sv and '"busy": GPU_LOCK.locked()' in sv and '"concurrency_mode": "reject-while-busy"' in sv, "server non-queuing concurrency guard missing")
require("Cannot rebuild yet: no transcript exists" in js, "empty rebuild error guard missing")
require('id="completionAlert"' in html and "notifyCaptionJobComplete" in js, "completion alert UI/logic missing")
require(NOTIFIER.exists() and "shell.Popup" in NOTIFIER.read_text(encoding="utf-8"), "Windows completion notifier missing")
require(".vbs" in manifest.get("requiredPermissions", {}).get("launchProcess", {}).get("extensions", []), "completion notifier launch permission missing")
require("STYLE_PRESET_STORAGE_KEY" in js, "caption preset support missing")
require("acquireWhisperServer" in js and "releaseWhisperServer" in js and "launchWhisperServerHidden" in js, "auto-server lifecycle missing")
require("%LOCALAPPDATA%\\SrijonCaptioner" in launcher, "portable launcher does not use LOCALAPPDATA runtime")
require("%LOCALAPPDATA%\\SrijonCaptioner" in hidden_launcher, "hidden launcher does not use LOCALAPPDATA runtime")
require("SRIJON_CAPTIONER_PYTHON" in launcher and "SRIJON_CAPTIONER_PYTHON" in hidden_launcher, "Python runtime override missing")
require("SRIJON_CAPTIONER_MODEL_DIR" in launcher and "SRIJON_CAPTIONER_MODEL_DIR" in hidden_launcher, "model directory override missing")
require(not re.search(r'(?im)^\s*(?:pythonExe|modelDir)\s*=\s*"[A-Za-z]:\\', hidden_launcher), "machine-specific absolute path found in hidden launcher")

if errors:
    print("VALIDATE_RESULT=FAIL")
    for e in errors:
        print(" -", e)
    sys.exit(1)
print("VALIDATE_RESULT=PASS")
