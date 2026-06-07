import { test, expect, describe } from "bun:test";
import { DateRange } from "../src/domain/calendar/value-objects/DateRange";
import { EventDetails } from "../src/domain/calendar/value-objects/EventDetails";
import { EventId } from "../src/domain/calendar/value-objects/EventId";
import { CalendarPath } from "../src/domain/calendar/value-objects/CalendarPath";
import { AppleCredentials } from "../src/domain/calendar/value-objects/AppleCredentials";
import { CalendarEvent } from "../src/domain/calendar/CalendarEvent";
import { ICalSerializationStrategy } from "../src/infrastructure/calendar/serialization/ICalSerializationStrategy";
import { RetrieveCalendarEventsQuery } from "../src/application/calendar/queries/RetrieveCalendarEventsQuery";
import { RetrieveCalendarEventsQueryHandler } from "../src/application/calendar/queries/RetrieveCalendarEventsQueryHandler";
import { UpdateCalendarEventCommand } from "../src/application/calendar/commands/UpdateCalendarEventCommand";
import { UpdateCalendarEventCommandHandler } from "../src/application/calendar/commands/UpdateCalendarEventCommandHandler";
import type { ICalDavRepository } from "../src/domain/calendar/ICalDavRepository";

describe("Domain Layer: Extended Event Details & Mutable Updates", () => {
  test("EventDetails should support location and url", () => {
    const details = new EventDetails(
      "Sync meeting",
      "Meeting notes",
      "Building 4, Room 101",
      "https://example.com/sync"
    );

    expect(details.title).toBe("Sync meeting");
    expect(details.description).toBe("Meeting notes");
    expect(details.location).toBe("Building 4, Room 101");
    expect(details.url).toBe("https://example.com/sync");
  });

  test("EventDetails should fallback to empty string defaults", () => {
    const details = new EventDetails("Sync meeting");
    expect(details.description).toBe("");
    expect(details.location).toBe("");
    expect(details.url).toBe("");
  });

  test("CalendarEvent should update properties using domain method", () => {
    const range1 = new DateRange(new Date("2026-06-07T12:00:00Z"), new Date("2026-06-07T13:00:00Z"));
    const details1 = new EventDetails("Standup");
    const event = CalendarEvent.create(range1, details1);

    const range2 = new DateRange(new Date("2026-06-07T14:00:00Z"), new Date("2026-06-07T15:00:00Z"));
    const details2 = new EventDetails("Refinement", "Sprint backlog review", "Room B", "https://docs.google.com");

    event.update(range2, details2);

    expect(event.dateRange.startDate.toISOString()).toBe("2026-06-07T14:00:00.000Z");
    expect(event.details.title).toBe("Refinement");
    expect(event.details.description).toBe("Sprint backlog review");
    expect(event.details.location).toBe("Room B");
    expect(event.details.url).toBe("https://docs.google.com");
  });
});

describe("Infrastructure Layer: Serialization & Deserialization", () => {
  const strategy = new ICalSerializationStrategy();

  test("should serialize and deserialize an event correctly containing all fields", () => {
    const range = new DateRange(new Date("2026-06-07T09:00:00Z"), new Date("2026-06-07T10:00:00Z"));
    const details = new EventDetails(
      "Planning meeting",
      "Important notes\nwith newlines",
      "Meeting room C, floor 3",
      "https://meet.google.com/abc-def-ghi"
    );
    const event = CalendarEvent.create(range, details);

    const payload = strategy.serialize(event);

    expect(payload).toContain("SUMMARY:Planning meeting");
    expect(payload).toContain("DESCRIPTION:Important notes\\nwith newlines");
    expect(payload).toContain("LOCATION:Meeting room C\\, floor 3");
    expect(payload).toContain("URL:https://meet.google.com/abc-def-ghi");

    const deserialized = strategy.deserialize(payload);

    expect(deserialized.id.value).toBe(event.id.value);
    expect(deserialized.details.title).toBe("Planning meeting");
    expect(deserialized.details.description).toBe("Important notes\nwith newlines");
    expect(deserialized.details.location).toBe("Meeting room C, floor 3");
    expect(deserialized.details.url).toBe("https://meet.google.com/abc-def-ghi");
    expect(deserialized.dateRange.startDate.toISOString()).toBe("2026-06-07T09:00:00.000Z");
    expect(deserialized.dateRange.endDate.toISOString()).toBe("2026-06-07T10:00:00.000Z");
  });

  test("should handle unfolding of multi-line folded properties in deserialize", () => {
    const foldedPayload = 
      "BEGIN:VCALENDAR\r\n" +
      "VERSION:2.0\r\n" +
      "BEGIN:VEVENT\r\n" +
      "UID:event-123\r\n" +
      "DTSTART:20260607T090000Z\r\n" +
      "DTEND:20260607T100000Z\r\n" +
      "SUMMARY:Meeting with a very long title \r\n" +
      " that has been folded\r\n" +
      "DESCRIPTION:Notes that are \r\n" +
      "\tfolded using tab\r\n" +
      "END:VEVENT\r\n" +
      "END:VCALENDAR\r\n";

    const event = strategy.deserialize(foldedPayload);
    expect(event.details.title).toBe("Meeting with a very long title that has been folded");
    expect(event.details.description).toBe("Notes that are folded using tab");
  });

  test("should parse all-day and floating/local format dates", () => {
    const payload = 
      "BEGIN:VCALENDAR\r\n" +
      "VERSION:2.0\r\n" +
      "BEGIN:VEVENT\r\n" +
      "UID:event-456\r\n" +
      "DTSTART;VALUE=DATE:20260607\r\n" +
      "DTEND;VALUE=DATE:20260608\r\n" +
      "SUMMARY:All day event\r\n" +
      "END:VEVENT\r\n" +
      "END:VCALENDAR\r\n";

    const event = strategy.deserialize(payload);
    expect(event.dateRange.startDate.toISOString()).toContain("2026-06-07T00:00:00");
    expect(event.dateRange.endDate.toISOString()).toContain("2026-06-08T00:00:00");
  });
});

