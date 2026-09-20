# Development Workflow

## Primary logic files

- `source/premiere-plugin/index.js`
- `source/premiere-plugin/server.py`
- `source/premiere-plugin/manifest.json`
- `source/whisper-server/server.py`

Keep both `server.py` copies synchronized.

## Build

Run:

`setup/BUILD_CCX.bat --version 1.2.14`

The build helper stages `source/premiere-plugin/`, optionally overrides the manifest version, then packages the staged files into a `.ccx` in `build/`.

The plugin files must be at the root of the CCX archive rather than nested under an additional directory.

## Validate before build

Run:

`setup/VALIDATE_PROJECT.bat`

This checks core project invariants and confirms both server copies match.

## Build and reinstall in one command

Run:

`setup/BUILD_AND_INSTALL.bat 1.2.14`

## Versioning

Always increase `manifest.json` for a newer user-facing build. Adobe UPIA can reject a downgrade with status `-418` when a newer build of the same plugin ID is installed.

## Testing the server without Premiere

Run:

`source/whisper-server/start_server.bat`

Then open:

`http://127.0.0.1:8765/health`

Or run:

`setup/VERIFY_SETUP.bat`

## Server changes

When changing the server response shape or endpoints, change the Premiere-side consumer in the same version and update `PROJECT_STATE.json` plus the relevant contract documentation.

## Safe future work examples

- preset import/export
- structured logging
- transcription progress reporting
- model/cache configuration
- generated audio cleanup policies
- additional machine-readable transcript export formats

## High-risk work

- timing changes
- segmentation algorithm changes
- WhisperX/PyTorch dependency upgrades
- server lifecycle/ownership changes
- active-sequence export changes
- modifications to Word-Level JSON timestamp semantics
