import type { IQuery } from "../../seedwork/IQuery";

/**
 * Data transfer object representing an MCP tool.
 */
export interface ToolDto {
  /**
   * Unique name of the tool.
   */
  name: string;
  /**
   * Human-readable description of what the tool does.
   */
  description: string;
  /**
   * JSON schema describing the expected input parameters.
   */
  inputSchema: {
    /**
     * The schema type, which must be object.
     */
    type: "object";
    /**
     * Parameter definitions.
     */
    properties: Record<string, any>;
    /**
     * Required parameter names.
     */
    required: string[];
  };
}

/**
 * Query to list all currently registered tools.
 */
export class ListToolsQuery implements IQuery<ToolDto[]> {
  /**
   * Creates an instance of ListToolsQuery.
   */
  constructor() {}
}
