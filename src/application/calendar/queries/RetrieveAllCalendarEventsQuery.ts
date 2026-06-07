import type { IQuery } from "../../seedwork/IQuery";
import type { CalendarEventDto } from "./RetrieveCalendarEventsQuery";

/**
 * Data transfer object containing events grouped by calendar.
 */
export interface CalendarEventsDto {
  /**
   * The name of the calendar.
   */
  calendarName: string;
  /**
   * The path identifier of the calendar.
   */
  calendarPath: string;
  /**
   * List of event DTOs for the calendar.
   */
  events: CalendarEventDto[];
}

/**
 * Query to retrieve events across all calendars within a date range.
 */
export class RetrieveAllCalendarEventsQuery implements IQuery<CalendarEventsDto[]> {
  /**
   * Creates an instance of RetrieveAllCalendarEventsQuery.
   */
  constructor(
    public readonly startDate?: Date,
    public readonly endDate?: Date,
    public readonly omit?: string[],
    public readonly timezone?: string
  ) {}
}
