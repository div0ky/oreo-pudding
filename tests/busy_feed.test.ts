import { test, expect, describe } from "bun:test";
import { CalendarEvent } from "../src/domain/calendar/CalendarEvent";
import { EventId } from "../src/domain/calendar/value-objects/EventId";
import { DateRange } from "../src/domain/calendar/value-objects/DateRange";
import { EventDetails } from "../src/domain/calendar/value-objects/EventDetails";
import {
  BusinessHoursPolicy,
  type BusyBlock
} from "../src/domain/calendar/BusinessHoursPolicy";
import { BusyFeedSerializationStrategy } from "../src/infrastructure/calendar/serialization/BusyFeedSerializationStrategy";
import { GetBusyFeedQuery } from "../src/application/calendar/queries/GetBusyFeedQuery";
import { GetBusyFeedQueryHandler } from "../src/application/calendar/queries/GetBusyFeedQueryHandler";
import type { ICalDavRepository } from "../src/domain/calendar/ICalDavRepository";
import {
  isFeedTokenValid,
  resolveBusyFeedWindow
} from "../src/index.ts";

const TZ = "America/Chicago";

// 2026-09-22 is in CDT (UTC-5): 08:00 CDT = 13:00Z, 17:00 CDT = 22:00Z.
function makeEvent(
  uid: string,
  startUtcIso: string,
  endUtcIso: string,
  title = "Secret Meeting"
): CalendarEvent {
  return CalendarEvent.restore(
    new EventId(uid),
    new DateRange(new Date(startUtcIso), new Date(endUtcIso)),
    new EventDetails(title, "secret notes", "secret location", "https://secret.example")
  );
}

