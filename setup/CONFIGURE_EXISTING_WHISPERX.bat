@echo off
setlocal
echo Configure Srijon Captioner to reuse an existing WhisperX environment.
echo Example Python: E:\path\whisperx-venv\Scripts\python.exe
echo.
set /p "PY=Full path to python.exe: "
if not exist "%PY%" (
  echo Python was not found at: %PY%
  pause
  exit /b 2
)
set /p "MODELS=Model folder path (press Enter for %%LOCALAPPDATA%%\SrijonCaptioner\models): "
if "%MODELS%"=="" set "MODELS=%LOCALAPPDATA%\SrijonCaptioner\models"
if not exist "%MODELS%" mkdir "%MODELS%"
setx SRIJON_CAPTIONER_PYTHON "%PY%" >nul
setx SRIJON_CAPTIONER_MODEL_DIR "%MODELS%" >nul
echo.
echo Saved user environment variables:
echo SRIJON_CAPTIONER_PYTHON=%PY%
echo SRIJON_CAPTIONER_MODEL_DIR=%MODELS%
echo.
echo Restart Premiere after installing/building the portable plugin.
pause
