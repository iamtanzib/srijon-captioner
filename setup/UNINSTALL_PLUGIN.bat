@echo off
setlocal
set "UPIA=C:\Program Files\Common Files\Adobe\Adobe Desktop Common\RemoteComponents\UPI\UnifiedPluginInstallerAgent\UnifiedPluginInstallerAgent.exe"
if not exist "%UPIA%" (
  echo Adobe UPIA was not found.
  pause
  exit /b 2
)
"%UPIA%" /remove "Srijon Captioner"
pause
