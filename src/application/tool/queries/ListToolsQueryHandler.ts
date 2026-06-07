import type { IQueryHandler } from "../../seedwork/IQueryHandler";
import { ListToolsQuery, type ToolDto } from "./ListToolsQuery";
import type { IToolRepository } from "../../../domain/tool/IToolRepository";

/**
 * Query handler that handles listing all registered tools.
 */
export class ListToolsQueryHandler implements IQueryHandler<ListToolsQuery, ToolDto[]> {
  /**
   * Creates an instance of ListToolsQueryHandler.
   */
  constructor(private readonly toolRepository: IToolRepository) {}

  /**
   * Retrieves all tools from the repository and maps them to DTOs.
   */
  public async handle(query: ListToolsQuery): Promise<ToolDto[]> {
    const tools = await this.toolRepository.findAll();
    return tools.map((tool) => ({
      name: tool.name.value,
      description: tool.description.value,
      inputSchema: {
        type: tool.schema.type,
        properties: tool.schema.properties,
        required: tool.schema.required
      }
    }));
  }
}
