# Start Here

## New machine

Run:

`setup/SETUP_ALL_NEW_DEVICE.bat`

Then open Premiere Pro 26.2+ and use Srijon Captioner.

The first use of a large Whisper model can download several GB of model data. Alignment models can also download the first time a language is aligned.

## Existing WhisperX machine

Run:

`setup/CONFIGURE_EXISTING_WHISPERX.bat`

Then build and install:

`setup/BUILD_CCX.bat --version 1.2.14`

`setup/CLEAN_REINSTALL_PLUGIN.bat`

## Development handoff

Read in this order:

1. `AI_AGENT_HANDOFF.md`
2. `FEATURE_CONTRACT.md`
3. `ARCHITECTURE.md`
4. `WORD_JSON_SCHEMA.md`
5. `PROJECT_STATE.json`
6. `../source/premiere-plugin/index.js`
7. `../source/premiere-plugin/server.py`

After any code change, run `AI_AGENT_CHECKLIST.md` before packaging a release.
