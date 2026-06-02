# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-06-02

### Added
- **Search Bar:** Real-time filtering of history entries by keywords, summaries, and tags.
- **Enhanced Export:** Export all entries to human-readable **Markdown** or professional **PDF** formats.
- **Stats Dashboard:** Insightful analytics including writing velocity (WPM), streaks, and total word counts.
- **Auto-Save & Recovery:** Sessions are backed up every 30 seconds to prevent data loss from unexpected crashes.
- **Production Readiness:** Configured standard user data directories for cross-platform stability.
- **Build System:** Integrated `electron-builder` for easy packaging into distributable applications.

### Changed
- **UI Redesign:** Modernized the dashboard with a premium card-based layout and improved typography.
- **Data Storage:** Moved history and temporary files from the local repository to the system's standard application data folder.

### Fixed
- Prevented saving of empty writing sessions.
- Resolved UI overlap issues in the Stats screen.
