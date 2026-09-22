import type { IQueryHandler } from "../../seedwork/IQueryHandler";
import { GetBusyFeedQuery } from "./GetBusyFeedQuery";
import { AppleCredentials } from "../../../domain/calendar/value-objects/AppleCredentials";
import { CalendarPath } from "../../../domain/calendar/value-objects/CalendarPath";
import type { ICalDavRepository } from "../../../domain/calendar/ICalDavRepository";
import { BusinessHoursPolicy } from "../../../domain/calendar/BusinessHoursPolicy";
import type { CalendarEvent } from "../../../domain/calendar/CalendarEvent";
import type { BusyFeedSerializationStrategy } from "../../../infrastructure/calendar/serialization/BusyFeedSerializationStrategy";
import { isValidTimeZone } from "../../utils/TimeZoneHelper";

/**
 * Query handler that builds a privacy-masked Busy ICS feed.
 */
export class GetBusyFeedQueryHandler
  implements IQueryHandler<GetBusyFeedQuery, string>
{
  /**
   * Creates an instance of GetBusyFeedQueryHandler.
   */
  constructor(
    private readonly repository: ICalDavRepository,
    private readonly serializer: BusyFeedSerializationStrategy
  ) {}

  /**
   * Orchestrates discovering calendars, retrieving events, clamping to
   * business hours, and serializing to a VCALENDAR feed.
   */
  public async handle(query: GetBusyFeedQuery): Promise<string> {
    const appleId = process.env.APP_ID || "";
    const appSpecificPassword = process.env.APP_PASS || "";
    const credentials = new AppleCredentials(appleId, appSpecificPassword);

    const calendars = await this.repository.discoverCalendars(credentials);
    const targetTz =
      query.timezone && isValidTimeZone(query.timezone)
        ? query.timezone
        : "America/Chicago";

    if (calendars.length === 0) {
      return this.serializer.serializeFeed([]);
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

    const results = await Promise.all(
      filteredCalendars.map(async (cal): Promise<CalendarEvent[]> => {
        try {
          const calendarPath = new CalendarPath(cal.path);
          return await this.repository.find(
            credentials,
            calendarPath,
            query.startDate,
            query.endDate
          );
        } catch (error) {
          console.error(
            `Failed to fetch events for calendar '${cal.name}' (${cal.path}):`,
            error
          );
          return [];
        }
      })
    );

    const allEvents = results.flat();
    const blocks = BusinessHoursPolicy.toBusyBlocks(allEvents, targetTz);
    return this.serializer.serializeFeed(blocks);
  }
}
