import { Entity } from "./Entity";
import type { DomainEvent } from "./DomainEvent";

/**
 * Base abstract class for Domain Aggregate Roots.
 */
export abstract class AggregateRoot<TId> extends Entity<TId> {
  private _domainEvents: DomainEvent[] = [];

  protected constructor(id: TId) {
    super(id);
  }

  /**
   * Gets a read-only list of domain events collected during lifecycle operations.
   */
  public get domainEvents(): readonly DomainEvent[] {
    return Object.freeze([...this._domainEvents]);
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  /**
   * Clears the internal collection of domain events.
   */
  public clearDomainEvents(): void {
    this._domainEvents = [];
  }
}
