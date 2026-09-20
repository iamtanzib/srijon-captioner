# Dependencies and Version Snapshot

Prepared for v1.2.14.

## Host

- Windows 10/11
- Adobe Premiere Pro 26.2+
- UXP Manifest v5
- Adobe UPIA recommended for CCX install when Creative Cloud Desktop is unavailable/unreliable

## Python

- Python 3.12 for automated setup
- WhisperX 3.8.6
- Python >=3.10 and <3.14 for this known setup line

## PyTorch

Known setup pins:

- torch 2.8.0
- torchvision 0.23.0
- torchaudio 2.8.0
- CUDA 12.8 PyTorch index for NVIDIA setup
- CPU PyTorch index for non-NVIDIA setup

## Local API

- fastapi >=0.116,<1
- uvicorn[standard] >=0.35,<1
- pydantic >=2.11,<3

## Media

- FFmpeg installed when possible by the bootstrap script

Treat these as a reproducible project snapshot. Upgrade dependencies separately and regression-test forced alignment, media loading, CUDA and timing before adopting new pins.
