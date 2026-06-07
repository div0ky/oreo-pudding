import type { ICommandHandler } from "../../seedwork/ICommandHandler";
import { MoveCalendarEventCommand } from "./MoveCalendarEventCommand";
import { AppleCredentials } from "../../../domain/calendar/value-objects/AppleCredentials";
import { DateRange } from "../../../domain/calendar/value-objects/DateRange";
import { CalendarPath } from "../../../domain/calendar/value-objects/CalendarPath";
import type { ICalDavRepository } from "../../../domain/calendar/ICalDavRepository";
import type { CalDavSerializationStrategy } from "../../../infrastructure/calendar/serialization/CalDavSerializationStrategy";

/**
 * Command handler that handles moving a calendar event.
 */
export class MoveCalendarEventCommandHandler
  implements ICommandHandler<MoveCalendarEventCommand, string>
{
  /**
   * Creates an instance of MoveCalendarEventCommandHandler.
   */
  constructor(
    private readonly repository: ICalDavRepository,
    private readonly serializationStrategy: CalDavSerializationStrategy
  ) {}

  /**
   * Orchestrates locating and updating the date range of a calendar event.
   */
  public async handle(command: MoveCalendarEventCommand): Promise<string> {
    const appleId = process.env.APP_ID || "";
    const appSpecificPassword = process.env.APP_PASS || "";
    const credentials = new AppleCredentials(appleId, appSpecificPassword);

    let event: any = null;
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

    // Calculate new date range, preserving duration if newEnd is not specified
    const duration = event.dateRange.endDate.getTime() - event.dateRange.startDate.getTime();
    const finalStart = command.newStart;
    const finalEnd =
      command.newEnd !== undefined ? command.newEnd : new Date(finalStart.getTime() + duration);

    const newDateRange = new DateRange(finalStart, finalEnd);

    // Apply change via Domain method
    event.update(newDateRange, event.details);

    // Serialize and save
    const payload = this.serializationStrategy.serialize(event);
    await this.repository.save(event, payload, credentials, calendarPath);

    return event.id.value;
  }
}
