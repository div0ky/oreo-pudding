import { Tool } from "./Tool";
import { ToolName } from "./ToolName";
import { ToolId } from "./ToolId";

export interface IToolRepository {
  findById(id: ToolId): Promise<Tool | null>;
  findByName(name: ToolName): Promise<Tool | null>;
  save(tool: Tool): Promise<void>;
  findAll(): Promise<Tool[]>;
}
