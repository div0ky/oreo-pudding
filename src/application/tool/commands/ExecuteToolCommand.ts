import type { ICommand } from "../../seedwork/ICommand";

/**
 * Command to execute an MCP tool by name with arguments.
 */
export class ExecuteToolCommand implements ICommand {
  /**
   * Creates an instance of ExecuteToolCommand.
   */
  constructor(
    public readonly name: string,
    public readonly args: Record<string, any>
  ) {}
}
