import type { ICommand } from "../../seedwork/ICommand";

/**
 * Command to create a new calendar event.
 */
export class CreateCalendarEventCommand implements ICommand {
  /**
   * Creates an instance of CreateCalendarEventCommand.
   */
  constructor(
    public readonly appleId: string,
    public readonly appSpecificPassword: string,
    public readonly title: string,
    public readonly description: string,
    public readonly startDate: Date,
    public readonly endDate: Date,
    public readonly calendarPath?: string,
    public readonly location: string = "",
    public readonly url: string = ""
  ) {}
}
