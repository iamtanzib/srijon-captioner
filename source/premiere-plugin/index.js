const ppro = require("premierepro");
const uxp = require("uxp");
const { entrypoints } = uxp;
const fs = uxp.storage.localFileSystem;
const nativeFs = require("fs");
const shell = uxp.shell;

const SERVERS = ["http://127.0.0.1:8765", "http://localhost:8765"];
let SERVER = SERVERS[0];
let rawTranscript = null;
let captions = [];
let initialized = false;
let currentSequenceFps = 30;
let sequenceFpsDetected = false;
let autoServerLaunchInProgress = false;
let serverCheckInProgress = false;
let activeCaptionJob = null;
let captionJobSerial = 0;
let activeDeliveryAction = null;
let deliveryActionSerial = 0;

const $ = (id) => document.getElementById(id);

function setControlDisabled(target, disabled) {
  const el = typeof target === "string" ? $(target) : target;
  if (!el) return;
  const off = !!disabled;
  if (el.matches && el.matches("button, input, select, textarea")) {
    el.disabled = off;
    return;
  }
  el.setAttribute("aria-disabled", off ? "true" : "false");
  el.setAttribute("tabindex", off ? "-1" : "0");
}

function wireCustomControls() {
  const controls = document.querySelectorAll(".uiButton");
  for (const control of controls) {
    control.addEventListener("click", event => {
      if (control.getAttribute("aria-disabled") === "true") {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      const active = document.activeElement;
      if (active && active !== control && typeof active.blur === "function") active.blur();
      if (typeof control.focus === "function") control.focus();
    });
    control.addEventListener("keydown", event => {
      const key = event.key;
      if (key !== "Enter" && key !== " " && key !== "Spacebar") return;
      event.preventDefault();
      if (control.getAttribute("aria-disabled") !== "true") control.click();
    });
  }
}

function wireNumberInputWheelGuards() {
  const viewport = $("appScroll");
  for (const input of document.querySelectorAll('input[type="number"]')) {
    input.addEventListener("wheel", event => {
      // UXP number fields can consume a panel-scroll wheel event and silently
      // step the focused value. Preserve the setting and forward that motion to
      // the real panel viewport instead.
      const value = input.value;
      event.preventDefault();
      event.stopPropagation();
      input.value = value;
      if (viewport && Number.isFinite(Number(event.deltaY))) {
        viewport.scrollTop += Number(event.deltaY);
      }
    });
  }
}

function wireDisclosureControls() {
  for (const disclosure of document.querySelectorAll("[data-disclosure]")) {
    const trigger = disclosure.querySelector(".disclosureTrigger");
    const content = disclosure.querySelector(".disclosureContent");
    const glyph = disclosure.querySelector(".disclosureGlyph");
    if (!trigger || !content) continue;
    const setOpen = open => {
      disclosure.classList.toggle("is-open", open);
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
      content.setAttribute("aria-hidden", open ? "false" : "true");
      if (glyph) glyph.textContent = open ? "−" : "+";
    };
    setOpen(disclosure.classList.contains("is-open"));
    trigger.addEventListener("click", () => {
      const open = trigger.getAttribute("aria-expanded") !== "true";
      setOpen(open);
      const name = String(trigger.textContent || "Settings").replace(/\s+/g, " ").trim();
      setStatus(`${open ? "Opened" : "Closed"} ${name.toLocaleLowerCase()}.`, "ready");
    });
  }
}

function ensurePanelViewport(rootNode) {
  document.documentElement.style.height = "100%";
  document.documentElement.style.overflow = "hidden";
  document.body.style.height = "100%";
  document.body.style.overflow = "hidden";
  const viewport = $("appScroll");
  if (viewport) {
    viewport.style.height = "100%";
    viewport.style.maxHeight = "100%";
    viewport.style.overflowX = "hidden";
    viewport.style.overflowY = "scroll";
  }
  if (rootNode && rootNode.style && rootNode !== viewport) {
    rootNode.style.height = "100%";
    rootNode.style.overflow = "hidden";
  }
}

const settingIds = [
  "model", "language", "device", "computeType", "batchSize", "alignWords",
  "maxChars", "minDuration", "gapFrames", "maxLines", "pauseMs", "maxDuration",
  "punctuationBreak", "punctuationMode", "capitalizationMode", "customCaps", "outputMode",
  "completionAlert"
];

function activeJobLabel() {
  return activeCaptionJob ? activeCaptionJob.label : "another caption job";
}

function guardNoActiveCaptionJob(action) {
  if (!activeCaptionJob) return true;
  const elapsed = Math.max(1, Math.round((Date.now() - activeCaptionJob.startedAt) / 1000));
  setStatus(`Cannot ${action} while ${activeJobLabel()} is running (${elapsed}s elapsed). Wait for it to finish.`, "error");
  return false;
}

function guardNoActiveDeliveryAction(action) {
  if (!activeDeliveryAction) return true;
  setStatus(`Cannot ${action} while ${activeDeliveryAction.label} is still open. Finish or cancel that action first.`, "error");
  return false;
}

function setCaptionJobUiBusy(busy) {
  for (const id of ["transcribeSequenceBtn", "transcribeFileBtn"]) {
    const control = $(id);
    if (!control) continue;
    control.classList.toggle("is-job-running", busy);
    control.setAttribute("aria-busy", busy ? "true" : "false");
  }
  // Freeze native fields so one job always uses one coherent configuration.
  // Custom action surfaces stay clickable and report why they are unavailable.
  for (const id of settingIds) {
    const el = $(id);
    if (el && el.matches && el.matches("input, select, textarea")) el.disabled = !!busy;
  }
}

function beginCaptionJob(label) {
  if (!guardNoActiveDeliveryAction(`start ${label}`)) return null;
  if (!guardNoActiveCaptionJob(`start ${label}`)) return null;
  activeCaptionJob = {
    id: ++captionJobSerial,
    label,
    startedAt: Date.now()
  };
  setCaptionJobUiBusy(true);
  return activeCaptionJob;
}

function beginDeliveryAction(label) {
  if (!guardNoActiveCaptionJob(label)) return null;
  if (!guardNoActiveDeliveryAction(label)) return null;
  activeDeliveryAction = { id: ++deliveryActionSerial, label };
  return activeDeliveryAction;
}

function finishDeliveryAction(action) {
  if (action && activeDeliveryAction && action.id === activeDeliveryAction.id) {
    activeDeliveryAction = null;
  }
}

function finishCaptionJob(job) {
  if (!job || !activeCaptionJob || job.id !== activeCaptionJob.id) return;
  activeCaptionJob = null;
  setCaptionJobUiBusy(false);
}

function inferActivityState(message) {
  const text = String(message || "").toLocaleLowerCase();
  if (/error|failed|could not|unable|not available|not found|violates|outdated/.test(text)) return "error";
  if (/starting|preparing|checking|testing|exporting|waiting|transcribing|releasing|choose a media/.test(text)) return "busy";
  if (/done|saved|copied|rebuilt|loaded|deleted|connection ok|ready|cleared/.test(text)) return "success";
  return "ready";
}

function setStatus(message, state) {
  const text = String(message || "Ready.");
  const resolvedState = state || inferActivityState(text);
  const status = $("status");
  const bar = $("activityBar");
  const label = $("activityLabel");
  if (status) status.textContent = text;
  if (bar) bar.setAttribute("data-state", resolvedState);
  if (label) {
    label.textContent = resolvedState === "busy" ? "Working"
      : resolvedState === "success" ? "Complete"
      : resolvedState === "error" ? "Needs attention"
      : "Activity";
  }
}

function setBusy(busy, message) {
  setCaptionJobUiBusy(busy);
  if (message) setStatus(message, busy ? "busy" : undefined);
}

function loadSettings() {
  for (const id of settingIds) {
    const el = $(id);
    if (!el) continue;
    const stored = localStorage.getItem(`captioner.${id}`);
    if (stored === null) continue;
    if (el.type === "checkbox") el.checked = stored === "true";
    else el.value = stored;
  }
}

function saveSetting(el) {
  localStorage.setItem(`captioner.${el.id}`, el.type === "checkbox" ? String(el.checked) : String(el.value));
}


const STYLE_PRESET_STORAGE_KEY = "captioner.stylePresets.v1";
const STYLE_PRESET_SETTING_IDS = [
  "maxChars", "minDuration", "gapFrames", "maxLines", "pauseMs", "maxDuration",
  "punctuationBreak", "punctuationMode", "capitalizationMode", "customCaps"
];

function readStylePresets() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STYLE_PRESET_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(p => p && typeof p.name === "string" && p.settings) : [];
  } catch (_) {
    return [];
  }
}

function writeStylePresets(presets) {
  localStorage.setItem(STYLE_PRESET_STORAGE_KEY, JSON.stringify(presets));
}

function collectStylePresetSettings() {
  const settings = {};
  for (const id of STYLE_PRESET_SETTING_IDS) {
    const el = $(id);
    if (!el) continue;
    settings[id] = el.type === "checkbox" ? !!el.checked : String(el.value);
  }
  return settings;
}

function renderStylePresetOptions(selectedName = "") {
  const select = $("stylePresetSelect");
  if (!select) return;
  const presets = readStylePresets().slice().sort((a, b) => a.name.localeCompare(b.name));
  select.innerHTML = "";
  const custom = document.createElement("option");
  custom.value = "";
  custom.textContent = "Custom / unsaved";
  select.appendChild(custom);
  for (const preset of presets) {
    const option = document.createElement("option");
    option.value = preset.name;
    option.textContent = preset.name;
    select.appendChild(option);
  }
  select.value = presets.some(p => p.name === selectedName) ? selectedName : "";
}

function applyStylePresetByName(name) {
  if (!guardNoActiveCaptionJob("load a caption preset")) return;
  const preset = readStylePresets().find(p => p.name === name);
  if (!preset) {
    setStatus("Preset not found.");
    return;
  }
  for (const id of STYLE_PRESET_SETTING_IDS) {
    const el = $(id);
    if (!el || !(id in preset.settings)) continue;
    const value = preset.settings[id];
    if (el.type === "checkbox") el.checked = !!value;
    else el.value = String(value);
    saveSetting(el);
  }
  syncLineMode();
  syncTextStyleControls();
  updateGapHint();
  if ($("stylePresetName")) $("stylePresetName").value = preset.name;
  if ($("stylePresetHint")) $("stylePresetHint").textContent = `Loaded “${preset.name}” · saved locally.`;
  if (rawTranscript) rebuildCaptions();
  else setStatus(`Loaded caption preset “${preset.name}”.`);
}

