import { type Result, ok } from '../../shared/Result';
import { type ValidationError } from '../../shared/errors';
import { type Message, type Middleware } from './types';

/** A pure validator for a specific message type. */
export type Validator<TMessage extends Message> = (
  message: TMessage,
) => Result<void, ValidationError>;

/**
 * Registry-backed validation middleware. Validators are keyed by message type;
 * when a message arrives, its validator (if any) runs first. A failed
 * validation short-circuits the chain and the handler is never invoked.
 */
export class ValidationMiddleware {
  private readonly validators = new Map<string, Validator<Message>>();

  /** Register a validator for a message type. */
  public register<TMessage extends Message>(type: string, validator: Validator<TMessage>): this {
    this.validators.set(type, validator as Validator<Message>);
    return this;
  }

  /** Adapt this registry into a {@link Middleware} for a bus. */
  public toMiddleware(): Middleware {
    return async (message, next) => {
      const validator = this.validators.get(message.type);
      if (validator !== undefined) {
        const result = validator(message);
        if (!result.ok) {
          return result;
        }
      }
      return next();
    };
  }

  /** Validate a message directly (useful in tests). */
  public validate(message: Message): Result<void, ValidationError> {
    const validator = this.validators.get(message.type);
    return validator ? validator(message) : ok(undefined);
  }
}
