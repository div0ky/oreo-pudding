import type { CalendarEvent } from "./CalendarEvent";
import type { AppleCredentials } from "./value-objects/AppleCredentials";
import type { CalendarPath } from "./value-objects/CalendarPath";

export interface ICalDavRepository {
  save(
    event: CalendarEvent,
    payload: string,
    credentials: AppleCredentials,
    calendarPath: CalendarPath
  ): Promise<void>;

  findById(
    eventId: string,
    credentials: AppleCredentials,
    calendarPath: CalendarPath
  ): Promise<CalendarEvent | null>;

  find(
    credentials: AppleCredentials,
    calendarPath: CalendarPath,
    startDate?: Date,
    endDate?: Date
  ): Promise<CalendarEvent[]>;

  discoverCalendars(
    credentials: AppleCredentials
  ): Promise<{ name: string; path: string }[]>;

  getDefaultCalendar(
    calendars: { name: string; path: string }[]
  ): { name: string; path: string };
}
