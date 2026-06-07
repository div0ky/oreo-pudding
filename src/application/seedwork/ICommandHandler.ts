import type { ICommand } from "./ICommand";

/**
 * Interface representing an application command handler.
 */
export interface ICommandHandler<TCommand extends ICommand, TResult = void> {
  /**
   * Orchestrates execution of the given command.
   */
  handle(command: TCommand): Promise<TResult>;
}
