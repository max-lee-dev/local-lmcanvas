# Changelog

All notable changes to `local-lmcanvas` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Removed

### Fixed

- Long-running command tool rows now expose `Keep running` while the command is still active, so a dev server can be restarted as a detached process before stopping the node.

## [0.1.0] — 2026-05-15

Initial public release.

### Added

- Canvas-based branching conversations powered by `@xyflow/react`.
- Multi-provider support: Claude Code, Codex, and Cursor agent CLIs.
- Local JSON storage under `~/.local-lmcanvas/` (one file per canvas, plus `settings.json`).
- Settings UI for system prompt, CLI binary path, and model selection.
- Keyboard shortcuts for submit (`⌘+Enter`), branch (`⌘+B`), and node deletion.
- Branching from highlighted text inside a response.
- Dark and light themes.
- Minimap for canvas navigation.

### Removed

- PostHog telemetry. The previous integration was placeholder-keyed and never active in distributed builds; it has been removed entirely to align with the "fully local, no cloud" positioning of the project. Any leftover `telemetryUuid` or `telemetryEnabled` fields in an existing `~/.local-lmcanvas/settings.json` are now ignored and harmless — you can leave them in place or delete them.

[Unreleased]: https://github.com/max-lee-dev/local-lmcanvas/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/max-lee-dev/local-lmcanvas/releases/tag/v0.1.0
