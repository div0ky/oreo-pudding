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

  /**
   * Discovers all available calendars for the user.
   */
  public async discoverCalendars(
    credentials: AppleCredentials
  ): Promise<{ name: string; path: string }[]> {
    // Step 1: Query current-user-principal on /
    const principalUrl = "https://caldav.icloud.com/";
    const principalHeaders = new Headers();
    principalHeaders.set("Authorization", credentials.toBasicAuthHeader());
    principalHeaders.set("Depth", "0");
    principalHeaders.set("Content-Type", "application/xml; charset=utf-8");
    principalHeaders.set("User-Agent", "Oreo-Pudding-CalDAV/1.0");

    const principalXml = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:current-user-principal/>
  </d:prop>
</d:propfind>`;

    const principalResponse = await fetch(principalUrl, {
      method: "PROPFIND",
      headers: principalHeaders,
      body: principalXml
    });

    if (!principalResponse.ok) {
      const text = await principalResponse.text().catch(() => "");
      throw new Error(`Failed to find current-user-principal. Status: ${principalResponse.status}. Server response: ${text}`);
    }

    const principalXmlText = await principalResponse.text();
    const principalMatch = principalXmlText.match(/<[^:]*:?current-user-principal[\s>][\s\S]*?<[^:]*:?href[^>]*>([\s\S]*?)<\/[^:]*:?href>/i);
    if (!principalMatch) {
      throw new Error("Could not parse current-user-principal href from XML response.");
    }
    const principalPath = principalMatch[1].trim();

    // Step 2: Query calendar-home-set on the principal URL
    const homeSetUrl = principalPath.startsWith("http")
      ? principalPath
      : `https://caldav.icloud.com${principalPath.startsWith("/") ? principalPath : `/${principalPath}`}`;
    
    const homeSetHeaders = new Headers();
    homeSetHeaders.set("Authorization", credentials.toBasicAuthHeader());
    homeSetHeaders.set("Depth", "0");
    homeSetHeaders.set("Content-Type", "application/xml; charset=utf-8");
    homeSetHeaders.set("User-Agent", "Oreo-Pudding-CalDAV/1.0");

    const homeSetXml = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <c:calendar-home-set />
  </d:prop>
</d:propfind>`;

    const homeSetResponse = await fetch(homeSetUrl, {
      method: "PROPFIND",
      headers: homeSetHeaders,
      body: homeSetXml
    });

    if (!homeSetResponse.ok) {
      const text = await homeSetResponse.text().catch(() => "");
      throw new Error(`Failed to retrieve calendar-home-set from principal path '${principalPath}'. Status: ${homeSetResponse.status}. Server response: ${text}`);
    }

    const homeSetXmlText = await homeSetResponse.text();
    const homeSetMatch = homeSetXmlText.match(/<[^:]*:?calendar-home-set[\s>][\s\S]*?<[^:]*:?href[^>]*>([\s\S]*?)<\/[^:]*:?href>/i);
    if (!homeSetMatch) {
      throw new Error("Could not parse calendar-home-set href from XML response.");
    }
    const calendarHomeSetPath = homeSetMatch[1].trim();

    // Step 3: Query displayname and resourcetype on the calendar-home-set URL with Depth: 1
    const listUrl = calendarHomeSetPath.startsWith("http")
      ? calendarHomeSetPath
      : `https://caldav.icloud.com${calendarHomeSetPath.startsWith("/") ? calendarHomeSetPath : `/${calendarHomeSetPath}`}`;
    
    const listHeaders = new Headers();
    listHeaders.set("Authorization", credentials.toBasicAuthHeader());
    listHeaders.set("Depth", "1");
    listHeaders.set("Content-Type", "application/xml; charset=utf-8");
    listHeaders.set("User-Agent", "Oreo-Pudding-CalDAV/1.0");

    const listXml = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:displayname />
    <d:resourcetype />
  </d:prop>
</d:propfind>`;

    const listResponse = await fetch(listUrl, {
      method: "PROPFIND",
      headers: listHeaders,
      body: listXml
    });

    if (!listResponse.ok) {
      const text = await listResponse.text().catch(() => "");
      throw new Error(`Failed to list calendars from calendar-home-set path '${calendarHomeSetPath}'. Status: ${listResponse.status}. Server response: ${text}`);
    }

    const listXmlText = await listResponse.text();
    const responseMatches = listXmlText.match(/<[^:]*:?response[\s>][\s\S]*?<\/[^:]*:?response>/gi) || [];

    const calendars: { name: string; path: string }[] = [];

    for (const responseBlock of responseMatches) {
      // Check if it's a calendar collection
      const resourceTypeMatch = responseBlock.match(/<[^:]*:?resourcetype[^>]*>([\s\S]*?)<\/[^:]*:?resourcetype>/i);
      const isCalendar = resourceTypeMatch && /<[^:]*:?calendar[\s\/>]/i.test(resourceTypeMatch[1]);
      if (!isCalendar) {
        continue;
      }

      const hrefMatch = responseBlock.match(/<[^:]*:?href[^>]*>([\s\S]*?)<\/[^:]*:?href>/i);
      if (!hrefMatch) {
        continue;
      }
      const path = hrefMatch[1].trim();

      const displayNameMatch = responseBlock.match(/<[^:]*:?displayname[^>]*>([\s\S]*?)<\/[^:]*:?displayname>/i);
      const name = displayNameMatch ? displayNameMatch[1].trim() : "Unnamed Calendar";

      // Also clean up path prefix if it contains host or is relative
      let cleanPath = path;
      if (cleanPath.startsWith("https://")) {
        try {
          const u = new URL(cleanPath);
          cleanPath = u.pathname;
        } catch {
          // ignore
        }
      }

      if (cleanPath.endsWith("/")) {
        cleanPath = cleanPath.slice(0, -1);
      }

      calendars.push({ name, path: cleanPath });
    }

    return calendars;
  }

  /**
   * Selection heuristic to score and rank discovered calendars to find the best default.
   */
  public getDefaultCalendar(
    calendars: { name: string; path: string }[]
  ): { name: string; path: string } {
    const rankCalendar = (name: string, path: string): number => {
      const n = name.toLowerCase();
      const p = path.toLowerCase();
      // Heuristic rankings
      if (n === "home" || p.includes("/home")) return 100;
      if (n === "personal" || p.includes("/personal")) return 90;
      if (n === "default" || p.includes("/default")) return 80;
      if (n === "ajs" || n.includes("ajs") || p.includes("ajs")) return 70;
      if (n.includes("calendar") || p.includes("calendar")) return 60;
      if (n.includes("reminder") || n.includes("todo") || n.includes("task")) return -10;
      return 0;
    };

    const sorted = [...calendars].sort((a, b) => rankCalendar(b.name, b.path) - rankCalendar(a.name, a.path));
    return sorted[0];
  }
}
