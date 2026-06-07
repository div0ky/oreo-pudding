import { CalendarEvent } from "../../../domain/calendar/CalendarEvent";
import { EventId } from "../../../domain/calendar/value-objects/EventId";
import { DateRange } from "../../../domain/calendar/value-objects/DateRange";
import { EventDetails } from "../../../domain/calendar/value-objects/EventDetails";
import type { CalDavSerializationStrategy } from "./CalDavSerializationStrategy";
import { parseInTimeZone, isValidTimeZone } from "../../../application/utils/TimeZoneHelper";

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
    const location = escapeText(event.details.location);
    const url = escapeText(event.details.url);

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
      location ? `LOCATION:${location}` : "",
      url ? `URL:${url}` : "",
      "END:VEVENT",
      "END:VCALENDAR"
    ].filter(line => line !== "");

    // CalDAV/iCalendar uses strict CRLF (\r\n) line endings
    return lines.join("\r\n") + "\r\n";
  }

  /**
   * Transforms a physical iCalendar string payload into a CalendarEvent aggregate.
   */
  public deserialize(payload: string): CalendarEvent {
    // Unfold multi-line properties (RFC 5545: folded lines start with space/tab)
    const unfolded = payload.replace(/\r?\n[ \t]/g, "");
    const lines = unfolded.split(/\r?\n/);

    let uid = "";
    let dtstartStr = "";
    let dtstartTzid: string | undefined = undefined;
    let dtendStr = "";
    let dtendTzid: string | undefined = undefined;
    let summary = "";
    let description = "";
    let location = "";
    let url = "";
    let inVevent = false;

    const unescapeText = (text: string): string => {
      return text
        .replace(/\\n/i, "\n")
        .replace(/\\,/g, ",")
        .replace(/\\;/g, ";")
        .replace(/\\\\/g, "\\");
    };

    const parseICalDate = (val: string, tzid?: string): Date => {
      const clean = val.trim();
      // 1. UTC format: YYYYMMDDTHHMMSSZ
      if (clean.length === 16 && clean.endsWith("Z")) {
        const y = clean.substring(0, 4);
        const m = clean.substring(4, 6);
        const d = clean.substring(6, 8);
        const h = clean.substring(9, 11);
        const min = clean.substring(11, 13);
        const s = clean.substring(13, 15);
        return new Date(`${y}-${m}-${d}T${h}:${min}:${s}Z`);
      }
      // 2. Local/Floating format: YYYYMMDDTHHMMSS
      if (clean.includes("T")) {
        const parts = clean.split("T");
        const datePart = parts[0];
        const timePart = parts[1];
        const y = datePart.substring(0, 4);
        const m = datePart.substring(4, 6);
        const d = datePart.substring(6, 8);
        const h = timePart.substring(0, 2);
        const min = timePart.substring(2, 4);
        const s = timePart.substring(4, 6);
        
        const dateStr = `${y}-${m}-${d}T${h}:${min}:${s}`;
        const targetTz = tzid && isValidTimeZone(tzid) ? tzid : "America/Chicago";
        return parseInTimeZone(dateStr, targetTz);
      }
      // 3. Date only format: YYYYMMDD
      if (clean.length === 8) {
        const y = clean.substring(0, 4);
        const m = clean.substring(4, 6);
        const d = clean.substring(6, 8);
        
        const dateStr = `${y}-${m}-${d}T00:00:00`;
        const targetTz = tzid && isValidTimeZone(tzid) ? tzid : "America/Chicago";
        return parseInTimeZone(dateStr, targetTz);
      }
      return new Date(clean);
    };

    for (const line of lines) {
      if (!line || line.trim() === "") continue;
      
      const trimmedLine = line.trim();
      const upperLine = trimmedLine.toUpperCase();

      if (upperLine === "BEGIN:VEVENT") {
        inVevent = true;
        continue;
      }
      if (upperLine === "END:VEVENT") {
        inVevent = false;
        continue;
      }

      if (!inVevent) continue;

      const colonIndex = line.indexOf(":");
      if (colonIndex === -1) continue;

      const left = line.substring(0, colonIndex);
      const right = line.substring(colonIndex + 1);

      // Extract parameter-free property name
      const leftParts = left.split(";");
      const name = leftParts[0].trim().toUpperCase();

      let tzid: string | undefined = undefined;
      for (let i = 1; i < leftParts.length; i++) {
        const param = leftParts[i].trim();
        if (param.toUpperCase().startsWith("TZID=")) {
          tzid = param.substring(5);
          if (tzid.startsWith('"') && tzid.endsWith('"')) {
            tzid = tzid.substring(1, tzid.length - 1);
          }
        }
      }

      switch (name) {
        case "UID":
          uid = right.trim();
          break;
        case "DTSTART":
          dtstartStr = right.trim();
          dtstartTzid = tzid;
          break;
        case "DTEND":
          dtendStr = right.trim();
          dtendTzid = tzid;
          break;
        case "SUMMARY":
          summary = unescapeText(right);
          break;
        case "DESCRIPTION":
          description = unescapeText(right);
          break;
        case "LOCATION":
          location = unescapeText(right);
          break;
        case "URL":
          url = unescapeText(right);
          break;
        default:
          break;
      }
    }

    if (!uid) {
      throw new Error("Invalid ICS: UID is missing.");
    }
    if (!dtstartStr || !dtendStr) {
      throw new Error("Invalid ICS: DTSTART or DTEND is missing.");
    }

    const startDate = parseICalDate(dtstartStr, dtstartTzid);
    const endDate = parseICalDate(dtendStr, dtendTzid);

    return CalendarEvent.restore(
      new EventId(uid),
      new DateRange(startDate, endDate),
      new EventDetails(summary, description, location, url)
    );
  }
}
