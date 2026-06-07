import type { ICommand } from "./ICommand";
import type { IQuery } from "./IQuery";

export interface IMediator {
  send<TResult>(command: ICommand): Promise<TResult>;
  query<TResult>(query: IQuery<TResult>): Promise<TResult>;
}
