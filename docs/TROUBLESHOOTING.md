# Troubleshooting

## `/health` does not open

Expected URL:

`http://127.0.0.1:8765/health`

Run `setup/VERIFY_SETUP.bat`. If verification fails, inspect Python/WhisperX imports and port 8765 usage.

## Python 3.14 is being used

WhisperX should run in the dedicated Python 3.12 environment created by the setup script, or a separately configured compatible environment. Do not use an unrelated global Python 3.14 installation.

## `ModuleNotFoundError: whisperx` or `torch`

Run:

`setup/SETUP_ALL_NEW_DEVICE.bat`

or configure a known-working environment with:

`setup/CONFIGURE_EXISTING_WHISPERX.bat`

## CUDA is false

Check:

`nvidia-smi`

Then run `setup/VERIFY_SETUP.bat`. If the machine has a supported NVIDIA GPU but the runtime is CPU-only, reinstall the expected CUDA PyTorch stack or update the NVIDIA driver.

## First transcription is very slow

The ASR model and language-specific alignment model may be downloading/loading. Later jobs are normally faster if cached.

## Alignment fails

Do not add approximate timing as a workaround. Fix the alignment model/dependency/network/cache issue. The contract requires the job to fail rather than return fabricated word timing.

## Server starts but transcription fails to read media

Install/repair FFmpeg and rerun verification. Check that the media path still exists and is readable by the configured Python environment.

## Active-sequence export cannot find an audio preset

Choose a Premiere Waveform Audio `.epr` preset once. The extension stores the remembered preset path/token locally for later jobs.

## UPIA status `-418`

A newer build of the same plugin is installed.

Use:

`setup/CLEAN_REINSTALL_PLUGIN.bat`

or remove the installed Srijon Captioner with UPIA before installing the older build.

## Captions have correct words but wrong timing

Check `/health` and confirm:

`timing_mode = forced-alignment-required`

Transcribe again after fixing the server. Rebuilding an old cached transcript cannot repair bad original timestamps.

## Gap 0 still contains holes

Generate a fresh SRT and inspect adjacent entries. Caption N end should exactly equal Caption N+1 start. If it does not, confirm the current intended version is installed and investigate the zero-gap code path.

## Caption preset missing

Caption presets are local extension storage, not part of the Premiere project file. A different Windows account or cleared plugin storage will not contain the old presets.

## Word-Level JSON timestamps look segmented like captions

That is a bug. Word-Level JSON must bypass the caption composer. Compare the JSON word timestamps against `rawTranscript.words` and the server response.

## Word-Level JSON duration stops at last speech

Use server v1.2.5+. It calculates full duration from the loaded audio where possible and also returns `speech_end` separately.