describe("BusinessHoursPolicy", () => {
  test("drops events fully before 8am", () => {
    const event = makeEvent(
      "before-hours",
      "2026-09-22T11:00:00.000Z",
      "2026-09-22T12:00:00.000Z"
    );
    const blocks = BusinessHoursPolicy.toBusyBlocks([event], TZ);
    expect(blocks.length).toBe(0);
  });

  test("drops events fully after 5pm", () => {
    const event = makeEvent(
      "after-hours",
      "2026-09-22T23:00:00.000Z",
      "2026-09-23T00:00:00.000Z"
    );
    const blocks = BusinessHoursPolicy.toBusyBlocks([event], TZ);
    expect(blocks.length).toBe(0);
  });

  test("drops events ending exactly at 8am and starting exactly at 5pm", () => {
    const endsAtOpen = makeEvent(
      "ends-at-open",
      "2026-09-22T11:00:00.000Z",
      "2026-09-22T13:00:00.000Z"
    );
    const startsAtClose = makeEvent(
      "starts-at-close",
      "2026-09-22T22:00:00.000Z",
      "2026-09-22T23:00:00.000Z"
    );
    expect(BusinessHoursPolicy.toBusyBlocks([endsAtOpen], TZ).length).toBe(0);
    expect(BusinessHoursPolicy.toBusyBlocks([startsAtClose], TZ).length).toBe(0);
  });

  test("clamps overlapping start to 8am", () => {
    const event = makeEvent(
      "clamp-start",
      "2026-09-22T12:00:00.000Z",
      "2026-09-22T15:00:00.000Z"
    );
    const blocks = BusinessHoursPolicy.toBusyBlocks([event], TZ);
    expect(blocks.length).toBe(1);
    const block = blocks[0] as BusyBlock;
    expect(block.dateRange.startDate.toISOString()).toBe("2026-09-22T13:00:00.000Z");
    expect(block.dateRange.endDate.toISOString()).toBe("2026-09-22T15:00:00.000Z");
    expect(block.busyId.value).toBe("clamp-start@2026-09-22");
    expect(block.localDate).toBe("2026-09-22");
  });

  test("clamps overlapping end to 5pm", () => {
    const event = makeEvent(
      "clamp-end",
      "2026-09-22T21:00:00.000Z",
      "2026-09-22T23:00:00.000Z"
    );
    const blocks = BusinessHoursPolicy.toBusyBlocks([event], TZ);
    expect(blocks.length).toBe(1);
    const block = blocks[0] as BusyBlock;
    expect(block.dateRange.startDate.toISOString()).toBe("2026-09-22T21:00:00.000Z");
    expect(block.dateRange.endDate.toISOString()).toBe("2026-09-22T22:00:00.000Z");
  });

  test("keeps events fully inside 8-5 unchanged", () => {
    const event = makeEvent(
      "inside",
      "2026-09-22T14:00:00.000Z",
      "2026-09-22T15:00:00.000Z"
    );
    const blocks = BusinessHoursPolicy.toBusyBlocks([event], TZ);
    expect(blocks.length).toBe(1);
    expect(blocks[0]?.dateRange.startDate.toISOString()).toBe(
      "2026-09-22T14:00:00.000Z"
    );
    expect(blocks[0]?.dateRange.endDate.toISOString()).toBe(
      "2026-09-22T15:00:00.000Z"
    );
  });

  test("splits multi-day events into one block per workday", () => {
    const event = makeEvent(
      "multi-day",
      "2026-09-21T21:00:00.000Z",
      "2026-09-22T14:00:00.000Z"
    );
    const blocks = BusinessHoursPolicy.toBusyBlocks([event], TZ);
    expect(blocks.length).toBe(2);
    expect(blocks[0]?.localDate).toBe("2026-09-21");
    expect(blocks[0]?.dateRange.startDate.toISOString()).toBe(
      "2026-09-21T21:00:00.000Z"
    );
    expect(blocks[0]?.dateRange.endDate.toISOString()).toBe(
      "2026-09-21T22:00:00.000Z"
    );
    expect(blocks[1]?.localDate).toBe("2026-09-22");
    expect(blocks[1]?.dateRange.startDate.toISOString()).toBe(
      "2026-09-22T13:00:00.000Z"
    );
    expect(blocks[1]?.dateRange.endDate.toISOString()).toBe(
      "2026-09-22T14:00:00.000Z"
    );
  });

  test("emits full 8-5 block for middle days of long events", () => {
    const event = makeEvent(
      "long-event",
      "2026-09-21T15:00:00.000Z",
      "2026-09-23T20:00:00.000Z"
    );
    const blocks = BusinessHoursPolicy.toBusyBlocks([event], TZ);
    expect(blocks.length).toBe(3);
    // Middle day is a full workday.
    expect(blocks[1]?.localDate).toBe("2026-09-22");
    expect(blocks[1]?.dateRange.startDate.toISOString()).toBe(
      "2026-09-22T13:00:00.000Z"
    );
    expect(blocks[1]?.dateRange.endDate.toISOString()).toBe(
      "2026-09-22T22:00:00.000Z"
    );
  });

  test("skips all-day midnight-to-midnight events", () => {
    const event = makeEvent(
      "all-day",
      "2026-09-22T05:00:00.000Z",
      "2026-09-23T05:00:00.000Z"
    );
    const blocks = BusinessHoursPolicy.toBusyBlocks([event], TZ);
    expect(blocks.length).toBe(0);
  });

  test("defaults to America/Chicago for invalid timezones", () => {
    const event = makeEvent(
      "tz-fallback",
      "2026-09-22T14:00:00.000Z",
      "2026-09-22T15:00:00.000Z"
    );
    const blocks = BusinessHoursPolicy.toBusyBlocks([event], "Not/AZone");
    expect(blocks.length).toBe(1);
    expect(blocks[0]?.localDate).toBe("2026-09-22");
  });
});

