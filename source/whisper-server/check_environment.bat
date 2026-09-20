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
"%PYTHON%" --version
"%PYTHON%" -c "import whisperx; print('WhisperX:', whisperx.__file__)"
"%PYTHON%" -c "import torch; print('Torch:', torch.__version__); print('CUDA available:', torch.cuda.is_available()); print('CUDA device:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU only')"
"%PYTHON%" -c "import fastapi, uvicorn, pydantic; print('FastAPI/uvicorn/pydantic OK')"
pause
