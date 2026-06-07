import type { CalendarEvent } from "./CalendarEvent";
import type { AppleCredentials } from "./value-objects/AppleCredentials";
import type { CalendarPath } from "./value-objects/CalendarPath";

export interface ICalDavRepository {
  save(
    event: CalendarEvent,
    payload: string,
    credentials: AppleCredentials,
    calendarPath: CalendarPath
  ): Promise<void>;
}
