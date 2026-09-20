# Technical Architecture

## Components

### Premiere extension

- Adobe Premiere Pro UXP, Manifest v5
- JavaScript runtime
- `premierepro` UXP module
- UXP filesystem APIs
- local settings/preset persistence through `localStorage`
- local process launch through UXP shell permission

### Local transcription service

- Python 3.12 recommended
- FastAPI + Uvicorn
- WhisperX
- PyTorch
- WhisperX alignment model for real word timestamps
- optional NVIDIA CUDA acceleration

## Main data flow

`Premiere sequence -> audio export -> local service -> WhisperX ASR -> forced alignment -> raw transcript -> output path`

Output path A:

`raw aligned words -> deterministic caption composer -> revisioned SRT beside project -> Premiere Project-panel import`

Output path B:

`raw aligned segments/words -> srijon-word-transcript-v1 JSON`

## Local service

Base URL:

`http://127.0.0.1:8765`

### GET /health

Expected fields include:

- `ok`
- `server_version`
- `timing_mode`
- `whisperx`
- `cuda`
- model/aligner cache counts
- Python executable
- model directory

The expected timing mode is:

`forced-alignment-required`

### POST /transcribe

Input includes source path plus model/language/device/compute/batch/alignment settings.

The response includes:

- language
- full media duration when available
- `speech_end`
- flattened real aligned words
- aligned WhisperX segments
- timing/alignment metadata

The server uses a non-blocking exclusive job lock. When a transcription is
already active, another `/transcribe` request receives HTTP 409 rather than
being silently queued. `/health` exposes this as `busy: true`; `/unload` and
`/shutdown` also reject requests while the lock is held.

### POST /unload

Releases cached model/alignment resources where supported.

### POST /shutdown

Stops the local service. Use only when the extension owns the server process for the current task.

## Active-sequence audio export

The extension uses Premiere's encoder APIs and a Waveform Audio `.epr` preset. It attempts to resolve a usable preset automatically and can remember the selected preset path/token.

Typical generated audio is stored next to the saved Premiere project in a `Srijon Captioner Audio` folder; a temporary location is used when a project path is unavailable.

Generated deliveries use two child folders:

- `Srijon Captioner Audio/Captions` for settings-aware revisioned SRT files
- `Srijon Captioner Audio/Word Data` for revisioned raw aligned JSON files

Repeated delivery never overwrites an earlier file. The readable filename records
the major caption settings, a stable hash covers the complete normalized settings
including custom capitalization terms, and `r001`, `r002`, … identifies revisions
within that configuration. `Project.importFiles()` imports the SRT into Premiere's
Project panel. The current UXP API can read caption tracks but does not provide a
supported caption-track creation/population action, so placing that imported SRT
on the timeline remains a user action.

## Raw transcript state

The extension keeps the server response in memory as `rawTranscript`.

Smart caption rebuilds operate entirely from this cached raw transcript. Changing caption composer settings must not re-run WhisperX.

Word-Level JSON is also generated from this same raw transcript and must not pass through the smart caption grouping logic.

## Persistence

General settings use keys in the form:

`captioner.<element-id>`

Caption preset collection:

`captioner.stylePresets.v1`

Waveform preset state is also stored locally so active-sequence transcription can remain one-click after initial setup.

Completion alerts are optional local state (`captioner.completionAlert`). On
Windows, the plugin opens its bundled `notify_complete.vbs` helper through the
already-declared UXP `.vbs` launch permission. The helper displays a 12-second
information popup with the standard Windows sound. Failure or denial is treated
as an alert-only problem and never invalidates completed caption data.

## Portable runtime

Default Python:

`%LOCALAPPDATA%\SrijonCaptioner\runtime\whisperx-venv\Scripts\python.exe`

Default model directory:

`%LOCALAPPDATA%\SrijonCaptioner\models`

Optional overrides:

- `SRIJON_CAPTIONER_PYTHON`
- `SRIJON_CAPTIONER_MODEL_DIR`
