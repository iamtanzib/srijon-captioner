$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$RuntimeRoot = Join-Path $env:LOCALAPPDATA "SrijonCaptioner\runtime"
$Venv = Join-Path $RuntimeRoot "whisperx-venv"
$VenvPython = Join-Path $Venv "Scripts\python.exe"
$ModelDir = Join-Path $env:LOCALAPPDATA "SrijonCaptioner\models"
$BuildDir = Join-Path $Root "build"
$Upia = "C:\Program Files\Common Files\Adobe\Adobe Desktop Common\RemoteComponents\UPI\UnifiedPluginInstallerAgent\UnifiedPluginInstallerAgent.exe"

function Banner($text) {
  Write-Host ""
  Write-Host "============================================================" -ForegroundColor DarkGray
  Write-Host $text -ForegroundColor Cyan
  Write-Host "============================================================" -ForegroundColor DarkGray
}

function Run-Step([string]$label, [scriptblock]$body) {
  Write-Host ""
  Write-Host "[STEP] $label" -ForegroundColor Yellow
  & $body
}

function Find-Python312 {
  try {
    $p = (& py -3.12 -c "import sys; print(sys.executable)" 2>$null | Select-Object -First 1)
    if ($LASTEXITCODE -eq 0 -and $p -and (Test-Path $p.Trim())) { return $p.Trim() }
  } catch {}
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA "Programs\Python\Python312\python.exe"),
    "C:\Python312\python.exe",
    "C:\Program Files\Python312\python.exe"
  )
  foreach ($c in $candidates) { if (Test-Path $c) { return $c } }
  return $null
}

Banner "Srijon Captioner v1.2.14 - New Device Setup"
Write-Host "Runtime location: $RuntimeRoot"
Write-Host "Model cache:      $ModelDir"
Write-Host "This can download several GB (PyTorch + WhisperX; model downloads on first transcription)." -ForegroundColor DarkYellow

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  throw "WinGet was not found. Install/update 'App Installer' from Microsoft, then rerun setup."
}

Run-Step "Install / locate Python 3.12" {
  $script:Python312 = Find-Python312
  if (-not $script:Python312) {
    Write-Host "Python 3.12 not found. Installing with WinGet..."
    & winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements --silent
    if ($LASTEXITCODE -ne 0) { throw "Python 3.12 installation failed (winget exit $LASTEXITCODE)." }
    Start-Sleep -Seconds 2
    $script:Python312 = Find-Python312
  }
  if (-not $script:Python312) { throw "Python 3.12 installed but could not be located. Restart Windows and rerun setup." }
  Write-Host "Python: $script:Python312" -ForegroundColor Green
}

Run-Step "Install FFmpeg if missing" {
  if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    & winget install -e --id Gyan.FFmpeg --accept-package-agreements --accept-source-agreements --silent
    if ($LASTEXITCODE -ne 0) {
      Write-Warning "FFmpeg WinGet install failed. WhisperX may still work depending on its decoder stack, but install FFmpeg manually if media loading fails."
    }
    $WinGetLinks = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Links"
    if (Test-Path $WinGetLinks) { $env:Path = "$WinGetLinks;$env:Path" }
  } else {
    Write-Host "FFmpeg already available." -ForegroundColor Green
  }
}

Run-Step "Create isolated WhisperX virtual environment" {
  New-Item -ItemType Directory -Force -Path $RuntimeRoot, $ModelDir, $BuildDir | Out-Null
  if (-not (Test-Path $VenvPython)) {
    & $script:Python312 -m venv $Venv
    if ($LASTEXITCODE -ne 0) { throw "venv creation failed." }
  }
  & $VenvPython -m pip install --upgrade pip setuptools wheel
  if ($LASTEXITCODE -ne 0) { throw "pip bootstrap failed." }
  Write-Host "Venv: $Venv" -ForegroundColor Green
}

