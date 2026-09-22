import { CalendarEvent } from "./CalendarEvent";
import { DateRange } from "./value-objects/DateRange";
import { EventId } from "./value-objects/EventId";

/**
 * Availability-only block derived from a source event clamped to business hours.
 */
export interface BusyBlock {
  /**
   * Stable feed identifier derived from the source event UID and local date.
   */
  busyId: EventId;
  /**
   * Original source event UID.
   */
  sourceId: EventId;
  /**
   * Clamped UTC date range for this block.
   */
  dateRange: DateRange;
  /**
   * Local workday date (YYYY-MM-DD) in the target timezone.
   */
  localDate: string;
}

interface TimeZoneParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * Pure domain policy that filters calendar events to business-hours overlap
 * and clamps them into per-workday Busy blocks.
 *
 * Zero dependencies outside the domain layer. Timezone conversions use only
 * the built-in Intl API so this policy stays independent of application utils.
 */
export class BusinessHoursPolicy {
  public static readonly START_HOUR = 8;
  public static readonly END_HOUR = 17;
  public static readonly DEFAULT_TIMEZONE = "America/Chicago";

  /**
   * Converts source events into Busy blocks overlapping 08:00-17:00.
   */
  public static toBusyBlocks(
    events: CalendarEvent[],
    timezone?: string
  ): BusyBlock[] {
    const targetTz =
      timezone && BusinessHoursPolicy.isValidTimeZone(timezone)
        ? timezone
        : BusinessHoursPolicy.DEFAULT_TIMEZONE;

    const blocks: BusyBlock[] = [];

    for (const event of events) {
      const start = event.dateRange.startDate;
      const end = event.dateRange.endDate;

      if (BusinessHoursPolicy.isAllDay(start, end, targetTz)) {
        continue;
      }

      const startLocalDate = BusinessHoursPolicy.toLocalDateString(
        start,
        targetTz
      );
      const endLocalDate = BusinessHoursPolicy.toLocalDateString(
        // Subtract 1ms so an event ending exactly at local midnight does not
        // spill into the next workday.
        new Date(end.getTime() - 1),
        targetTz
      );

      for (
        let localDate = startLocalDate;
        localDate <= endLocalDate;
        localDate = BusinessHoursPolicy.addLocalDays(localDate, 1)
      ) {
        const workday = BusinessHoursPolicy.workdayBounds(
          localDate,
          targetTz
        );
        const overlapStart = new Date(
          Math.max(start.getTime(), workday.start.getTime())
        );
        const overlapEnd = new Date(
          Math.min(end.getTime(), workday.end.getTime())
        );

        if (overlapEnd.getTime() <= overlapStart.getTime()) {
          continue;
        }

        blocks.push({
          busyId: new EventId(`${event.id.value}@${localDate}`),
          sourceId: event.id,
          dateRange: new DateRange(overlapStart, overlapEnd),
          localDate
        });
      }
    }

    blocks.sort(
      (a, b) =>
        a.dateRange.startDate.getTime() - b.dateRange.startDate.getTime()
    );
    return blocks;
  }

  private static isValidTimeZone(timeZone: string): boolean {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone });
      return true;
    } catch {
      return false;
    }
  }

  private static getParts(date: Date, timeZone: string): TimeZoneParts {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
    const partMap = new Map(
      formatter.formatToParts(date).map((p) => [p.type, p.value])
    );
    let hour = parseInt(partMap.get("hour") ?? "0", 10);
    if (hour === 24) {
      hour = 0;
    }
    return {
      year: parseInt(partMap.get("year") ?? "0", 10),
      month: parseInt(partMap.get("month") ?? "0", 10),
      day: parseInt(partMap.get("day") ?? "0", 10),
      hour,
      minute: parseInt(partMap.get("minute") ?? "0", 10),
      second: parseInt(partMap.get("second") ?? "0", 10)
    };
  }

  private static toLocalDateString(date: Date, timeZone: string): string {
    const parts = BusinessHoursPolicy.getParts(date, timeZone);
    const month = String(parts.month).padStart(2, "0");
    const day = String(parts.day).padStart(2, "0");
    return `${parts.year}-${month}-${day}`;
  }

  private static isAllDay(
    start: Date,
    end: Date,
    timeZone: string
  ): boolean {
    const startParts = BusinessHoursPolicy.getParts(start, timeZone);
    const endParts = BusinessHoursPolicy.getParts(end, timeZone);
    const startsAtMidnight =
      startParts.hour === 0 &&
      startParts.minute === 0 &&
      startParts.second === 0;
    const endsAtMidnight =
      endParts.hour === 0 && endParts.minute === 0 && endParts.second === 0;
    return startsAtMidnight && endsAtMidnight;
  }

  private static addLocalDays(localDate: string, days: number): string {
    const [y, m, d] = localDate.split("-").map((v) => parseInt(v, 10));
    const utc = Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1);
    const next = new Date(utc + days * 24 * 60 * 60 * 1000);
    const month = String(next.getUTCMonth() + 1).padStart(2, "0");
    const day = String(next.getUTCDate()).padStart(2, "0");
    return `${next.getUTCFullYear()}-${month}-${day}`;
  }

  private static workdayBounds(
    localDate: string,
    timeZone: string
  ): { start: Date; end: Date } {
    const [y, m, d] = localDate.split("-").map((v) => parseInt(v, 10));
    return {
      start: BusinessHoursPolicy.zonedTimeToUtc(
        y ?? 0,
        m ?? 1,
        d ?? 1,
        BusinessHoursPolicy.START_HOUR,
        0,
        0,
        timeZone
      ),
      end: BusinessHoursPolicy.zonedTimeToUtc(
        y ?? 0,
        m ?? 1,
        d ?? 1,
        BusinessHoursPolicy.END_HOUR,
        0,
        0,
        timeZone
      )
    };
  }

  private static zonedTimeToUtc(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
    timeZone: string
  ): Date {
    const utcGuess = new Date(
      Date.UTC(year, month - 1, day, hour, minute, second)
    );
    const parts = BusinessHoursPolicy.getParts(utcGuess, timeZone);
    const tzUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    const offset = utcGuess.getTime() - tzUtc;
    return new Date(utcGuess.getTime() + offset);
  }
}
