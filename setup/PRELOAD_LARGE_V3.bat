@echo off
setlocal
set "PY=%LOCALAPPDATA%\SrijonCaptioner\runtime\whisperx-venv\Scripts\python.exe"
set "MODELS=%LOCALAPPDATA%\SrijonCaptioner\models"
if defined SRIJON_CAPTIONER_PYTHON set "PY=%SRIJON_CAPTIONER_PYTHON%"
if defined SRIJON_CAPTIONER_MODEL_DIR set "MODELS=%SRIJON_CAPTIONER_MODEL_DIR%"
if not exist "%PY%" (
  echo Runtime missing: %PY%
  echo Run SETUP_ALL_NEW_DEVICE.bat first.
  pause
  exit /b 2
)
if not exist "%MODELS%" mkdir "%MODELS%"
echo This will download/load the large-v3 model and can use several GB of disk/network.
echo Alignment models are language-specific and may still download on first transcription.
"%PY%" -c "import whisperx,torch,gc; d='cuda' if torch.cuda.is_available() else 'cpu'; c='float16' if d=='cuda' else 'int8'; print('device=',d,'compute=',c); m=whisperx.load_model('large-v3',d,compute_type=c,download_root=r'%MODELS%'); print('large-v3 ready'); del m; gc.collect(); torch.cuda.empty_cache() if torch.cuda.is_available() else None"
pause
