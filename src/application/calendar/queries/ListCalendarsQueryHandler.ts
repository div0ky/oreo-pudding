import type { IQueryHandler } from "../../seedwork/IQueryHandler";
import { ListCalendarsQuery, type CalendarDto } from "./ListCalendarsQuery";
import { AppleCredentials } from "../../../domain/calendar/value-objects/AppleCredentials";
import type { ICalDavRepository } from "../../../domain/calendar/ICalDavRepository";

export class ListCalendarsQueryHandler implements IQueryHandler<ListCalendarsQuery, CalendarDto[]> {
  constructor(private readonly repository: ICalDavRepository) {}

  public async handle(query: ListCalendarsQuery): Promise<CalendarDto[]> {
    const credentials = new AppleCredentials(query.appleId, query.appSpecificPassword);
    const calendars = await this.repository.discoverCalendars(credentials);
    const result = calendars.map(c => ({
      name: c.name,
      path: c.path
    }));

    if ("_swr" in calendars) {
      Object.defineProperty(result, "_swr", {
        value: (calendars as any)._swr,
        enumerable: false,
        writable: true,
        configurable: true
      });
    }

    return result;
  }
}