function saveCurrentStylePreset() {
  if (!guardNoActiveCaptionJob("save a caption preset")) return;
  const nameInput = $("stylePresetName");
  const select = $("stylePresetSelect");
  const name = String((nameInput && nameInput.value) || (select && select.value) || "").trim();
  if (!name) {
    setStatus("Type a preset name first, then press Save.");
    if (nameInput) nameInput.focus();
    return;
  }
  let presets = readStylePresets();
  const lower = name.toLocaleLowerCase();
  const item = { name, settings: collectStylePresetSettings(), updatedAt: Date.now() };
  const index = presets.findIndex(p => p.name.toLocaleLowerCase() === lower);
  if (index >= 0) presets[index] = item;
  else presets.push(item);
  writeStylePresets(presets);
  renderStylePresetOptions(name);
  if (nameInput) nameInput.value = name;
  if ($("stylePresetHint")) $("stylePresetHint").textContent = `Saved “${name}” locally on this computer.`;
  setStatus(`Saved caption preset “${name}”.`);
}

function deleteSelectedStylePreset() {
  if (!guardNoActiveCaptionJob("delete a caption preset")) return;
  const select = $("stylePresetSelect");
  const nameInput = $("stylePresetName");
  const name = String((select && select.value) || (nameInput && nameInput.value) || "").trim();
  if (!name) {
    setStatus("Choose a saved preset to delete.");
    return;
  }
  const before = readStylePresets();
  const after = before.filter(p => p.name !== name);
  if (after.length === before.length) {
    setStatus(`Preset “${name}” was not found.`);
    return;
  }
  writeStylePresets(after);
  renderStylePresetOptions("");
  if (nameInput) nameInput.value = "";
  if ($("stylePresetHint")) $("stylePresetHint").textContent = "Preset deleted. Current caption settings were not changed.";
  setStatus(`Deleted caption preset “${name}”.`);
}

function wireStylePresets() {
  renderStylePresetOptions("");
  const select = $("stylePresetSelect");
  const load = $("loadStylePresetBtn");
  const save = $("saveStylePresetBtn");
  const del = $("deleteStylePresetBtn");
  if (select) {
    select.addEventListener("change", () => {
      const name = select.value;
      if ($("stylePresetName")) $("stylePresetName").value = name;
      if (name && $("stylePresetHint")) $("stylePresetHint").textContent = `Selected “${name}” · press Load to apply.`;
    });
  }
  if (load) load.addEventListener("click", () => {
    const name = select ? select.value : "";
    if (!name) return setStatus("Choose a saved caption preset first.");
    applyStylePresetByName(name);
  });
  if (save) save.addEventListener("click", saveCurrentStylePreset);
  if (del) del.addEventListener("click", deleteSelectedStylePreset);
}

function syncLineMode() {
  const lines = Number($("maxLines").value) === 1 ? 1 : 2;
  $("maxLines").value = String(lines);
  const singleBtn = $("lineSingleBtn");
  const doubleBtn = $("lineDoubleBtn");
  if (singleBtn) singleBtn.classList.toggle("active", lines === 1);
  if (doubleBtn) doubleBtn.classList.toggle("active", lines === 2);
  if (singleBtn) singleBtn.setAttribute("aria-pressed", lines === 1 ? "true" : "false");
  if (doubleBtn) doubleBtn.setAttribute("aria-pressed", lines === 2 ? "true" : "false");
}

function setLineMode(lines) {
  if (!guardNoActiveCaptionJob("change caption line mode")) return;
  const input = $("maxLines");
  input.value = String(lines === 1 ? 1 : 2);
  saveSetting(input);
  syncLineMode();
  if (rawTranscript) rebuildCaptions();
  else setStatus(`${input.value === "1" ? "Single" : "Double"}-line captions selected. This will apply after transcription.`, "ready");
}

function wireLineMode() {
  const singleBtn = $("lineSingleBtn");
  const doubleBtn = $("lineDoubleBtn");
  if (singleBtn) singleBtn.addEventListener("click", () => setLineMode(1));
  if (doubleBtn) doubleBtn.addEventListener("click", () => setLineMode(2));
}

function syncTextStyleControls() {
  const punctuationMode = $("punctuationMode") ? $("punctuationMode").value : "remove";
  const capitalizationMode = $("capitalizationMode") ? $("capitalizationMode").value : "smart";

  const pRemove = $("punctuationRemoveBtn");
  const pKeep = $("punctuationKeepBtn");
  if (pRemove) pRemove.classList.toggle("active", punctuationMode !== "keep");
  if (pKeep) pKeep.classList.toggle("active", punctuationMode === "keep");
  if (pRemove) pRemove.setAttribute("aria-pressed", punctuationMode !== "keep" ? "true" : "false");
  if (pKeep) pKeep.setAttribute("aria-pressed", punctuationMode === "keep" ? "true" : "false");

  const capButtons = {
    smart: $("capSmartBtn"),
    original: $("capOriginalBtn"),
    lower: $("capLowerBtn"),
    upper: $("capUpperBtn")
  };
  for (const [mode, button] of Object.entries(capButtons)) {
    if (button) button.classList.toggle("active", capitalizationMode === mode);
    if (button) button.setAttribute("aria-pressed", capitalizationMode === mode ? "true" : "false");
  }
}

function setPunctuationMode(mode) {
  if (!guardNoActiveCaptionJob("change punctuation mode")) return;
  const input = $("punctuationMode");
  if (!input) return;
  input.value = mode === "keep" ? "keep" : "remove";
  saveSetting(input);
  syncTextStyleControls();
  if (rawTranscript) rebuildCaptions();
  else setStatus(`${input.value === "keep" ? "Keep" : "Remove"} punctuation selected. Source punctuation will still guide caption breaks.`, "ready");
}

function setCapitalizationMode(mode) {
  if (!guardNoActiveCaptionJob("change capitalization mode")) return;
  const allowed = new Set(["smart", "original", "lower", "upper"]);
  const input = $("capitalizationMode");
  if (!input) return;
  input.value = allowed.has(mode) ? mode : "smart";
  saveSetting(input);
  syncTextStyleControls();
  if (rawTranscript) rebuildCaptions();
  else setStatus(`${input.value === "original" ? "Source" : input.value} capitalization selected. This will apply after transcription.`, "ready");
}

function wireTextStyleControls() {
  const bindings = [
    ["punctuationRemoveBtn", () => setPunctuationMode("remove")],
    ["punctuationKeepBtn", () => setPunctuationMode("keep")],
    ["capSmartBtn", () => setCapitalizationMode("smart")],
    ["capOriginalBtn", () => setCapitalizationMode("original")],
    ["capLowerBtn", () => setCapitalizationMode("lower")],
    ["capUpperBtn", () => setCapitalizationMode("upper")]
  ];
  for (const [id, handler] of bindings) {
    const button = $(id);
    if (button) button.addEventListener("click", handler);
  }
}

function updateGapHint() {
  const frames = Math.max(0, Math.round(Number($("gapFrames").value) || 0));
  const fps = Math.max(1, currentSequenceFps || 30);
  const ms = Math.round((frames / fps) * 1000);
  const source = sequenceFpsDetected ? `${formatFps(fps)} fps` : `${formatFps(fps)} fps fallback`;
  if (frames === 0) {
    $("gapTimeHint").textContent = `0 frames • continuous transitions • ${source}`;
  } else {
    $("gapTimeHint").textContent = `${frames} frame${frames === 1 ? "" : "s"} ≈ ${ms} ms • ${source}`;
  }
}

function wireSettings() {
  for (const id of settingIds) {
    const el = $(id);
    if (!el) continue;
    el.addEventListener("change", () => {
      saveSetting(el);
      if (id === "maxLines") syncLineMode();
      if (id === "gapFrames") updateGapHint();
      if (rawTranscript && [
        "maxChars", "minDuration", "gapFrames", "maxLines", "pauseMs", "maxDuration",
        "punctuationBreak", "punctuationMode", "capitalizationMode", "customCaps"
      ].includes(id)) {
        rebuildCaptions();
      }
    });
  }
}

