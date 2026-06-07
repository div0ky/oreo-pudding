import type { ICommandHandler } from "../../seedwork/ICommandHandler";
import { ExecuteToolCommand } from "./ExecuteToolCommand";
import type { IToolRepository } from "../../../domain/tool/IToolRepository";
import { ToolName } from "../../../domain/tool/ToolName";
import type { EventDispatcher } from "../../../infrastructure/events/EventDispatcher";

/**
 * Command handler that orchestrates the execution of a registered tool.
 */
export class ExecuteToolCommandHandler implements ICommandHandler<ExecuteToolCommand, string> {
  /**
   * Creates an instance of ExecuteToolCommandHandler.
   */
  constructor(
    private readonly toolRepository: IToolRepository,
    private readonly eventDispatcher: EventDispatcher
  ) {}

  /**
   * Finds the tool by name, executes it, and dispatches its domain events.
   */
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
