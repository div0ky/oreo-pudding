import type { DomainEvent } from "../../seedwork/DomainEvent";
import type { ToolId } from "../ToolId";
import type { ToolName } from "../ToolName";

export class ToolRegisteredEvent implements DomainEvent {
  public readonly occurredOn: Date;

  constructor(
    public readonly toolId: ToolId,
    public readonly toolName: ToolName
  ) {
    this.occurredOn = new Date();
  }
}