async function probeServer() {
  const errors = [];
  for (const base of SERVERS) {
    try {
      const res = await fetch(`${base}/health?ts=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
        headers: { "Accept": "application/json" }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      SERVER = base;
      return { data, base, errors };
    } catch (e) {
      errors.push(`${base}: ${e && e.message ? e.message : String(e)}`);
    }
  }
  return { data: null, base: null, errors };
}

function applyServerStatus(result, verified = false) {
  const data = result && result.data;
  const action = $("testServerBtn");
  if (action) {
    if (verified || !serverCheckInProgress) action.classList.remove("is-checking");
    if (verified) action.classList.toggle("is-verified", !!(data && data.whisperx));
    if (verified || !serverCheckInProgress) action.setAttribute("aria-busy", "false");
  }
  if (data) {
    $("serverBadge").className = `statusDot ${data.whisperx ? "good" : "bad"}`;
    $("serverTitle").textContent = data.busy
      ? "WhisperX is busy"
      : data.whisperx
      ? (verified ? "Connection verified" : "WhisperX ready")
      : "WhisperX unavailable";
    const timingLabel = data.timing_mode === "forced-alignment-required" ? " • TRUE WORD TIMING" : "";
    const versionLabel = data.server_version ? ` • server ${data.server_version}` : "";
    const busyLabel = data.busy ? " • JOB RUNNING" : "";
    $("serverDetail").textContent = `${String(result.base || SERVER).replace("http://", "")} • CUDA ${data.cuda ? "ON" : "OFF"}${busyLabel}${timingLabel}${versionLabel}`;
    return data;
  }
  $("serverBadge").className = "statusDot";
  $("serverTitle").textContent = "WhisperX sleeps until needed";
  $("serverDetail").textContent = "Auto server • starts for transcription • closes when finished";
  return null;
}

async function getPluginAssetPath(filename) {
  const folder = await fs.getPluginFolder();
  const root = folder && (folder.nativePath || fs.getNativePath(folder));
  if (!root) throw new Error("Could not resolve the installed plugin folder.");
  return joinPath(root, filename);
}

async function launchWhisperServerHidden() {
  if (autoServerLaunchInProgress) return;
  autoServerLaunchInProgress = true;
  try {
    const launcherPath = await getPluginAssetPath("start_server_hidden.vbs");
    setStatus("Starting WhisperX automatically…\nThe first launch may ask for Adobe permission. You can allow/remember it.");
    const result = await shell.openPath(
      launcherPath,
      "Srijon Captioner needs to start its local WhisperX transcription server. It runs only on this computer and will close after transcription finishes."
    );
    if (result) throw new Error(result);
  } finally {
    autoServerLaunchInProgress = false;
  }
}

async function waitForWhisperServer(timeoutMs = 90000) {
  const started = Date.now();
  let lastErrors = [];
  while (Date.now() - started < timeoutMs) {
    const result = await probeServer();
    if (result.data) {
      applyServerStatus(result);
      return result.data;
    }
    lastErrors = result.errors || [];
    await new Promise(resolve => setTimeout(resolve, 700));
  }
  throw new Error(`WhisperX server did not become ready within ${Math.round(timeoutMs / 1000)} seconds. ${lastErrors.join(" | ")}`);
}

async function acquireWhisperServer() {
  const existing = await probeServer();
  if (existing.data) {
    applyServerStatus(existing);
    return { health: existing.data, startedByPlugin: false };
  }

  await launchWhisperServerHidden();
  const health = await waitForWhisperServer();
  return { health, startedByPlugin: true };
}

async function releaseWhisperServer(lease) {
  if (!lease || !lease.startedByPlugin) return;
  try {
    setStatus("Releasing GPU memory and closing the extension-owned WhisperX server…", "busy");
    await fetch(`${SERVER}/shutdown`, {
      method: "POST",
      headers: { "Accept": "application/json" }
    });
  } catch (_) {
    // The process may exit before the response fully settles; that is harmless.
  }
  await new Promise(resolve => setTimeout(resolve, 450));
  applyServerStatus({ data: null, errors: [] });
}

async function checkServer(interactive = false) {
  const action = $("testServerBtn");
  const started = Date.now();
  if (interactive && action) {
    action.classList.remove("is-verified");
    action.classList.add("is-checking");
    action.setAttribute("aria-busy", "true");
  }
  $("serverBadge").className = "statusDot";
  $("serverTitle").textContent = "Checking WhisperX…";
  $("serverDetail").textContent = "Testing 127.0.0.1:8765…";
  try {
    const result = await probeServer();
    const elapsed = Date.now() - started;
    if (interactive && elapsed < 420) await new Promise(resolve => setTimeout(resolve, 420 - elapsed));
    return applyServerStatus(result, interactive);
  } finally {
    if (interactive && action) {
      action.classList.remove("is-checking");
      action.setAttribute("aria-busy", "false");
    }
  }
}

async function testServerConnection() {
  if (!guardNoActiveCaptionJob("run a separate server test")) return;
  if (serverCheckInProgress) {
    setStatus("A WhisperX server test is already running. Wait for its result.", "busy");
    return;
  }
  serverCheckInProgress = true;
  setStatus("Testing the local WhisperX connection…", "busy");
  try {
    const health = await checkServer(true);
    if (!health) {
      setStatus("Server is offline. This is normal between jobs—it will start automatically when you transcribe.", "ready");
      return;
    }
    if (!health.whisperx) {
      setStatus("Server responded, but WhisperX is unavailable. Check the configured Python environment.", "error");
      return;
    }
    if (health.busy) {
      setStatus("Server connection OK, but another caption job is already running. Wait for it to finish before starting a new one.", "busy");
      return;
    }
    if (health.timing_mode !== "forced-alignment-required") {
      setStatus("Server responded, but it is outdated and cannot guarantee forced word alignment.", "error");
      return;
    }
    if (health.concurrency_mode !== "reject-while-busy") {
      setStatus("Server responded, but it is outdated and cannot safely reject overlapping caption jobs. Restart Premiere after installing this build.", "error");
      return;
    }
    setStatus(`Server connection OK. WhisperX ready • CUDA ${health.cuda ? "on" : "off"} • forced alignment ready.`, "success");
  } catch (e) {
    setStatus(`Server test failed: ${e.message || e}`, "error");
  } finally {
    serverCheckInProgress = false;
  }
}

function formatFps(value) {
  const n = Number(value) || 0;
  if (Math.abs(n - Math.round(n)) < 0.01) return String(Math.round(n));
  return n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

async function refreshSequence(announce = false) {
  try {
    const project = await ppro.Project.getActiveProject();
    if (!project) {
      $("sequenceName").textContent = "No active project";
      $("sequenceFps").textContent = "Frame rate: 30 fps fallback";
      currentSequenceFps = 30;
      sequenceFpsDetected = false;
      updateGapHint();
      if (announce) setStatus("No active Premiere project. Open a project, then refresh again.", "error");
      return null;
    }
    const sequence = await project.getActiveSequence();
    $("sequenceName").textContent = sequence ? sequence.name : "No active sequence";

    currentSequenceFps = 30;
    sequenceFpsDetected = false;
    if (sequence) {
      try {
        const settings = await sequence.getSettings();
        if (settings && typeof settings.getVideoFrameRate === "function") {
          const rate = settings.getVideoFrameRate();
          const fps = Number(rate && rate.value);
          if (Number.isFinite(fps) && fps > 0) {
            currentSequenceFps = fps;
            sequenceFpsDetected = true;
          }
        }
      } catch (_) {}
    }
    $("sequenceFps").textContent = sequenceFpsDetected
      ? `Frame rate: ${formatFps(currentSequenceFps)} fps`
      : "Frame rate: 30 fps fallback";
    updateGapHint();
    if (announce) {
      setStatus(sequence
        ? `Current sequence refreshed: ${sequence.name} • ${formatFps(currentSequenceFps)} fps.`
        : "No active sequence. Open a sequence, then refresh again.", sequence ? "success" : "error");
    }
    return sequence;
  } catch (e) {
    $("sequenceName").textContent = "Unable to read sequence";
    $("sequenceFps").textContent = "Frame rate: 30 fps fallback";
    currentSequenceFps = 30;
    sequenceFpsDetected = false;
    updateGapHint();
    if (announce) setStatus(`Could not refresh the active sequence: ${e.message || e}`, "error");
    return null;
  }
}

async function choosePreset(options = {}) {
  const fromActiveJob = !!(options && options.fromActiveJob === true);
  if (!fromActiveJob && !guardNoActiveCaptionJob("change the audio export preset")) return null;
  try {
    const file = await fs.getFileForOpening({ types: ["epr"] });
    if (!file) {
      setStatus("Audio preset selection cancelled. The current preset was not changed.", "ready");
      return null;
    }
    const token = await fs.createPersistentToken(file);
    localStorage.setItem("captioner.presetToken", token);
    localStorage.setItem("captioner.presetName", file.name || file.nativePath);
    localStorage.setItem("captioner.presetPath", file.nativePath || "");
    $("presetName").textContent = `Audio preset: ${file.name || file.nativePath}`;
    setStatus("Audio preset saved. From now on, Active Sequence transcription is one click.");
    return file;
  } catch (e) {
    setStatus(`Could not save preset: ${e.message || e}`);
    return null;
  }
}

async function getPresetFile() {
  // With v1.1.4 fullAccess, a remembered native path is the fastest route.
  const rememberedPath = localStorage.getItem("captioner.presetPath");
  if (rememberedPath) {
    try {
      nativeFs.lstatSync(rememberedPath);
      {
        return { nativePath: rememberedPath, name: basenamePath(rememberedPath) };
      }
    } catch (_) {}
  }

  const token = localStorage.getItem("captioner.presetToken");
  if (!token) return null;
  try {
    const entry = await fs.getEntryForPersistentToken(token);
    if (entry && entry.nativePath) {
      localStorage.setItem("captioner.presetPath", entry.nativePath);
      return entry;
    }
    return null;
  } catch (e) {
    localStorage.removeItem("captioner.presetToken");
    localStorage.removeItem("captioner.presetName");
    localStorage.removeItem("captioner.presetPath");
    return null;
  }
}

function joinPath(folder, name) {
  const sep = folder.includes("\\") ? "\\" : "/";
  return `${folder}${folder.endsWith(sep) ? "" : sep}${name}`;
}

function dirnamePath(filePath) {
  const p = String(filePath || "");
  const i = Math.max(p.lastIndexOf("\\"), p.lastIndexOf("/"));
  return i >= 0 ? p.slice(0, i) : "";
}

function basenamePath(filePath) {
  const p = String(filePath || "");
  const i = Math.max(p.lastIndexOf("\\"), p.lastIndexOf("/"));
  return i >= 0 ? p.slice(i + 1) : p;
}

function safeName(name) {
  return (name || "sequence").replace(/[\\/:*?\"<>|]/g, "_").replace(/\s+/g, " ").trim();
}

function compactFileToken(value) {
  return safeName(String(value == null ? "" : value))
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function numberFileToken(value, fallback = 0) {
  const number = Number.isFinite(Number(value)) ? Number(value) : fallback;
  return String(Number(number.toFixed(3))).replace(".", "p");
}

function shortSettingsHash(value) {
  const text = String(value || "");
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = (((hash << 5) + hash) ^ text.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).toUpperCase().padStart(8, "0").slice(-8);
}

function captionSettingsFileTag(rules = captionRules()) {
  const normalized = {
    maxChars: rules.maxChars,
    maxLines: rules.maxLines,
    minDuration: rules.minDuration,
    maxDuration: rules.maxDuration,
    gapFrames: rules.gapFrames,
    fps: Number(Number(rules.fps).toFixed(3)),
    smartBreaks: !!rules.smartBreaks,
    pauseMs: Math.round(Number(rules.pause) * 1000),
    punctuationMode: rules.punctuationMode,
    capitalizationMode: rules.capitalizationMode,
    customCaps: String(rules.customCaps || "").trim()
  };
  const readable = [
    `${normalized.maxChars}c-${normalized.maxLines}l`,
    `min${numberFileToken(normalized.minDuration)}s-max${numberFileToken(normalized.maxDuration)}s`,
    `gap${normalized.gapFrames}f-${numberFileToken(normalized.fps, 30)}fps`,
    normalized.smartBreaks ? `smartbreak-${normalized.pauseMs}ms` : "lengthbreak",
    normalized.punctuationMode === "keep" ? "punct" : "nopunct",
    `${compactFileToken(normalized.capitalizationMode || "smart")}case`
  ].join("-");
  return `${readable}-cfg${shortSettingsHash(JSON.stringify(normalized))}`;
}

function namedOutputStem(sourceName, kind, descriptor) {
  const source = compactFileToken(sourceName) || "sequence";
  const suffix = `__${compactFileToken(kind) || "output"}__${compactFileToken(descriptor) || "data"}`;
  // Keep the complete settings/hash suffix while shortening only the sequence
  // name. This avoids legacy Windows/Premiere path-length failures in deeply
  // nested projects without making revision families ambiguous.
  const maxStemLength = 128;
  const sourceRoom = Math.max(12, maxStemLength - suffix.length);
  return `${source.slice(0, sourceRoom)}${suffix}`;
}

function nextRevisionedOutput(folder, stem, extension) {
  const safeStem = compactFileToken(stem).slice(0, 190) || "caption-output";
  const safeExtension = String(extension || "txt").replace(/^\./, "").toLowerCase();
  const escapedStem = safeStem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escapedStem}__r(\\d+)\\.${safeExtension}$`, "i");
  let highest = 0;
  try {
    for (const name of nativeFs.readdirSync(folder)) {
      const match = String(name).match(pattern);
      if (match) highest = Math.max(highest, Number(match[1]) || 0);
    }
  } catch (_) {}
  const revision = highest + 1;
  const filename = `${safeStem}__r${String(revision).padStart(3, "0")}.${safeExtension}`;
  return { path: joinPath(folder, filename), filename, revision };
}

function writeUtf8FileVerified(filePath, content) {
  nativeFs.writeFileSync(filePath, String(content), { encoding: "utf-8" });
  const stat = nativeFs.lstatSync(filePath);
  if (!stat || Number(stat.size) <= 0) throw new Error("The output file was created but contains no data.");
  return filePath;
}

function listEprFiles(folder, depth = 0) {
  if (!folder || depth > 3) return [];
  let names = [];
  try { names = nativeFs.readdirSync(folder); } catch (_) { return []; }
  const out = [];
  for (const name of names) {
    const full = joinPath(folder, name);
    try {
      const stat = nativeFs.lstatSync(full);
      if (stat && typeof stat.isDirectory === "function" && stat.isDirectory()) {
        out.push(...listEprFiles(full, depth + 1));
      } else if (/\.epr$/i.test(name)) {
        out.push(full);
      }
    } catch (_) {}
  }
  return out;
}

function looksLikeAudioOnlyEpr(filePath) {
  try {
    const xml = nativeFs.readFileSync(filePath, { encoding: "utf-8" });
    return /<DoAudio>true<\/DoAudio>/i.test(xml) && /<DoVideo>false<\/DoVideo>/i.test(xml);
  } catch (_) {
    return false;
  }
}

function premiereInstallRoots() {
  const roots = [];
  try {
    const appPath = uxp.host && uxp.host.applicationPath;
    if (appPath) roots.push(dirnamePath(appPath));
  } catch (_) {}

  // Fallback for Premiere 26.2 builds where host.applicationPath may not exist.
  const adobeRoot = "C:\\Program Files\\Adobe";
  try {
    const names = nativeFs.readdirSync(adobeRoot);
    for (const name of names) {
      if (!/premiere/i.test(name)) continue;
      const full = joinPath(adobeRoot, name);
      try {
        const stat = nativeFs.lstatSync(full);
        if (stat && typeof stat.isDirectory === "function" && stat.isDirectory()) roots.push(full);
      } catch (_) {}
    }
  } catch (_) {}

  return Array.from(new Set(roots));
}

function autoFindWavePreset() {
  const remembered = localStorage.getItem("captioner.autoPresetPath");
  if (remembered) {
    try {
      nativeFs.lstatSync(remembered);
      if (looksLikeAudioOnlyEpr(remembered)) return remembered;
    } catch (_) {}
  }

  const presetFolder = "3F3F3F3F_57415645"; // Adobe's stock Waveform Audio exporter folder.
  const candidates = [];
  for (const root of premiereInstallRoots()) {
    const dir = joinPath(joinPath(joinPath(root, "MediaIO"), "systempresets"), presetFolder);
    for (const file of listEprFiles(dir)) {
      if (looksLikeAudioOnlyEpr(file)) candidates.push(file);
    }
  }
  if (!candidates.length) return null;

  // Prefer a 48 kHz-looking preset when the name/XML exposes it; WhisperX can
  // still read other standard PCM WAV presets, so any audio-only Waveform preset
  // is a valid fallback.
  candidates.sort((a, b) => {
    const score = p => /48|48000|waveform|wav/i.test(basenamePath(p)) ? 1 : 0;
    return score(b) - score(a);
  });
  const found = candidates[0];
  localStorage.setItem("captioner.autoPresetPath", found);
  localStorage.setItem("captioner.presetPath", found);
  localStorage.setItem("captioner.presetName", `Auto: ${basenamePath(found)}`);
  return found;
}

async function resolveAudioPreset() {
  let preset = await getPresetFile();
  if (preset && preset.nativePath) return preset;

  setStatus("Finding Premiere's built-in Waveform Audio preset…");
  const autoPath = autoFindWavePreset();
  if (autoPath) {
    $("presetName").textContent = `Audio preset: Auto • ${basenamePath(autoPath)}`;
    return { nativePath: autoPath, name: basenamePath(autoPath) };
  }

  setStatus("One-time setup: choose any Premiere Waveform Audio (.epr) preset. The extension will remember it permanently.");
  preset = await choosePreset({ fromActiveJob: true });
  if (!preset || !preset.nativePath) {
    throw new Error("No Waveform Audio preset selected. Active Sequence transcription needs an audio-only .epr preset once; after that it is one click.");
  }
  return preset;
}

async function projectAudioFolder(project) {
  const projectPath = String(project && project.path || "");
  const projectDir = dirnamePath(projectPath);
  if (!projectDir) return null;
  const outputDir = joinPath(projectDir, "Srijon Captioner Audio");
  try {
    try {
      nativeFs.lstatSync(outputDir);
    } catch (_) {
      await nativeFs.mkdir(outputDir, { recursive: true });
    }
    return outputDir;
  } catch (_) {
    return null;
  }
}

async function projectOutputFolder(project, subfolder) {
  const projectPath = String(project && project.path || "");
  if (!dirnamePath(projectPath)) return null;
  const audioFolder = await projectAudioFolder(project);
  if (!audioFolder) return null;
  const outputFolder = joinPath(audioFolder, subfolder);
  try {
    try {
      const stat = nativeFs.lstatSync(outputFolder);
      if (stat && typeof stat.isDirectory === "function" && !stat.isDirectory()) {
        throw new Error(`${outputFolder} exists but is not a folder.`);
      }
    } catch (_) {
      if (typeof nativeFs.mkdirSync === "function") nativeFs.mkdirSync(outputFolder, { recursive: true });
      else await nativeFs.mkdir(outputFolder, { recursive: true });
    }
    return outputFolder;
  } catch (_) {
    return null;
  }
}

async function waitForStableFile(filePath, timeoutMs = 120000) {
  const started = Date.now();
  let lastSize = -1;
  let stableChecks = 0;
  while ((Date.now() - started) < timeoutMs) {
    try {
      const stat = nativeFs.lstatSync(filePath);
      const size = Number(stat.size) || 0;
      if (size > 0 && size === lastSize) stableChecks++;
      else stableChecks = 0;
      lastSize = size;
      if (stableChecks >= 2) return true;
    } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error("Premiere reported an export, but the audio file did not become ready in time.");
}

async function exportActiveSequence() {
  const preset = await resolveAudioPreset();

  const project = await ppro.Project.getActiveProject();
  if (!project) throw new Error("No active Premiere project.");
  const sequence = await project.getActiveSequence();
  if (!sequence) throw new Error("No active sequence.");

  let extension = "wav";
  try {
    extension = await ppro.EncoderManager.getExportFileExtension(sequence, preset.nativePath) || "wav";
  } catch (_) {}
  extension = String(extension).replace(/^\./, "") || "wav";

  let outputFolder = await projectAudioFolder(project);
  let locationLabel = "beside your project";
  if (!outputFolder) {
    const temp = await fs.getTemporaryFolder();
    if (!temp || !temp.nativePath) throw new Error("Could not access a folder for the temporary audio export.");
    outputFolder = temp.nativePath;
    locationLabel = "Premiere plugin temp folder";
  }

  const outputPath = joinPath(
    outputFolder,
    `${safeName(sequence.name)}_caption_audio_${Date.now()}.${extension}`
  );
  const encoder = ppro.EncoderManager.getManager();

  setStatus(`Step 1/3 • Exporting sequence audio ${locationLabel}…\n${outputPath}`);
  const ok = await encoder.exportSequence(
    sequence,
    ppro.Constants.ExportType.IMMEDIATELY,
    outputPath,
    preset.nativePath,
    true
  );
  if (!ok) throw new Error("Premiere reported that the sequence audio export failed.");

  setStatus(`Step 2/3 • Waiting for exported audio to finish writing…\n${outputPath}`);
  await waitForStableFile(outputPath);
  return { path: outputPath, label: sequence.name, outputPath };
}

async function chooseMediaFile() {
  const file = await fs.getFileForOpening({
    types: ["wav", "mp3", "m4a", "aac", "flac", "mp4", "mov", "mkv", "avi", "mxf", "webm"]
  });
  if (!file) return null;
  let nativePath = file.nativePath;
  try {
    nativePath = nativePath || fs.getNativePath(file);
  } catch (_) {}
  if (!nativePath) throw new Error("Premiere let you select the file, but UXP did not return a native Windows path.");
  setStatus(`Selected media:\n${nativePath}\nChecking WhisperX server…`);
  return { path: nativePath, label: file.name || "media" };
}

function whisperSettings() {
  return {
    model: $("model").value.trim() || "large-v3",
    language: $("language").value || null,
    device: $("device").value,
    compute_type: $("computeType").value,
    batch_size: Math.min(128, Math.max(1, Math.round(Number($("batchSize").value) || 8))),
    align: $("alignWords").checked
  };
}

function validatedWhisperSettings() {
  const settings = whisperSettings();
  if (!settings.align) {
    throw new Error("Forced alignment is required. Turn on Forced alignment before starting a caption job.");
  }
  if (settings.device === "cpu" && ["float16", "int8_float16"].includes(settings.compute_type)) {
    throw new Error("CPU transcription cannot use float16 compute reliably. Choose int8 or float32, then try again.");
  }
  return settings;
}

async function notifyCaptionJobComplete(outcome, job) {
  const enabled = $("completionAlert") && $("completionAlert").checked;
  if (!enabled || !outcome) return;
  try {
    const alertPath = await getPluginAssetPath("notify_complete.vbs");
    const result = await shell.openPath(
      alertPath,
      "Srijon Captioner uses this bundled helper to play a Windows completion sound and show a short popup after a caption job finishes."
    );
    if (!activeCaptionJob && result) {
      setStatus(`${outcome.message}\nCaptions are ready, but the Windows completion alert could not be shown: ${result}`, "success");
    }
  } catch (e) {
    // Notification failure must never turn a successful caption job into a
    // failed job. Keep the result visible and explain the optional alert only.
    if (!activeCaptionJob) {
      setStatus(`${outcome.message}\nCaptions are ready; the optional Windows completion alert was unavailable.`, "success");
    }
  }
}

async function transcribePath(path, label, jobSettings) {
  let lease = null;
  let outcome = null;
  try {
    setStatus(`Preparing WhisperX for ${label || path}…`);
    lease = await acquireWhisperServer();
    const health = lease.health;
    if (!health.whisperx) throw new Error("The local server started, but Python cannot import WhisperX. Check the configured WhisperX Python environment.");
    if (health.busy) throw new Error("The WhisperX server is already processing another caption job. Wait for it to finish, then try again.");
    if (health.timing_mode !== "forced-alignment-required") {
      throw new Error("Timing server is outdated. This build requires forced word alignment and refuses approximate word timings.");
    }
    if (health.concurrency_mode !== "reject-while-busy") {
      throw new Error("The running WhisperX server is outdated and cannot safely reject overlapping jobs. Restart Premiere after installing this build.");
    }

    setStatus(`Transcribing ${label || path}…\nRunning WhisperX forced alignment. You can use other apps while Premiere stays open.`, "busy");
    const res = await fetch(`${SERVER}/transcribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, ...(jobSettings || validatedWhisperSettings()) })
    });
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!data) throw new Error(`WhisperX returned an unreadable response (HTTP ${res.status}).`);
    if (!res.ok || data.error) throw new Error(data.detail || data.error || `Server returned HTTP ${res.status}`);

    const trueTiming = data.aligned === true && data.timing_source === "whisperx-forced-alignment";
    if (!trueTiming) {
      throw new Error(`Accurate word alignment was not produced (${data.timing_source || "unknown timing source"}). ${data.align_error || "Forced alignment is required."}`);
    }

    rawTranscript = data;
    await refreshSequence();
    const wordCount = (data.words || []).length;
    if (currentOutputMode() === "wordjson") {
      captions = [];
      renderWordJsonPreview();
      outcome = {
        wordCount,
        mode: "wordjson",
        message: `Done. ${wordCount} forced-aligned words received. Word-Level JSON is ready.`
      };
    } else {
      rebuildCaptions({ fromActiveJob: true });
      $("transcriptMeta").textContent = `${wordCount} aligned words • TRUE word timing • language ${data.language || "?"} • ${formatClock(data.duration || 0)} • ${label || "media"}`;
      outcome = {
        wordCount,
        mode: "smart",
        message: `Done. ${wordCount} forced-aligned words received. Captions are ready.`
      };
    }
    updateButtons();
  } finally {
    await releaseWhisperServer(lease);
  }
  if (outcome) setStatus(outcome.message, "success");
  return outcome;
}

async function transcribeFile() {
  const job = beginCaptionJob("a media-file caption job");
  if (!job) return null;
  let outcome = null;
  try {
    setBusy(true, "Choose a media file…");
    const settings = validatedWhisperSettings();
    const picked = await chooseMediaFile();
    if (!picked) {
      setStatus("Media selection cancelled. No caption job was started.", "ready");
      return null;
    }
    outcome = await transcribePath(picked.path, picked.label, settings);
  } catch (e) {
    setStatus(`ERROR: ${e.message || e}`);
  } finally {
    finishCaptionJob(job);
  }
  if (outcome) await notifyCaptionJobComplete(outcome, job);
  return outcome;
}

async function transcribeSequence() {
  const job = beginCaptionJob("a current-sequence caption job");
  if (!job) return null;
  let outcome = null;
  try {
    setBusy(true, "Preparing active sequence…");
    const settings = validatedWhisperSettings();
    const exported = await exportActiveSequence();
    setStatus(`Step 3/3 • Audio ready. Starting WhisperX transcription…\n${exported.path}`);
    outcome = await transcribePath(exported.path, exported.label, settings);
  } catch (e) {
    setStatus(`ERROR: ${e.message || e}`);
  } finally {
    finishCaptionJob(job);
  }
  if (outcome) await notifyCaptionJobComplete(outcome, job);
  return outcome;
}

function normalizeWord(w) {
  return {
    text: String(w.word ?? w.text ?? "").trim(),
    start: Number(w.start),
    end: Number(w.end)
  };
}

function currentOutputMode() {
  const el = $("outputMode");
  return el && el.value === "wordjson" ? "wordjson" : "smart";
}

function normalizeWordForJson(word) {
  if (!word || word.start == null || word.end == null) return null;
  const text = String(word.word != null ? word.word : (word.text != null ? word.text : "")).trim();
  if (!text) return null;
  const out = {
    word: text,
    start: Number(word.start),
    end: Number(word.end)
  };
  if (!Number.isFinite(out.start) || !Number.isFinite(out.end)) return null;
  if (word.score != null && Number.isFinite(Number(word.score))) out.score = Number(word.score);
  return out;
}

function buildWordLevelJsonObject() {
  if (!rawTranscript) return null;
  const allWords = (rawTranscript.words || []).map(normalizeWordForJson).filter(Boolean);
  const sourceSegments = Array.isArray(rawTranscript.segments) ? rawTranscript.segments : [];
  const segments = [];

  for (const seg of sourceSegments) {
    const segStart = Number(seg.start);
    const segEnd = Number(seg.end);
    if (!Number.isFinite(segStart) || !Number.isFinite(segEnd)) continue;
    let words = Array.isArray(seg.words) ? seg.words.map(normalizeWordForJson).filter(Boolean) : [];
    if (!words.length) {
      words = allWords.filter(w => w.start >= segStart - 0.002 && w.start <= segEnd + 0.002);
    }
    const text = String(seg.text || words.map(w => w.word).join(" ")).trim();
    segments.push({
      start: segStart,
      end: segEnd,
      text,
      words
    });
  }

  if (!segments.length && allWords.length) {
    segments.push({
      start: allWords[0].start,
      end: allWords[allWords.length - 1].end,
      text: allWords.map(w => w.word).join(" "),
      words: allWords
    });
  }

  let duration = Number(rawTranscript.duration);
  if (!Number.isFinite(duration) || duration < 0) {
    duration = allWords.length ? allWords[allWords.length - 1].end : 0;
  }

  return {
    schema: "srijon-word-transcript-v1",
    language: rawTranscript.language || null,
    duration,
    segments
  };
}

function wordJsonText() {
  const obj = buildWordLevelJsonObject();
  return obj ? JSON.stringify(obj, null, 2) : "";
}

function renderWordJsonPreview() {
  const obj = buildWordLevelJsonObject();
  const preview = $("wordJsonPreview");
  if (!preview) return;
  if (!obj) {
    preview.textContent = '{\n  "schema": "srijon-word-transcript-v1",\n  "segments": []\n}';
    if ($("wordJsonCount")) $("wordJsonCount").textContent = "0 words";
    if ($("wordJsonMeta")) $("wordJsonMeta").textContent = "Transcribe something first.";
    return;
  }
  const wordCount = obj.segments.reduce((n, seg) => n + (seg.words || []).length, 0);
  if ($("wordJsonCount")) $("wordJsonCount").textContent = `${wordCount} words`;
  if ($("wordJsonMeta")) $("wordJsonMeta").textContent = `${obj.segments.length} segments • ${wordCount} aligned words • language ${obj.language || "?"} • ${formatClock(obj.duration || 0)}`;
  const json = JSON.stringify(obj, null, 2);
  preview.textContent = json.length > 14000 ? json.slice(0, 14000) + "\n\n… preview truncated; saved JSON includes everything" : json;
}

async function saveWordJson() {
  if (!guardNoActiveCaptionJob("save Word JSON") || !guardNoActiveDeliveryAction("save Word JSON")) return null;
  const obj = buildWordLevelJsonObject();
  if (!obj) {
    setStatus("Nothing to save yet. Transcribe a file or sequence first.", "error");
    return null;
  }
  const delivery = beginDeliveryAction("save Word JSON");
  if (!delivery) return null;
  setDeliveryBusy(true, "Preparing raw Word JSON export…");
  try {
    const project = await ppro.Project.getActiveProject();
    const seq = project ? await project.getActiveSequence() : null;
    const sourceName = safeName(seq ? seq.name : "transcript");
    const language = compactFileToken(obj.language || "unknown-language") || "unknown-language";
    const model = compactFileToken($("model") ? $("model").value : "whisperx") || "whisperx";
    const stem = namedOutputStem(sourceName, "word-data", `${language}-${model}-raw-aligned`);

    if (project && dirnamePath(String(project.path || ""))) {
      const folder = await projectOutputFolder(project, "Word Data");
      if (!folder) throw new Error("Could not create the project’s Srijon Captioner Audio\\Word Data folder.");
      const output = nextRevisionedOutput(folder, stem, "json");
      writeUtf8FileVerified(output.path, JSON.stringify(obj, null, 2));
      setStatus(`Saved raw Word JSON revision ${String(output.revision).padStart(3, "0")} beside the project:\n${output.path}`, "success");
      return { nativePath: output.path, name: output.filename };
    }

    setStatus("This Premiere project has not been saved yet. Choose where to save the Word JSON.", "ready");
    const suggested = `${compactFileToken(stem)}__r001.json`;
    const file = await fs.getFileForSaving(suggested, { types: ["json"] });
    if (!file) {
      setStatus("Save JSON cancelled. No file was written.", "ready");
      return null;
    }
    await file.write(JSON.stringify(obj, null, 2));
    setStatus(`Word-level JSON saved:\n${file.nativePath || file.name}`);
    return file;
  } catch (e) {
    setStatus(`ERROR: ${e.message || e}`);
    return null;
  } finally {
    finishDeliveryAction(delivery);
    updateButtons();
  }
}

async function copyWordJson() {
  if (!guardNoActiveCaptionJob("copy Word JSON") || !guardNoActiveDeliveryAction("copy Word JSON")) return;
  try {
    const text = wordJsonText();
    if (!text) {
      setStatus("Nothing to copy yet. Transcribe a file or sequence first.", "error");
      return;
    }
    await navigator.clipboard.writeText(text);
    setStatus("Word-level JSON copied to clipboard.");
  } catch (e) {
    setStatus(`Could not copy JSON: ${e.message || e}`);
  }
}

function syncOutputMode() {
  const mode = currentOutputMode();
  const smart = mode === "smart";
  const smartBtn = $("modeSmartBtn");
  const jsonBtn = $("modeWordJsonBtn");
  if (smartBtn) smartBtn.classList.toggle("active", smart);
  if (jsonBtn) jsonBtn.classList.toggle("active", !smart);
  if (smartBtn) smartBtn.setAttribute("aria-pressed", smart ? "true" : "false");
  if (jsonBtn) jsonBtn.setAttribute("aria-pressed", smart ? "false" : "true");
  if ($("outputModeChip")) $("outputModeChip").textContent = smart ? "SRT" : "JSON";
  ["smartComposeSection", "smartPreviewSection", "smartExportSection"].forEach(id => {
    const el = $(id); if (el) el.classList.toggle("modeHidden", !smart);
  });
  const jsonSection = $("wordJsonSection");
  if (jsonSection) jsonSection.classList.toggle("modeHidden", smart);
  if (rawTranscript) {
    if (smart) rebuildCaptions();
    else renderWordJsonPreview();
  }
  updateButtons();
}

function setOutputMode(mode) {
  if (!guardNoActiveCaptionJob("change output mode")) return;
  const input = $("outputMode");
  if (!input) return;
  input.value = mode === "wordjson" ? "wordjson" : "smart";
  saveSetting(input);
  syncOutputMode();
  setStatus(input.value === "wordjson"
    ? "Word-Level JSON mode. Caption layout settings are ignored; export uses raw forced-aligned WhisperX timing."
    : "Smart Captions mode. Caption composer settings are active.");
}

function wireOutputMode() {
  const smartBtn = $("modeSmartBtn");
  const jsonBtn = $("modeWordJsonBtn");
  if (smartBtn) smartBtn.addEventListener("click", () => setOutputMode("smart"));
  if (jsonBtn) jsonBtn.addEventListener("click", () => setOutputMode("wordjson"));
}

function captionRules() {
  return {
    maxChars: Math.max(8, Math.round(Number($("maxChars").value) || 32)),
    maxLines: Number($("maxLines").value) === 1 ? 1 : 2,
    minDuration: Math.max(0.1, Number($("minDuration").value) || 1),
    gapFrames: Math.max(0, Math.round(Number($("gapFrames").value) || 0)),
    fps: Math.max(1, Number(currentSequenceFps) || 30),
    pause: Math.max(0.1, (Number($("pauseMs").value) || 450) / 1000),
    maxDuration: Math.max(1, Number($("maxDuration").value) || 5),
    smartBreaks: $("punctuationBreak").checked,
    punctuationMode: $("punctuationMode") && $("punctuationMode").value === "keep" ? "keep" : "remove",
    capitalizationMode: $("capitalizationMode") ? $("capitalizationMode").value : "smart",
    customCaps: $("customCaps") ? $("customCaps").value : ""
  };
}

function sentenceEnding(text) {
  return /[.!?…][\"')\]]*$/.test(text || "");
}

function clauseEnding(text) {
  return /[,;:—–-][\"')\]]*$/.test(text || "");
}

function bareWord(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}


const SMART_CASE_TERMS = new Map([
  ["ai", "AI"], ["api", "API"], ["bbc", "BBC"], ["cnn", "CNN"],
  ["fbi", "FBI"], ["cia", "CIA"], ["usa", "USA"], ["us", "US"],
  ["uk", "UK"], ["eu", "EU"], ["uae", "UAE"], ["ceo", "CEO"],
  ["cfo", "CFO"], ["cto", "CTO"], ["coo", "COO"], ["saas", "SaaS"],
  ["seo", "SEO"], ["gpu", "GPU"], ["cpu", "CPU"], ["ram", "RAM"],
  ["rtx", "RTX"], ["hmo", "HMO"], ["srt", "SRT"], ["xml", "XML"],
  ["json", "JSON"], ["pdf", "PDF"], ["pc", "PC"], ["url", "URL"],
  ["ui", "UI"], ["ux", "UX"], ["roi", "ROI"], ["kpi", "KPI"],
  ["crm", "CRM"], ["b2b", "B2B"], ["b2c", "B2C"], ["4k", "4K"],
  ["8k", "8K"], ["youtube", "YouTube"], ["tiktok", "TikTok"],
  ["linkedin", "LinkedIn"], ["chatgpt", "ChatGPT"], ["openai", "OpenAI"],
  ["iphone", "iPhone"], ["ipad", "iPad"], ["macos", "macOS"]
]);

function canonicalCaseKey(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function stripWrappingPunctuation(text) {
  return String(text || "")
    .trim()
    .replace(/^[“”"([{<]+/gu, "")
    .replace(/[“”")\]}>]+$/gu, "")
    .replace(/^[—–]+|[—–]+$/gu, "");
}

function removeCaptionPunctuation(text) {
  let value = stripWrappingPunctuation(text);
  // Preserve decimal/grouped numbers such as 3.5 or 1,000, but remove sentence
  // punctuation everywhere else. Apostrophes inside contractions and internal
  // hyphens are intentionally preserved because "dont" is less readable than "don't".
  const numeric = /^\d+(?:[.,]\d+)+(?:%|x)?$/i.test(value);
  if (!numeric) value = value.replace(/[.,!?;:…]/gu, "");
  value = value.replace(/^[\-—–]+|[\-—–]+$/gu, "");
  return value.trim();
}

function parseCustomCaps(value) {
  const map = new Map();
  String(value || "").split(",").forEach(part => {
    const term = part.trim();
    const key = canonicalCaseKey(term);
    if (term && key) map.set(key, term);
  });
  return map;
}

function isAllCapsForm(text) {
  const letters = String(text || "").replace(/[^\p{L}]/gu, "");
  return letters.length >= 2 && letters === letters.toUpperCase() && letters !== letters.toLowerCase();
}

function isTitleForm(text) {
  const letters = String(text || "").replace(/[^\p{L}]/gu, "");
  if (!letters) return false;
  return letters[0] === letters[0].toUpperCase() && letters.slice(1) === letters.slice(1).toLowerCase();
}

function isMixedCaseForm(text) {
  const letters = String(text || "").replace(/[^\p{L}]/gu, "");
  if (letters.length < 2) return false;
  const hasUpper = letters !== letters.toLowerCase();
  const hasLower = letters !== letters.toUpperCase();
  return hasUpper && hasLower && !isTitleForm(letters);
}

function sourceSentenceStart(words, index) {
  if (index <= 0) return true;
  return sentenceEnding(words[index - 1].text);
}

function buildSmartCaseLexicon(words, customCaps) {
  const chosen = new Map(SMART_CASE_TERMS);
  for (const [key, value] of parseCustomCaps(customCaps)) chosen.set(key, value);

  const evidence = new Map();
  for (let i = 0; i < words.length; i++) {
    const source = removeCaptionPunctuation(words[i].text);
    const key = canonicalCaseKey(source);
    if (!key || chosen.has(key)) continue;
    const atSentenceStart = sourceSentenceStart(words, i);
    let strength = 0;
    if (isAllCapsForm(source)) strength = 100;
    else if (isMixedCaseForm(source)) strength = 90;
    else if (isTitleForm(source) && !atSentenceStart) strength = 70;
    if (!strength) continue;
    const old = evidence.get(key);
    if (!old || strength > old.strength) evidence.set(key, { value: source, strength });
  }
  for (const [key, info] of evidence) chosen.set(key, info.value);
  return chosen;
}

function smartCaseToken(text, lexicon) {
  let value = String(text || "");
  if (!value) return value;

  // Handle contractions and possessives by smart-casing the lexical base first.
  const contraction = value.match(/^(.+?)(['’](?:s|t|re|ve|ll|d|m))$/iu);
  if (contraction) {
    const base = smartCaseToken(contraction[1], lexicon);
    const suffix = contraction[2].toLowerCase();
    return `${base}${suffix}`;
  }

  const key = canonicalCaseKey(value);
  if (!key) return value;
  if (key === "i") return "I";
  if (lexicon.has(key)) return lexicon.get(key);
  return value.toLowerCase();
}

function prepareDisplayWords(words, rules) {
  const lexicon = buildSmartCaseLexicon(words, rules.customCaps);
  return words.map((word) => {
    let display = rules.punctuationMode === "keep"
      ? stripWrappingPunctuation(word.text)
      : removeCaptionPunctuation(word.text);

    if (rules.capitalizationMode === "upper") display = display.toUpperCase();
    else if (rules.capitalizationMode === "lower") display = display.toLowerCase();
    else if (rules.capitalizationMode === "smart") display = smartCaseToken(display, lexicon);
    // "original" deliberately leaves WhisperX's casing untouched.

    return { ...word, displayText: display.trim() };
  }).filter(word => word.displayText);
}

const BAD_END_WORDS = new Set([
  "a", "an", "the", "to", "of", "for", "with", "at", "in", "on", "from", "by",
  "and", "or", "but", "so", "because", "if", "when", "while", "as", "than",
  "that", "which", "who", "whose", "this", "these", "those", "my", "your", "our", "their"
]);

const BAD_START_WORDS = new Set([
  "of", "for", "with", "at", "in", "on", "from", "by", "than", "which", "whose"
]);

function wordsText(words) {
  return words.map(w => w.displayText || w.text).join(" ").replace(/\s+([,.;:!?])/g, "$1").replace(/\s+/g, " ").trim();
}

function breakLanguagePenalty(leftLast, rightFirst) {
  let penalty = 0;
  const left = bareWord(leftLast && leftLast.text);
  const right = bareWord(rightFirst && rightFirst.text);
  if (BAD_END_WORDS.has(left)) penalty += 7;
  if (BAD_START_WORDS.has(right)) penalty += 5;
  return penalty;
}

function lineBreakPenalty(leftLast, rightFirst) {
  let penalty = breakLanguagePenalty(leftLast, rightFirst) * 0.85;
  if (leftLast && clauseEnding(leftLast.text)) penalty -= 2.5;
  if (leftLast && sentenceEnding(leftLast.text)) penalty -= 4;
  return penalty;
}

function formatCandidate(words, maxChars, maxLines) {
  if (!words.length) return null;
  const full = wordsText(words);
  const singleWordTooLong = words.length === 1 && full.length > maxChars;

  if (maxLines === 1) {
    if (full.length > maxChars && !singleWordTooLong) return null;
    const fill = Math.min(1, full.length / maxChars);

    // maxChars is a HARD LIMIT, not a target. For single-line captions we
    // deliberately prefer a comfortable amount of text instead of packing
    // every block all the way to the limit. This produces punchier captions
    // and reduces Premiere's own visual auto-wrap with large caption styles.
    const targetFill = 0.68;
    const targetPenalty = Math.pow(fill - targetFill, 2) * 2.2;
    const crowdedPenalty = fill > 0.82 ? Math.pow((fill - 0.82) / 0.18, 2) * 3.8 : 0;
    const tinyPenalty = fill < 0.28 ? Math.pow((0.28 - fill) / 0.28, 2) * 1.4 : 0;

    return {
      text: full.replace(/\s*\n\s*/g, " "),
      lines: [full.replace(/\s*\n\s*/g, " ")],
      score: targetPenalty + crowdedPenalty + tinyPenalty + (singleWordTooLong ? 25 : 0)
    };
  }

  if (full.length <= maxChars || singleWordTooLong) {
    const fill = Math.min(1, full.length / maxChars);
    return {
      text: full,
      lines: [full],
      score: Math.pow(1 - fill, 2) * 2.0 + (singleWordTooLong ? 25 : 0)
    };
  }

  let best = null;
  for (let i = 1; i < words.length; i++) {
    const firstWords = words.slice(0, i);
    const secondWords = words.slice(i);
    const a = wordsText(firstWords);
    const b = wordsText(secondWords);
    if (a.length > maxChars || b.length > maxChars) continue;

    const balance = Math.abs(a.length - b.length) / Math.max(1, maxChars);
    const fullness = (a.length + b.length) / Math.max(1, maxChars * 2);
    const awkward = lineBreakPenalty(words[i - 1], words[i]);
    const score = balance * 3.4 + Math.pow(1 - fullness, 2) * 1.2 + awkward;

    if (!best || score < best.score) {
      best = { text: `${a}\n${b}`, lines: [a, b], score };
    }
  }
  return best;
}

function internalBreakPenalty(words) {
  let score = 0;
  for (let i = 0; i < words.length - 1; i++) {
    if (sentenceEnding(words[i].text)) score += 60;
    else if (clauseEnding(words[i].text)) score += 6;
  }
  return score;
}

function boundaryScore(words, endIndex, rules) {
  if (endIndex >= words.length - 1) return -3;
  const current = words[endIndex];
  const next = words[endIndex + 1];
  const gap = Math.max(0, next.start - current.end);
  let score = breakLanguagePenalty(current, next);

  if (rules.smartBreaks) {
    if (sentenceEnding(current.text)) score -= 9;
    else if (clauseEnding(current.text)) score -= 4;
    if (gap >= 0.30) score -= 5;
    else if (gap >= 0.18) score -= 2.8;
    else if (gap >= 0.10) score -= 1.2;
  }
  return score;
}

function candidateScore(words, startIndex, endIndex, formatted, rules) {
  const group = words.slice(startIndex, endIndex + 1);
  const duration = Math.max(0.05, group[group.length - 1].end - group[0].start);
  const chars = formatted.lines.reduce((sum, line) => sum + line.length, 0);
  const readableDuration = Math.max(duration, rules.minDuration);
  const cps = chars / readableDuration;

  let score = 1.0 + formatted.score;
  if (rules.smartBreaks) score += internalBreakPenalty(group);
  score += boundaryScore(words, endIndex, rules);

  if (group.length === 1 && group[0].text.length < rules.maxChars * 0.6) score += 7;
  else if (group.length === 2) score += 1.0;

  if (duration < rules.minDuration) {
    score += (rules.minDuration - duration) * 8.0;
  }

  if (endIndex < words.length - 1) {
    const gapSec = rules.gapFrames / rules.fps;
    const availableUntilNext = words[endIndex + 1].start - gapSec - group[0].start;
    if (availableUntilNext < rules.minDuration) {
      score += (rules.minDuration - availableUntilNext) * 28.0;
    }
  }

  if (cps > 21) score += Math.pow(cps - 21, 2) * 0.08;
  if (cps < 5 && group.length <= 2) score += (5 - cps) * 0.18;

  return score;
}

function crossesHardPause(words, startIndex, endIndex, pauseThreshold) {
  for (let i = startIndex; i < endIndex; i++) {
    if ((words[i + 1].start - words[i].end) >= pauseThreshold) return true;
  }
  return false;
}

function segmentWords(words, rules) {
  const n = words.length;
  const dp = new Array(n + 1).fill(Infinity);
  const nextBreak = new Array(n).fill(-1);
  const formatting = new Array(n).fill(null);
  dp[n] = 0;

  for (let i = n - 1; i >= 0; i--) {
    for (let j = i; j < n; j++) {
      if (j > i && crossesHardPause(words, i, j, rules.pause)) break;

      const duration = words[j].end - words[i].start;
      if (duration > rules.maxDuration && j > i) break;

      const group = words.slice(i, j + 1);
      const formatted = formatCandidate(group, rules.maxChars, rules.maxLines);
      if (!formatted) {
        if (j > i) break;
        continue;
      }

      const score = candidateScore(words, i, j, formatted, rules) + dp[j + 1];
      if (score < dp[i]) {
        dp[i] = score;
        nextBreak[i] = j + 1;
        formatting[i] = { end: j, formatted };
      }
    }

    // Safety: never drop a word, even if a single token is longer than the chosen line limit.
    if (nextBreak[i] < 0) {
      const formatted = { text: words[i].text, lines: [words[i].text], score: 50 };
      nextBreak[i] = i + 1;
      formatting[i] = { end: i, formatted };
      dp[i] = 50 + dp[i + 1];
    }
  }

  const groups = [];
  let i = 0;
  while (i < n) {
    const info = formatting[i];
    const end = info ? info.end : i;
    groups.push(words.slice(i, end + 1));
    i = Math.max(i + 1, nextBreak[i]);
  }
  return groups;
}

function canMergeGroups(a, b, rules) {
  if (!a || !b || !a.length || !b.length) return null;
  const pause = b[0].start - a[a.length - 1].end;
  if (pause >= rules.pause) return null;
  const merged = [...a, ...b];
  if ((merged[merged.length - 1].end - merged[0].start) > rules.maxDuration) return null;
  const formatted = formatCandidate(merged, rules.maxChars, rules.maxLines);
  return formatted ? merged : null;
}

function mergeTooShortGroups(groups, rules) {
  if (groups.length < 2) return groups;
  const gapSec = rules.gapFrames / rules.fps;
  const out = groups.map(g => g.slice());

  let i = 0;
  while (i < out.length - 1) {
    let current = out[i];
    let next = out[i + 1];
    const hardPause = next[0].start - current[current.length - 1].end >= rules.pause;
    const hardPhraseBoundary = rules.smartBreaks && sentenceEnding(current[current.length - 1].text);
    const protectedBoundary = hardPause || hardPhraseBoundary;

    const currentTooShort = () => {
      const available = Math.max(0, next[0].start - gapSec - current[0].start);
      const rawDuration = current[current.length - 1].end - current[0].start;
      return available < rules.minDuration || rawDuration < rules.minDuration * 0.55;
    };

    // If a block would flash too quickly, first borrow leading words from the next
    // block while the user's character/line constraints still allow it. This is
    // smarter than simply stretching a tiny caption on screen.
    if (!protectedBoundary) {
      while (currentTooShort() && next.length > 1) {
        const candidate = [...current, next[0]];
        const formatted = formatCandidate(candidate, rules.maxChars, rules.maxLines);
        const duration = candidate[candidate.length - 1].end - candidate[0].start;
        if (!formatted || duration > rules.maxDuration) break;
        current.push(next.shift());
      }
    }

    if (currentTooShort() && !protectedBoundary) {
      const merged = canMergeGroups(current, next, rules);
      if (merged) {
        out.splice(i, 2, merged);
        if (i > 0) i--;
        continue;
      }
    }

    i++;
  }
  return out;
}

function buildCaptions(wordsInput, rules) {
  const sourceWords = (wordsInput || [])
    .map(normalizeWord)
    .filter(w => w.text && Number.isFinite(w.start) && Number.isFinite(w.end))
    .sort((a, b) => a.start - b.start);
  if (!sourceWords.length) return [];

  // Keep source punctuation/casing on `text` for segmentation intelligence, while
  // `displayText` is what actually counts toward line length and reaches the SRT.
  const words = prepareDisplayWords(sourceWords, rules);
  if (!words.length) return [];

  let groups = segmentWords(words, rules);
  groups = mergeTooShortGroups(groups, rules);
  const gapSec = rules.gapFrames / rules.fps;

  const items = groups.map(group => {
    const formatted = formatCandidate(group, rules.maxChars, rules.maxLines) || {
      text: wordsText(group), lines: [wordsText(group)]
    };
    const strictText = rules.maxLines === 1
      ? formatted.text.replace(/\s*\n\s*/g, " ")
      : formatted.text;
    return {
      rawStart: group[0].start,
      rawEnd: group[group.length - 1].end,
      start: group[0].start,
      end: group[group.length - 1].end,
      text: strictText,
      words: group,
      lines: rules.maxLines === 1 ? [strictText] : formatted.lines,
      singleLine: rules.maxLines === 1
    };
  });

  // Timing pass. Forced-aligned word timestamps are authoritative. With zero
  // gap, every next caption starts at its OWN first aligned word timestamp, and
  // the previous caption ends at that exact same boundary. We never shift a
  // caption start to satisfy minimum duration. Minimum duration is solved by
  // segmentation/merging, not by desynchronizing text from speech.
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    item.start = item.rawStart;

    if (i < items.length - 1) {
      const nextStart = items[i + 1].rawStart;

      if (rules.gapFrames === 0) {
        // Seamless transition. Previous caption stays visible through any natural
        // pause, then the next caption appears exactly when its first word starts.
        item.end = Math.max(item.start + 0.001, nextStart);
      } else {
        // Requested dead space lives immediately before the next caption. Do not
        // move the next caption away from its real first-word timestamp.
        const latestEnd = nextStart - gapSec;
        const wantedEnd = Math.max(item.rawEnd, item.start + rules.minDuration);
        item.end = Math.min(wantedEnd, latestEnd);
        if (item.end <= item.start) {
          item.end = Math.max(item.start + 0.001, Math.min(item.rawEnd, nextStart));
        }
      }
    } else {
      // There is no following caption to constrain the final block.
      item.end = Math.max(item.rawEnd, item.start + rules.minDuration);
    }

  }

  // Final contract pass: in seamless mode there is one canonical boundary for
  // every handoff. This protects SRT export from future timing-pass changes.
  if (rules.gapFrames === 0) {
    for (let i = 0; i < items.length - 1; i++) {
      items[i].end = items[i + 1].start;
    }
  }

  return items;
}

function assertCaptionOutput(items, rules) {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!Number.isFinite(item.start) || !Number.isFinite(item.end) || item.end <= item.start) {
      throw new Error(`Caption ${i + 1} has invalid timing.`);
    }
    if (rules.maxLines === 1 && /\r|\n/.test(String(item.text))) {
      throw new Error(`Caption ${i + 1} violates single-line mode.`);
    }
    if (rules.gapFrames === 0 && i < items.length - 1 && item.end !== items[i + 1].start) {
      throw new Error(`Caption ${i + 1} violates the zero-gap timing contract.`);
    }
  }
}

function rebuildCaptions(options = {}) {
  const fromActiveJob = !!(options && options.fromActiveJob === true);
  if (!fromActiveJob && !guardNoActiveCaptionJob("rebuild captions")) return false;
  if (!fromActiveJob && !guardNoActiveDeliveryAction("rebuild captions")) return false;
  if (!rawTranscript || !Array.isArray(rawTranscript.words)) {
    setStatus("Cannot rebuild yet: no transcript exists. Transcribe a sequence or media file first.", "error");
    return false;
  }
  const rules = captionRules();
  captions = buildCaptions(rawTranscript.words, rules);
  assertCaptionOutput(captions, rules);
  renderPreview();
  updateButtons();
  const mode = rules.maxLines === 1 ? "single line" : "double line";
  const gapLabel = rules.gapFrames === 0 ? "seamless handoffs" : `${rules.gapFrames} frame gap`;
  const punctuationLabel = rules.punctuationMode === "keep" ? "punctuation kept" : "no punctuation";
  const caseLabel = rules.capitalizationMode === "smart" ? "smart caps" : rules.capitalizationMode;
  setStatus(`Rebuilt ${captions.length} captions • ${rules.maxChars} chars/line • ${mode} • ${gapLabel} • ${punctuationLabel} • ${caseLabel}.`);
  return true;
}

function formatClock(seconds) {
  seconds = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function srtTime(seconds) {
  let ms = Math.round(Math.max(0, seconds) * 1000);
  const h = Math.floor(ms / 3600000); ms %= 3600000;
  const m = Math.floor(ms / 60000); ms %= 60000;
  const s = Math.floor(ms / 1000); ms %= 1000;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")},${String(ms).padStart(3,"0")}`;
}

function toSrt(items) {
  return items.map((c, i) => {
    // Defensive guarantee: Single mode NEVER writes an explicit newline inside
    // the subtitle text. (Premiere can still visually wrap a long one-line SRT
    // based on font size / caption box width; lowering Maximum length prevents that.)
    const text = c.singleLine ? String(c.text).replace(/\s*\n\s*/g, " ") : c.text;
    return `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${text}\n`;
  }).join("\n");
}

function renderPreview() {
  $("captionCount").textContent = `${captions.length} captions`;
  const preview = $("preview");
  preview.innerHTML = "";

  if (captions.length) {
    const lineCounts = captions.map(c => (c.text.match(/\n/g) || []).length + 1);
    const doubleCount = lineCounts.filter(n => n > 1).length;
    const avgDuration = captions.reduce((sum, c) => sum + (c.end - c.start), 0) / captions.length;
    $("composerStats").innerHTML = `
      <span>${doubleCount} two-line</span>
      <span>${captions.length - doubleCount} one-line</span>
      <span>${avgDuration.toFixed(2)}s avg</span>
      <span>${formatFps(currentSequenceFps)} fps</span>
    `;
  } else {
    $("composerStats").innerHTML = "";
  }

  const maxPreview = 120;
  for (const c of captions.slice(0, maxPreview)) {
    const item = document.createElement("div");
    item.className = "captionItem";
    const time = document.createElement("div");
    time.className = "time";
    time.textContent = `${srtTime(c.start)} → ${srtTime(c.end)}`;
    const text = document.createElement("div");
    text.className = "captionText";
    text.textContent = c.text;
    item.appendChild(time);
    item.appendChild(text);
    preview.appendChild(item);
  }
  if (captions.length > maxPreview) {
    const more = document.createElement("div");
    more.className = "captionItem hint";
    more.textContent = `Previewing first ${maxPreview}. SRT export includes all ${captions.length}.`;
    preview.appendChild(more);
  }
}

function updateButtons() {
  const on = captions.length > 0;
  setControlDisabled("saveSrtBtn", !on);
  setControlDisabled("saveImportBtn", !on);
  setControlDisabled("copySrtBtn", !on);
  setControlDisabled("clearBtn", !rawTranscript);
  const jsonOn = !!rawTranscript && Array.isArray(rawTranscript.words) && rawTranscript.words.length > 0;
  setControlDisabled("saveJsonBtn", !jsonOn);
  setControlDisabled("copyJsonBtn", !jsonOn);
  setControlDisabled("clearJsonBtn", !rawTranscript);
}

function setDeliveryBusy(busy, message) {
  ["saveSrtBtn", "saveImportBtn", "copySrtBtn", "saveJsonBtn", "copyJsonBtn"].forEach(id => {
    setControlDisabled(id, busy);
  });
  if (message) setStatus(message, busy ? "busy" : undefined);
}

async function autoSaveAndImportSrt(project, sequence, rules) {
  const folder = await projectOutputFolder(project, "Captions");
  if (!folder) throw new Error("Could not create the project’s Srijon Captioner Audio\\Captions folder.");
  const sequenceName = safeName(sequence ? sequence.name : "captions");
  const settingsTag = captionSettingsFileTag(rules);
  const output = nextRevisionedOutput(folder, namedOutputStem(sequenceName, "captions", settingsTag), "srt");

  setStatus(`Saving caption revision ${String(output.revision).padStart(3, "0")} beside the project…`, "busy");
  writeUtf8FileVerified(output.path, toSrt(captions));

  const root = await project.getRootItem();
  const ok = await project.importFiles([output.path], true, root, false);
  if (!ok) {
    throw new Error(`The SRT was saved at ${output.path}, but Premiere reported that importing it failed.`);
  }

  setStatus(
    `Imported caption revision ${String(output.revision).padStart(3, "0")} into the Project panel.\nSaved: ${output.path}\nDrag the imported SRT onto the timeline to create the native caption track.`,
    "success"
  );
  return { nativePath: output.path, name: output.filename, revision: output.revision, imported: true };
}

async function saveSrt(importAfter) {
  const actionLabel = importAfter ? "auto-save and import an SRT" : "save an SRT";
  if (!guardNoActiveCaptionJob(actionLabel) || !guardNoActiveDeliveryAction(actionLabel)) return null;
  const delivery = beginDeliveryAction(actionLabel);
  if (!delivery) return null;
  setDeliveryBusy(true, importAfter ? "Preparing an automatic caption export…" : "Preparing SRT export…");
  try {
    const project = await ppro.Project.getActiveProject();
    const seq = await refreshSequence();
    // Recompose from the cached aligned words at click time so export always
    // reflects the visible settings, even if a UXP field has not blurred yet.
    if (rawTranscript && currentOutputMode() === "smart") rebuildCaptions();
    if (!captions.length) {
      setStatus("Nothing to save yet. Transcribe a file or sequence first.", "error");
      return null;
    }
    const rules = captionRules();
    assertCaptionOutput(captions, rules);
    setDeliveryBusy(true);

    if (importAfter) {
      if (!project) throw new Error("There is no active Premiere project. Open a project, or use Save SRT instead.");
      if (dirnamePath(String(project.path || ""))) {
        return await autoSaveAndImportSrt(project, seq, rules);
      }
      setStatus("This Premiere project has not been saved yet. Choose where to save the SRT; it will still be imported.", "ready");
    }

    const settingsTag = captionSettingsFileTag(rules);
    const suggested = `${namedOutputStem(safeName(seq ? seq.name : "captions"), "captions", settingsTag)}__r001.srt`;
    const file = await fs.getFileForSaving(suggested, { types: ["srt"] });
    if (!file) {
      setStatus("Save SRT cancelled. No file was written.", "ready");
      return null;
    }
    await file.write(toSrt(captions));
    setStatus(`Saved SRT:\n${file.nativePath || file.name}`);

    if (importAfter) {
      const root = await project.getRootItem();
      const ok = await project.importFiles([file.nativePath], true, root, false);
      if (!ok) throw new Error("SRT saved, but Premiere importFiles() reported failure.");
      setStatus(`SRT saved and imported.\nSaved: ${file.nativePath || file.name}\nDrag it from the Project panel onto the timeline to create the native caption track.`, "success");
    }
    return file;
  } catch (e) {
    setStatus(`ERROR: ${e.message || e}`);
    return null;
  } finally {
    finishDeliveryAction(delivery);
    updateButtons();
  }
}

async function copySrt() {
  if (!guardNoActiveCaptionJob("copy an SRT") || !guardNoActiveDeliveryAction("copy an SRT")) return;
  try {
    if (rawTranscript && currentOutputMode() === "smart") rebuildCaptions();
    if (!captions.length) {
      setStatus("Nothing to copy yet. Transcribe a file or sequence first.", "error");
      return;
    }
    assertCaptionOutput(captions, captionRules());
    const text = toSrt(captions);
    await navigator.clipboard.writeText(text);
    setStatus("SRT copied to clipboard.");
  } catch (e) {
    setStatus(`Could not copy SRT: ${e.message || e}`);
  }
}

function clearAll() {
  if (!guardNoActiveCaptionJob("clear the cached transcript")) return false;
  if (!guardNoActiveDeliveryAction("clear the cached transcript")) return false;
  rawTranscript = null;
  captions = [];
  $("preview").innerHTML = "";
  $("composerStats").innerHTML = "";
  $("captionCount").textContent = "0 captions";
  $("transcriptMeta").textContent = "Transcribe something first.";
  renderWordJsonPreview();
  updateButtons();
  setStatus("Cleared cached transcript.");
  return true;
}

function init() {
  if (initialized) return;
  initialized = true;
  ensurePanelViewport();
  loadSettings();

  // v1.2 defaults are intentionally optimized for short-form content. Existing
  // users keep their new settings once changed; old v1.1 uppercase state is
  // migrated only when no capitalization mode has ever been saved.
  if (localStorage.getItem("captioner.punctuationMode") === null && $("punctuationMode")) {
    $("punctuationMode").value = "remove";
  }
  if (localStorage.getItem("captioner.capitalizationMode") === null && $("capitalizationMode")) {
    const oldUpper = localStorage.getItem("captioner.uppercase") === "true";
    $("capitalizationMode").value = oldUpper ? "upper" : "smart";
  }
  if (localStorage.getItem("captioner.gapFrames") === null && $("gapFrames")) {
    $("gapFrames").value = "0";
  }

  wireCustomControls();
  wireDisclosureControls();
  wireNumberInputWheelGuards();
  wireSettings();
  wireOutputMode();
  wireLineMode();
  wireTextStyleControls();
  wireStylePresets();
  syncLineMode();
  syncTextStyleControls();
  syncOutputMode();
  updateButtons();

  const presetName = localStorage.getItem("captioner.presetName");
  if (presetName) $("presetName").textContent = `Audio preset: ${presetName}`;
  else $("presetName").textContent = "Automatic: the extension will look for Premiere’s stock Waveform Audio preset on first use.";

  $("refreshSequenceBtn").addEventListener("click", () => {
    if (guardNoActiveCaptionJob("refresh the active sequence")) refreshSequence(true);
  });
  $("testServerBtn").addEventListener("click", testServerConnection);
  $("presetBtn").addEventListener("click", choosePreset);
  $("transcribeFileBtn").addEventListener("click", transcribeFile);
  $("transcribeSequenceBtn").addEventListener("click", transcribeSequence);
  $("rebuildBtn").addEventListener("click", rebuildCaptions);
  $("saveSrtBtn").addEventListener("click", () => saveSrt(false));
  $("saveImportBtn").addEventListener("click", () => saveSrt(true));
  $("copySrtBtn").addEventListener("click", copySrt);
  $("clearBtn").addEventListener("click", clearAll);
  $("saveJsonBtn").addEventListener("click", saveWordJson);
  $("copyJsonBtn").addEventListener("click", copyWordJson);
  $("clearJsonBtn").addEventListener("click", clearAll);

  refreshSequence();
  checkServer();
  setStatus("Ready. WhisperX starts automatically when you transcribe and closes when the job finishes.", "ready");
}

entrypoints.setup({
  panels: {
    srijonCaptionerPanel: {
      show(rootNode) {
        ensurePanelViewport(rootNode);
        init();
        if (!activeCaptionJob) {
          refreshSequence();
          checkServer();
        }
      },
      hide() {}
    }
  }
});

init();
