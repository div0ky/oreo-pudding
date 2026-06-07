import type { CalendarEvent } from "../../../domain/calendar/CalendarEvent";

/**
 * Interface representing strategy patterns for serializing and deserializing calendar events.
 */
export interface CalDavSerializationStrategy {
  /**
   * Serializes a CalendarEvent aggregate into a string format.
   */
  serialize(event: CalendarEvent): string;
  /**
   * Deserializes a string payload back into a CalendarEvent aggregate.
   */
  deserialize(payload: string): CalendarEvent;
}
