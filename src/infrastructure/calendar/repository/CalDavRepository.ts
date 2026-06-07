import type { ICalDavRepository } from "../../../domain/calendar/ICalDavRepository";
import type { CalendarEvent } from "../../../domain/calendar/CalendarEvent";
import type { AppleCredentials } from "../../../domain/calendar/value-objects/AppleCredentials";
import type { CalendarPath } from "../../../domain/calendar/value-objects/CalendarPath";

export class CalDavRepository implements ICalDavRepository {
  /**
   * Commits the serialized calendar event to the iCloud CalDAV server.
   * Executes an HTTP PUT against https://caldav.icloud.com/ using Bun's native fetch.
   */
  public async save(
    event: CalendarEvent,
    payload: string,
    credentials: AppleCredentials,
    calendarPath: CalendarPath
  ): Promise<void> {
    // Formulate clean path
    const path = calendarPath.value.startsWith("/")
      ? calendarPath.value
      : `/${calendarPath.value}`;
    
    const url = `https://caldav.icloud.com${path}/${event.id.value}.ics`;

    const headers = new Headers();
    headers.set("Authorization", credentials.toBasicAuthHeader());
    headers.set("Content-Type", "text/calendar; charset=utf-8");
    headers.set("User-Agent", "Oreo-Pudding-CalDAV/1.0");

    const response = await fetch(url, {
      method: "PUT",
      headers,
      body: payload
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      throw new Error(
        `CalDAV PUT to '${url}' failed with status ${response.status} (${response.statusText}). Server Response: ${responseText}`
      );
    }
  }
}
