# AI Agent Handoff

You are modifying **Srijon Captioner**, a Windows Adobe Premiere Pro UXP extension backed by a local WhisperX service.

Before making changes, read `FEATURE_CONTRACT.md` and `ARCHITECTURE.md`.

## Current feature version

- Version: **1.2.14**
- Host used during development: Premiere Pro 2026 / 26.2.2
- Minimum host version: 26.2.0
- Plugin ID: `com.srijon.captioner.local`
- Manifest version: 5
- Server port: 8765 on loopback only

## Primary code

- Premiere integration, state, export flow, caption composer, SRT, presets and Word JSON: `source/premiere-plugin/index.js`
- Local WhisperX API and forced-alignment timing: `source/premiere-plugin/server.py`
- Standalone server mirror: `source/whisper-server/server.py`
- Permissions/version/host metadata: `source/premiere-plugin/manifest.json`
- Auto-server launcher: `source/premiere-plugin/start_server_auto.bat` + `start_server_hidden.vbs`

If `server.py` changes, update both server copies identically.

## High-risk code paths

### Forced alignment and timing
Search for:
- `extract_true_words`
- `_run_alignment`
- `/transcribe`
- `buildCaptions`
- `segmentWords`
- `mergeTooShortGroups`
- zero-gap timing logic

Never generate synthetic per-word timing as a fallback.

### Automatic server lifecycle
Search for:
- `launchWhisperServerHidden`
- `acquireWhisperServer`
- `releaseWhisperServer`
- `/shutdown`

Ownership rule: a server started by the extension may be stopped by the extension. A pre-existing server must be left running.

### Active-sequence transcription
Search for:
- `resolveAudioPreset`
- `autoFindWaveformPreset`
- `exportActiveSequence`
- `EncoderManager`
- `exportSequence`

The intended workflow does not require manual audio export.

### Smart caption composition
Search for:
- `captionRules`
- `segmentWords`
- `buildCaptions`
- `renderCaptionText`
- `applyGapTiming`
- punctuation/capitalization helpers

The composer is deterministic and operates on forced-aligned word timestamps.

### Caption presets
Search for:
- `STYLE_PRESET_STORAGE_KEY`
- `loadStylePresets`
- `saveStylePreset`
- `applyStylePreset`

Current storage key: `captioner.stylePresets.v1`.

### Word-Level JSON
Search for:
- `currentOutputMode`
- `buildWordLevelJsonObject`
- `renderWordJsonPreview`
- `saveWordJson`
- `copyWordJson`

Word JSON must preserve real segment and word timing from WhisperX. Do not route it through caption segmentation.

### Revisioned project-side delivery
Search for:
- `captionSettingsFileTag`
- `nextRevisionedOutput`
- `projectOutputFolder`
- `autoSaveAndImportSrt`

Saved-project SRTs go to `Srijon Captioner Audio/Captions` and are imported into
the Project panel. Raw Word JSON goes to `Srijon Captioner Audio/Word Data`.
Settings-aware revision names must never overwrite an earlier delivery.

### Caption-job guardrails
Search for:
- `activeCaptionJob`
- `beginCaptionJob`
- `guardNoActiveCaptionJob`
- `validatedWhisperSettings`
- `exclusive_caption_job`
- `notifyCaptionJobComplete`

The panel and server both enforce one caption job at a time. Never replace the
server's non-blocking conflict with a waiting lock: users must get an immediate,
visible explanation. Completion-alert failure must not fail a successful job.

## Portable runtime

Development source uses this runtime by default:

`%LOCALAPPDATA%\SrijonCaptioner\runtime\whisperx-venv\Scripts\python.exe`

Model cache:

`%LOCALAPPDATA%\SrijonCaptioner\models`

Environment-variable overrides:

- `SRIJON_CAPTIONER_PYTHON`
- `SRIJON_CAPTIONER_MODEL_DIR`

The exact current-release snapshot in `release/` may contain a historical machine-specific launcher. Use the portable source/build for a different machine.

## Build and install

Build:

`setup/BUILD_CCX.bat --version 1.2.14`

Build then reinstall:

`setup/BUILD_AND_INSTALL.bat 1.2.14`

Adobe UPIA rejects downgrades when a newer version with the same plugin ID is installed. `CLEAN_REINSTALL_PLUGIN.bat` removes the current install before installing the portable build.

## Required regression test

1. Extension loads in Premiere 26.2+.
2. Media-file transcription works.
3. Active-sequence transcription automatically exports audio and transcribes it.
4. When the server is offline, a transcription job starts it automatically.
5. An extension-owned server stops after the job.
6. A manually running server remains running after the job.
7. `/health` reports `forced-alignment-required`.
8. A short transcript returns real aligned words with numeric `start` and `end`.
9. Alignment failure produces an error, never approximated timing.
10. Smart Captions mode produces SRT.
11. Single-line mode contains no explicit newline inside caption text.
12. With gap = 0, caption N ends exactly when caption N+1 starts.
13. Rebuild changes caption segmentation without re-running WhisperX.
14. Punctuation removal does not damage boundary detection.
15. Smart capitalization preserves important casing and custom terms.
16. Caption presets save, load, delete and survive a Premiere restart.
17. Save SRT works.
18. Auto-save + Import writes beside the project, creates a new revision and imports that exact SRT into the Project panel.
19. Word-Level JSON mode exports the documented schema.
20. Word-Level JSON word timestamps match raw forced-aligned timestamps and are not re-segmented.
21. Word-Level JSON `duration` represents full source duration when available.
22. Five repeated exports with identical settings produce `r001` through `r005`; changing settings starts a separate revision family.
23. A second panel job and a second server request are rejected immediately with a clear busy message.
24. Rebuild without a transcript reports an error; mutating/export actions are blocked during a job.
25. Completion alert on/off persists, launches only after success and cannot change job success if the alert fails.

## Request template

Give another agent this folder and say:

> Read `docs/AI_AGENT_HANDOFF.md`, `docs/FEATURE_CONTRACT.md`, `docs/ARCHITECTURE.md`, and `docs/WORD_JSON_SCHEMA.md`. Make the requested change without breaking any feature contract. Modify `source/`, bump the manifest version, run the validation/build scripts, and report changed files, behavior changes, and regression risks.
