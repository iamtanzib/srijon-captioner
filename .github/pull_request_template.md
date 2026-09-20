## What changed

Describe the user-visible behavior and the reason for the change.

## Verification

- [ ] `python tools/validate_project.py`
- [ ] `node --check source/premiere-plugin/index.js`
- [ ] CCX builds successfully
- [ ] Affected workflow tested in Premiere Pro 26.2+
- [ ] Both `server.py` copies are identical

## Feature-contract impact

List affected invariants from `docs/FEATURE_CONTRACT.md`, or write “None”.

## Regression risk

Call out timing, transcription, server ownership, active-sequence export, revision naming, Word JSON or narrow-panel UI risks.
