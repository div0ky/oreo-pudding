/**
 * Interface representing an execution strategy for a tool.
 */
export interface ToolStrategy {
  /**
   * Executes the tool functionality with the provided arguments.
   */
  execute(args: Record<string, any>): Promise<string>;
}
