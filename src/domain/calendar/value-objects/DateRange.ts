import { ValueObject } from "../../seedwork/ValueObject";
import { InvalidDateRangeException } from "../exceptions/InvalidDateRangeException";

interface DateRangeProps {
  startDate: Date;
  endDate: Date;
}

export class DateRange extends ValueObject<DateRangeProps> {
  constructor(startDate: Date, endDate: Date) {
    if (endDate.getTime() <= startDate.getTime()) {
      throw new InvalidDateRangeException(startDate, endDate);
    }
    super({
      startDate: new Date(startDate.getTime()),
      endDate: new Date(endDate.getTime())
    });
  }

  public get startDate(): Date {
    return new Date(this.props.startDate.getTime());
  }

  public get endDate(): Date {
    return new Date(this.props.endDate.getTime());
  }
}
