import type { IQuery } from "../../seedwork/IQuery";

export interface CalendarDto {
  name: string;
  path: string;
}

export class ListCalendarsQuery implements IQuery<CalendarDto[]> {
  constructor(
    public readonly appleId: string,
    public readonly appSpecificPassword: string
  ) {}
}
