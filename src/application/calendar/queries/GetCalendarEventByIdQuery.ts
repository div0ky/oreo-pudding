import type { IQuery } from "../../seedwork/IQuery";

/**
 * Data transfer object representing a single calendar event with its location.
 */
export interface CalendarEventDetailDto {
  /**
   * Unique identifier of the event.
   */
  eventId: string;
  /**
   * Calendar path holding the event.
   */
  calendarPath: string;
  /**
   * Display name of the holding calendar when discovered.
   */
  calendarName?: string;
  /**
   * Title of the event.
   */
  title: string;
  /**
   * Description or notes of the event.
   */
  description: string;
  /**
   * Location of the event.
   */
  location: string;
  /**
   * URL associated with the event.
   */
  url: string;
  /**
   * Start date and time in ISO-8601 format.
   */
  startDate: string;
  /**
   * End date and time in ISO-8601 format.
   */
  endDate: string;
}

/**
 * Query to retrieve a single event by ID, auto-discovering its calendar.
 */
export class GetCalendarEventByIdQuery implements IQuery<CalendarEventDetailDto> {
  /**
   * Creates an instance of GetCalendarEventByIdQuery.
   */
  constructor(
    public readonly eventId: string,
    public readonly calendarPath?: string
  ) {}
}
