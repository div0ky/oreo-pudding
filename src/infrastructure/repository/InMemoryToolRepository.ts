import type { IToolRepository } from "../../domain/tool/IToolRepository";
import type { Tool } from "../../domain/tool/Tool";
import type { ToolId } from "../../domain/tool/ToolId";
import type { ToolName } from "../../domain/tool/ToolName";

export class InMemoryToolRepository implements IToolRepository {
  private tools = new Map<string, Tool>();

  public async findById(id: ToolId): Promise<Tool | null> {
    return this.tools.get(id.value) || null;
  }

  public async findByName(name: ToolName): Promise<Tool | null> {
    for (const tool of this.tools.values()) {
      if (tool.name.equals(name)) {
        return tool;
      }
    }
    return null;
  }

  public async save(tool: Tool): Promise<void> {
    this.tools.set(tool.id.value, tool);
  }

  public async findAll(): Promise<Tool[]> {
    return Array.from(this.tools.values());
  }
}
