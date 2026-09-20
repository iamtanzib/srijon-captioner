@echo off
setlocal
set "UPIA=C:\Program Files\Common Files\Adobe\Adobe Desktop Common\RemoteComponents\UPI\UnifiedPluginInstallerAgent\UnifiedPluginInstallerAgent.exe"
if not exist "%UPIA%" (
  echo Adobe UPIA was not found.
  echo See docs\INSTALLATION.md
  pause
  exit /b 2
)
set "CCX=%~dp0..\build\Srijon-Captioner-v1.2.14-Final.ccx"
if not exist "%CCX%" (
  echo Release package was not found:
  echo %CCX%
  echo Build it with setup\BUILD_CCX.bat --version 1.2.14 --name Srijon-Captioner-v1.2.14-Final.ccx
  pause
  exit /b 3
)
"%UPIA%" /install "%CCX%"
pause
