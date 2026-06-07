import type { IToolRepository } from "../../domain/tool/IToolRepository";
import type { Tool } from "../../domain/tool/Tool";
import type { ToolId } from "../../domain/tool/ToolId";
import type { ToolName } from "../../domain/tool/ToolName";

/**
 * In-memory concrete implementation of the IToolRepository aggregate repository port.
 */
export class InMemoryToolRepository implements IToolRepository {
  private tools = new Map<string, Tool>();

  /**
   * Finds a tool aggregate by its unique ToolId.
   */
  public async findById(id: ToolId): Promise<Tool | null> {
    return this.tools.get(id.value) || null;
  }

  /**
   * Finds a tool aggregate by its unique ToolName.
   */
  public async findByName(name: ToolName): Promise<Tool | null> {
    for (const tool of this.tools.values()) {
      if (tool.name.equals(name)) {
        return tool;
      }
    }
    return null;
  }

  /**
   * Saves or updates a tool aggregate in the in-memory store.
   */
  public async save(tool: Tool): Promise<void> {
    this.tools.set(tool.id.value, tool);
  }

  /**
   * Returns a list of all registered tool aggregates.
   */
  public async findAll(): Promise<Tool[]> {
    return Array.from(this.tools.values());
  }
}
