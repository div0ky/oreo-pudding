import type { ICommand } from "../seedwork/ICommand";
import type { IQuery } from "../seedwork/IQuery";
import type { ICommandHandler } from "../seedwork/ICommandHandler";
import type { IQueryHandler } from "../seedwork/IQueryHandler";

export class LoggingCommandHandlerDecorator<TCommand extends ICommand, TResult = void>
  implements ICommandHandler<TCommand, TResult>
{
  constructor(
    private readonly decoratee: ICommandHandler<TCommand, TResult>,
    private readonly logger: (msg: string) => void = console.error
  ) {}

  public async handle(command: TCommand): Promise<TResult> {
    const commandName = command.constructor.name;
    this.logger(`[Mediator COMMAND] Starting execution of ${commandName}`);
    const start = performance.now();
    try {
      const result = await this.decoratee.handle(command);
      const duration = (performance.now() - start).toFixed(2);
      this.logger(`[Mediator COMMAND] Completed ${commandName} in ${duration}ms`);
      return result;
    } catch (error) {
      const duration = (performance.now() - start).toFixed(2);
      this.logger(`[Mediator COMMAND] Failed ${commandName} in ${duration}ms: ${error}`);
      throw error;
    }
  }
}

export class LoggingQueryHandlerDecorator<TQuery extends IQuery<TResult>, TResult>
  implements IQueryHandler<TQuery, TResult>
{
  constructor(
    private readonly decoratee: IQueryHandler<TQuery, TResult>,
    private readonly logger: (msg: string) => void = console.error
  ) {}

  public async handle(query: TQuery): Promise<TResult> {
    const queryName = query.constructor.name;
    this.logger(`[Mediator QUERY] Starting execution of ${queryName}`);
    const start = performance.now();
    try {
      const result = await this.decoratee.handle(query);
      const duration = (performance.now() - start).toFixed(2);
      this.logger(`[Mediator QUERY] Completed ${queryName} in ${duration}ms`);
      return result;
    } catch (error) {
      const duration = (performance.now() - start).toFixed(2);
      this.logger(`[Mediator QUERY] Failed ${queryName} in ${duration}ms: ${error}`);
      throw error;
    }
  }
}
