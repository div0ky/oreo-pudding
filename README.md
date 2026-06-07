# 🍮 Oreo Pudding: Apple Calendar CalDAV MCP Server

[![Model Context Protocol](https://img.shields.io/badge/MCP-1.29.0-blue.svg)](https://modelcontextprotocol.io/)
[![Runtime](https://img.shields.io/badge/runtime-Bun-black.svg?logo=bun)](https://bun.sh/)
[![Architecture](https://img.shields.io/badge/Architecture-DDD--CQRS--GoF-purple.svg)](#architecture-overview)

An enterprise-grade Model Context Protocol (MCP) server built with **Bun** that connects LLM clients (such as Claude Desktop and **Poke** at [poke.com](https://poke.com)) to Apple Calendar (iCloud) via CalDAV. Designed with strict Domain-Driven Design (DDD), CQRS, and Gang of Four (GoF) design patterns.

---

## 🚀 Key Features

*   **⚡ Native CalDAV Protocol Sync**: Full support for listing calendars, retrieving events, creating, moving/rescheduling, and updating events directly on Apple iCloud servers.
*   **📍 Auto-Discovery & Intelligent Routing**: Automatically resolves iCloud user principals, calendar-home-sets, and lists calendars under the hood. For commands missing a calendar path, it employs an intelligent scoring heuristic to automatically pick the most suitable default calendar (e.g., scoring `Home` or `Personal` highest).
*   **⏰ Timezone-Aware Parser**: Native handling of timezone normalizations. Defaults to `America/Chicago` (configurable). Correctly parses floating/local ISO-8601 datetimes without timezone indicators inside the context of the target IANA timezone using [TimeZoneHelper](file:///Users/ajspurlock/git/wizards/oreo-pudding/src/application/utils/TimeZoneHelper.ts), preventing incorrect offset shifts.
*   **💨 Stale-While-Revalidate (SWR) Cache**: Low-latency responses utilizing in-memory SWR caching for both calendar lists (48h TTL) and events (5m TTL) inside [CalDavRepository](file:///Users/ajspurlock/git/wizards/oreo-pudding/src/infrastructure/calendar/repository/CalDavRepository.ts). Spawns asynchronous background fetches on cache hits to guarantee fresh data without blocking execution.
*   **🔌 Dual Transport Mode**: Supports both standard I/O streams (`stdio`) for local integration and Web Standard HTTP SSE (`text/event-stream`) for remote/network hosting.
*   **🖥️ Embedded Interactive Testing Dashboard**: Built-in modern glassmorphic Vue 3 testing dashboard served on `/dashboard` (when running in SSE mode). Includes a live JSON-RPC logger to inspect commands and events in real time.
*   **🛡️ Bearer Token Authorization**: Option to secure the SSE server using static Bearer token authorization headers.

---

## 🛠️ Architecture Overview

The codebase is built on clean architectural principles, enforcing a strict inward dependency flow:
`Interface` ➔ `Application` ➔ `Infrastructure` ➔ `Domain`

For a deep dive into the patterns used, check out the [Architecture Documentation](file:///Users/ajspurlock/git/wizards/oreo-pudding/ARCHITECTURE.md).

### Design Patterns Utilized
*   **DDD (Domain-Driven Design)**: Pure domain entity layers with strict invariants (`Tool`, `ToolId`, `ToolName`, `ToolDescription`, `ToolSchema`).
*   **CQRS**: Isolation of state-mutating commands (e.g., `CreateCalendarEventCommand`, `MoveCalendarEventCommand`) from read-only queries (e.g., `RetrieveCalendarEventsQuery`, `ListCalendarsQuery`).
*   **Mediator**: Dispatching of CQRS messages via a decoupled Mediator bus using [Mediator](file:///Users/ajspurlock/git/wizards/oreo-pudding/src/application/mediator/Mediator.ts).
*   **Strategy**: Abstract tool strategy executors allowing customizable behavior per registered tool.
*   **Observer (Domain Events)**: Broadcast of domain lifecycle occurrences (e.g., event saved, event moved) through an asynchronous event dispatcher.
*   **Decorator**: Logging, performance timing, and schema validation cleanly wrapped around use-case handlers.

---

## ⚙️ Environment Configuration

Create a `.env` file in the root directory (Bun loads this automatically):

```env
# iCloud credentials
APP_ID="your-apple-id@icloud.com"
APP_PASS="xxxx-xxxx-xxxx-xxxx" # iCloud App-Specific Password

# Optional: Server configuration for SSE mode
PORT=3000
BEARER_TOKEN="your-secure-bearer-token"
```

> [!IMPORTANT]
> **iCloud Credentials**: For security reasons, you **must not** use your primary iCloud password. You must generate an **App-Specific Password** from your Apple ID account page:
> 1. Go to [appleid.apple.com](https://appleid.apple.com) and sign in.
> 2. In the **Sign-In and Security** section, select **App-Specific Passwords**.
> 3. Click **Generate an app-specific password** and follow the instructions.
> 4. Copy the generated password (formatted as `xxxx-xxxx-xxxx-xxxx`) and paste it as `APP_PASS`.

---

## 📦 Installation & Running

Ensure you have [Bun](https://bun.sh/) installed.

### 1. Install Dependencies
```bash
bun install
```

### 2. Run in Standard I/O (stdio) Mode (Default)
This mode is ideal for local integrations (e.g., Claude Desktop):
```bash
bun run index.ts
```

### 3. Run in SSE (Server-Sent Events) Mode
Starts an HTTP server on the designated `PORT`:
```bash
PORT=3000 bun run index.ts
```

---

## 🖥️ Interactive Testing Dashboard

When running in **SSE Mode**, you can access the visual testing dashboard.

1. Start the server:
   ```bash
   PORT=3000 bun run index.ts
   ```
2. Open your browser and navigate to `http://localhost:3000/dashboard` (or `http://localhost:3000/dashboard.html`).
3. Set your **Authorization Header** using your `BEARER_TOKEN` (if configured) or connect directly.
4. Interact with the server: list calendars, view event timelines, create new events, and view live JSON-RPC request/response payload logs in the terminal console.

---

## 🛠️ Available MCP Tools

The server exposes the following tools to MCP-compatible client applications (configured in [index.ts](file:///Users/ajspurlock/git/wizards/oreo-pudding/src/index.ts)):

### 1. `list_calendars`
Lists all available calendars for the authenticated iCloud account.
*   **Arguments**: None

### 2. `retrieve_calendar_events`
Retrieves events from the primary/default calendar within a specified date range.
*   **Arguments**:
    *   `startDate` (string, optional): Start datetime in ISO 8601 format. If omitted, defaults to the start of the current day.
    *   `endDate` (string, optional): End datetime in ISO 8601 format. If omitted, defaults to 24 hours from `startDate`.
    *   `timezone` (string, optional): IANA timezone identifier (e.g., `America/Chicago`). Output datetimes will be formatted in this timezone.

### 3. `retrieve_all_calendar_events`
Retrieves events across all calendars for the account in a single query.
*   **Arguments**:
    *   `startDate` (string, optional): ISO 8601 start date.
    *   `endDate` (string, optional): ISO 8601 end date.
    *   `omit` (array of strings, optional): Calendar names or paths to exclude from retrieval.
    *   `timezone` (string, optional): IANA timezone identifier.

### 4. `create_calendar_event`
Creates a new event on your calendar.
*   **Arguments**:
    *   `title` (string, required): Title of the event.
    *   `startDate` (string, required): ISO 8601 start date/time (e.g., `2026-06-07T15:00:00`).
    *   `endDate` (string, required): ISO 8601 end date/time.
    *   `description` (string, optional): Description or notes.
    *   `location` (string, optional): Location name.
    *   `url` (string, optional): URL linked to the event.
    *   `timezone` (string, optional): IANA timezone identifier. Defaults to `America/Chicago`. Used to parse inputs if they lack offsets.

### 5. `update_calendar_event`
Updates fields on an existing event.
*   **Arguments**:
    *   `eventId` (string, required): The unique event ID (UID).
    *   `title` (string, optional): New title.
    *   `description` (string, optional): New description.
    *   `location` (string, optional): New location.
    *   `url` (string, optional): New URL.
    *   `startDate` (string, optional): New ISO 8601 start date/time.
    *   `endDate` (string, optional): New ISO 8601 end date/time.
    *   `timezone` (string, optional): Target timezone.

### 6. `move_calendar_event`
Quickly reschedules an existing event to a new start date/time (optionally keeping the same duration).
*   **Arguments**:
    *   `eventId` (string, required): The unique event ID (UID).
    *   `startDate` (string, required): New ISO 8601 start date/time.
    *   `endDate` (string, optional): New ISO 8601 end date/time. If omitted, the event's original duration is preserved.
    *   `calendarPath` (string, optional): The calendar path where the event is located. If omitted, the server will auto-discover the correct calendar.
    *   `timezone` (string, optional): Target timezone.

---

## 🤖 Claude Desktop Integration

To add this server to the Claude Desktop App, edit your configuration file:

*   **Mac**: `~/Library/Application Support/Claude/claude_desktop_config.json`
*   **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add the following configuration block under `mcpServers`:

```json
{
  "mcpServers": {
    "apple-calendar": {
      "command": "bun",
      "args": [
        "run",
        "/absolute/path/to/oreo-pudding/src/index.ts"
      ],
      "env": {
        "APP_ID": "your-apple-id@icloud.com",
        "APP_PASS": "xxxx-xxxx-xxxx-xxxx"
      }
    }
  }
}
```

Make sure to replace `/absolute/path/to/oreo-pudding` with the actual path to this repository on your machine.

---

## 🌐 Poke Integration (poke.com)

This server is designed to work seamlessly with **Poke** (available at [poke.com](https://poke.com)).

To integrate with Poke:
1. Run the server in SSE mode on a publicly accessible URL or expose it using a port forwarding/tunneling service (e.g., ngrok):
   ```bash
   PORT=3000 bun run index.ts
   ```
2. Ensure you have set the `BEARER_TOKEN` in your `.env` file to secure the endpoint.
3. In Poke's MCP configuration, add a new SSE connection and supply your server's `/sse` endpoint URL (e.g., `https://your-deployed-domain.com/sse` or `http://localhost:3000/sse`).
4. Provide the `BEARER_TOKEN` as a `Bearer <token>` inside Poke's connection Authorization headers.

---

## 🧪 Development & Quality Assurance

### Linting
We enforce clean styling rules using ESLint with strict JSDoc/TSDoc validation:
```bash
# Run lint check
bun run lint

# Auto-fix linting issues
bun run lint:fix
```

### Testing
We use Bun's native test runner. Tests are written under `tests/` and cover event serialization, timezone parsing, CalDAV operations, and Mediator routing:
```bash
bun test
```

### Extending the Server
When adding new features or tools, please follow the guidelines specified in the [Developer & Agent Guidelines](file:///Users/ajspurlock/git/wizards/oreo-pudding/AGENTS.md) to maintain the integrity of our DDD and CQRS architecture.
