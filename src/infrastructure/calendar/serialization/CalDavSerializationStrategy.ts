import type { CalendarEvent } from "../../../domain/calendar/CalendarEvent";

export interface CalDavSerializationStrategy {
  serialize(event: CalendarEvent): string;
  deserialize(payload: string): CalendarEvent;
}
