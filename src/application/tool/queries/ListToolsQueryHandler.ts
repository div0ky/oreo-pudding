import type { IQueryHandler } from "../../seedwork/IQueryHandler";
import { ListToolsQuery, type ToolDto } from "./ListToolsQuery";
import type { IToolRepository } from "../../../domain/tool/IToolRepository";

export class ListToolsQueryHandler implements IQueryHandler<ListToolsQuery, ToolDto[]> {
  constructor(private readonly toolRepository: IToolRepository) {}

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
