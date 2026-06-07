import { ValueObject } from "../../seedwork/ValueObject";

interface CalendarPathProps {
  value: string;
}

/**
 * Value Object representing a calendar path URI.
 */
export class CalendarPath extends ValueObject<CalendarPathProps> {
  /**
   * Creates an instance of CalendarPath.
   */
  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Calendar path cannot be empty.");
    }
    super({ value: value.trim() });
  }

  /**
   * Gets the calendar path string value.
   */
  public get value(): string {
    return this.props.value;
  }
}
