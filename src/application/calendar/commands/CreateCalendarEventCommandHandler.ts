import type { ICommandHandler } from "../../seedwork/ICommandHandler";
import { CreateCalendarEventCommand } from "./CreateCalendarEventCommand";
import { AppleCredentials } from "../../../domain/calendar/value-objects/AppleCredentials";
import { DateRange } from "../../../domain/calendar/value-objects/DateRange";
import { EventDetails } from "../../../domain/calendar/value-objects/EventDetails";
import { CalendarPath } from "../../../domain/calendar/value-objects/CalendarPath";
import { CalendarEvent } from "../../../domain/calendar/CalendarEvent";
import type { ICalDavRepository } from "../../../domain/calendar/ICalDavRepository";
import type { CalDavSerializationStrategy } from "../../../infrastructure/calendar/serialization/CalDavSerializationStrategy";

export class CreateCalendarEventCommandHandler
  implements ICommandHandler<CreateCalendarEventCommand, string>
{
  constructor(
    private readonly repository: ICalDavRepository,
    private readonly serializationStrategy: CalDavSerializationStrategy
  ) {}

  /**
   * Orchestrates the creation and CalDAV persistence of a CalendarEvent.
   */
  public async handle(command: CreateCalendarEventCommand): Promise<string> {
    // 1. Initialize value objects, triggering validation invariants
    const credentials = new AppleCredentials(command.appleId, command.appSpecificPassword);
    const dateRange = new DateRange(command.startDate, command.endDate);
    const details = new EventDetails(command.title, command.description, command.location, command.url);
    const calendarPath = new CalendarPath(command.calendarPath);

    // 2. Aggregate Root Factory creation
    const event = CalendarEvent.create(dateRange, details);

    // 3. Serialize aggregate using the strategy pattern
    const payload = this.serializationStrategy.serialize(event);

    // 4. Commit results using the repository port
    await this.repository.save(event, payload, credentials, calendarPath);

    return event.id.value;
  }
}
