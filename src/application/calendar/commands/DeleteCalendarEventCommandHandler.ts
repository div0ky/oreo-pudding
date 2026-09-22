import type { ICommandHandler } from "../../seedwork/ICommandHandler";
import { DeleteCalendarEventCommand } from "./DeleteCalendarEventCommand";
import { AppleCredentials } from "../../../domain/calendar/value-objects/AppleCredentials";
import type { ICalDavRepository } from "../../../domain/calendar/ICalDavRepository";
import { locateCalendarEvent } from "../utils/CalendarEventLocator";

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

    const located = await locateCalendarEvent(
      this.repository,
      credentials,
      command.eventId,
      command.calendarPath
    );

    await this.repository.delete(
      located.event.id.value,
      credentials,
      located.calendarPath
    );

    return located.event.id.value;
  }
}
