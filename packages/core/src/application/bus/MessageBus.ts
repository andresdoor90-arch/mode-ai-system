import { type Result, err } from '../../shared/Result';
import { HandlerNotFoundError } from '../../shared/errors';
import { type Message, type RequestHandler, type Middleware, type HandlerFn } from './types';

/**
 * A pure, in-memory message bus. Routes a message to its registered handler,
 * wrapping execution in a chain of middlewares. Has zero external dependencies
 * — no event emitters, timers or I/O — so it is fully deterministic and
 * testable. `CommandBus` and `QueryBus` are thin specialisations of this.
 */
export class MessageBus {
  private readonly handlers = new Map<string, RequestHandler<Message<unknown>, unknown>>();
  private readonly middlewares: Middleware[] = [];

  /** Register the single handler responsible for a message type. */
  public register<TResult, TMessage extends Message<TResult>>(
    type: string,
    handler: RequestHandler<TMessage, TResult>,
  ): this {
    if (this.handlers.has(type)) {
      throw new Error(`A handler is already registered for "${type}".`);
    }
    this.handlers.set(type, handler as RequestHandler<Message<unknown>, unknown>);
    return this;
  }

  /** Append a middleware to the execution chain (runs in registration order). */
  public use(middleware: Middleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  /** Whether a handler exists for the given message type. */
  public canHandle(type: string): boolean {
    return this.handlers.has(type);
  }

  /** Dispatch a message and return its handler's `Result`. */
  public async dispatch<TResult>(message: Message<TResult>): Promise<Result<TResult>> {
    const handler = this.handlers.get(message.type);
    if (handler === undefined) {
      return err(new HandlerNotFoundError(`No handler registered for "${message.type}".`));
    }

    const invokeHandler: HandlerFn = () => handler.handle(message);
    const chain = this.middlewares.reduceRight<HandlerFn>(
      (next, middleware) => () => middleware(message, next),
      invokeHandler,
    );

    const result = await chain();
    return result as Result<TResult>;
  }
}
