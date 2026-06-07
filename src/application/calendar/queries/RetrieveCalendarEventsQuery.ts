import type { IQuery } from "../../seedwork/IQuery";

export interface CalendarEventDto {
  eventId: string;
  title: string;
  description: string;
  location: string;
  url: string;
  startDate: string;
  endDate: string;
}

export class RetrieveCalendarEventsQuery implements IQuery<CalendarEventDto[]> {
  constructor(
    public readonly appleId: string,
    public readonly appSpecificPassword: string,
    public readonly calendarPath: string,
    public readonly startDate?: Date,
    public readonly endDate?: Date
  ) {}
}
