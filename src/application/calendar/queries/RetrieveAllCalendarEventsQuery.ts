import type { IQuery } from "../../seedwork/IQuery";
import type { CalendarEventDto } from "./RetrieveCalendarEventsQuery";

export interface CalendarEventsDto {
  calendarName: string;
  calendarPath: string;
  events: CalendarEventDto[];
}

export class RetrieveAllCalendarEventsQuery implements IQuery<CalendarEventsDto[]> {
  constructor(
    public readonly startDate?: Date,
    public readonly endDate?: Date,
    public readonly omit?: string[]
  ) {}
}
