import { ValueObject } from "../../seedwork/ValueObject";

interface EventIdProps {
  value: string;
}

/**
 * Value Object representing a unique identifier for a calendar event.
 */
export class EventId extends ValueObject<EventIdProps> {
  /**
   * Creates an instance of EventId.
   */
  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Calendar Event ID value cannot be empty.");
    }
    super({ value: value.trim() });
  }

  /**
   * Gets the string value of the event ID.
   */
  public get value(): string {
    return this.props.value;
  }
}
