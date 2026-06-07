import { Tool } from "./Tool";
import { ToolName } from "./ToolName";
import { ToolId } from "./ToolId";

/**
 * Repository interface representing ports for Tool aggregate storage.
 */
export interface IToolRepository {
  /**
   * Retrieves a tool aggregate by its unique ToolId.
   */
  findById(id: ToolId): Promise<Tool | null>;
  /**
   * Retrieves a tool aggregate by its unique ToolName.
   */
  findByName(name: ToolName): Promise<Tool | null>;
  /**
   * Persists or updates a tool aggregate in the store.
   */
  save(tool: Tool): Promise<void>;
  /**
   * Returns a list of all registered tool aggregates.
   */
  findAll(): Promise<Tool[]>;
}
