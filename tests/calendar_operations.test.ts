import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { DateRange } from "../src/domain/calendar/value-objects/DateRange";
import { EventDetails } from "../src/domain/calendar/value-objects/EventDetails";
import { EventId } from "../src/domain/calendar/value-objects/EventId";
import { CalendarPath } from "../src/domain/calendar/value-objects/CalendarPath";
import { AppleCredentials } from "../src/domain/calendar/value-objects/AppleCredentials";
import { CalendarEvent } from "../src/domain/calendar/CalendarEvent";
import { ICalSerializationStrategy } from "../src/infrastructure/calendar/serialization/ICalSerializationStrategy";
import { RetrieveCalendarEventsQuery } from "../src/application/calendar/queries/RetrieveCalendarEventsQuery";
import { RetrieveCalendarEventsQueryHandler } from "../src/application/calendar/queries/RetrieveCalendarEventsQueryHandler";
import { ListCalendarsQuery } from "../src/application/calendar/queries/ListCalendarsQuery";
import { ListCalendarsQueryHandler } from "../src/application/calendar/queries/ListCalendarsQueryHandler";
import { CreateCalendarEventCommand } from "../src/application/calendar/commands/CreateCalendarEventCommand";
import { CreateCalendarEventCommandHandler } from "../src/application/calendar/commands/CreateCalendarEventCommandHandler";
import { UpdateCalendarEventCommand } from "../src/application/calendar/commands/UpdateCalendarEventCommand";
import { UpdateCalendarEventCommandHandler } from "../src/application/calendar/commands/UpdateCalendarEventCommandHandler";
import type { ICalDavRepository } from "../src/domain/calendar/ICalDavRepository";
import { CalDavRepository } from "../src/infrastructure/calendar/repository/CalDavRepository";
import { RetrieveAllCalendarEventsQuery } from "../src/application/calendar/queries/RetrieveAllCalendarEventsQuery";
import { RetrieveAllCalendarEventsQueryHandler } from "../src/application/calendar/queries/RetrieveAllCalendarEventsQueryHandler";


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

  test("should not overwrite event dates with timezone block dates in deserialize", () => {
    const payload = 
      "BEGIN:VCALENDAR\r\n" +
      "VERSION:2.0\r\n" +
      "BEGIN:VEVENT\r\n" +
      "UID:event-timezone-test\r\n" +
      "DTSTART;TZID=America/Chicago:20260608T084500\r\n" +
      "DTEND;TZID=America/Chicago:20260608T094500\r\n" +
      "SUMMARY:Meeting with timezone\r\n" +
      "END:VEVENT\r\n" +
      "BEGIN:VTIMEZONE\r\n" +
      "TZID:America/Chicago\r\n" +
      "BEGIN:STANDARD\r\n" +
      "DTSTART:20071104T020000\r\n" +
      "END:STANDARD\r\n" +
      "END:VTIMEZONE\r\n" +
      "END:VCALENDAR\r\n";

    const event = strategy.deserialize(payload);
    expect(event.dateRange.startDate.toISOString()).toContain("2026-06-08T08:45:00");
    expect(event.dateRange.endDate.toISOString()).toContain("2026-06-08T09:45:00");
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
    },
    async discoverCalendars(credentials) {
      return [{ name: "home", path: "calendars/home" }];
    },
    getDefaultCalendar(calendars) {
      return calendars[0];
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
    expect(result[0].startDate).toBe("2026-06-07T07:00:00.000-05:00");
    expect(result[0].timezone).toBe("America/Chicago");
  });

  test("RetrieveCalendarEventsQueryHandler should return list of mapped DTOs in a custom timezone", async () => {
    eventsStore.clear();

    const range = new DateRange(new Date("2026-06-07T12:00:00Z"), new Date("2026-06-07T13:00:00Z"));
    const details = new EventDetails("Standup Meeting", "Daily sync", "Room A", "https://zoom.us");
    const event = CalendarEvent.create(range, details);
    eventsStore.set(event.id.value, event);

    const query = new RetrieveCalendarEventsQuery(
      "test@icloud.com",
      "abcd-efgh-ijkl-mnop",
      "calendars/home",
      undefined,
      undefined,
      "Asia/Tokyo"
    );

    const handler = new RetrieveCalendarEventsQueryHandler(mockRepo);
    const result = await handler.handle(query);

    expect(result.length).toBe(1);
    expect(result[0].startDate).toBe("2026-06-07T21:00:00.000+09:00");
    expect(result[0].timezone).toBe("Asia/Tokyo");
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

  test("ListCalendarsQueryHandler should return list of discovered calendars", async () => {
    const query = new ListCalendarsQuery("test@icloud.com", "abcd-efgh-ijkl-mnop");
    const handler = new ListCalendarsQueryHandler(mockRepo);
    const result = await handler.handle(query);

    expect(result.length).toBe(1);
    expect(result[0].name).toBe("home");
    expect(result[0].path).toBe("calendars/home");
  });

  test("CreateCalendarEventCommandHandler should auto-discover calendar path when omitted", async () => {
    const command = new CreateCalendarEventCommand(
      "test@icloud.com",
      "abcd-efgh-ijkl-mnop",
      "Auto Discovered Path Event",
      "Checking auto path fallback",
      new Date("2026-06-07T12:00:00Z"),
      new Date("2026-06-07T13:00:00Z"),
      undefined // Omitted calendar path
    );

    const strategy = new ICalSerializationStrategy();
    
    let savedPath: string | null = null;
    const repoWithDiscoverySpy: ICalDavRepository = {
      ...mockRepo,
      async save(event, payload, credentials, calendarPath) {
        savedPath = calendarPath.value;
      }
    };

    const handlerWithSpy = new CreateCalendarEventCommandHandler(repoWithDiscoverySpy, strategy);
    await handlerWithSpy.handle(command);

    expect(savedPath).toBe("calendars/home");
  });
});

