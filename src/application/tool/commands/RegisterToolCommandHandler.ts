import type { ICommandHandler } from "../../seedwork/ICommandHandler";
import { RegisterToolCommand } from "./RegisterToolCommand";
import type { IToolRepository } from "../../../domain/tool/IToolRepository";
import { Tool } from "../../../domain/tool/Tool";
import { ToolId } from "../../../domain/tool/ToolId";
import { ToolName } from "../../../domain/tool/ToolName";
import { ToolDescription } from "../../../domain/tool/ToolDescription";
import { ToolSchema } from "../../../domain/tool/ToolSchema";
import type { EventDispatcher } from "../../../infrastructure/events/EventDispatcher";

export class RegisterToolCommandHandler implements ICommandHandler<RegisterToolCommand, string> {
  constructor(
    private readonly toolRepository: IToolRepository,
    private readonly eventDispatcher: EventDispatcher
  ) {}

  public async handle(command: RegisterToolCommand): Promise<string> {
    const id = new ToolId(crypto.randomUUID());
    const name = new ToolName(command.name);
    
    const existing = await this.toolRepository.findByName(name);
    if (existing) {
      throw new Error(`Tool with name '${command.name}' already registered.`);
    }

    const description = new ToolDescription(command.description);
    const schema = new ToolSchema(command.schema);

    const tool = Tool.create(id, name, description, schema, command.strategy);
    await this.toolRepository.save(tool);

    await this.eventDispatcher.publishAll(tool.domainEvents);
    tool.clearDomainEvents();

    return id.value;
  }
}
