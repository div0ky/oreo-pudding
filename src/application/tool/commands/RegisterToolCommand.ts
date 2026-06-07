import type { ICommand } from "../../seedwork/ICommand";
import type { ToolStrategy } from "../../../domain/tool/ToolStrategy";

/**
 * Command to register a new domain tool with the MCP server.
 */
export class RegisterToolCommand implements ICommand {
  /**
   * Creates an instance of RegisterToolCommand.
   */
  constructor(
    public readonly name: string,
    public readonly description: string,
    public readonly schema: {
      /**
       * The JSON schema type, which must be object.
       */
      type: "object";
      /**
       * Property schemas describing arguments.
       */
      properties?: Record<string, any>;
      /**
       * List of required argument keys.
       */
      required?: string[];
    },
    public readonly strategy: ToolStrategy
  ) {}
}
