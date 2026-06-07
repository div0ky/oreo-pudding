import type { ICalDavRepository } from "../../../domain/calendar/ICalDavRepository";
import type { CalendarEvent } from "../../../domain/calendar/CalendarEvent";
import type { AppleCredentials } from "../../../domain/calendar/value-objects/AppleCredentials";
import type { CalendarPath } from "../../../domain/calendar/value-objects/CalendarPath";
import { ICalSerializationStrategy } from "../serialization/ICalSerializationStrategy";

export class CalDavRepository implements ICalDavRepository {
  /**
   * Commits the serialized calendar event to the iCloud CalDAV server.
   * Executes an HTTP PUT against https://caldav.icloud.com/ using Bun's native fetch.
   */
  public async save(
    event: CalendarEvent,
    payload: string,
    credentials: AppleCredentials,
    calendarPath: CalendarPath
  ): Promise<void> {
    // Formulate clean path
    const path = calendarPath.value.startsWith("/")
      ? calendarPath.value
      : `/${calendarPath.value}`;
    
    const url = `https://caldav.icloud.com${path}/${event.id.value}.ics`;

    const headers = new Headers();
    headers.set("Authorization", credentials.toBasicAuthHeader());
    headers.set("Content-Type", "text/calendar; charset=utf-8");
    headers.set("User-Agent", "Oreo-Pudding-CalDAV/1.0");

    const response = await fetch(url, {
      method: "PUT",
      headers,
      body: payload
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      throw new Error(
        `CalDAV PUT to '${url}' failed with status ${response.status} (${response.statusText}). Server Response: ${responseText}`
      );
    }
  }

  /**
   * Retrieves a single calendar event by its eventId (UID) from the CalDAV server.
   */
  public async findById(
    eventId: string,
    credentials: AppleCredentials,
    calendarPath: CalendarPath
  ): Promise<CalendarEvent | null> {
    const path = calendarPath.value.startsWith("/")
      ? calendarPath.value
      : `/${calendarPath.value}`;
    
    const url = `https://caldav.icloud.com${path}/${eventId}.ics`;

    const headers = new Headers();
    headers.set("Authorization", credentials.toBasicAuthHeader());
    headers.set("User-Agent", "Oreo-Pudding-CalDAV/1.0");

    const response = await fetch(url, {
      method: "GET",
      headers
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      throw new Error(
        `CalDAV GET to '${url}' failed with status ${response.status} (${response.statusText}). Server Response: ${responseText}`
      );
    }

    const payload = await response.text();
    const strategy = new ICalSerializationStrategy();
    return strategy.deserialize(payload);
  }

  /**
   * Queries the CalDAV server using a REPORT request to retrieve calendar events
   * within an optional date range.
   */
  public async find(
    credentials: AppleCredentials,
    calendarPath: CalendarPath,
    startDate?: Date,
    endDate?: Date
  ): Promise<CalendarEvent[]> {
    const path = calendarPath.value.startsWith("/")
      ? calendarPath.value
      : `/${calendarPath.value}`;
    
    const url = `https://caldav.icloud.com${path}`;

    let timeRangeXml = "";
    if (startDate || endDate) {
      const formatXmlDate = (date: Date): string => {
        return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      };
      const startAttr = startDate ? ` start="${formatXmlDate(startDate)}"` : "";
      const endAttr = endDate ? ` end="${formatXmlDate(endDate)}"` : "";
      timeRangeXml = `<c:time-range${startAttr}${endAttr}/>`;
    }

    const xmlBody = `<?xml version="1.0" encoding="utf-8" ?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
    <d:prop>
        <d:getetag />
        <c:calendar-data />
    </d:prop>
    <c:filter>
        <c:comp-filter name="VCALENDAR">
            <c:comp-filter name="VEVENT">
                ${timeRangeXml}
            </c:comp-filter>
        </c:comp-filter>
    </c:filter>
</c:calendar-query>`;

    const headers = new Headers();
    headers.set("Authorization", credentials.toBasicAuthHeader());
    headers.set("Content-Type", "application/xml; charset=utf-8");
    headers.set("Depth", "1");
    headers.set("User-Agent", "Oreo-Pudding-CalDAV/1.0");

    const response = await fetch(url, {
      method: "REPORT",
      headers,
      body: xmlBody
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      throw new Error(
        `CalDAV REPORT to '${url}' failed with status ${response.status} (${response.statusText}). Server Response: ${responseText}`
      );
    }

    const xmlText = await response.text();
    const events: CalendarEvent[] = [];
    const strategy = new ICalSerializationStrategy();

    // Match all response blocks case-insensitively
    const responseMatches = xmlText.match(/<[^:]*:?response[\s>][\s\S]*?<\/[^:]*:?response>/gi) || [];

    for (const responseBlock of responseMatches) {
      const dataMatch = responseBlock.match(/<[^:]*:?calendar-data[^>]*>([\s\S]*?)<\/[^:]*:?calendar-data>/i);
      if (!dataMatch) continue;

      let icsContent = dataMatch[1].trim();
      if (icsContent.startsWith("<![CDATA[")) {
        icsContent = icsContent.substring(9);
      }
      if (icsContent.endsWith("]]>")) {
        icsContent = icsContent.substring(0, icsContent.length - 3);
      }

      try {
        const event = strategy.deserialize(icsContent);
        events.push(event);
      } catch (err) {
        console.error("Failed to deserialize event from CalDAV response:", err);
      }
    }

    return events;
  }
}
