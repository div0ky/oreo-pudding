import type { ICommand } from "../seedwork/ICommand";
import type { IQuery } from "../seedwork/IQuery";
import type { ICommandHandler } from "../seedwork/ICommandHandler";
import type { IQueryHandler } from "../seedwork/IQueryHandler";

/**
 * Decorator for command handlers that logs command execution details.
 */
export class LoggingCommandHandlerDecorator<TCommand extends ICommand, TResult = void>
  implements ICommandHandler<TCommand, TResult>
{
  /**
   * Creates an instance of LoggingCommandHandlerDecorator.
   */
  constructor(
    private readonly decoratee: ICommandHandler<TCommand, TResult>,
    private readonly logger: (msg: string) => void = console.error
  ) {}

  /**
   * Handles the command, logging start, completion, and failure states.
   */
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

/**
 * Decorator for query handlers that logs query execution details.
 */
export class LoggingQueryHandlerDecorator<TQuery extends IQuery<TResult>, TResult>
  implements IQueryHandler<TQuery, TResult>
{
  /**
   * Creates an instance of LoggingQueryHandlerDecorator.
   */
  constructor(
    private readonly decoratee: IQueryHandler<TQuery, TResult>,
    private readonly logger: (msg: string) => void = console.error
  ) {}

  /**
   * Handles the query, logging start, completion, and failure states.
   */
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
