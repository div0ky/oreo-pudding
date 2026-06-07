import type { ICommandHandler } from "../../seedwork/ICommandHandler";
import { UpdateCalendarEventCommand } from "./UpdateCalendarEventCommand";
import { AppleCredentials } from "../../../domain/calendar/value-objects/AppleCredentials";
import { DateRange } from "../../../domain/calendar/value-objects/DateRange";
import { EventDetails } from "../../../domain/calendar/value-objects/EventDetails";
import { CalendarPath } from "../../../domain/calendar/value-objects/CalendarPath";
import type { ICalDavRepository } from "../../../domain/calendar/ICalDavRepository";
import type { CalDavSerializationStrategy } from "../../../infrastructure/calendar/serialization/CalDavSerializationStrategy";

export class UpdateCalendarEventCommandHandler
  implements ICommandHandler<UpdateCalendarEventCommand, string>
{
  constructor(
    private readonly repository: ICalDavRepository,
    private readonly serializationStrategy: CalDavSerializationStrategy
  ) {}

  public async handle(command: UpdateCalendarEventCommand): Promise<string> {
    const credentials = new AppleCredentials(command.appleId, command.appSpecificPassword);
    const calendarPath = new CalendarPath(command.calendarPath);

    // 1. Retrieve the existing event
    const event = await this.repository.findById(command.eventId, credentials, calendarPath);
    if (!event) {
      throw new Error(`Calendar event with ID '${command.eventId}' not found.`);
    }

    // 2. Resolve updated properties, falling back to existing event values where undefined
    const finalStart = command.startDate !== undefined ? command.startDate : event.dateRange.startDate;
    const finalEnd = command.endDate !== undefined ? command.endDate : event.dateRange.endDate;
    const newDateRange = new DateRange(finalStart, finalEnd);

    const finalTitle = command.title !== undefined ? command.title : event.details.title;
    const finalDesc = command.description !== undefined ? command.description : event.details.description;
    const finalLoc = command.location !== undefined ? command.location : event.details.location;
    const finalUrl = command.url !== undefined ? command.url : event.details.url;
    const newDetails = new EventDetails(finalTitle, finalDesc, finalLoc, finalUrl);

    // 3. Apply changes via Domain method
    event.update(newDateRange, newDetails);

    // 4. Serialize and save the updated aggregate
    const payload = this.serializationStrategy.serialize(event);
    await this.repository.save(event, payload, credentials, calendarPath);

    return event.id.value;
  }
}
