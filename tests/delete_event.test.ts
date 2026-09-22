import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { DateRange } from "../src/domain/calendar/value-objects/DateRange";
import { EventDetails } from "../src/domain/calendar/value-objects/EventDetails";
import { EventId } from "../src/domain/calendar/value-objects/EventId";
import { CalendarPath } from "../src/domain/calendar/value-objects/CalendarPath";
import { AppleCredentials } from "../src/domain/calendar/value-objects/AppleCredentials";
import { CalendarEvent } from "../src/domain/calendar/CalendarEvent";
import { DeleteCalendarEventCommand } from "../src/application/calendar/commands/DeleteCalendarEventCommand";
import { DeleteCalendarEventCommandHandler } from "../src/application/calendar/commands/DeleteCalendarEventCommandHandler";
import type { ICalDavRepository } from "../src/domain/calendar/ICalDavRepository";
import { CalDavRepository } from "../src/infrastructure/calendar/repository/CalDavRepository";

describe("DeleteCalendarEventCommandHandler", () => {
  const originalAppId = process.env.APP_ID;
  const originalAppPass = process.env.APP_PASS;

  beforeEach(() => {
    process.env.APP_ID = "test@icloud.com";
    process.env.APP_PASS = "abcd-efgh-ijkl-mnop";
  });

  afterEach(() => {
    if (originalAppId === undefined) {
      delete process.env.APP_ID;
    } else {
      process.env.APP_ID = originalAppId;
    }
    if (originalAppPass === undefined) {
      delete process.env.APP_PASS;
    } else {
      process.env.APP_PASS = originalAppPass;
    }
  });

  function makeEvent(id: string): CalendarEvent {
    const range = new DateRange(
      new Date("2026-06-07T12:00:00Z"),
      new Date("2026-06-07T13:00:00Z")
    );
    return CalendarEvent.restore(new EventId(id), range, new EventDetails("Doomed Event"));
  }

  test("should delete from the explicit calendar path and return the event id", async () => {
    const event = makeEvent("event-123");
    let deletedEventId = "";
    let deletedPath = "";

    const mockRepo: ICalDavRepository = {
      async save() {},
      async delete(eventId, credentials, calendarPath) {
        deletedEventId = eventId;
        deletedPath = calendarPath.value;
      },
      async findById(eventId) {
        return eventId === "event-123" ? event : null;
      },
      async find() {
        return [];
      },
      async discoverCalendars() {
        return [{ name: "home", path: "calendars/home" }];
      },
      getDefaultCalendar(calendars) {
        const first = calendars[0];
        if (!first) throw new Error("No calendars");
        return first;
      }
    };

    const handler = new DeleteCalendarEventCommandHandler(mockRepo);
    const result = await handler.handle(
      new DeleteCalendarEventCommand("event-123", "calendars/home")
    );

    expect(result).toBe("event-123");
    expect(deletedEventId).toBe("event-123");
    expect(deletedPath).toBe("calendars/home");
  });

  test("should auto-discover the calendar holding the event when path is omitted", async () => {
    const event = makeEvent("search-event-123");
    let deletedPath = "";
    const searchedPaths: string[] = [];

    const mockRepo: ICalDavRepository = {
      async save() {},
      async delete(eventId, credentials, calendarPath) {
        deletedPath = calendarPath.value;
      },
      async findById(eventId, credentials, calendarPath) {
        searchedPaths.push(calendarPath.value);
        // Event lives only in the non-default calendar
        if (eventId === "search-event-123" && calendarPath.value === "calendars/work") {
          return event;
        }
        return null;
      },
      async find() {
        return [];
      },
      async discoverCalendars() {
        return [
          { name: "home", path: "calendars/home" },
          { name: "work", path: "calendars/work" }
        ];
      },
      getDefaultCalendar(calendars) {
        const first = calendars[0];
        if (!first) throw new Error("No calendars");
        return first;
      }
    };

    const handler = new DeleteCalendarEventCommandHandler(mockRepo);
    const result = await handler.handle(new DeleteCalendarEventCommand("search-event-123"));

    expect(result).toBe("search-event-123");
    expect(deletedPath).toBe("calendars/work");
    // Default calendar is tried first, then the remaining calendars are searched
    expect(searchedPaths[0]).toBe("calendars/home");
    expect(searchedPaths).toContain("calendars/work");
  });

  test("should throw when the event is not found in the explicit calendar path", async () => {
    const mockRepo: ICalDavRepository = {
      async save() {},
      async delete() {
        throw new Error("delete should not be called");
      },
      async findById() {
        return null;
      },
      async find() {
        return [];
      },
      async discoverCalendars() {
        return [{ name: "home", path: "calendars/home" }];
      },
      getDefaultCalendar(calendars) {
        const first = calendars[0];
        if (!first) throw new Error("No calendars");
        return first;
      }
    };

    const handler = new DeleteCalendarEventCommandHandler(mockRepo);
    expect(
      handler.handle(new DeleteCalendarEventCommand("missing-event", "calendars/home"))
    ).rejects.toThrow(
      "Calendar event with ID 'missing-event' not found in calendar path 'calendars/home'."
    );
  });

  test("should throw when the event is not found across any discovered calendar", async () => {
    const mockRepo: ICalDavRepository = {
      async save() {},
      async delete() {
        throw new Error("delete should not be called");
      },
      async findById() {
        return null;
      },
      async find() {
        return [];
      },
      async discoverCalendars() {
        return [
          { name: "home", path: "calendars/home" },
          { name: "work", path: "calendars/work" }
        ];
      },
      getDefaultCalendar(calendars) {
        const first = calendars[0];
        if (!first) throw new Error("No calendars");
        return first;
      }
    };

    const handler = new DeleteCalendarEventCommandHandler(mockRepo);
    expect(handler.handle(new DeleteCalendarEventCommand("ghost-event"))).rejects.toThrow(
      "Calendar event with ID 'ghost-event' not found across any discovered calendars."
    );
  });

  test("should throw when no calendars exist for the account", async () => {
    const mockRepo: ICalDavRepository = {
      async save() {},
      async delete() {
        throw new Error("delete should not be called");
      },
      async findById() {
        return null;
      },
      async find() {
        return [];
      },
      async discoverCalendars() {
        return [];
      },
      getDefaultCalendar() {
        throw new Error("No calendars");
      }
    };

    const handler = new DeleteCalendarEventCommandHandler(mockRepo);
    expect(handler.handle(new DeleteCalendarEventCommand("event-123"))).rejects.toThrow(
      "No calendars found for this iCloud account."
    );
  });
});

