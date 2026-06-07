import type { ICommand } from "../../seedwork/ICommand";

export class ExecuteToolCommand implements ICommand {
  constructor(
    public readonly name: string,
    public readonly args: Record<string, any>
  ) {}
}
