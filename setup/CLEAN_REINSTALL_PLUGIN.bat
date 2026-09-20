@echo off
setlocal
set "UPIA=C:\Program Files\Common Files\Adobe\Adobe Desktop Common\RemoteComponents\UPI\UnifiedPluginInstallerAgent\UnifiedPluginInstallerAgent.exe"
set "CCX=%~dp0..\build\Srijon-Captioner-v1.2.14-Final.ccx"
if not exist "%UPIA%" (
  echo Adobe UPIA was not found.
  pause
  exit /b 2
)
if not exist "%CCX%" (
  echo Release package was not found:
  echo %CCX%
  echo Build it with setup\BUILD_CCX.bat --version 1.2.14 --name Srijon-Captioner-v1.2.14-Final.ccx
  pause
  exit /b 3
)
echo Removing current Srijon Captioner (if installed)...
"%UPIA%" /remove "Srijon Captioner"
echo Installing: %CCX%
"%UPIA%" /install "%CCX%"
"%UPIA%" /list all
pause
