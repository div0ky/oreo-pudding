import { describe, expect, test } from "bun:test";
import { isValidTimeZone, parseInTimeZone, formatInTimeZone } from "../src/application/utils/TimeZoneHelper";

describe("TimeZoneHelper", () => {
  test("isValidTimeZone should return true for valid timezones and false for invalid ones", () => {
    expect(isValidTimeZone("America/Chicago")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Europe/London")).toBe(true);
    expect(isValidTimeZone("Invalid/Timezone")).toBe(false);
  });

  test("parseInTimeZone should parse local datetime strings in default America/Chicago timezone", () => {
    // June 7 is DST (CDT = UTC-5)
    const dateDst = parseInTimeZone("2026-06-07T15:00:00");
    expect(dateDst.toISOString()).toBe("2026-06-07T20:00:00.000Z");

    // December 7 is standard time (CST = UTC-6)
    const dateStd = parseInTimeZone("2026-12-07T15:00:00");
    expect(dateStd.toISOString()).toBe("2026-12-07T21:00:00.000Z");
  });

  test("parseInTimeZone should parse local datetime strings in a custom timezone", () => {
    // New York in June (EDT = UTC-4)
    const dateNy = parseInTimeZone("2026-06-07T15:00:00", "America/New_York");
    expect(dateNy.toISOString()).toBe("2026-06-07T19:00:00.000Z");

    // Tokyo is always UTC+9
    const dateTokyo = parseInTimeZone("2026-06-07T15:00:00", "Asia/Tokyo");
    expect(dateTokyo.toISOString()).toBe("2026-06-07T06:00:00.000Z");
  });

  test("parseInTimeZone should preserve absolute time if string contains offset or Z", () => {
    const dateZ = parseInTimeZone("2026-06-07T15:00:00Z", "America/Chicago");
    expect(dateZ.toISOString()).toBe("2026-06-07T15:00:00.000Z");

    const dateOffset = parseInTimeZone("2026-06-07T15:00:00+02:00", "America/Chicago");
    expect(dateOffset.toISOString()).toBe("2026-06-07T13:00:00.000Z");
  });

  test("formatInTimeZone should format a Date object to local string with correct offset", () => {
    const utcDate = new Date("2026-06-07T20:00:00Z");
    
    // Chicago CDT (UTC-5)
    const formattedChicago = formatInTimeZone(utcDate, "America/Chicago");
    expect(formattedChicago).toBe("2026-06-07T15:00:00.000-05:00");

    // Tokyo (UTC+9)
    const formattedTokyo = formatInTimeZone(utcDate, "Asia/Tokyo");
    expect(formattedTokyo).toBe("2026-06-08T05:00:00.000+09:00");

    // UTC
    const formattedUtc = formatInTimeZone(utcDate, "UTC");
    expect(formattedUtc).toBe("2026-06-07T20:00:00.000Z");
  });

  test("parseInTimeZone should parse date-only strings without treating the day suffix as a timezone offset", () => {
    // Should parse June 8 as midnight in Chicago, which is 05:00 UTC (CDT = UTC-5)
    const dateOnly = parseInTimeZone("2026-06-08", "America/Chicago");
    expect(dateOnly.toISOString()).toBe("2026-06-08T05:00:00.000Z");

    // December 8 is standard time (CST = UTC-6)
    const dateOnlyStd = parseInTimeZone("2026-12-08", "America/Chicago");
    expect(dateOnlyStd.toISOString()).toBe("2026-12-08T06:00:00.000Z");
  });
});
