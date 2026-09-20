# AI Agent Regression Checklist

Before shipping any modified CCX:

- [ ] Read `FEATURE_CONTRACT.md`.
- [ ] Run `setup/VALIDATE_PROJECT.bat`.
- [ ] Both server.py copies are identical.
- [ ] Manifest version was bumped.
- [ ] `/health` reports `forced-alignment-required`.
- [ ] Media-file transcription works.
- [ ] Active-sequence transcription works.
- [ ] Auto-started server stops after a job.
- [ ] Pre-existing server remains running after a job.
- [ ] Real aligned words have numeric start/end.
- [ ] No approximate word timing fallback exists.
- [ ] Gap 0 gives exact adjacent timing handoffs.
- [ ] Single-line SRT has no explicit newline inside caption text.
- [ ] Rebuild does not re-run WhisperX.
- [ ] Punctuation removal still uses original punctuation for segmentation.
- [ ] Smart capitalization preserves acronyms/important casing/custom terms.
- [ ] Caption presets persist and reload.
- [ ] Save SRT works.
- [ ] Save + Import SRT works.
- [ ] Word-Level JSON can be saved.
- [ ] Word-Level JSON can be copied.
- [ ] Word JSON schema id is `srijon-word-transcript-v1`.
- [ ] Word JSON timestamps are raw aligned timestamps, not caption timings.
- [ ] Word JSON full `duration` and server `speech_end` semantics are preserved.
- [ ] Build CCX successfully.
- [ ] Clean reinstall succeeds in Premiere 26.2+.
