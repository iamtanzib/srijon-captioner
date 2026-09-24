@echo off
setlocal
set "SRC=%~dp0stylize-bridge"
set "DEST=%APPDATA%\Adobe\CEP\extensions\com.srijon.captioner.stylize.bridge"

echo.
echo Srijon Captioner - Stylize timeline helper
echo ===========================================
echo.

if not exist "%SRC%\CSXS\manifest.xml" (
  echo ERROR: Bundled Stylize Bridge files are missing.
  pause
  exit /b 2
)

if exist "%DEST%" rmdir /s /q "%DEST%"
mkdir "%DEST%" >nul 2>&1
xcopy "%SRC%\*" "%DEST%\" /E /I /H /Y >nul
if errorlevel 1 (
  echo ERROR: Could not copy the Stylize Bridge to:
  echo %DEST%
  pause
  exit /b 3
)

for %%V in (9 10 11 12 13 14 15) do (
  reg add "HKCU\Software\Adobe\CSXS.%%V" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
)

echo Installed:
echo %DEST%
echo.
echo Close Premiere completely and reopen it once.
echo After restart, Srijon Captioner's Stylize tab can create MOGRT captions.
echo.
pause
