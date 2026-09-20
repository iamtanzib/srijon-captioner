@echo off
setlocal
set "PY=%LOCALAPPDATA%\SrijonCaptioner\runtime\whisperx-venv\Scripts\python.exe"
if defined SRIJON_CAPTIONER_PYTHON set "PY=%SRIJON_CAPTIONER_PYTHON%"
if not exist "%PY%" (
  echo Runtime not found: %PY%
  echo Run SETUP_ALL_NEW_DEVICE.bat or CONFIGURE_EXISTING_WHISPERX.bat first.
  pause
  exit /b 2
)
"%PY%" "%~dp0..\tools\verify_runtime.py"
pause
