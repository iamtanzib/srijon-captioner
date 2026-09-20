@echo off
setlocal
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Requesting Administrator permission...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0bootstrap.ps1"
set "RC=%errorlevel%"
echo.
if not "%RC%"=="0" (
  echo SETUP FAILED with exit code %RC%.
  echo Read docs\TROUBLESHOOTING.md for common fixes.
) else (
  echo SETUP COMPLETE.
)
echo.
pause
exit /b %RC%
