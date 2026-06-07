import type { ICommandHandler } from "../../seedwork/ICommandHandler";
import { CreateCalendarEventCommand } from "./CreateCalendarEventCommand";
import { AppleCredentials } from "../../../domain/calendar/value-objects/AppleCredentials";
import { DateRange } from "../../../domain/calendar/value-objects/DateRange";
import { EventDetails } from "../../../domain/calendar/value-objects/EventDetails";
import { CalendarPath } from "../../../domain/calendar/value-objects/CalendarPath";
import { CalendarEvent } from "../../../domain/calendar/CalendarEvent";
import type { ICalDavRepository } from "../../../domain/calendar/ICalDavRepository";
import type { CalDavSerializationStrategy } from "../../../infrastructure/calendar/serialization/CalDavSerializationStrategy";

/**
 * Command handler that orchestrates the creation of calendar events.
 */
export class CreateCalendarEventCommandHandler
  implements ICommandHandler<CreateCalendarEventCommand, string>
{
  /**
   * Creates an instance of CreateCalendarEventCommandHandler.
   */
  constructor(
    private readonly repository: ICalDavRepository,
    private readonly serializationStrategy: CalDavSerializationStrategy
  ) {}

  /**
   * Orchestrates the creation and CalDAV persistence of a CalendarEvent.
   */
  public async handle(command: CreateCalendarEventCommand): Promise<string> {
    // 1. Initialize credentials & basic details
    const credentials = new AppleCredentials(command.appleId, command.appSpecificPassword);
    const dateRange = new DateRange(command.startDate, command.endDate);
    const details = new EventDetails(command.title, command.description, command.location, command.url);

    // 2. Discover default calendar if none provided
    let pathStr = command.calendarPath;
    if (!pathStr || pathStr.trim() === "") {
      const calendars = await this.repository.discoverCalendars(credentials);
      if (calendars.length === 0) {
        throw new Error("No calendars found for this iCloud account.");
      }
      const defaultCal = this.repository.getDefaultCalendar(calendars);
      pathStr = defaultCal.path;
    }
    const calendarPath = new CalendarPath(pathStr);

    // 2. Aggregate Root Factory creation
    const event = CalendarEvent.create(dateRange, details);

    // 3. Serialize aggregate using the strategy pattern
    const payload = this.serializationStrategy.serialize(event);

    // 4. Commit results using the repository port
    await this.repository.save(event, payload, credentials, calendarPath);

    return event.id.value;
  }
}
