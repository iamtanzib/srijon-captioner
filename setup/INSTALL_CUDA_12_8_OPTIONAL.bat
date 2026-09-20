@echo off
setlocal
net session >nul 2>&1
if %errorlevel% neq 0 (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
echo WhisperX upstream currently recommends CUDA Toolkit 12.8 for GPU use.
echo This is a large optional install. Your NVIDIA driver must also be compatible.
echo.
winget install -e --id Nvidia.CUDA --version 12.8 --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
  echo.
  echo WinGet could not install exactly CUDA 12.8.
  echo Use the official NVIDIA CUDA 12.8 installer instead, then rerun VERIFY_SETUP.bat.
)
pause
