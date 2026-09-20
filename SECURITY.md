# Security Policy

## Supported version

Security fixes are applied to the latest release line, currently `1.2.x`.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability or a report containing private media paths. Use GitHub's **Report a vulnerability** flow in the repository Security tab. Include the affected version, impact, reproduction steps and any suggested mitigation.

You should receive an acknowledgement within seven days. Please allow time to investigate and prepare a coordinated fix before public disclosure.

## Security model

Srijon Captioner processes media locally. Its FastAPI service binds to `127.0.0.1:8765`; it is not designed to accept remote network traffic. The extension needs filesystem and local process-launch access to export sequence audio, run the bundled service and save deliverables. Review `docs/SECURITY_AND_PRIVACY.md` for the full data-flow summary.
