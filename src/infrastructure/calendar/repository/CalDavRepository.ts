import type { ICalDavRepository } from "../../../domain/calendar/ICalDavRepository";
import type { CalendarEvent } from "../../../domain/calendar/CalendarEvent";
import type { AppleCredentials } from "../../../domain/calendar/value-objects/AppleCredentials";
import type { CalendarPath } from "../../../domain/calendar/value-objects/CalendarPath";
import { ICalSerializationStrategy } from "../serialization/ICalSerializationStrategy";

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
  revalidating: boolean;
}

/**
 * CalDAV client repository implementation for syncing calendar data with iCloud.
 */
export class CalDavRepository implements ICalDavRepository {
  private readonly calendarsCache = new Map<string, CacheEntry<{ /**
   * The calendar display name.
   */
  name: string; /**
   * The calendar HTTP path suffix.
   */
  path: string }[]>>();
  private readonly eventsQueryCache = new Map<string, CacheEntry<CalendarEvent[]>>();
  private readonly eventsByIdCache = new Map<string, CacheEntry<CalendarEvent | null>>();

  private readonly CALENDAR_CACHE_TTL = 48 * 60 * 60 * 1000; // 48 hours
  private readonly EVENTS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Helper to invalidate all event-related cache keys for a given user & calendar path.
   */
  private invalidateEventCaches(appleId: string, path: string): void {
    const prefix = `${appleId}:${path}`;

    for (const key of this.eventsQueryCache.keys()) {
      if (key.startsWith(prefix)) {
        this.eventsQueryCache.delete(key);
      }
    }

    for (const key of this.eventsByIdCache.keys()) {
      if (key.startsWith(prefix)) {
        this.eventsByIdCache.delete(key);
      }
    }
  }

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
    // Invalidate events cache to prevent stale reads
    this.invalidateEventCaches(credentials.appleId, calendarPath.value);

