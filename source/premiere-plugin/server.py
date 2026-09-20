from __future__ import annotations

import gc
import os
import sys
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

SERVER_VERSION = "1.2.14"

try:
    import whisperx
    WHISPERX_IMPORT_ERROR = None
except Exception as exc:  # pragma: no cover
    whisperx = None
    WHISPERX_IMPORT_ERROR = repr(exc)

try:
    import torch
except Exception:
    torch = None

app = FastAPI(title="Srijon Captioner WhisperX Server", version=SERVER_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_CACHE = {}
ALIGN_CACHE = {}
GPU_LOCK = threading.Lock()


@contextmanager
def exclusive_caption_job():
    """Reject concurrent transcription instead of silently queueing hours of work."""
    if not GPU_LOCK.acquire(blocking=False):
        raise HTTPException(
            status_code=409,
            detail="Another caption job is already running. Wait for it to finish before starting a new one.",
        )
    try:
        yield
    finally:
        GPU_LOCK.release()


class TranscribeRequest(BaseModel):
    path: str
    model: str = "large-v3"
    language: Optional[str] = None
    device: str = "cuda"
    compute_type: str = "float16"
    batch_size: int = Field(default=8, ge=1, le=128)
    align: bool = True
    model_dir: Optional[str] = Field(default_factory=lambda: os.getenv("WHISPERX_MODEL_DIR") or None)


def clear_cuda_cache():
    gc.collect()
    if torch is not None and torch.cuda.is_available():
        torch.cuda.empty_cache()


def get_model(req: TranscribeRequest):
    key = (req.model, req.device, req.compute_type, req.language, req.model_dir)
    if key not in MODEL_CACHE:
        kwargs = {
            "compute_type": req.compute_type,
            "language": req.language,
        }
        if req.model_dir:
            kwargs["download_root"] = req.model_dir
        MODEL_CACHE[key] = whisperx.load_model(req.model, req.device, **kwargs)
    return MODEL_CACHE[key]


def _load_align_model(language: str, device: str, model_dir: Optional[str]):
    """Load alignment model, preferring the user's model folder but also trying
    WhisperX/HuggingFace's normal cache. Their existing GUI may have placed the
    alignment model in the default cache rather than WHISPERX_MODEL_DIR.
    """
    attempts = []
    dirs_to_try = []
    if model_dir:
        dirs_to_try.append(model_dir)
    dirs_to_try.append(None)

    # preserve order while removing duplicates
    seen = set()
    dirs_to_try = [d for d in dirs_to_try if not (d in seen or seen.add(d))]

    for directory in dirs_to_try:
        key = (language, device, directory)
        if key in ALIGN_CACHE:
            model_a, metadata = ALIGN_CACHE[key]
            return model_a, metadata, directory or "default-cache"
        try:
            kwargs = {}
            if directory:
                kwargs["model_dir"] = directory
            model_a, metadata = whisperx.load_align_model(
                language_code=language,
                device=device,
                **kwargs,
            )
            ALIGN_CACHE[key] = (model_a, metadata)
            return model_a, metadata, directory or "default-cache"
        except Exception as exc:
            attempts.append(f"{directory or 'default-cache'}: {type(exc).__name__}: {exc}")

    raise RuntimeError("Could not load WhisperX alignment model. " + " | ".join(attempts))


def _run_alignment(segments, model_a, metadata, audio, device):
    """Use WhisperX forced alignment. `nearest` is WhisperX's CLI default for
    assigning timestamps to occasional unalignable words, while still deriving
    timing from the phoneme alignment rather than uniform segment interpolation.
    Compatibility retry supports older WhisperX builds without this kwarg.
    """
    try:
        return whisperx.align(
            segments,
            model_a,
            metadata,
            audio,
            device,
            interpolate_method="nearest",
            return_char_alignments=False,
        )
    except TypeError as exc:
        if "interpolate_method" not in str(exc):
            raise
        return whisperx.align(
            segments,
            model_a,
            metadata,
            audio,
            device,
            return_char_alignments=False,
        )


def extract_true_words(result):
    """Extract ONLY genuine timestamped words from WhisperX alignment output.

    IMPORTANT: Do not approximate words by evenly dividing a segment. That old
    fallback was the cause of badly drifting captions while still looking
    superficially plausible.
    """
    words = []

    # Newer/older WhisperX versions may expose a flattened word_segments list.
    for w in result.get("word_segments", []) or []:
        start = w.get("start")
        end = w.get("end")
        text = w.get("word", w.get("text", ""))
        if start is None or end is None or not str(text).strip():
            continue
        start = float(start)
        end = float(end)
        if end < start:
            continue
        words.append({
            "word": str(text).strip(),
            "start": start,
            "end": end,
            **({"score": float(w["score"])} if w.get("score") is not None else {}),
        })

    if not words:
        for seg in result.get("segments", []) or []:
            for w in seg.get("words", []) or []:
                start = w.get("start")
                end = w.get("end")
                text = w.get("word", w.get("text", ""))
                if start is None or end is None or not str(text).strip():
                    continue
                start = float(start)
                end = float(end)
                if end < start:
                    continue
                words.append({
                    "word": str(text).strip(),
                    "start": start,
                    "end": end,
                    **({"score": float(w["score"])} if w.get("score") is not None else {}),
                })

    # Keep deterministic chronological order. Tiny overlaps are valid in forced
    # alignment and are intentionally NOT "fixed" by shifting timestamps.
    words.sort(key=lambda w: (w["start"], w["end"]))
    return words


@app.get("/health")
def health():
    cuda = bool(torch is not None and torch.cuda.is_available())
    return {
        "ok": True,
        "server_version": SERVER_VERSION,
        "timing_mode": "forced-alignment-required",
        "concurrency_mode": "reject-while-busy",
        "whisperx": whisperx is not None,
        "whisperx_error": WHISPERX_IMPORT_ERROR,
        "cuda": cuda,
        "busy": GPU_LOCK.locked(),
        "cached_models": len(MODEL_CACHE),
        "cached_aligners": len(ALIGN_CACHE),
        "python": sys.executable,
        "model_dir": os.getenv("WHISPERX_MODEL_DIR") or None,
    }


@app.post("/transcribe")
def transcribe(req: TranscribeRequest):
    if whisperx is None:
        raise HTTPException(status_code=500, detail=f"WhisperX import failed: {WHISPERX_IMPORT_ERROR}")

    media = Path(os.path.expandvars(os.path.expanduser(req.path)))
    if not media.exists():
        raise HTTPException(status_code=404, detail=f"Media file does not exist: {media}")

    if req.device == "cuda" and torch is not None and not torch.cuda.is_available():
        raise HTTPException(status_code=400, detail="device=cuda was requested, but torch.cuda.is_available() is False.")

    # This extension is specifically built around real word-level timing. Do not
    # let users accidentally turn alignment off and receive fake timings.
    if not req.align:
        raise HTTPException(
            status_code=400,
            detail="Word alignment is required for timing-accurate captions. Keep Word alignment enabled.",
        )

    with exclusive_caption_job():
        try:
            model = get_model(req)
            audio = whisperx.load_audio(str(media))
            base_result = model.transcribe(audio, batch_size=req.batch_size)
            language = base_result.get("language") or req.language or "en"

            if not base_result.get("segments"):
                raise RuntimeError("WhisperX transcription returned no speech segments.")

            try:
                model_a, metadata, align_model_source = _load_align_model(
                    language, req.device, req.model_dir
                )
                result = _run_alignment(
                    base_result["segments"], model_a, metadata, audio, req.device
                )
                result["language"] = language
            except Exception as exc:
                # CRITICAL: never fall back to uniform segment interpolation.
                raise RuntimeError(
                    "Forced word alignment failed, so transcription was stopped instead of generating inaccurate captions. "
                    f"Alignment error: {type(exc).__name__}: {exc}"
                ) from exc

            words = extract_true_words(result)
            if not words:
                raise RuntimeError(
                    "Forced alignment completed but returned no timestamped words. "
                    "No approximate timings were generated."
                )

            # whisperx.load_audio() returns 16 kHz mono audio. Use the full media
            # duration for exported word-JSON metadata (not merely the last spoken word).
            speech_end = max((w["end"] for w in words), default=0.0)
            try:
                duration = float(len(audio)) / 16000.0
            except Exception:
                duration = speech_end
            return {
                "ok": True,
                "server_version": SERVER_VERSION,
                "file": str(media),
                "language": language,
                "aligned": True,
                "align_error": None,
                "alignment_model_source": align_model_source,
                "timing_source": "whisperx-forced-alignment",
                "duration": duration,
                "speech_end": speech_end,
                "words": words,
                "segments": result.get("segments", []),
            }
        except HTTPException:
            raise
        except Exception as exc:
            clear_cuda_cache()
            raise HTTPException(
                status_code=500,
                detail=f"Transcription failed: {type(exc).__name__}: {exc}",
            ) from exc


@app.post("/unload")
def unload():
    if GPU_LOCK.locked():
        raise HTTPException(status_code=409, detail="Cannot unload models while a caption job is running.")
    MODEL_CACHE.clear()
    ALIGN_CACHE.clear()
    clear_cuda_cache()
    return {"ok": True}


@app.post("/shutdown")
def shutdown():
    """Stop this local server after returning the HTTP response.

    The Premiere plugin calls this only when it launched the server itself.
    A manually-started server is deliberately left running.
    """
    if GPU_LOCK.locked():
        raise HTTPException(status_code=409, detail="Cannot shut down WhisperX while a caption job is running.")

    def _stop_process():
        import time
        time.sleep(0.30)
        try:
            MODEL_CACHE.clear()
            ALIGN_CACHE.clear()
            clear_cuda_cache()
        finally:
            os._exit(0)

    threading.Thread(target=_stop_process, daemon=True).start()
    return {"ok": True, "shutting_down": True}


if __name__ == "__main__":
    import uvicorn
    print(f"Srijon Captioner timing server v{SERVER_VERSION}: http://127.0.0.1:8765")
    print("Forced word alignment is REQUIRED. Approximate segment timing is disabled.")
    print("Keep this window open while using the Premiere panel.")
    uvicorn.run(app, host="127.0.0.1", port=8765, log_level="info")
