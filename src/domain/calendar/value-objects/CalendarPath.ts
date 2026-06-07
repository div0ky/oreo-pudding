import { ValueObject } from "../../seedwork/ValueObject";

interface CalendarPathProps {
  value: string;
}

export class CalendarPath extends ValueObject<CalendarPathProps> {
  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Calendar path cannot be empty.");
    }
    super({ value: value.trim() });
  }

  public get value(): string {
    return this.props.value;
  }
}
