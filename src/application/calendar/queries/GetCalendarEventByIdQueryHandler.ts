import type { IQueryHandler } from "../../seedwork/IQueryHandler";
import { GetCalendarEventByIdQuery, type CalendarEventDetailDto } from "./GetCalendarEventByIdQuery";
import { AppleCredentials } from "../../../domain/calendar/value-objects/AppleCredentials";
import type { ICalDavRepository } from "../../../domain/calendar/ICalDavRepository";
import { locateCalendarEvent } from "../utils/CalendarEventLocator";

/**
 * Query handler that retrieves a single event by ID for previews.
 */
export class GetCalendarEventByIdQueryHandler
  implements IQueryHandler<GetCalendarEventByIdQuery, CalendarEventDetailDto>
{
  /**
   * Creates an instance of GetCalendarEventByIdQueryHandler.
   */
  constructor(private readonly repository: ICalDavRepository) {}

  /**
   * Orchestrates locating an event and mapping it to a detail DTO.
   */
  public async handle(query: GetCalendarEventByIdQuery): Promise<CalendarEventDetailDto> {
    const appleId = process.env.APP_ID || "";
    const appSpecificPassword = process.env.APP_PASS || "";
    const credentials = new AppleCredentials(appleId, appSpecificPassword);

    const located = await locateCalendarEvent(
      this.repository,
      credentials,
      query.eventId,
      query.calendarPath
    );

    return {
      eventId: located.event.id.value,
      calendarPath: located.calendarPath.value,
      calendarName: located.calendarName,
      title: located.event.details.title,
      description: located.event.details.description,
      location: located.event.details.location,
      url: located.event.details.url,
      startDate: located.event.dateRange.startDate.toISOString(),
      endDate: located.event.dateRange.endDate.toISOString()
    };
  }
}
