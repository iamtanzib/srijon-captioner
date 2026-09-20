# Installation

## Fresh Windows PC

Run as administrator:

`setup/SETUP_ALL_NEW_DEVICE.bat`

The script performs a best-effort setup of:

- Python 3.12
- FFmpeg
- isolated virtual environment
- PyTorch 2.8 stack
- WhisperX 3.8.6
- FastAPI/Uvicorn/Pydantic
- portable CCX build
- runtime/server verification
- Adobe UPIA plugin installation when UPIA exists

Internet is required for package downloads and first-time model downloads.

Default runtime:

`%LOCALAPPDATA%\SrijonCaptioner\runtime\whisperx-venv`

Default model cache:

`%LOCALAPPDATA%\SrijonCaptioner\models`

## Existing WhisperX runtime

Run:

`setup/CONFIGURE_EXISTING_WHISPERX.bat`

This stores:

- `SRIJON_CAPTIONER_PYTHON`
- `SRIJON_CAPTIONER_MODEL_DIR`

Then run:

`setup/BUILD_CCX.bat --version 1.2.14`

`setup/CLEAN_REINSTALL_PLUGIN.bat`

## Adobe UPIA

Typical executable:

`C:\Program Files\Common Files\Adobe\Adobe Desktop Common\RemoteComponents\UPI\UnifiedPluginInstallerAgent\UnifiedPluginInstallerAgent.exe`

Install:

`UnifiedPluginInstallerAgent.exe /install "path\to\plugin.ccx"`

List:

`UnifiedPluginInstallerAgent.exe /list all`

Remove:

`UnifiedPluginInstallerAgent.exe /remove "Srijon Captioner"`

## First automatic server launch

The extension uses Adobe's process-launch permission to start the local WhisperX service. Premiere may show a one-time permission/consent prompt. Denying it prevents automatic server startup.

## Optional model preload

Run:

`setup/PRELOAD_LARGE_V3.bat`

Language-specific alignment resources can still be downloaded on first alignment for that language.
