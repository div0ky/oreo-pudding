import type { IQuery } from "./IQuery";

/**
 * Interface representing an application query handler.
 */
export interface IQueryHandler<TQuery extends IQuery<TResult>, TResult> {
  /**
   * Executes the query and returns the structured result.
   */
  handle(query: TQuery): Promise<TResult>;
}
