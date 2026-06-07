import { ValueObject } from "../../seedwork/ValueObject";
import { InvalidDateRangeException } from "../exceptions/InvalidDateRangeException";

interface DateRangeProps {
  startDate: Date;
  endDate: Date;
}

/**
 * Value Object representing a chronological range of time.
 */
export class DateRange extends ValueObject<DateRangeProps> {
  /**
   * Creates a validated DateRange.
   */
  constructor(startDate: Date, endDate: Date) {
    if (endDate.getTime() <= startDate.getTime()) {
      throw new InvalidDateRangeException(startDate, endDate);
    }
    super({
      startDate: new Date(startDate.getTime()),
      endDate: new Date(endDate.getTime())
    });
  }

  /**
   * Gets a copy of the start date.
   */
  public get startDate(): Date {
    return new Date(this.props.startDate.getTime());
  }

  /**
   * Gets a copy of the end date.
   */
  public get endDate(): Date {
    return new Date(this.props.endDate.getTime());
  }
}
