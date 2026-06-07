import type { ICommandHandler } from "../../seedwork/ICommandHandler";
import { ExecuteToolCommand } from "./ExecuteToolCommand";
import type { IToolRepository } from "../../../domain/tool/IToolRepository";
import { ToolName } from "../../../domain/tool/ToolName";
import type { EventDispatcher } from "../../../infrastructure/events/EventDispatcher";

export class ExecuteToolCommandHandler implements ICommandHandler<ExecuteToolCommand, string> {
  constructor(
    private readonly toolRepository: IToolRepository,
    private readonly eventDispatcher: EventDispatcher
  ) {}

  public async handle(command: ExecuteToolCommand): Promise<string> {
    const name = new ToolName(command.name);
    const tool = await this.toolRepository.findByName(name);
    if (!tool) {
      throw new Error(`Tool with name '${command.name}' not found.`);
    }

    const result = await tool.execute(command.args);

    await this.eventDispatcher.publishAll(tool.domainEvents);
    tool.clearDomainEvents();

    return result;
  }
}
