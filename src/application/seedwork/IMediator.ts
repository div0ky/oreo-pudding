import type { ICommand } from "./ICommand";
import type { IQuery } from "./IQuery";

/**
 * Interface representing a mediator for routing commands and queries.
 */
export interface IMediator {
  /**
   * Sends a command to its registered handler.
   */
  send<TResult>(command: ICommand): Promise<TResult>;
  /**
   * Dispatches a query to its registered handler.
   */
  query<TResult>(query: IQuery<TResult>): Promise<TResult>;
}
