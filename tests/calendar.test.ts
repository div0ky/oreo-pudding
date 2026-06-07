import { test, expect, describe, mock } from "bun:test";
import { AppleCredentials } from "../src/domain/calendar/value-objects/AppleCredentials";
import { DateRange } from "../src/domain/calendar/value-objects/DateRange";
import { EventDetails } from "../src/domain/calendar/value-objects/EventDetails";
import { EventId } from "../src/domain/calendar/value-objects/EventId";
import { CalendarPath } from "../src/domain/calendar/value-objects/CalendarPath";
import { CalendarEvent } from "../src/domain/calendar/CalendarEvent";
import { InvalidDateRangeException } from "../src/domain/calendar/exceptions/InvalidDateRangeException";
import { ICalSerializationStrategy } from "../src/infrastructure/calendar/serialization/ICalSerializationStrategy";
import { CreateCalendarEventCommand } from "../src/application/calendar/commands/CreateCalendarEventCommand";
import { CreateCalendarEventCommandHandler } from "../src/application/calendar/commands/CreateCalendarEventCommandHandler";
import type { ICalDavRepository } from "../src/domain/calendar/ICalDavRepository";

describe("Domain Layer Value Objects", () => {
  describe("AppleCredentials", () => {
    test("should successfully validate valid credentials", () => {
      const creds = new AppleCredentials("test@icloud.com", "abcd-efgh-ijkl-mnop");
      expect(creds.appleId).toBe("test@icloud.com");
      expect(creds.appSpecificPassword).toBe("abcd-efgh-ijkl-mnop");
    });

    test("should throw on invalid email address format", () => {
      expect(() => new AppleCredentials("invalidemail", "abcd-efgh-ijkl-mnop")).toThrow(
        "Invalid Apple ID format"
      );
      expect(() => new AppleCredentials("", "abcd-efgh-ijkl-mnop")).toThrow(
        "Apple ID cannot be empty"
      );
    });

    test("should throw on invalid app-specific password format", () => {
      expect(() => new AppleCredentials("test@icloud.com", "invalidpassword")).toThrow(
        "Invalid App-Specific Password format"
      );
      expect(() => new AppleCredentials("test@icloud.com", "abcd-efgh-ijkl")).toThrow(
        "Invalid App-Specific Password format"
      );
      expect(() => new AppleCredentials("test@icloud.com", "")).toThrow(
        "App-Specific Password cannot be empty"
      );
    });

    test("should generate correct Base64 Basic Authentication header", () => {
      const creds = new AppleCredentials("test@icloud.com", "abcd-efgh-ijkl-mnop");
      const header = creds.toBasicAuthHeader();
      expect(header).toBe(`Basic ${btoa("test@icloud.com:abcd-efgh-ijkl-mnop")}`);
    });
  });

  describe("DateRange", () => {
    test("should validate chronological dates", () => {
      const start = new Date("2026-06-07T12:00:00Z");
      const end = new Date("2026-06-07T13:00:00Z");
      const range = new DateRange(start, end);

      expect(range.startDate.getTime()).toBe(start.getTime());
      expect(range.endDate.getTime()).toBe(end.getTime());
    });

    test("should throw InvalidDateRangeException if end date is equal to start date", () => {
      const date = new Date("2026-06-07T12:00:00Z");
      expect(() => new DateRange(date, date)).toThrow(InvalidDateRangeException);
    });

    test("should throw InvalidDateRangeException if end date is before start date", () => {
      const start = new Date("2026-06-07T13:00:00Z");
      const end = new Date("2026-06-07T12:00:00Z");
      expect(() => new DateRange(start, end)).toThrow(InvalidDateRangeException);
    });

    test("should return cloned dates to ensure immutability", () => {
      const start = new Date("2026-06-07T12:00:00Z");
      const end = new Date("2026-06-07T13:00:00Z");
      const range = new DateRange(start, end);

      range.startDate.setFullYear(2020);
      expect(range.startDate.getFullYear()).toBe(2026); // Should not have changed internal value
    });
  });

  describe("EventDetails", () => {
    test("should validate non-empty titles", () => {
      const details = new EventDetails("My Title", "My Description");
      expect(details.title).toBe("My Title");
      expect(details.description).toBe("My Description");
    });

    test("should trim details", () => {
      const details = new EventDetails("   My Title   ", "   My Description   ");
      expect(details.title).toBe("My Title");
      expect(details.description).toBe("My Description");
    });

    test("should throw if title is empty or spaces", () => {
      expect(() => new EventDetails("")).toThrow("Calendar event title cannot be empty");
      expect(() => new EventDetails("    ")).toThrow("Calendar event title cannot be empty");
    });
  });

  describe("EventId & CalendarPath", () => {
    test("EventId should require non-empty value", () => {
      expect(new EventId("id-123").value).toBe("id-123");
      expect(() => new EventId("")).toThrow("Calendar Event ID value cannot be empty");
    });

    test("CalendarPath should require non-empty value", () => {
      expect(new CalendarPath("path/to/cal").value).toBe("path/to/cal");
      expect(() => new CalendarPath("")).toThrow("Calendar path cannot be empty");
    });
  });
});

