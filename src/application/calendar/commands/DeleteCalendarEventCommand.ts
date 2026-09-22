import type { ICommand } from "../../seedwork/ICommand";

/**
 * Command to delete an existing calendar event.
 */
export class DeleteCalendarEventCommand implements ICommand {
  /**
   * Creates an instance of DeleteCalendarEventCommand.
   */
  constructor(
    public readonly eventId: string,
    public readonly calendarPath?: string
  ) {}
}
