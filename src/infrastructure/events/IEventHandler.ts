import type { DomainEvent } from "../../domain/seedwork/DomainEvent";

export interface IEventHandler<TEvent extends DomainEvent> {
  handle(event: TEvent): Promise<void>;
}
