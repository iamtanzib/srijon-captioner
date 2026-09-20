# Contributing to Srijon Captioner

Thanks for helping improve the project. Caption timing and Premiere integration are sensitive, so focused changes with clear verification are preferred.

## Before changing code

Read, in order:

1. `docs/FEATURE_CONTRACT.md`
2. `docs/ARCHITECTURE.md`
3. `docs/AI_AGENT_HANDOFF.md`
4. `docs/AI_AGENT_CHECKLIST.md`

The feature contract is authoritative unless a proposed change explicitly updates it and explains the compatibility impact.

## Development workflow

1. Create a branch from `main`.
2. Make the smallest coherent change.
3. Keep both `server.py` copies byte-for-byte identical.
4. Run `setup\VALIDATE_PROJECT.bat`.
5. Build with `setup\BUILD_CCX.bat --version 1.2.14`.
6. Test the affected workflow inside Premiere Pro 26.2+.
7. Describe behavior, verification and regression risk in the pull request.

Do not commit CCX files, model caches, media, local runtimes, generated audio or machine-specific paths. Release packages belong in GitHub Releases.

## Non-negotiable invariants

- Word timing comes from WhisperX forced alignment; there is no approximation fallback.
- Gap `0` means the current caption ends exactly when the next caption begins.
- Single-line mode never emits an explicit line break.
- Rebuild uses the cached raw transcript and does not retranscribe.
- Raw Word JSON bypasses caption segmentation.
- Only one caption job may run at a time.
- An extension-owned server may be stopped; a pre-existing server must be left running.
- Existing delivery files are never overwritten.

## Issues and pull requests

Include Premiere version, Windows version, model/device/compute settings, reproducible steps, expected behavior, actual behavior and relevant logs. Remove private project paths or media names before posting screenshots or logs.