describe("CalDavRepository delete", () => {
  const credentials = new AppleCredentials("test@icloud.com", "abcd-efgh-ijkl-mnop");
  const calendarPath = new CalendarPath("calendars/home");

  test("delete should send an HTTP DELETE to the event resource URL", async () => {
    const repo = new CalDavRepository();
    const originalFetch = globalThis.fetch;

    let capturedUrl = "";
    let capturedMethod = "";
    let capturedAuth = "";

    globalThis.fetch = (async (url: any, init: any) => {
      capturedUrl = String(url);
      capturedMethod = init?.method;
      capturedAuth = (init?.headers as Headers).get("Authorization") ?? "";
      return new Response("", { status: 204 });
    }) as unknown as typeof fetch;

    try {
      await repo.delete("event-abc-123", credentials, calendarPath);
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(capturedMethod).toBe("DELETE");
    expect(capturedUrl).toBe("https://caldav.icloud.com/calendars/home/event-abc-123.ics");
    expect(capturedAuth).toBe(credentials.toBasicAuthHeader());
  });

  test("delete should throw a descriptive error when the server rejects the request", async () => {
    const repo = new CalDavRepository();
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async () => {
      return new Response("gone", { status: 404, statusText: "Not Found" });
    }) as unknown as typeof fetch;

    try {
      expect(repo.delete("missing-event", credentials, calendarPath)).rejects.toThrow(
        "CalDAV DELETE to 'https://caldav.icloud.com/calendars/home/missing-event.ics' failed with status 404"
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("delete should invalidate event caches matching user and path", async () => {
    const repo = new CalDavRepository();

    // Set up mock live implementations
    (repo as any).findLive = async () => [];
    (repo as any).findByIdLive = async () => null;
    (repo as any).deleteLive = async () => {};

    // Populates query and byId caches
    await repo.find(credentials, calendarPath);
    await repo.findById("event-123", credentials, calendarPath);

    const queryKey = `${credentials.appleId}:${calendarPath.value}:none:none`;
    const byIdKey = `${credentials.appleId}:${calendarPath.value}:event-123`;

    expect((repo as any).eventsQueryCache.has(queryKey)).toBe(true);
    expect((repo as any).eventsByIdCache.has(byIdKey)).toBe(true);

    // Call delete to trigger invalidation
    await repo.delete("event-123", credentials, calendarPath);

    // Caches should now be empty for that user & path
    expect((repo as any).eventsQueryCache.has(queryKey)).toBe(false);
    expect((repo as any).eventsByIdCache.has(byIdKey)).toBe(false);
  });
});

describe("delete_calendar_event MCP tool confirmation", () => {
  async function spawnStdioServer() {
    const proc = Bun.spawn(["bun", "run", "src/index.ts"], {
      stdout: "pipe",
      stdin: "pipe",
      stderr: "ignore"
    });

    const writer = proc.stdin;
    const reader = proc.stdout.getReader();
    let buffer = "";

    async function readMessage(): Promise<any> {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          throw new Error("Stdout stream closed before reading a full JSON-RPC message");
        }
        buffer += new TextDecoder().decode(value);
        const newlineIndex = buffer.indexOf("\n");
        if (newlineIndex !== -1) {
          const line = buffer.substring(0, newlineIndex);
          buffer = buffer.substring(newlineIndex + 1);
          return JSON.parse(line);
        }
      }
    }

    async function sendMessage(msg: Record<string, any>): Promise<void> {
      writer.write(JSON.stringify(msg) + "\n");
      await writer.flush();
    }

    return { proc, readMessage, sendMessage };
  }

  test("tools/list should expose delete_calendar_event as destructive", async () => {
    const { proc, readMessage, sendMessage } = await spawnStdioServer();

    try {
      await sendMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" }
        }
      });
      const initResponse = await readMessage();
      expect(initResponse.id).toBe(1);

      await sendMessage({ jsonrpc: "2.0", method: "notifications/initialized" });
      await sendMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" });
      const listResponse = await readMessage();

      const tools = listResponse.result.tools;
      const deleteTool = tools.find((t: any) => t.name === "delete_calendar_event");
      expect(deleteTool).toBeDefined();
      expect(deleteTool.annotations).toBeDefined();
      expect(deleteTool.annotations.destructiveHint).toBe(true);
      expect(deleteTool.annotations.readOnlyHint).toBe(false);
    } finally {
      proc.kill();
    }
  });

  test("should refuse deletion when the client does not support elicitation", async () => {
    const { proc, readMessage, sendMessage } = await spawnStdioServer();

    try {
      await sendMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" }
        }
      });
      await readMessage(); // initialize result
      await sendMessage({ jsonrpc: "2.0", method: "notifications/initialized" });

      await sendMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "delete_calendar_event",
          arguments: { eventId: "any-event-id" }
        }
      });
      const callResponse = await readMessage();

      expect(callResponse.id).toBe(2);
      expect(callResponse.result.isError).toBe(true);
      expect(callResponse.result.content[0].text).toContain("Deletion refused");
    } finally {
      proc.kill();
    }
  });

  test("should cancel deletion when the user declines confirmation", async () => {
    const { proc, readMessage, sendMessage } = await spawnStdioServer();

    try {
      await sendMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: { elicitation: { form: {} } },
          clientInfo: { name: "test-client", version: "1.0.0" }
        }
      });
      await readMessage(); // initialize result
      await sendMessage({ jsonrpc: "2.0", method: "notifications/initialized" });

      await sendMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "delete_calendar_event",
          arguments: { eventId: "declined-event-id" }
        }
      });

      // Server pauses the tool call to request confirmation
      const elicitationRequest = await readMessage();
      expect(elicitationRequest.method).toBe("elicitation/create");
      expect(elicitationRequest.params.message).toContain("declined-event-id");

      // User declines
      await sendMessage({
        jsonrpc: "2.0",
        id: elicitationRequest.id,
        result: { action: "decline" }
      });

      const callResponse = await readMessage();
      expect(callResponse.id).toBe(2);
      expect(callResponse.result.isError).toBe(true);
      expect(callResponse.result.content[0].text).toContain("Deletion cancelled");
      expect(callResponse.result.content[0].text).toContain("declined-event-id");
    } finally {
      proc.kill();
    }
  });
});
