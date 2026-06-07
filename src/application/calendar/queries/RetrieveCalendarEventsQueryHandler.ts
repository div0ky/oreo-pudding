import type { IQueryHandler } from "../../seedwork/IQueryHandler";
import { RetrieveCalendarEventsQuery, type CalendarEventDto } from "./RetrieveCalendarEventsQuery";
import { AppleCredentials } from "../../../domain/calendar/value-objects/AppleCredentials";
import { CalendarPath } from "../../../domain/calendar/value-objects/CalendarPath";
import type { ICalDavRepository } from "../../../domain/calendar/ICalDavRepository";
import { formatInTimeZone, isValidTimeZone } from "../../utils/TimeZoneHelper";

/**
 * Query handler that handles retrieving calendar events.
 */
export class RetrieveCalendarEventsQueryHandler
  implements IQueryHandler<RetrieveCalendarEventsQuery, CalendarEventDto[]>
{
  /**
   * Creates an instance of RetrieveCalendarEventsQueryHandler.
   */
  constructor(private readonly repository: ICalDavRepository) {}

  /**
   * Orchestrates retrieving events from a specific calendar using CalDAV.
   */
  public async handle(query: RetrieveCalendarEventsQuery): Promise<CalendarEventDto[]> {
    const credentials = new AppleCredentials(query.appleId, query.appSpecificPassword);
    
    let pathStr = query.calendarPath;
    if (!pathStr || pathStr.trim() === "") {
      const calendars = await this.repository.discoverCalendars(credentials);
      if (calendars.length === 0) {
        throw new Error("No calendars found for this iCloud account.");
      }
      const defaultCal = this.repository.getDefaultCalendar(calendars);
      pathStr = defaultCal.path;
    }
    const calendarPath = new CalendarPath(pathStr);

    const events = await this.repository.find(
      credentials,
      calendarPath,
      query.startDate,
      query.endDate
    );

    const targetTz = query.timezone && isValidTimeZone(query.timezone) ? query.timezone : "America/Chicago";

    const result = events.map((event) => ({
      eventId: event.id.value,
      title: event.details.title,
      description: event.details.description,
      location: event.details.location,
      url: event.details.url,
      startDate: formatInTimeZone(event.dateRange.startDate, targetTz),
      endDate: formatInTimeZone(event.dateRange.endDate, targetTz),
      timezone: targetTz
    }));

    if ("_swr" in events) {
      Object.defineProperty(result, "_swr", {
        value: (events as any)._swr,
        enumerable: false,
        writable: true,
        configurable: true
      });
    }

    return result;
  }
}
