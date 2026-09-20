# Project Changelog Summary

## v1.2.14
- made the bundled hidden server launcher portable and removed its developer-machine path
- standardized fresh installs on `%LOCALAPPDATA%\SrijonCaptioner` with documented environment-variable overrides
- added public-repository documentation, contribution guidance, issue templates and automated validation
- preserved the complete v1.2.13 caption, timing, job-safety, delivery and completion-alert feature contract

## v1.0.x
- initial Premiere UXP extension + local WhisperX service
- media-file transcription
- SRT generation/import
- local network compatibility fixes

## v1.1.0
- deterministic smart caption composer based on character limits, pauses and duration

## v1.1.1
- host-compatibility fixes

## v1.1.2
- strict single-line SRT output
- seamless gap=0 handoffs

## v1.1.3
- forced alignment required
- removed approximate/uniform word timing fallback

## v1.1.4
- one-click active-sequence audio export/transcription
- Waveform Audio preset discovery/remembering

## v1.2.0
- punctuation output modes
- smart/source/lower/CAPS capitalization
- custom Always Capitalize terms

## v1.2.1
- automatic hidden WhisperX server startup/shutdown with ownership rules

## v1.2.4
- clearer active-state indication
- persistent local caption presets
- retained as previous stable release in `archive/`

## v1.2.5
- added separate Smart Captions / Word-Level JSON output modes
- Word-Level JSON schema: `srijon-word-transcript-v1`
- raw aligned segment/word export with optional confidence score
- full source-media duration returned by server when available
- server returns `speech_end` separately
- all v1.2.4 caption behavior retained

## v1.2.6
- rebuilt the docked Premiere panel UI from scratch with a dark, compact workflow
- standardized the accent color on `#0172FE`
- improved readability, responsive behavior, action hierarchy and status visibility
- preserved all v1.2.5 transcription, caption, preset, SRT and Word-Level JSON behavior

## v1.2.7
- replaced the stacked card layout with a two-column editor console at wider dock sizes
- added UXP-specific high-priority control styling so blue actions remain blue in Premiere
- replaced CSS grid and sticky status positioning with UXP-safe flex and normal-flow layouts
- added responsive single-column behavior for 300–520 px dock widths
- preserved all transcription, caption, preset, SRT and Word-Level JSON behavior

## v1.2.8
- replaced the cramped editor console with a single-column, Apple Settings-inspired dock workflow
- replaced every visible native HTML button with a custom UXP-safe action surface to prevent Premiere's gray button chrome
- removed label truncation from action controls and verified zero horizontal overflow at 570, 390 and 300 px widths
- added keyboard activation and disabled-state handling for the custom controls
- preserved all transcription, forced-alignment, caption, preset, SRT and Word-Level JSON behavior

## v1.2.9
- fixed docked-panel scrolling using an explicit full-height inner viewport with `overflow-y: scroll`
- reinforced viewport sizing from the Premiere UXP panel `show(rootNode)` lifecycle hook
- added a scrolling regression check and verified wheel movement at a 584 × 580 px dock size
- preserved the v1.2.8 visual design and all transcription/export behavior

## v1.2.10
- prevented UXP number inputs from silently changing while the user scrolls the panel
- made custom actions commit the currently focused field before running
- recomposed captions from cached aligned words immediately before SRT save/copy
- added a final canonical zero-gap timing pass and export-time timing/single-line assertions
- revalidated forced alignment, server ownership, active-sequence artifacts, presets, SRT and raw Word JSON behavior

## v1.2.11
- moved the live activity/status strip to the top of the docked workflow so progress is visible immediately
- replaced unreliable native details/summary accordions with explicit UXP-safe disclosure controls
- added perceptible server-test progress plus clear healthy, offline, missing-WhisperX and outdated-server results
- moved Rebuild beside Timing and density and added clear feedback for refresh, cancellation and unavailable actions
- added pressed/expanded accessibility state to segmented and disclosure controls
- revalidated the complete v1.2.5 feature contract, zero-gap SRT timing, Word JSON preservation, presets and narrow-panel interactions

## v1.2.12
- changed the primary caption delivery action to automatically save beside the Premiere project and import the SRT into the Project panel
- added predictable `Srijon Captioner Audio/Captions` and `Srijon Captioner Audio/Word Data` output folders
- added readable settings-aware filenames with stable configuration hashes and non-overwriting `r001`, `r002`, … revisions
- retained Save SRT, Copy SRT and unsaved-project picker fallbacks
- documented the UXP limitation that imported SRTs still need to be dragged onto the timeline to create a native caption track
- regression-tested five repeated exports, a changed-settings branch, Project-panel imports, raw Word JSON timing and zero-gap SRT handoffs

## v1.2.13
- added a panel-level caption-job mutex so duplicate clicks report a clear error instead of starting overlapping work
- added a server-level non-queuing GPU lock with HTTP 409 conflicts, protecting against panel reloads and other clients
- exposed server busy state through `/health` and blocked model unload/server shutdown during active transcription
- added explicit errors for rebuild-without-transcript and for rebuild, export, copy, clear, preset, mode and refresh actions attempted during a job
- froze native transcription/caption fields for the duration of a job and snapshot-validated forced alignment and CPU compute settings
- added an optional completion alert setting backed by a bundled Windows popup and standard information sound
- restored the final success message after extension-owned server cleanup and clarified long-job background use
- regression-tested guard behavior, notification launch, narrow-panel layout, prior export revisioning and core feature preservation
