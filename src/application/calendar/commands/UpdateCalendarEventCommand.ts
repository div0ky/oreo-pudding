import type { ICommand } from "../../seedwork/ICommand";

/**
 * Command to update details or date range of an existing calendar event.
 */
export class UpdateCalendarEventCommand implements ICommand {
  /**
   * Creates an instance of UpdateCalendarEventCommand.
   */
  constructor(
    public readonly appleId: string,
    public readonly appSpecificPassword: string,
    public readonly eventId: string,
    public readonly calendarPath?: string,
    public readonly title?: string,
    public readonly description?: string,
    public readonly location?: string,
    public readonly url?: string,
    public readonly startDate?: Date,
    public readonly endDate?: Date
  ) {}
}
