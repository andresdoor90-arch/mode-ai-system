import { type Result } from '../../shared/Result';
import { MessageBus } from './MessageBus';
import { type Command } from './types';

/**
 * Bus for state-changing commands. Each command type maps to exactly one
 * handler. `send` is an intention-revealing alias for `dispatch`.
 */
export class CommandBus extends MessageBus {
  public send<TResult>(command: Command<TResult>): Promise<Result<TResult>> {
    return this.dispatch<TResult>(command);
  }
}