describe("Application Layer: CQRS Pipeline Queries and Commands", () => {
  const eventsStore = new Map<string, CalendarEvent>();

  const mockRepo: ICalDavRepository = {
    async save(event, payload, credentials, calendarPath) {
      eventsStore.set(event.id.value, event);
    },
    async findById(eventId, credentials, calendarPath) {
      return eventsStore.get(eventId) || null;
    },
    async find(credentials, calendarPath, startDate, endDate) {
      return Array.from(eventsStore.values());
    }
  };

  test("RetrieveCalendarEventsQueryHandler should return list of mapped DTOs", async () => {
    eventsStore.clear();

    const range = new DateRange(new Date("2026-06-07T12:00:00Z"), new Date("2026-06-07T13:00:00Z"));
    const details = new EventDetails("Standup Meeting", "Daily sync", "Room A", "https://zoom.us");
    const event = CalendarEvent.create(range, details);
    eventsStore.set(event.id.value, event);

    const query = new RetrieveCalendarEventsQuery(
      "test@icloud.com",
      "abcd-efgh-ijkl-mnop",
      "calendars/home"
    );

    const handler = new RetrieveCalendarEventsQueryHandler(mockRepo);
    const result = await handler.handle(query);

    expect(result.length).toBe(1);
    expect(result[0].eventId).toBe(event.id.value);
    expect(result[0].title).toBe("Standup Meeting");
    expect(result[0].description).toBe("Daily sync");
    expect(result[0].location).toBe("Room A");
    expect(result[0].url).toBe("https://zoom.us");
    expect(result[0].startDate).toBe("2026-06-07T12:00:00.000Z");
  });

  test("UpdateCalendarEventCommandHandler should load, update and save the aggregate", async () => {
    eventsStore.clear();

    const range = new DateRange(new Date("2026-06-07T12:00:00Z"), new Date("2026-06-07T13:00:00Z"));
    const details = new EventDetails("Meeting");
    const event = CalendarEvent.create(range, details);
    eventsStore.set(event.id.value, event);

    const command = new UpdateCalendarEventCommand(
      "test@icloud.com",
      "abcd-efgh-ijkl-mnop",
      "calendars/home",
      event.id.value,
      "Updated Meeting Title",
      "Updated Description",
      "Room Z",
      "https://example.com",
      new Date("2026-06-07T15:00:00Z"),
      new Date("2026-06-07T16:00:00Z")
    );

    const strategy = new ICalSerializationStrategy();
    const handler = new UpdateCalendarEventCommandHandler(mockRepo, strategy);
    const updatedId = await handler.handle(command);

    expect(updatedId).toBe(event.id.value);

    const saved = eventsStore.get(event.id.value);
    expect(saved).toBeDefined();
    expect(saved!.details.title).toBe("Updated Meeting Title");
    expect(saved!.details.description).toBe("Updated Description");
    expect(saved!.details.location).toBe("Room Z");
    expect(saved!.details.url).toBe("https://example.com");
    expect(saved!.dateRange.startDate.toISOString()).toBe("2026-06-07T15:00:00.000Z");
    expect(saved!.dateRange.endDate.toISOString()).toBe("2026-06-07T16:00:00.000Z");
  });

  test("UpdateCalendarEventCommandHandler should keep existing fields if parameters are omitted", async () => {
    eventsStore.clear();

    const range = new DateRange(new Date("2026-06-07T12:00:00Z"), new Date("2026-06-07T13:00:00Z"));
    const details = new EventDetails("Original Title", "Original Desc", "Original Loc", "Original Url");
    const event = CalendarEvent.create(range, details);
    eventsStore.set(event.id.value, event);

    // Update only the description, leaving all other fields undefined
    const command = new UpdateCalendarEventCommand(
      "test@icloud.com",
      "abcd-efgh-ijkl-mnop",
      "calendars/home",
      event.id.value,
      undefined,
      "Partially Updated Desc"
    );

    const strategy = new ICalSerializationStrategy();
    const handler = new UpdateCalendarEventCommandHandler(mockRepo, strategy);
    await handler.handle(command);

    const saved = eventsStore.get(event.id.value);
    expect(saved).toBeDefined();
    expect(saved!.details.title).toBe("Original Title");
    expect(saved!.details.description).toBe("Partially Updated Desc");
    expect(saved!.details.location).toBe("Original Loc");
    expect(saved!.details.url).toBe("Original Url");
    expect(saved!.dateRange.startDate.toISOString()).toBe("2026-06-07T12:00:00.000Z");
  });
});
