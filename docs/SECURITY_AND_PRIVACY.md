# Security and Privacy Notes

- Transcription is performed locally on the user's computer.
- The API service binds to loopback (`127.0.0.1`) rather than a public interface.
- Media paths are sent from the Premiere extension to that local service.
- Model/alignment downloads can require internet when assets are not already cached.
- The extension requires process-launch permission for automatic local server startup.
- Filesystem access is used for active-sequence audio export, export-preset discovery and generated files.
- Local settings/presets are stored on the user's machine.

Before public distribution, review Adobe packaging/signing requirements and third-party licenses.
