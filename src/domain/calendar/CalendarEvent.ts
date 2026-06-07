import { AggregateRoot } from "../seedwork/AggregateRoot";
import { EventId } from "./value-objects/EventId";
import { DateRange } from "./value-objects/DateRange";
import { EventDetails } from "./value-objects/EventDetails";

/**
 * Aggregate Root representing a calendar event.
 */
export class CalendarEvent extends AggregateRoot<EventId> {
  private _dateRange: DateRange;
  private _details: EventDetails;

  private constructor(
    id: EventId,
    dateRange: DateRange,
    details: EventDetails
  ) {
    super(id);
    this._dateRange = dateRange;
    this._details = details;
  }

  /**
   * Gets the date range of the calendar event.
   */
  public get dateRange(): DateRange {
    return this._dateRange;
  }

  /**
   * Gets the details (title, description, etc.) of the calendar event.
   */
  public get details(): EventDetails {
    return this._details;
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

  /**
   * Factory Method Pattern
   * Reconstitutes an existing event from persistence/infrastructure.
   */
  public static restore(
    id: EventId,
    dateRange: DateRange,
    details: EventDetails
  ): CalendarEvent {
    return new CalendarEvent(id, dateRange, details);
  }

  /**
   * Domain method to update event properties.
   */
  public update(dateRange: DateRange, details: EventDetails): void {
    this._dateRange = dateRange;
    this._details = details;
  }
}
