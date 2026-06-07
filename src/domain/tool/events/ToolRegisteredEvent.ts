import type { DomainEvent } from "../../seedwork/DomainEvent";
import type { ToolId } from "../ToolId";
import type { ToolName } from "../ToolName";

/**
 * Domain Event published when a new tool is registered.
 */
export class ToolRegisteredEvent implements DomainEvent {
  public readonly occurredOn: Date;

  /**
   * Creates an instance of ToolRegisteredEvent.
   */
  constructor(
    public readonly toolId: ToolId,
    public readonly toolName: ToolName
  ) {
    this.occurredOn = new Date();
  }
}
