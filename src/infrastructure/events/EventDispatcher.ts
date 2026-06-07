import type { DomainEvent } from "../../domain/seedwork/DomainEvent";
import type { IEventHandler } from "./IEventHandler";

export class EventDispatcher {
  private handlers = new Map<string, IEventHandler<any>[]>();

  public subscribe<TEvent extends DomainEvent>(
    eventConstructor: new (...args: any[]) => TEvent,
    handler: IEventHandler<TEvent>
  ): void {
    const key = eventConstructor.name;
    const existing = this.handlers.get(key) || [];
    existing.push(handler);
    this.handlers.set(key, existing);
  }

  public async publish(event: DomainEvent): Promise<void> {
    const key = event.constructor.name;
    const handlers = this.handlers.get(key) || [];
    const promises = handlers.map(async (handler) => {
      try {
        await handler.handle(event);
      } catch (err) {
        console.error(`Error in event handler for event ${key}:`, err);
      }
    });
    await Promise.all(promises);
  }

  public async publishAll(events: readonly DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }
}
