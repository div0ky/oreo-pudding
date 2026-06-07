import { ValueObject } from "../../seedwork/ValueObject";

interface EventIdProps {
  value: string;
}

export class EventId extends ValueObject<EventIdProps> {
  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Calendar Event ID value cannot be empty.");
    }
    super({ value: value.trim() });
  }

  public get value(): string {
    return this.props.value;
  }
}
