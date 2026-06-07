import type { ICommand } from "../../seedwork/ICommand";

/**
 * Command to move a calendar event to a new date and time range.
 */
export class MoveCalendarEventCommand implements ICommand {
  /**
   * Creates an instance of MoveCalendarEventCommand.
   */
  constructor(
    public readonly eventId: string,
    public readonly newStart: Date,
    public readonly newEnd?: Date,
    public readonly calendarPath?: string
  ) {}
}
