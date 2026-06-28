import { type Result } from '../../shared/Result';
import { MessageBus } from './MessageBus';
import { type Query } from './types';

/**
 * Bus for read-only queries. `ask` is an intention-revealing alias for
 * `dispatch`.
 */
export class QueryBus extends MessageBus {
  public ask<TResult>(query: Query<TResult>): Promise<Result<TResult>> {
    return this.dispatch<TResult>(query);
  }
}
