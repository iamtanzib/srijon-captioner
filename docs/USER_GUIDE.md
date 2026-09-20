# Usage Guide

## Smart Captions

1. Open a Premiere project and active sequence, or choose a media file.
2. Start transcription.
3. The extension ensures the local WhisperX service is available, transcribes, force-aligns words, and caches the result.
4. Configure caption rules such as character length, duration, gap frames, line count, punctuation and capitalization.
5. Rebuild as many times as needed without re-running WhisperX.
6. Use Auto-save + Import to create a revisioned SRT beside the project and import it into Premiere, or use Save SRT/Copy for manual delivery.
7. Save frequently used caption settings as local presets.

## Active Sequence

The extension can automatically export sequence audio using a Waveform Audio export preset, wait for the audio file, then submit that file to the local WhisperX service.

When the project is saved, exported audio is normally written under a `Srijon Captioner Audio` folder near the Premiere project.

## Word-Level JSON

1. Select Word-Level JSON output mode.
2. Transcribe the sequence or media file.
3. Save or copy the generated JSON.
4. The JSON contains raw aligned segment data and word-level timestamps.

Caption formatting rules do not modify Word-Level JSON timing.

## Long jobs and safety

- Keep Premiere open while transcription runs; you can switch to another app.
- Only one caption job runs at a time. A second attempt reports the active job instead of queueing another GPU task.
- Caption settings are frozen during transcription and return to normal when the job ends.
- Rebuild requires an existing transcript. Export, copy, clear, preset and rebuild actions that could conflict are rejected while a job is active.
- Completion alert is enabled by default under Transcription settings. It plays the standard Windows information sound and shows a short popup after a successful job. Disable it there if preferred.

## Server lifecycle

Manual server startup is not normally required.

- If no server is running, a transcription task starts one automatically.
- If the extension started it, the extension shuts it down after the task.
- If a server was already running, it is left running.

## Offline behavior

Once Python packages, Whisper model files and alignment resources are cached locally, transcription can run without internet. Missing model/alignment resources require a network connection to download them.
