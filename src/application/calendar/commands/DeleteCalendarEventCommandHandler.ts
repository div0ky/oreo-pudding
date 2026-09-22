import type { ICommandHandler } from "../../seedwork/ICommandHandler";
import { DeleteCalendarEventCommand } from "./DeleteCalendarEventCommand";
import { AppleCredentials } from "../../../domain/calendar/value-objects/AppleCredentials";
import { CalendarPath } from "../../../domain/calendar/value-objects/CalendarPath";
import type { CalendarEvent } from "../../../domain/calendar/CalendarEvent";
import type { ICalDavRepository } from "../../../domain/calendar/ICalDavRepository";

/**
 * Command handler that handles deleting a calendar event.
 */
export class DeleteCalendarEventCommandHandler
  implements ICommandHandler<DeleteCalendarEventCommand, string>
{
  /**
   * Creates an instance of DeleteCalendarEventCommandHandler.
   */
  constructor(
    private readonly repository: ICalDavRepository
  ) {}

  /**
   * Orchestrates locating and deleting a calendar event.
   */
  public async handle(command: DeleteCalendarEventCommand): Promise<string> {
    const appleId = process.env.APP_ID || "";
    const appSpecificPassword = process.env.APP_PASS || "";
    const credentials = new AppleCredentials(appleId, appSpecificPassword);

    let event: CalendarEvent | null = null;
    let calendarPath: CalendarPath;

    if (command.calendarPath && command.calendarPath.trim() !== "") {
      calendarPath = new CalendarPath(command.calendarPath);
      event = await this.repository.findById(command.eventId, credentials, calendarPath);
      if (!event) {
        throw new Error(
          `Calendar event with ID '${command.eventId}' not found in calendar path '${command.calendarPath}'.`
        );
      }
    } else {
      // Auto-discover calendar path
      const calendars = await this.repository.discoverCalendars(credentials);
      if (calendars.length === 0) {
        throw new Error("No calendars found for this iCloud account.");
      }

      // Try the default calendar first (optimization)
      const defaultCal = this.repository.getDefaultCalendar(calendars);
      const defaultPath = new CalendarPath(defaultCal.path);
      event = await this.repository.findById(command.eventId, credentials, defaultPath);

      if (event) {
        calendarPath = defaultPath;
      } else {
        // Search remaining calendars
        const otherCalendars = calendars.filter((c) => c.path !== defaultCal.path);
        const searchResults = await Promise.all(
          otherCalendars.map(async (cal) => {
            try {
              const path = new CalendarPath(cal.path);
              const found = await this.repository.findById(command.eventId, credentials, path);
              return found ? { event: found, path } : null;
            } catch {
              return null;
            }
          })
        );

        const foundResult = searchResults.find((r) => r !== null);
        if (foundResult) {
          event = foundResult.event;
          calendarPath = foundResult.path;
        } else {
          throw new Error(
            `Calendar event with ID '${command.eventId}' not found across any discovered calendars.`
          );
        }
      }
    }

    await this.repository.delete(event.id.value, credentials, calendarPath);

    return event.id.value;
  }
}
