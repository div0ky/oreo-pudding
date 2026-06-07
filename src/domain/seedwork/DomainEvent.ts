/**
 * Interface representing a Domain Event within the aggregate boundary.
 */
export interface DomainEvent {
  /**
   * The date and time when the domain event occurred.
   */
  readonly occurredOn: Date;
}
