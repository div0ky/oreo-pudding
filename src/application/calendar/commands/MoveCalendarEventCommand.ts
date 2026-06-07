import type { ICommand } from "../../seedwork/ICommand";

export class MoveCalendarEventCommand implements ICommand {
  constructor(
    public readonly eventId: string,
    public readonly newStart: Date,
    public readonly newEnd?: Date,
    public readonly calendarPath?: string
  ) {}
}
