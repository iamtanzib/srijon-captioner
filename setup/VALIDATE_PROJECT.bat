@echo off
setlocal
set "PY=%LOCALAPPDATA%\SrijonCaptioner\runtime\whisperx-venv\Scripts\python.exe"
if exist "%PY%" (
  "%PY%" "%~dp0..\tools\validate_project.py"
) else (
  py -3.12 "%~dp0..\tools\validate_project.py"
)
pause
