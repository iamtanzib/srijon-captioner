@echo off
setlocal
set "PY=%LOCALAPPDATA%\SrijonCaptioner\runtime\whisperx-venv\Scripts\python.exe"
if defined SRIJON_CAPTIONER_PYTHON set "PY=%SRIJON_CAPTIONER_PYTHON%"
if not exist "%PY%" (
  where py >nul 2>&1 && set "PY=py"
)
if "%PY%"=="py" (
  py -3.12 "%~dp0..\tools\build_ccx.py" %*
) else (
  "%PY%" "%~dp0..\tools\build_ccx.py" %*
)
pause
