# Feature Contract — Preserve Unless Explicitly Changed

## 1. Forced word alignment is mandatory

- WhisperX transcription must be followed by forced alignment.
- Never evenly distribute words across a segment as a fallback.
- If alignment fails, return an error.
- Word objects must use genuine numeric `start` and `end` timestamps.

## 2. Zero-gap caption timing

When `gapFrames = 0`:

- Caption N+1 begins at the aligned start of its first word.
- Caption N ends exactly at Caption N+1 start.
- Minimum duration may influence grouping, but must not push the next caption away from actual speech timing.

## 3. Strict single-line output

Single-line mode must not emit an explicit line break inside an SRT caption block.

## 4. Deterministic segmentation

No language model is required for caption grouping. Preserve deterministic rules based on:

- source punctuation
- measured pauses
- character limits
- line-count limit
- line balance
- awkward boundary penalties
- duration/readability constraints

## 5. Display punctuation is separate from boundary evidence

Removing punctuation from exported caption text must not remove the source punctuation used internally for segmentation decisions.

## 6. Smart capitalization

Smart capitalization should preserve useful casing such as:

- `I`, `I'm`, `I've`, etc.
- common acronyms such as `AI`, `BBC`, `USA`, `CEO`, `API`, `GPU`, `SRT`
- mixed-case names/brands when source evidence exists
- proper names when Whisper source casing provides evidence
- terms from the user-maintained Always Capitalize list

Do not apply German-style capitalization to ordinary English nouns.

## 7. Automatic server ownership

- If the extension launches the server for a job, it may stop that instance after the job.
- If the server was already running, leave it running.
- The server binds to `127.0.0.1:8765`.
- Only one transcription may run at a time. A competing request must fail with a
  busy conflict instead of waiting invisibly or sharing GPU/model state.
- Model unload and server shutdown must be rejected while transcription holds
  the server job lock.

## 8. Active-sequence transcription

The extension must be able to export active-sequence audio automatically through Premiere and then transcribe that exported file.

## 9. Caption presets

Caption presets are local persistent state. Loading a preset should restore the stored composer values and rebuild immediately when a raw transcript is already cached.

Storage key: `captioner.stylePresets.v1`.

## 10. Native SRT workflow

Smart Captions mode produces standard SRT and supports importing that SRT into Premiere.

For a saved Premiere project, the primary delivery action must save into
`Srijon Captioner Audio/Captions` beside the project, use a settings-aware,
non-overwriting revisioned filename, and import that exact file into the Project
panel. Keep the ordinary Save SRT picker as a separate fallback. Premiere UXP
does not currently expose a supported API for populating a native caption track,
so the user may still need to drag the imported SRT onto the timeline.

## 11. Word-Level JSON is raw aligned transcript data

Word-Level JSON mode must:

- bypass caption segmentation rules
- preserve source segment boundaries returned by WhisperX when available
- preserve per-word `word`, `start`, `end` and optional `score`
- use forced-aligned word timestamps directly
- include full source duration when the server can determine it
- use schema identifier `srijon-word-transcript-v1`

Changing character limits, gap frames, line count, punctuation display mode, capitalization display mode, or caption duration rules must not alter the raw Word-Level JSON timing data.

For a saved project, Word-Level JSON is stored in
`Srijon Captioner Audio/Word Data` with non-overwriting revisions.

## 12. Defensive UX and completion feedback

- A second caption job cannot start while one is already active.
- Actions that would mutate, clear, rebuild or export cached caption state must
  explain why they are unavailable during an active job.
- Rebuild with no raw transcript is a visible error, not a silent no-op.
- A job snapshots validated transcription settings before media selection/export.
- Optional completion feedback may fail independently; notification failure must
  never change a successful transcription into a failed job.
