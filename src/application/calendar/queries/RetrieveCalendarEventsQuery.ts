import type { IQuery } from "../../seedwork/IQuery";

/**
 * Data transfer object representing a calendar event.
 */
export interface CalendarEventDto {
  /**
   * Unique identifier of the event.
   */
  eventId: string;
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
   * Formatted start date and time.
   */
  startDate: string;
  /**
   * Formatted end date and time.
   */
  endDate: string;
  /**
   * Timezone of the formatted event times.
   */
  timezone: string;
}

/**
 * Query to retrieve events from a specific calendar path within a date range.
 */
export class RetrieveCalendarEventsQuery implements IQuery<CalendarEventDto[]> {
  /**
   * Creates an instance of RetrieveCalendarEventsQuery.
   */
  constructor(
    public readonly appleId: string,
    public readonly appSpecificPassword: string,
    public readonly calendarPath?: string,
    public readonly startDate?: Date,
    public readonly endDate?: Date,
    public readonly timezone?: string
  ) {}
}
