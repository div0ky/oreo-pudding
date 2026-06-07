# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-06-07

### Added
- Added the `retrieve_all_calendar_events` MCP tool to retrieve events from all user calendars in a single request.
- Added the `move_calendar_event` MCP tool to reschedule events to a new start/end date-time.
- Implemented in-memory Stale-While-Revalidate (SWR) caching and metadata propagation for CalDAV calendars and events.
- Added America/Chicago and custom timezone normalization support for calendar events and tools.
- Added In-Memory SWR caching section to `ARCHITECTURE.md` to document the performance strategy.

### Fixed
- Isolated property parsing to the `VEVENT` block in the calendar deserializer to prevent timezone metadata overwrites.
- Fixed timezone normalization logic for local/floating iCal times.
- Fixed command registration for `UpdateCalendarEventCommand` handler and preserved class names in build minification to prevent mediator mapping failures.
- Fixed TypeScript compiler errors across all source files and test suites.
- Configured strict JSDoc/TSDoc checks and populated empty comments codebase-wide.

## [1.0.0] - 2026-06-07

### Added
- Initial release of the CalDAV MCP Server.
- Support for SSE/HTTP transport via `PORT` environment variable and Bun.serve.
- Standard Server-Sent Events (SSE) and CORS support for integrations.
- Apple ID CalDAV authentication aligned with Poke.com using HTTP Bearer headers.
- Automatic CalDAV calendar auto-discovery and `list_calendars` tool, making `calendarPath` optional.
- Automatic credential retrieval from environment variables (`APP_ID` and `APP_PASS`).
- Calendar event retrieval and update tools supporting location and URL fields.

[Unreleased]: https://github.com/div0ky/oreo-pudding/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/div0ky/oreo-pudding/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/div0ky/oreo-pudding/releases/tag/v1.0.0
