import type { CalendarEvent } from "./CalendarEvent";
import type { AppleCredentials } from "./value-objects/AppleCredentials";
import type { CalendarPath } from "./value-objects/CalendarPath";

/**
 * Repository port interface for CalDAV calendar event storage operations.
 */
export interface ICalDavRepository {
  /**
   * Saves or updates a calendar event aggregate in the remote CalDAV store.
   */
  save(
    event: CalendarEvent,
    payload: string,
    credentials: AppleCredentials,
    calendarPath: CalendarPath
  ): Promise<void>;

  /**
   * Finds a calendar event by its ID within a specific calendar path.
   */
  findById(
    eventId: string,
    credentials: AppleCredentials,
    calendarPath: CalendarPath
  ): Promise<CalendarEvent | null>;

  /**
   * Retrieves events from a calendar path matching the optional date range.
   */
  find(
    credentials: AppleCredentials,
    calendarPath: CalendarPath,
    startDate?: Date,
    endDate?: Date
  ): Promise<CalendarEvent[]>;

  /**
   * Discovers all calendars associated with the given credentials.
   */
  discoverCalendars(
    credentials: AppleCredentials
  ): Promise<{ /**
   * The name of the calendar.
   */
  name: string; /**
   * The path identifier of the calendar.
   */
  path: string }[]>;

  /**
   * Selects the default/primary calendar from a list of discovered calendars.
   */
  getDefaultCalendar(
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
  path: string };
}
