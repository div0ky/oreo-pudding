import type { IQuery } from "../../seedwork/IQuery";

/**
 * Data transfer object representing a calendar.
 */
export interface CalendarDto {
  /**
   * The display name of the calendar.
   */
  name: string;
  /**
   * The CalDAV URL path of the calendar.
   */
  path: string;
}

/**
 * Query to list all calendars associated with an iCloud account.
 */
export class ListCalendarsQuery implements IQuery<CalendarDto[]> {
  /**
   * Creates an instance of ListCalendarsQuery.
   */
  constructor(
    public readonly appleId: string,
    public readonly appSpecificPassword: string
  ) {}
}
