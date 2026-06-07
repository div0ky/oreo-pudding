import { Entity } from "./Entity";
import type { DomainEvent } from "./DomainEvent";

export abstract class AggregateRoot<TId> extends Entity<TId> {
  private _domainEvents: DomainEvent[] = [];

  protected constructor(id: TId) {
    super(id);
  }

  public get domainEvents(): readonly DomainEvent[] {
    return Object.freeze([...this._domainEvents]);
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  public clearDomainEvents(): void {
    this._domainEvents = [];
  }
}
