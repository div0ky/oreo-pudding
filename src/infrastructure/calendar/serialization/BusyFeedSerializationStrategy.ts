import type { BusyBlock } from "../../../domain/calendar/BusinessHoursPolicy";

/**
 * Serializes Busy blocks into a privacy-masked RFC 5545 VCALENDAR feed.
 */
export class BusyFeedSerializationStrategy {
  /**
   * Transforms Busy blocks into a complete iCalendar feed string.
   * All blocks are emitted as availability-only VEVENTs with SUMMARY:Busy
   * and no title, description, location, or URL.
   */
  public serializeFeed(blocks: BusyBlock[]): string {
    const formatDate = (date: Date): string => {
      return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    };

    const timestampStr = formatDate(new Date());

    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Oreo Pudding//Busy Feed//EN",
      "CALSCALE:GREGORIAN",
      "X-WR-CALNAME:Busy"
    ];

    for (const block of blocks) {
      lines.push(
        "BEGIN:VEVENT",
        `UID:${block.busyId.value}`,
        `DTSTAMP:${timestampStr}`,
        `DTSTART:${formatDate(block.dateRange.startDate)}`,
        `DTEND:${formatDate(block.dateRange.endDate)}`,
        "SUMMARY:Busy",
        "STATUS:CONFIRMED",
        "TRANSP:OPAQUE",
        "END:VEVENT"
      );
    }

    lines.push("END:VCALENDAR");

    return lines.join("\r\n") + "\r\n";
  }
}
