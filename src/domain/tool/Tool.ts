import { AggregateRoot } from "../seedwork/AggregateRoot";
import { ToolId } from "./ToolId";
import { ToolName } from "./ToolName";
import { ToolDescription } from "./ToolDescription";
import { ToolSchema } from "./ToolSchema";
import type { ToolStrategy } from "./ToolStrategy";
import { ToolExecutedEvent } from "./events/ToolExecutedEvent";
import { ToolRegisteredEvent } from "./events/ToolRegisteredEvent";

export class Tool extends AggregateRoot<ToolId> {
  private constructor(
    id: ToolId,
    public readonly name: ToolName,
    public readonly description: ToolDescription,
    public readonly schema: ToolSchema,
    private readonly strategy: ToolStrategy
  ) {
    super(id);
  }

  // Factory Method Pattern
  public static create(
    id: ToolId,
    name: ToolName,
    description: ToolDescription,
    schema: ToolSchema,
    strategy: ToolStrategy
  ): Tool {
    const tool = new Tool(id, name, description, schema, strategy);
    tool.addDomainEvent(new ToolRegisteredEvent(id, name));
    return tool;
  }

  public async execute(args: Record<string, any>): Promise<string> {
    const start = performance.now();
    try {
      const result = await this.strategy.execute(args);
      const duration = performance.now() - start;
      this.addDomainEvent(new ToolExecutedEvent(this.id, this.name, args, duration));
      return result;
    } catch (error) {
      throw error;
    }
  }
}
