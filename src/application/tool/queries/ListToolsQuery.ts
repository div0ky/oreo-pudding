import type { IQuery } from "../../seedwork/IQuery";

export interface ToolDto {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required: string[];
  };
}

export class ListToolsQuery implements IQuery<ToolDto[]> {
  constructor() {}
}