Run-Step "Install PyTorch runtime" {
  $HasNvidia = $null -ne (Get-Command nvidia-smi -ErrorAction SilentlyContinue)
  if ($HasNvidia) {
    Write-Host "NVIDIA GPU detected. Installing the CUDA 12.8 PyTorch 2.8 stack used by WhisperX 3.8.6." -ForegroundColor Green
    & $VenvPython -m pip install torch==2.8.0 torchvision==0.23.0 torchaudio==2.8.0 --index-url https://download.pytorch.org/whl/cu128
  } else {
    Write-Host "No NVIDIA GPU detected. Installing CPU PyTorch stack." -ForegroundColor DarkYellow
    & $VenvPython -m pip install torch==2.8.0 torchvision==0.23.0 torchaudio==2.8.0 --index-url https://download.pytorch.org/whl/cpu
  }
  if ($LASTEXITCODE -ne 0) { throw "PyTorch installation failed." }
}

Run-Step "Install WhisperX and local API dependencies" {
  & $VenvPython -m pip install whisperx==3.8.6 "fastapi>=0.116,<1" "uvicorn[standard]>=0.35,<1" "pydantic>=2.11,<3"
  if ($LASTEXITCODE -ne 0) { throw "WhisperX/server dependency installation failed." }
}

Run-Step "Write runtime config + build portable CCX" {
  & $VenvPython (Join-Path $Root "tools\write_runtime_config.py")
  if ($LASTEXITCODE -ne 0) { throw "Could not write runtime config." }
  & $VenvPython (Join-Path $Root "tools\build_ccx.py") --name "Srijon-Captioner-v1.2.14-Portable.ccx"
  if ($LASTEXITCODE -ne 0) { throw "CCX build failed." }
}

Run-Step "Verify WhisperX + local server" {
  & $VenvPython (Join-Path $Root "tools\verify_runtime.py")
  if ($LASTEXITCODE -ne 0) { throw "Runtime verification failed." }
}

Run-Step "Install Premiere plugin (when Adobe UPIA is available)" {
  $Ccx = Join-Path $BuildDir "Srijon-Captioner-v1.2.14-Portable.ccx"
  if (-not (Test-Path $Upia)) {
    Write-Warning "Adobe UPIA not found. Runtime is ready, but plugin was not installed automatically. See docs\INSTALLATION.md."
  } elseif (-not (Test-Path $Ccx)) {
    Write-Warning "Built CCX missing: $Ccx"
  } else {
    $list = (& $Upia /list all 2>&1 | Out-String)
    if ($list -match "Srijon Captioner") {
      Write-Host "An existing Srijon Captioner installation was found."
      $answer = Read-Host "Replace it with this portable v1.2.14 build? [y/N]"
      if ($answer -match '^[Yy]') {
        & $Upia /remove "Srijon Captioner"
        Start-Sleep -Seconds 1
      } else {
        Write-Host "Skipping plugin install; runtime setup is still complete." -ForegroundColor DarkYellow
        return
      }
    }
    & $Upia /install $Ccx
    if ($LASTEXITCODE -ne 0) {
      Write-Warning "UPIA plugin installation returned exit code $LASTEXITCODE. Runtime is still installed. See docs\TROUBLESHOOTING.md."
    } else {
      Write-Host "Premiere plugin installed." -ForegroundColor Green
    }
  }
}

Banner "Setup finished"
Write-Host "1. Open Premiere Pro 26.2+"
Write-Host "2. Window > UXP Plugins > Srijon Captioner"
Write-Host "3. Click Transcribe Active Sequence or Transcribe Media File"
Write-Host "4. First large-v3 run downloads model files into: $ModelDir"
Write-Host ""
Write-Host "NOTE: If CUDA is false, update the NVIDIA driver and see setup\INSTALL_CUDA_12_8_OPTIONAL.bat / docs\TROUBLESHOOTING.md." -ForegroundColor DarkYellow
