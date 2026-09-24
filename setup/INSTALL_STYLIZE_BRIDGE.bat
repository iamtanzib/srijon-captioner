@echo off
setlocal
set "SRC=%~dp0..\source\premiere-plugin\stylize-bridge"
set "DEST=%APPDATA%\Adobe\CEP\extensions\com.srijon.captioner.stylize.bridge"

echo Installing Srijon Captioner Stylize timeline helper...
if not exist "%SRC%\CSXS\manifest.xml" (
  echo ERROR: Missing source helper: %SRC%
  pause
  exit /b 2
)

if exist "%DEST%" rmdir /s /q "%DEST%"
mkdir "%DEST%" >nul 2>&1
xcopy "%SRC%\*" "%DEST%\" /E /I /H /Y >nul
if errorlevel 1 (
  echo ERROR: Could not install Stylize helper.
  pause
  exit /b 3
)

for %%V in (9 10 11 12 13 14 15) do (
  reg add "HKCU\Software\Adobe\CSXS.%%V" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
)

echo Installed Stylize helper:
echo %DEST%
echo Restart Premiere once before using Stylize.