describe("BusyFeedSerializationStrategy", () => {
  test("emits masked Busy VCALENDAR with UTC dates and CRLF", () => {
    const event = makeEvent(
      "serialize-1",
      "2026-09-22T14:00:00.000Z",
      "2026-09-22T15:00:00.000Z",
      "Top Secret Title"
    );
    const blocks = BusinessHoursPolicy.toBusyBlocks([event], TZ);
    const serializer = new BusyFeedSerializationStrategy();
    const ics = serializer.serializeFeed(blocks);

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("PRODID:-//Oreo Pudding//Busy Feed//EN");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:serialize-1@2026-09-22");
    expect(ics).toContain("DTSTART:20260922T140000Z");
    expect(ics).toContain("DTEND:20260922T150000Z");
    expect(ics).toContain("SUMMARY:Busy");
    expect(ics).toContain("STATUS:CONFIRMED");
    expect(ics).toContain("TRANSP:OPAQUE");
    expect(ics).not.toContain("Top Secret Title");
    expect(ics).not.toContain("secret notes");
    expect(ics).not.toContain("secret location");
    expect(ics).not.toContain("DESCRIPTION");
    expect(ics).not.toContain("LOCATION");
    expect(ics.endsWith("\r\n")).toBe(true);
  });

  test("emits valid empty VCALENDAR when there are no blocks", () => {
    const serializer = new BusyFeedSerializationStrategy();
    const ics = serializer.serializeFeed([]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });
});

describe("GetBusyFeedQueryHandler", () => {
  test("omits excluded calendars and returns masked feed", async () => {
    const originalId = process.env.APP_ID;
    const originalPass = process.env.APP_PASS;
    process.env.APP_ID = "test@icloud.com";
    process.env.APP_PASS = "abcd-efgh-ijkl-mnop";

    const queriedPaths: string[] = [];
    const workEvent = makeEvent(
      "work-1",
      "2026-09-22T14:00:00.000Z",
      "2026-09-22T15:00:00.000Z",
      "Work Standup"
    );
    const familyEvent = makeEvent(
      "family-1",
      "2026-09-22T14:00:00.000Z",
      "2026-09-22T15:00:00.000Z",
      "Family Dinner"
    );

    const mockRepo: ICalDavRepository = {
      async save() {},
      async delete() {},
      async findById() {
        return null;
      },
      async find(_credentials, calendarPath) {
        queriedPaths.push(calendarPath.value);
        if (calendarPath.value.includes("family")) {
          return [familyEvent];
        }
        return [workEvent];
      },
      async discoverCalendars() {
        return [
          { name: "Work", path: "user/calendars/work" },
          { name: "Family", path: "user/calendars/family" }
        ];
      },
      getDefaultCalendar(calendars) {
        const first = calendars[0];
        if (!first) {
          throw new Error("No calendars");
        }
        return first;
      }
    };

    try {
      const handler = new GetBusyFeedQueryHandler(
        mockRepo,
        new BusyFeedSerializationStrategy()
      );
      const ics = await handler.handle(
        new GetBusyFeedQuery(
          new Date("2026-09-22T00:00:00.000Z"),
          new Date("2026-09-23T00:00:00.000Z"),
          ["family"],
          TZ
        )
      );

      expect(queriedPaths).toContain("user/calendars/work");
      expect(queriedPaths).not.toContain("user/calendars/family");
      expect(ics).toContain("UID:work-1@2026-09-22");
      expect(ics).not.toContain("family-1");
      expect(ics).not.toContain("Work Standup");
    } finally {
      if (originalId === undefined) {
        delete process.env.APP_ID;
      } else {
        process.env.APP_ID = originalId;
      }
      if (originalPass === undefined) {
        delete process.env.APP_PASS;
      } else {
        process.env.APP_PASS = originalPass;
      }
    }
  });

  test("returns empty feed when no calendars are discovered", async () => {
    const originalId = process.env.APP_ID;
    const originalPass = process.env.APP_PASS;
    process.env.APP_ID = "test@icloud.com";
    process.env.APP_PASS = "abcd-efgh-ijkl-mnop";

    const mockRepo: ICalDavRepository = {
      async save() {},
      async delete() {},
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

    try {
      const handler = new GetBusyFeedQueryHandler(
        mockRepo,
        new BusyFeedSerializationStrategy()
      );
      const ics = await handler.handle(new GetBusyFeedQuery());
      expect(ics).toContain("BEGIN:VCALENDAR");
      expect(ics).not.toContain("BEGIN:VEVENT");
    } finally {
      if (originalId === undefined) {
        delete process.env.APP_ID;
      } else {
        process.env.APP_ID = originalId;
      }
      if (originalPass === undefined) {
        delete process.env.APP_PASS;
      } else {
        process.env.APP_PASS = originalPass;
      }
    }
  });
});

describe("Busy feed helpers", () => {
  test("isFeedTokenValid compares tokens safely", () => {
    expect(isFeedTokenValid("secret", "secret")).toBe(true);
    expect(isFeedTokenValid("secret", "other!")).toBe(false);
    expect(isFeedTokenValid(null, "secret")).toBe(false);
    expect(isFeedTokenValid("secret", undefined)).toBe(false);
    expect(isFeedTokenValid("short", "much-longer-token")).toBe(false);
  });

  test("resolveBusyFeedWindow defaults to past 30 plus next 60", () => {
    const now = new Date("2026-09-22T15:00:00.000Z");
    const window = resolveBusyFeedWindow({ now });
    expect(window.timezone).toBe("America/Chicago");
    const spanDays =
      (window.end.getTime() - window.start.getTime()) / (24 * 60 * 60 * 1000);
    expect(spanDays).toBeGreaterThan(89);
    expect(spanDays).toBeLessThan(92);
    expect(window.start.getTime()).toBeLessThan(now.getTime());
    expect(window.end.getTime()).toBeGreaterThan(now.getTime());
  });

  test("resolveBusyFeedWindow honors days and explicit start/end", () => {
    const daysWindow = resolveBusyFeedWindow({
      days: "30",
      now: new Date("2026-09-22T15:00:00.000Z")
    });
    const spanDays =
      (daysWindow.end.getTime() - daysWindow.start.getTime()) /
      (24 * 60 * 60 * 1000);
    expect(spanDays).toBeGreaterThan(29);
    expect(spanDays).toBeLessThan(32);

    const explicit = resolveBusyFeedWindow({
      start: "2026-09-01T00:00:00",
      end: "2026-09-02T00:00:00",
      timezone: "UTC"
    });
    expect(explicit.timezone).toBe("UTC");
    expect(explicit.end.getTime()).toBeGreaterThan(explicit.start.getTime());
  });

  test("resolveBusyFeedWindow rejects invalid params", () => {
    expect(() => resolveBusyFeedWindow({ days: "0" })).toThrow(
      "Invalid days param"
    );
    expect(() =>
      resolveBusyFeedWindow({
        start: "2026-09-02T00:00:00",
        end: "2026-09-01T00:00:00"
      })
    ).toThrow("Invalid date range");
  });
});

describe("Busy feed HTTP route", () => {
  test("rejects missing or wrong feed token with 401", async () => {
    const testPort = 55671;
    const proc = Bun.spawn(["bun", "run", "src/index.ts"], {
      env: {
        ...process.env,
        FEED_TOKEN: "feed-secret-123",
        PORT: String(testPort)
      },
      stdout: "pipe",
      stderr: "pipe"
    });

    await new Promise((resolve) => setTimeout(resolve, 800));

    try {
      const missing = await fetch(`http://localhost:${testPort}/busy.ics`);
      expect(missing.status).toBe(401);

      const wrong = await fetch(
        `http://localhost:${testPort}/busy.ics?token=wrong`
      );
      expect(wrong.status).toBe(401);
    } finally {
      proc.kill();
    }
  });

  test("accepts correct token for HEAD without hitting CalDAV", async () => {
    const testPort = 55672;
    const proc = Bun.spawn(["bun", "run", "src/index.ts"], {
      env: {
        ...process.env,
        FEED_TOKEN: "feed-secret-123",
        PORT: String(testPort)
      },
      stdout: "pipe",
      stderr: "pipe"
    });

    await new Promise((resolve) => setTimeout(resolve, 800));

    try {
      const res = await fetch(
        `http://localhost:${testPort}/busy.ics?token=feed-secret-123`,
        { method: "HEAD" }
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/calendar");
    } finally {
      proc.kill();
    }
  });

  test("returns 400 for invalid days param with valid token", async () => {
    const testPort = 55673;
    const proc = Bun.spawn(["bun", "run", "src/index.ts"], {
      env: {
        ...process.env,
        FEED_TOKEN: "feed-secret-123",
        PORT: String(testPort)
      },
      stdout: "pipe",
      stderr: "pipe"
    });

    await new Promise((resolve) => setTimeout(resolve, 800));

    try {
      const res = await fetch(
        `http://localhost:${testPort}/busy.ics?token=feed-secret-123&days=not-a-number`
      );
      expect(res.status).toBe(400);
    } finally {
      proc.kill();
    }
  });
});
