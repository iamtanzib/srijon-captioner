# Word-Level JSON Contract

Schema identifier:

`srijon-word-transcript-v1`

Reference file:

`examples/word-transcript-example.json`

## Shape

```json
{
  "schema": "srijon-word-transcript-v1",
  "language": "en",
  "duration": 15.42,
  "segments": [
    {
      "start": 0.24,
      "end": 5.22,
      "text": "If you're a marketer...",
      "words": [
        {
          "word": "If",
          "start": 0.24,
          "end": 0.32,
          "score": 0.84
        }
      ]
    }
  ]
}
```

## Top-level fields

- `schema` — fixed string `srijon-word-transcript-v1`
- `language` — detected/requested language when available; otherwise null
- `duration` — full source-media duration in seconds when available
- `segments` — aligned WhisperX segments

## Segment fields

- `start` — segment start in seconds
- `end` — segment end in seconds
- `text` — original segment text
- `words` — forced-aligned words belonging to the segment

## Word fields

- `word` — token text as returned from the aligned transcript
- `start` — genuine aligned word start in seconds
- `end` — genuine aligned word end in seconds
- `score` — alignment confidence when supplied by WhisperX; optional

## Invariants

- Word timestamps are never synthesized by evenly spacing words.
- Word-Level JSON does not use caption character limits, line count, gap frames, minimum duration, maximum duration, punctuation display transforms or capitalization display transforms.
- Segment text may retain punctuation/casing from WhisperX.
- If WhisperX does not expose usable original segment-word arrays, the extension may map the flattened aligned words back into the segment's time range, but those word timestamps must still be real forced-aligned values.
- If there are aligned words but no usable segment list, one fallback segment may be constructed from the aligned word range. This changes grouping only, not word timing.
