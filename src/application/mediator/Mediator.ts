import type { IMediator } from "../seedwork/IMediator";
import type { ICommand } from "../seedwork/ICommand";
import type { IQuery } from "../seedwork/IQuery";
import type { ICommandHandler } from "../seedwork/ICommandHandler";
import type { IQueryHandler } from "../seedwork/IQueryHandler";

/**
 * Mediator implementation that routes commands and queries to their registered handlers.
 */
export class Mediator implements IMediator {
  private commandHandlers = new Map<string, ICommandHandler<any, any>>();
  private queryHandlers = new Map<string, IQueryHandler<any, any>>();

  /**
   * Registers a command handler for a specific command constructor type.
   */
  public registerCommand<TCommand extends ICommand, TResult>(
    commandConstructor: new (...args: any[]) => TCommand,
    handler: ICommandHandler<TCommand, TResult>
  ): void {
    const key = commandConstructor.name;
    this.commandHandlers.set(key, handler);
  }

  /**
   * Registers a query handler for a specific query constructor type.
   */
  public registerQuery<TQuery extends IQuery<TResult>, TResult>(
    queryConstructor: new (...args: any[]) => TQuery,
    handler: IQueryHandler<TQuery, TResult>
  ): void {
    const key = queryConstructor.name;
    this.queryHandlers.set(key, handler);
  }

  /**
   * Sends a command to its registered handler and returns the result.
   */
  public async send<TResult>(command: ICommand): Promise<TResult> {
    const key = command.constructor.name;
    const handler = this.commandHandlers.get(key);
    if (!handler) {
      throw new Error(`No Command Handler registered for Command: ${key}`);
    }
    return handler.handle(command);
  }

  /**
   * Sends a query to its registered handler and returns the result.
   */
  public async query<TResult>(query: IQuery<TResult>): Promise<TResult> {
    const key = query.constructor.name;
    const handler = this.queryHandlers.get(key);
    if (!handler) {
      throw new Error(`No Query Handler registered for Query: ${key}`);
    }
    return handler.handle(query);
  }
}
