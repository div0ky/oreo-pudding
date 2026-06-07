export interface ToolStrategy {
  execute(args: Record<string, any>): Promise<string>;
}