    await this.saveLive(event, payload, credentials, calendarPath);
  }

  private async saveLive(
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
    const key = `${credentials.appleId}:${calendarPath.value}:${eventId}`;
    const now = Date.now();
    const cached = this.eventsByIdCache.get(key);

    if (!cached) {
      const data = await this.findByIdLive(eventId, credentials, calendarPath);
      this.eventsByIdCache.set(key, { data, fetchedAt: now, revalidating: false });
      return data;
    }

    const age = now - cached.fetchedAt;
    if (age >= this.EVENTS_CACHE_TTL) {
      if (!cached.revalidating) {
        cached.revalidating = true;
        this.findByIdLive(eventId, credentials, calendarPath)
          .then((freshData) => {
            cached.data = freshData;
            cached.fetchedAt = Date.now();
          })
          .catch((err) => {
            console.error("Background findById revalidation failed:", err);
          })
          .finally(() => {
            cached.revalidating = false;
          });
      }
    }

    return cached.data;
  }

  private async findByIdLive(
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
    const key = `${credentials.appleId}:${calendarPath.value}:${startDate?.getTime() ?? "none"}:${endDate?.getTime() ?? "none"}`;
    const now = Date.now();
    const cached = this.eventsQueryCache.get(key);

    let data: CalendarEvent[];
    let fetchedAt: number;
    let isStale = false;

    if (!cached) {
      data = await this.findLive(credentials, calendarPath, startDate, endDate);
      fetchedAt = now;
      this.eventsQueryCache.set(key, { data, fetchedAt: now, revalidating: false });
    } else {
      data = cached.data;
      fetchedAt = cached.fetchedAt;
      const age = now - fetchedAt;
      if (age >= this.EVENTS_CACHE_TTL) {
        isStale = true;
        if (!cached.revalidating) {
          cached.revalidating = true;
          this.findLive(credentials, calendarPath, startDate, endDate)
            .then((freshData) => {
              cached.data = freshData;
              cached.fetchedAt = Date.now();
            })
            .catch((err) => {
              console.error("Background find revalidation failed:", err);
            })
            .finally(() => {
              cached.revalidating = false;
            });
        }
      }
    }

    const result = [...data];
    Object.defineProperty(result, "_swr", {
      value: {
        cachedAt: new Date(fetchedAt).toISOString(),
        staleAt: new Date(fetchedAt + this.EVENTS_CACHE_TTL).toISOString(),
        isStale
      },
      enumerable: false,
      writable: true,
      configurable: true
    });

    return result;
  }

  private async findLive(
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

      const content = dataMatch[1];
      if (!content) continue;
      let icsContent = content.trim();
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
   * Discovers all available calendars for the user, utilizing caching.
   */
  public async discoverCalendars(
    credentials: AppleCredentials
  ): Promise<{ /**
   * The calendar name.
   */
  name: string; /**
   * The calendar path.
   */
  path: string }[]> {
    const key = credentials.appleId;
    const now = Date.now();
    const cached = this.calendarsCache.get(key);

    let data: { /**
     * The calendar name.
     */
    name: string; /**
     * The calendar path.
     */
    path: string }[];
    let fetchedAt: number;
    let isStale = false;

    if (!cached) {
      data = await this.discoverCalendarsLive(credentials);
      fetchedAt = now;
      this.calendarsCache.set(key, { data, fetchedAt, revalidating: false });
    } else {
      data = cached.data;
      fetchedAt = cached.fetchedAt;
      const age = now - fetchedAt;
      if (age >= this.CALENDAR_CACHE_TTL) {
        isStale = true;
        if (!cached.revalidating) {
          cached.revalidating = true;
          this.discoverCalendarsLive(credentials)
            .then((freshData) => {
              cached.data = freshData;
              cached.fetchedAt = Date.now();
            })
            .catch((err) => {
              console.error("Background discoverCalendars revalidation failed:", err);
            })
            .finally(() => {
              cached.revalidating = false;
            });
        }
      }
    }

    const result = [...data];
    Object.defineProperty(result, "_swr", {
      value: {
        cachedAt: new Date(fetchedAt).toISOString(),
        staleAt: new Date(fetchedAt + this.CALENDAR_CACHE_TTL).toISOString(),
        isStale
      },
      enumerable: false,
      writable: true,
      configurable: true
    });

    return result;
  }

  private async discoverCalendarsLive(
    credentials: AppleCredentials
  ): Promise<{ /**
   * The calendar name.
   */
  name: string; /**
   * The calendar path.
   */
  path: string }[]> {
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
    const principalContent = principalMatch[1];
    if (!principalContent) {
      throw new Error("Could not parse current-user-principal href from XML response.");
    }
    const principalPath = principalContent.trim();

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
    const homeSetContent = homeSetMatch[1];
    if (!homeSetContent) {
      throw new Error("Could not parse calendar-home-set href from XML response.");
    }
    const calendarHomeSetPath = homeSetContent.trim();

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

    const calendars: { /**
     * The calendar name.
     */
    name: string; /**
     * The calendar path.
     */
    path: string }[] = [];

    for (const responseBlock of responseMatches) {
      // Check if it's a calendar collection
      const resourceTypeMatch = responseBlock.match(/<[^:]*:?resourcetype[^>]*>([\s\S]*?)<\/[^:]*:?resourcetype>/i);
      const resourceTypeVal = resourceTypeMatch?.[1];
      const isCalendar = resourceTypeVal && /<[^:]*:?calendar[\s\/>]/i.test(resourceTypeVal);
      if (!isCalendar) {
        continue;
      }

      const hrefMatch = responseBlock.match(/<[^:]*:?href[^>]*>([\s\S]*?)<\/[^:]*:?href>/i);
      const hrefVal = hrefMatch?.[1];
      if (!hrefVal) {
        continue;
      }
      const path = hrefVal.trim();

      const displayNameMatch = responseBlock.match(/<[^:]*:?displayname[^>]*>([\s\S]*?)<\/[^:]*:?displayname>/i);
      const nameVal = displayNameMatch?.[1];
      const name = nameVal ? nameVal.trim() : "Unnamed Calendar";

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
    calendars: { /**
     * The calendar name.
     */
    name: string; /**
     * The calendar path.
     */
    path: string }[]
  ): { /**
   * The default calendar name.
   */
  name: string; /**
   * The default calendar path.
   */
  path: string } {
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
    const defaultCal = sorted[0];
    if (!defaultCal) {
      throw new Error("No calendars available to select a default.");
    }
    return defaultCal;
  }
}