describe("Domain Layer Aggregate Root", () => {
  test("CalendarEvent should create successfully with factory", () => {
    const range = new DateRange(
      new Date("2026-06-07T12:00:00Z"),
      new Date("2026-06-07T13:00:00Z")
    );
    const details = new EventDetails("Meeting");
    const event = CalendarEvent.create(range, details);

    expect(event.id).toBeDefined();
    expect(event.id.value).toMatch(/^[a-f0-9-]{36}$/); // should generate uuid
    expect(event.dateRange).toBe(range);
    expect(event.details).toBe(details);
  });
});

describe("Infrastructure Layer Serialization Strategy", () => {
  test("ICalSerializationStrategy should output strict iCalendar string conforming to CalDAV", () => {
    const range = new DateRange(
      new Date("2026-06-07T12:00:00Z"),
      new Date("2026-06-07T13:00:00Z")
    );
    const details = new EventDetails("Standup \\ meeting,", "Discussing sprint; items\nNext lines");
    const event = CalendarEvent.create(range, details);

    const strategy = new ICalSerializationStrategy();
    const payload = strategy.serialize(event);

    // Verify UTC dates (YYYYMMDDTHHMMSSZ format)
    expect(payload).toContain("DTSTART:20260607T120000Z");
    expect(payload).toContain("DTEND:20260607T130000Z");
    expect(payload).toContain(`UID:${event.id.value}`);

    // Verify escaped fields (backslash, comma, semicolon, newline escaped)
    expect(payload).toContain("SUMMARY:Standup \\\\ meeting\\,");
    expect(payload).toContain("DESCRIPTION:Discussing sprint\\; items\\nNext lines");

    // Verify standard headers and trailers
    expect(payload).toContain("BEGIN:VCALENDAR");
    expect(payload).toContain("VERSION:2.0");
    expect(payload).toContain("BEGIN:VEVENT");
    expect(payload).toContain("END:VEVENT");
    expect(payload).toContain("END:VCALENDAR");

    // Verify CRLF (\r\n) line endings
    expect(payload.endsWith("\r\n")).toBe(true);
    const lines = payload.split("\r\n");
    expect(lines.length).toBeGreaterThan(5);
  });
});

describe("Application Layer CQRS Command Pipeline", () => {
  test("CommandHandler should orchestrate instantiation, validation, serialization, and save", async () => {
    let savedEvent: CalendarEvent | null = null;
    let savedPayload: string | null = null;
    let savedCredentials: AppleCredentials | null = null;
    let savedPath: CalendarPath | null = null;

    const mockRepo: ICalDavRepository = {
      async save(event, payload, credentials, calendarPath) {
        savedEvent = event;
        savedPayload = payload;
        savedCredentials = credentials;
        savedPath = calendarPath;
      }
    };

    const strategy = new ICalSerializationStrategy();
    const handler = new CreateCalendarEventCommandHandler(mockRepo, strategy);

    const command = new CreateCalendarEventCommand(
      "test@icloud.com",
      "abcd-efgh-ijkl-mnop",
      "Weekly Sync",
      "Syncing team progress.",
      new Date("2026-06-07T14:00:00Z"),
      new Date("2026-06-07T15:00:00Z"),
      "user123/calendars/work"
    );

    const eventId = await handler.handle(command);

    expect(eventId).toBeDefined();
    expect(savedEvent).toBeDefined();
    expect(savedEvent!.id.value).toBe(eventId);
    expect(savedEvent!.details.title).toBe("Weekly Sync");
    expect(savedEvent!.dateRange.startDate.toISOString()).toBe("2026-06-07T14:00:00.000Z");

    expect(savedPayload).toBeDefined();
    expect(savedPayload!).toContain("SUMMARY:Weekly Sync");
    expect(savedPayload!).toContain("DTSTART:20260607T140000Z");

    expect(savedCredentials).toBeDefined();
    expect(savedCredentials!.appleId).toBe("test@icloud.com");
    expect(savedCredentials!.toBasicAuthHeader()).toBe(
      `Basic ${btoa("test@icloud.com:abcd-efgh-ijkl-mnop")}`
    );

    expect(savedPath).toBeDefined();
    expect(savedPath!.value).toBe("user123/calendars/work");
  });
});

