import type { DomainEvent } from "../../domain/seedwork/DomainEvent";

/**
 * Interface representing a subscriber event handler for Domain Events.
 */
export interface IEventHandler<TEvent extends DomainEvent> {
  /**
   * Processes the published domain event.
   */
  handle(event: TEvent): Promise<void>;
}
