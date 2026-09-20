@echo off
setlocal
set "PYTHON=%LOCALAPPDATA%\SrijonCaptioner\runtime\whisperx-venv\Scripts\python.exe"
set "WHISPERX_MODEL_DIR=%LOCALAPPDATA%\SrijonCaptioner\models"
if defined SRIJON_CAPTIONER_PYTHON set "PYTHON=%SRIJON_CAPTIONER_PYTHON%"
if defined SRIJON_CAPTIONER_MODEL_DIR set "WHISPERX_MODEL_DIR=%SRIJON_CAPTIONER_MODEL_DIR%"
cd /d "%~dp0"
if not exist "%PYTHON%" (
  echo Runtime missing: %PYTHON%
  echo Run setup\SETUP_ALL_NEW_DEVICE.bat first.
  pause
  exit /b 2
)
set "WHISPERX_MODEL_DIR=%WHISPERX_MODEL_DIR%"
"%PYTHON%" server.py
pause
