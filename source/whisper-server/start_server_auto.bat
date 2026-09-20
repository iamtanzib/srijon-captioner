@echo off
setlocal
cd /d "%~dp0"
set "PYTHON=%LOCALAPPDATA%\SrijonCaptioner\runtime\whisperx-venv\Scripts\python.exe"
set "WHISPERX_MODEL_DIR=%LOCALAPPDATA%\SrijonCaptioner\models"
if defined SRIJON_CAPTIONER_PYTHON set "PYTHON=%SRIJON_CAPTIONER_PYTHON%"
if defined SRIJON_CAPTIONER_MODEL_DIR set "WHISPERX_MODEL_DIR=%SRIJON_CAPTIONER_MODEL_DIR%"
if not exist "%PYTHON%" (
  echo WhisperX runtime was not found:
  echo %PYTHON%
  echo Run setup\SETUP_ALL_NEW_DEVICE.bat from the developer kit.
  exit /b 2
)
start "Srijon Captioner WhisperX" /min "%PYTHON%" server.py
exit /b 0
