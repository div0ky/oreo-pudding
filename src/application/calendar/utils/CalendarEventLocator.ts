import { AppleCredentials } from "../../../domain/calendar/value-objects/AppleCredentials";
import { CalendarPath } from "../../../domain/calendar/value-objects/CalendarPath";
import type { CalendarEvent } from "../../../domain/calendar/CalendarEvent";
import type { ICalDavRepository } from "../../../domain/calendar/ICalDavRepository";

/**
 * A calendar event resolved to the calendar holding it.
 */
export interface LocatedCalendarEvent {
  /**
   * The resolved aggregate.
   */
  event: CalendarEvent;
  /**
   * The calendar path holding the event.
   */
  calendarPath: CalendarPath;
  /**
   * The display name of the holding calendar when discovered.
   */
  calendarName?: string;
}

/**
 * Locates an event by ID within an explicit calendar path, or auto-discovers
 * the holding calendar (default-first, then fan-out search) when omitted.
 */
export async function locateCalendarEvent(
  repository: ICalDavRepository,
  credentials: AppleCredentials,
  eventId: string,
  calendarPath?: string
): Promise<LocatedCalendarEvent> {
  if (calendarPath && calendarPath.trim() !== "") {
    const path = new CalendarPath(calendarPath);
    const event = await repository.findById(eventId, credentials, path);
    if (!event) {
      throw new Error(
        `Calendar event with ID '${eventId}' not found in calendar path '${calendarPath}'.`
      );
    }
    return { event, calendarPath: path };
  }

  // Auto-discover calendar path
  const calendars = await repository.discoverCalendars(credentials);
  if (calendars.length === 0) {
    throw new Error("No calendars found for this iCloud account.");
  }

  // Try the default calendar first (optimization)
  const defaultCal = repository.getDefaultCalendar(calendars);
  const defaultPath = new CalendarPath(defaultCal.path);
  const defaultEvent = await repository.findById(eventId, credentials, defaultPath);

  if (defaultEvent) {
    return { event: defaultEvent, calendarPath: defaultPath, calendarName: defaultCal.name };
  }

  // Search remaining calendars
  const otherCalendars = calendars.filter((c) => c.path !== defaultCal.path);
  const searchResults = await Promise.all(
    otherCalendars.map(async (cal) => {
      try {
        const path = new CalendarPath(cal.path);
        const found = await repository.findById(eventId, credentials, path);
        return found ? { event: found, path, name: cal.name } : null;
      } catch {
        return null;
      }
    })
  );

  const foundResult = searchResults.find((r) => r !== null);
  if (foundResult) {
    return {
      event: foundResult.event,
      calendarPath: foundResult.path,
      calendarName: foundResult.name
    };
  }

  throw new Error(
    `Calendar event with ID '${eventId}' not found across any discovered calendars.`
  );
}