describe("Zod Edge Validation Schema", () => {
  test("should fallback to environment variables when appleId or appSpecificPassword are omitted", async () => {
    const originalId = process.env.APP_ID;
    const originalPass = process.env.APP_PASS;
    const originalToken = process.env.BEARER_TOKEN;

    try {
      process.env.APP_ID = "env-apple-id@icloud.com";
      process.env.APP_PASS = "envx-envy-envz-envw";
      process.env.BEARER_TOKEN = "env-token";

      const { createCalendarEventSchema } = await import("../src/index.ts");
      
      const payload = {
        title: "Test Event",
        startDate: "2026-06-07T12:00:00Z",
        endDate: "2026-06-07T13:00:00Z",
        calendarPath: "calendars/personal"
      };

      const result = createCalendarEventSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.appleId).toBe("env-apple-id@icloud.com");
        expect(result.data.appSpecificPassword).toBe("envx-envy-envz-envw");
      }
    } finally {
      process.env.APP_ID = originalId;
      process.env.APP_PASS = originalPass;
      process.env.BEARER_TOKEN = originalToken;
    }
  });

  test("should fail if no credentials provided in parameters and env vars are missing", async () => {
    const originalId = process.env.APP_ID;
    const originalPass = process.env.APP_PASS;
    const originalToken = process.env.BEARER_TOKEN;

    try {
      delete process.env.APP_ID;
      delete process.env.APP_PASS;
      process.env.BEARER_TOKEN = "env-token";

      const { createCalendarEventSchema } = await import("../src/index.ts");

      const payload = {
        title: "Test Event",
        startDate: "2026-06-07T12:00:00Z",
        endDate: "2026-06-07T13:00:00Z",
        calendarPath: "calendars/personal"
      };

      const result = createCalendarEventSchema.safeParse(payload);
      expect(result.success).toBe(false);
    } finally {
      process.env.APP_ID = originalId;
      process.env.APP_PASS = originalPass;
      process.env.BEARER_TOKEN = originalToken;
    }
  });
});

describe("Additional Domain Layer Unit Tests", () => {
  describe("AppleCredentials Edge Cases", () => {
    test("should throw if Apple ID has multiple @ characters", () => {
      expect(() => new AppleCredentials("test@@icloud.com", "abcd-efgh-ijkl-mnop")).toThrow(
        "Invalid Apple ID format"
      );
    });

    test("should throw if App-Specific Password is too short or lacks dashes", () => {
      expect(() => new AppleCredentials("test@icloud.com", "abcdefghijklmnop")).toThrow(
        "Invalid App-Specific Password format"
      );
      expect(() => new AppleCredentials("test@icloud.com", "abcd-efgh-ijkl-mno")).toThrow(
        "Invalid App-Specific Password format"
      );
    });
  });

  describe("EventDetails Edge Cases", () => {
    test("should support unicode, emojis and special characters in title", () => {
      const details = new EventDetails("🚀 Launch Sync Meeting! 💻", "Let's align on next steps.");
      expect(details.title).toBe("🚀 Launch Sync Meeting! 💻");
      expect(details.description).toBe("Let's align on next steps.");
    });

    test("should default description to empty string if not provided", () => {
      const details = new EventDetails("Simple Title");
      expect(details.description).toBe("");
    });
  });

  describe("DateRange Edge Cases", () => {
    test("should allow dates exactly 1 millisecond apart", () => {
      const start = new Date("2026-06-07T12:00:00.000Z");
      const end = new Date("2026-06-07T12:00:00.001Z");
      const range = new DateRange(start, end);
      expect(range.startDate.getTime()).toBe(start.getTime());
      expect(range.endDate.getTime()).toBe(end.getTime());
    });
  });

  describe("ICalSerializationStrategy Edge Cases", () => {
    test("should omit DESCRIPTION field if event description is empty", () => {
      const range = new DateRange(
        new Date("2026-06-07T12:00:00Z"),
        new Date("2026-06-07T13:00:00Z")
      );
      const details = new EventDetails("No Description Event");
      const event = CalendarEvent.create(range, details);

      const strategy = new ICalSerializationStrategy();
      const payload = strategy.serialize(event);

      expect(payload).toContain("SUMMARY:No Description Event");
      expect(payload).not.toContain("DESCRIPTION");
    });
  });
});

