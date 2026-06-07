import type { ICommand } from "../../seedwork/ICommand";
import type { ToolStrategy } from "../../../domain/tool/ToolStrategy";

export class RegisterToolCommand implements ICommand {
  constructor(
    public readonly name: string,
    public readonly description: string,
    public readonly schema: {
      type: "object";
      properties?: Record<string, any>;
      required?: string[];
    },
    public readonly strategy: ToolStrategy
  ) {}
}
