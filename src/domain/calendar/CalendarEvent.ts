import { AggregateRoot } from "../seedwork/AggregateRoot";
import { EventId } from "./value-objects/EventId";
import { DateRange } from "./value-objects/DateRange";
import { EventDetails } from "./value-objects/EventDetails";

export class CalendarEvent extends AggregateRoot<EventId> {
  private constructor(
    id: EventId,
    public readonly dateRange: DateRange,
    public readonly details: EventDetails
  ) {
    super(id);
  }

  /**
   * Factory Method Pattern
   * Generates an internal cryptographic unique domain identity (EventId)
   */
  public static create(
    dateRange: DateRange,
    details: EventDetails
  ): CalendarEvent {
    // Generate UUID using standard cryptographic Factory pattern
    const uuid = crypto.randomUUID();
    const id = new EventId(uuid);
    return new CalendarEvent(id, dateRange, details);
  }
}