describe("CalDavRepository SWR Caching", () => {
  const credentials = new AppleCredentials("test@icloud.com", "abcd-efgh-ijkl-mnop");
  const calendarPath = new CalendarPath("calendars/home");

  test("discoverCalendars should cache results and perform background SWR revalidation when stale", async () => {
    const repo = new CalDavRepository();
    let liveCalls = 0;
    (repo as any).discoverCalendarsLive = async () => {
      // Simulate network delay to make execution truly asynchronous
      await new Promise((resolve) => setTimeout(resolve, 1));
      liveCalls++;
      return [{ name: "Mock Calendar", path: "mock-path" }];
    };

    // 1. First call (cache miss)
    const result1 = await repo.discoverCalendars(credentials);
    expect(result1).toEqual([{ name: "Mock Calendar", path: "mock-path" }]);
    expect(liveCalls).toBe(1);

    // 2. Second call (cache hit, fresh)
    const result2 = await repo.discoverCalendars(credentials);
    expect(result2).toEqual([{ name: "Mock Calendar", path: "mock-path" }]);
    expect(liveCalls).toBe(1);

    // 3. Stale the cache (set age to 49 hours)
    const cacheKey = credentials.appleId;
    const entry = (repo as any).calendarsCache.get(cacheKey);
    expect(entry).toBeDefined();
    entry.fetchedAt = Date.now() - 49 * 60 * 60 * 1000;

    // 4. Third call (stale-while-revalidate)
    const result3 = await repo.discoverCalendars(credentials);
    // Returns stale data immediately
    expect(result3).toEqual([{ name: "Mock Calendar", path: "mock-path" }]);
    expect(liveCalls).toBe(1); // Increment happens in background

    // Wait for microtask queue to allow the background Promise to run
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(liveCalls).toBe(2);
  });

  test("find should cache results and perform background SWR revalidation when stale", async () => {
    const repo = new CalDavRepository();
    let liveCalls = 0;
    (repo as any).findLive = async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      liveCalls++;
      return [];
    };

    // 1. First call (cache miss)
    const result1 = await repo.find(credentials, calendarPath);
    expect(result1).toEqual([]);
    expect(liveCalls).toBe(1);

    // 2. Second call (cache hit)
    const result2 = await repo.find(credentials, calendarPath);
    expect(result2).toEqual([]);
    expect(liveCalls).toBe(1);

    // 3. Stale the cache (set age to 6 minutes)
    const cacheKey = `${credentials.appleId}:${calendarPath.value}:none:none`;
    const entry = (repo as any).eventsQueryCache.get(cacheKey);
    expect(entry).toBeDefined();
    entry.fetchedAt = Date.now() - 6 * 60 * 1000;

    // 4. Third call (stale-while-revalidate)
    const result3 = await repo.find(credentials, calendarPath);
    expect(result3).toEqual([]);
    expect(liveCalls).toBe(1);

    // Wait for background revalidation
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(liveCalls).toBe(2);
  });

  test("findById should cache results and perform background SWR revalidation when stale", async () => {
    const repo = new CalDavRepository();
    let liveCalls = 0;
    (repo as any).findByIdLive = async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      liveCalls++;
      return null;
    };

    // 1. First call (cache miss)
    const result1 = await repo.findById("event-id", credentials, calendarPath);
    expect(result1).toBeNull();
    expect(liveCalls).toBe(1);

    // 2. Second call (cache hit)
    const result2 = await repo.findById("event-id", credentials, calendarPath);
    expect(result2).toBeNull();
    expect(liveCalls).toBe(1);

    // 3. Stale the cache (set age to 6 minutes)
    const cacheKey = `${credentials.appleId}:${calendarPath.value}:event-id`;
    const entry = (repo as any).eventsByIdCache.get(cacheKey);
    expect(entry).toBeDefined();
    entry.fetchedAt = Date.now() - 6 * 60 * 1000;

    // 4. Third call (stale-while-revalidate)
    const result3 = await repo.findById("event-id", credentials, calendarPath);
    expect(result3).toBeNull();
    expect(liveCalls).toBe(1);

    // Wait for background revalidation
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(liveCalls).toBe(2);
  });


  test("save should invalidate event caches matching user and path", async () => {
    const repo = new CalDavRepository();
    
    // Set up mock live implementations
    (repo as any).findLive = async () => [];
    (repo as any).findByIdLive = async () => null;
    (repo as any).saveLive = async () => {};

    // Populates query and byId caches
    await repo.find(credentials, calendarPath);
    await repo.findById("event-123", credentials, calendarPath);

    const queryKey = `${credentials.appleId}:${calendarPath.value}:none:none`;
    const byIdKey = `${credentials.appleId}:${calendarPath.value}:event-123`;

    expect((repo as any).eventsQueryCache.has(queryKey)).toBe(true);
    expect((repo as any).eventsByIdCache.has(byIdKey)).toBe(true);

    // Call save to trigger invalidation
    const range = new DateRange(new Date("2026-06-07T12:00:00Z"), new Date("2026-06-07T13:00:00Z"));
    const details = new EventDetails("Mock Event");
    const event = CalendarEvent.create(range, details);
    await repo.save(event, "ics-payload", credentials, calendarPath);

    // Caches should now be empty for that user & path
    expect((repo as any).eventsQueryCache.has(queryKey)).toBe(false);
    expect((repo as any).eventsByIdCache.has(byIdKey)).toBe(false);
  });

  test("should attach and propagate _swr cache metadata in repository and query handlers", async () => {
    const repo = new CalDavRepository();
    (repo as any).discoverCalendarsLive = async () => [{ name: "Mock Cal", path: "/mock" }];
    (repo as any).findLive = async () => [];

    // 1. Test repository returns _swr
    const calendarsResult = await repo.discoverCalendars(credentials);
    expect((calendarsResult as any)._swr).toBeDefined();
    expect((calendarsResult as any)._swr.cachedAt).toBeDefined();
    expect((calendarsResult as any)._swr.staleAt).toBeDefined();
    expect((calendarsResult as any)._swr.isStale).toBe(false);

    // 2. Test query handlers propagate _swr
    const listHandler = new ListCalendarsQueryHandler(repo);
    const listResult = await listHandler.handle(new ListCalendarsQuery("test@icloud.com", "abcd-efgh-ijkl-mnop"));
    expect((listResult as any)._swr).toBeDefined();
    expect((listResult as any)._swr.isStale).toBe(false);
    const retrieveHandler = new RetrieveCalendarEventsQueryHandler(repo);
    const retrieveResult = await retrieveHandler.handle(
      new RetrieveCalendarEventsQuery("test@icloud.com", "abcd-efgh-ijkl-mnop", "calendars/home")
    );
    expect((retrieveResult as any)._swr).toBeDefined();
  });
});

