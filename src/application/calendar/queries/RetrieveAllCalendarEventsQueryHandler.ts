import type { IQueryHandler } from "../../seedwork/IQueryHandler";
import { RetrieveAllCalendarEventsQuery, type CalendarEventsDto } from "./RetrieveAllCalendarEventsQuery";
import { AppleCredentials } from "../../../domain/calendar/value-objects/AppleCredentials";
import { CalendarPath } from "../../../domain/calendar/value-objects/CalendarPath";
import type { ICalDavRepository } from "../../../domain/calendar/ICalDavRepository";
import { formatInTimeZone, isValidTimeZone } from "../../utils/TimeZoneHelper";

/**
 * Query handler that handles retrieving calendar events across all calendars.
 */
export class RetrieveAllCalendarEventsQueryHandler
  implements IQueryHandler<RetrieveAllCalendarEventsQuery, CalendarEventsDto[]>
{
  /**
   * Creates an instance of RetrieveAllCalendarEventsQueryHandler.
   */
  constructor(private readonly repository: ICalDavRepository) {}

  /**
   * Orchestrates discovering calendars and retrieving events from each of them.
   */
  public async handle(query: RetrieveAllCalendarEventsQuery): Promise<CalendarEventsDto[]> {
    const appleId = process.env.APP_ID || "";
    const appSpecificPassword = process.env.APP_PASS || "";
    const credentials = new AppleCredentials(appleId, appSpecificPassword);

    const calendars = await this.repository.discoverCalendars(credentials);
    if (calendars.length === 0) {
      return [];
    }

    const omitList = (query.omit || []).map((o) => o.trim().toLowerCase());

    const filteredCalendars = calendars.filter((cal) => {
      const nameLower = cal.name.toLowerCase();
      const pathLower = cal.path.toLowerCase();
      return !omitList.some(
        (omitVal) =>
          nameLower === omitVal ||
          pathLower === omitVal ||
          nameLower.includes(omitVal) ||
          pathLower.includes(omitVal)
      );
    });

    const targetTz = query.timezone && isValidTimeZone(query.timezone) ? query.timezone : "America/Chicago";

    const results = await Promise.all(
      filteredCalendars.map(async (cal) => {
        try {
          const calendarPath = new CalendarPath(cal.path);
          const events = await this.repository.find(
            credentials,
            calendarPath,
            query.startDate,
            query.endDate
          );

          const mappedEvents = events.map((event) => ({
            eventId: event.id.value,
            title: event.details.title,
            description: event.details.description,
            location: event.details.location,
            url: event.details.url,
            startDate: formatInTimeZone(event.dateRange.startDate, targetTz),
            endDate: formatInTimeZone(event.dateRange.endDate, targetTz),
            timezone: targetTz
          }));

          return {
            calendarName: cal.name,
            calendarPath: cal.path,
            events: mappedEvents,
            _swr: (events as any)._swr
          };
        } catch (error) {
          console.error(`Failed to fetch events for calendar '${cal.name}' (${cal.path}):`, error);
          return {
            calendarName: cal.name,
            calendarPath: cal.path,
            events: [],
            _swr: undefined
          };
        }
      })
    );

    // Aggregate SWR caching metadata
    let cachedAt: Date | undefined;
    let staleAt: Date | undefined;
    let isStale = false;

    const discoverSwr = (calendars as any)._swr;
    if (discoverSwr) {
      cachedAt = new Date(discoverSwr.cachedAt);
      staleAt = new Date(discoverSwr.staleAt);
      isStale = discoverSwr.isStale;
    }

    for (const r of results) {
      if (r._swr) {
        const swrCached = new Date(r._swr.cachedAt);
        const swrStale = new Date(r._swr.staleAt);
        if (!cachedAt || swrCached < cachedAt) cachedAt = swrCached;
        if (!staleAt || swrStale < staleAt) staleAt = swrStale;
        if (r._swr.isStale) isStale = true;
      }
    }

    const finalResult: CalendarEventsDto[] = results.map((r) => ({
      calendarName: r.calendarName,
      calendarPath: r.calendarPath,
      events: r.events
    }));

    if (cachedAt && staleAt) {
      Object.defineProperty(finalResult, "_swr", {
        value: {
          cachedAt: cachedAt.toISOString(),
          staleAt: staleAt.toISOString(),
          isStale
        },
        enumerable: false,
        writable: true,
        configurable: true
      });
    }

    return finalResult;
  }
}
