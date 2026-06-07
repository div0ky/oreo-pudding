import type { CalendarEvent } from "../../../domain/calendar/CalendarEvent";
import type { CalDavSerializationStrategy } from "./CalDavSerializationStrategy";

export class ICalSerializationStrategy implements CalDavSerializationStrategy {
  /**
   * Transforms a CalendarEvent aggregate into a physical iCalendar string payload.
   * Conforming to CalDAV specifications, dates are formatted to pure UTC representation.
   */
  public serialize(event: CalendarEvent): string {
    const formatDate = (date: Date): string => {
      // Strips ISO characters like "-" and ":" and milliseconds
      // e.g., "2026-06-07T19:34:41.000Z" -> "20260607T193441Z"
      return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    };

    const startStr = formatDate(event.dateRange.startDate);
    const endStr = formatDate(event.dateRange.endDate);
    const timestampStr = formatDate(new Date());
    const uid = event.id.value;

    // RFC 5545 Text Escaping Rule:
    // Any character semi-colon, comma, backslash, or newline must be escaped.
    const escapeText = (text: string): string => {
      return text
        .replace(/\\/g, "\\\\")
        .replace(/,/g, "\\,")
        .replace(/;/g, "\\;")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "");
    };

    const title = escapeText(event.details.title);
    const description = escapeText(event.details.description);

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Oreo Pudding//NONSGML Calendar//EN",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${timestampStr}`,
      `DTSTART:${startStr}`,
      `DTEND:${endStr}`,
      `SUMMARY:${title}`,
      description ? `DESCRIPTION:${description}` : "",
      "END:VEVENT",
      "END:VCALENDAR"
    ].filter(line => line !== "");

    // CalDAV/iCalendar uses strict CRLF (\r\n) line endings
    return lines.join("\r\n") + "\r\n";
  }
}
