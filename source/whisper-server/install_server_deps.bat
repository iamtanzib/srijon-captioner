@echo off
setlocal
set "PYTHON=%LOCALAPPDATA%\SrijonCaptioner\runtime\whisperx-venv\Scripts\python.exe"
if defined SRIJON_CAPTIONER_PYTHON set "PYTHON=%SRIJON_CAPTIONER_PYTHON%"
if not exist "%PYTHON%" (
  echo Runtime missing: %PYTHON%
  echo Run setup\SETUP_ALL_NEW_DEVICE.bat first.
  pause
  exit /b 2
)
"%PYTHON%" -m pip install -r "%~dp0requirements.txt"
pause
