@echo off
setlocal
set "VER=%~1"
if "%VER%"=="" set "VER=1.3.0"
call "%~dp0BUILD_CCX.bat" --version %VER% --name Srijon-Captioner-v%VER%-DevBuild.ccx
if errorlevel 1 exit /b %errorlevel%
set "UPIA=C:\Program Files\Common Files\Adobe\Adobe Desktop Common\RemoteComponents\UPI\UnifiedPluginInstallerAgent\UnifiedPluginInstallerAgent.exe"
if not exist "%UPIA%" (
  echo Adobe UPIA not found.
  pause
  exit /b 2
)
"%UPIA%" /remove "Srijon Captioner"
"%UPIA%" /install "%~dp0..\build\Srijon-Captioner-v%VER%-DevBuild.ccx"
if errorlevel 1 exit /b %errorlevel%
call "%~dp0INSTALL_STYLIZE_BRIDGE.bat"
"%UPIA%" /list all
pause