describe("RetrieveAllCalendarEventsQueryHandler", () => {
  const originalAppId = process.env.APP_ID;
  const originalAppPass = process.env.APP_PASS;

  beforeEach(() => {
    process.env.APP_ID = "test@icloud.com";
    process.env.APP_PASS = "abcd-efgh-ijkl-mnop";
  });

  afterEach(() => {
    process.env.APP_ID = originalAppId;
    process.env.APP_PASS = originalAppPass;
  });

  test("should retrieve events from all discovered calendars and map them", async () => {
    const range = new DateRange(new Date("2026-06-07T12:00:00Z"), new Date("2026-06-07T13:00:00Z"));
    const event1 = CalendarEvent.create(range, new EventDetails("Work Event"));
    const event2 = CalendarEvent.create(range, new EventDetails("Personal Event"));

    const mockRepo: ICalDavRepository = {
      async save() {},
      async findById() { return null; },
      async find(credentials, calendarPath) {
        if (calendarPath.value === "calendars/work") {
          return [event1];
        }
        if (calendarPath.value === "calendars/personal") {
          return [event2];
        }
        return [];
      },
      async discoverCalendars() {
        return [
          { name: "Work", path: "calendars/work" },
          { name: "Personal", path: "calendars/personal" }
        ];
      },
      getDefaultCalendar(calendars) {
        return calendars[0];
      }
    };

    const query = new RetrieveAllCalendarEventsQuery();
    const handler = new RetrieveAllCalendarEventsQueryHandler(mockRepo);
    const result = await handler.handle(query);

    expect(result.length).toBe(2);
    
    const workCal = result.find(c => c.calendarName === "Work");
    expect(workCal).toBeDefined();
    expect(workCal!.events.length).toBe(1);
    expect(workCal!.events[0].title).toBe("Work Event");
    expect(workCal!.calendarPath).toBe("calendars/work");

    const personalCal = result.find(c => c.calendarName === "Personal");
    expect(personalCal).toBeDefined();
    expect(personalCal!.events.length).toBe(1);
    expect(personalCal!.events[0].title).toBe("Personal Event");
  });

  test("RetrieveAllCalendarEventsQueryHandler should support custom timezone parameter", async () => {
    const range = new DateRange(new Date("2026-06-07T12:00:00Z"), new Date("2026-06-07T13:00:00Z"));
    const event = CalendarEvent.create(range, new EventDetails("Work Event"));

    const mockRepo: ICalDavRepository = {
      async save() {},
      async findById() { return null; },
      async find() { return [event]; },
      async discoverCalendars() {
        return [{ name: "Work", path: "calendars/work" }];
      },
      getDefaultCalendar(calendars) {
        return calendars[0];
      }
    };

    const query = new RetrieveAllCalendarEventsQuery(undefined, undefined, undefined, "Asia/Tokyo");
    const handler = new RetrieveAllCalendarEventsQueryHandler(mockRepo);
    const result = await handler.handle(query);

    expect(result.length).toBe(1);
    expect(result[0].events[0].startDate).toBe("2026-06-07T21:00:00.000+09:00");
    expect(result[0].events[0].timezone).toBe("Asia/Tokyo");
  });

  test("should omit specified calendars", async () => {
    const mockRepo: ICalDavRepository = {
      async save() {},
      async findById() { return null; },
      async find() { return []; },
      async discoverCalendars() {
        return [
          { name: "Work", path: "calendars/work" },
          { name: "Personal", path: "calendars/personal" },
          { name: "Holidays", path: "calendars/holidays" }
        ];
      },
      getDefaultCalendar(calendars) {
        return calendars[0];
      }
    };

    // Omit Work (exact case-insensitive name match) and calendars/holidays (exact path match)
    const query = new RetrieveAllCalendarEventsQuery(undefined, undefined, ["work", "calendars/holidays"]);
    const handler = new RetrieveAllCalendarEventsQueryHandler(mockRepo);
    const result = await handler.handle(query);

    expect(result.length).toBe(1);
    expect(result[0].calendarName).toBe("Personal");
  });

  test("should omit calendars using case-insensitive substring matching", async () => {
    const mockRepo: ICalDavRepository = {
      async save() {},
      async findById() { return null; },
      async find() { return []; },
      async discoverCalendars() {
        return [
          { name: "US Holidays", path: "calendars/us-holidays" },
          { name: "UK Holidays", path: "calendars/uk-holidays" },
          { name: "Main", path: "calendars/main" }
        ];
      },
      getDefaultCalendar(calendars) {
        return calendars[0];
      }
    };

    // Omit "holiday" as substring
    const query = new RetrieveAllCalendarEventsQuery(undefined, undefined, ["holiday"]);
    const handler = new RetrieveAllCalendarEventsQueryHandler(mockRepo);
    const result = await handler.handle(query);

    expect(result.length).toBe(1);
    expect(result[0].calendarName).toBe("Main");
  });

  test("should aggregate SWR caching headers from discovery and find calls", async () => {
    const mockCalendars = [{ name: "Main", path: "calendars/main" }];
    Object.defineProperty(mockCalendars, "_swr", {
      value: {
        cachedAt: "2026-06-07T12:00:00.000Z",
        staleAt: "2026-06-09T12:00:00.000Z",
        isStale: false
      },
      enumerable: false
    });

    const mockEvents = [];
    Object.defineProperty(mockEvents, "_swr", {
      value: {
        cachedAt: "2026-06-07T12:10:00.000Z",
        staleAt: "2026-06-07T12:15:00.000Z",
        isStale: true
      },
      enumerable: false
    });

    const mockRepo: ICalDavRepository = {
      async save() {},
      async findById() { return null; },
      async find() { return mockEvents; },
      async discoverCalendars() { return mockCalendars; },
      getDefaultCalendar(calendars) { return calendars[0]; }
    };

    const query = new RetrieveAllCalendarEventsQuery();
    const handler = new RetrieveAllCalendarEventsQueryHandler(mockRepo);
    const result = await handler.handle(query);

    const swr = (result as any)._swr;
    expect(swr).toBeDefined();
    // cachedAt should be the min (earliest): 2026-06-07T12:00:00.000Z
    expect(swr.cachedAt).toBe("2026-06-07T12:00:00.000Z");
    // staleAt should be the min (earliest): 2026-06-07T12:15:00.000Z
    expect(swr.staleAt).toBe("2026-06-07T12:15:00.000Z");
    // isStale should be true since one of them was stale
    expect(swr.isStale).toBe(true);
  });
});
