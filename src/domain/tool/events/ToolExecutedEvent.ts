import type { DomainEvent } from "../../seedwork/DomainEvent";
import type { ToolId } from "../ToolId";
import type { ToolName } from "../ToolName";

/**
 * Domain Event published when a tool finishes execution.
 */
export class ToolExecutedEvent implements DomainEvent {
  public readonly occurredOn: Date;

  /**
   * Creates an instance of ToolExecutedEvent.
   */
  constructor(
    public readonly toolId: ToolId,
    public readonly toolName: ToolName,
    public readonly inputArguments: Record<string, any>,
    public readonly durationMs: number
  ) {
    this.occurredOn = new Date();
  }
}
