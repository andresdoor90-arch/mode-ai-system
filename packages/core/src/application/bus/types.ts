import { type Result } from '../../shared/Result';

/**
 * Base shape of any message flowing through a bus. The `type` string is the
 * routing key used to locate a handler. `TResult` is a phantom type that lets
 * `dispatch`/`ask` infer the handler's return type at the call-site; it carries
 * no runtime value.
 */
export interface Message<TResult = unknown> {
  readonly type: string;
  /** Phantom marker — never assigned at runtime. */
  readonly __result?: TResult;
}

/** A state-changing message. */
export type Command<TResult = void> = Message<TResult>;

/** A read-only message. */
export type Query<TResult> = Message<TResult>;

/** Handles exactly one message type, returning a `Result`. */
export interface RequestHandler<TMessage extends Message<TResult>, TResult> {
  handle(message: TMessage): Promise<Result<TResult>>;
}

/** The continuation passed to a middleware. */
export type HandlerFn = () => Promise<Result<unknown>>;

/**
 * A cross-cutting concern wrapped around handler execution (validation,
 * logging, timing...). Middlewares form a chain; each may short-circuit by
 * returning early instead of calling `next`.
 */
export type Middleware = (message: Message, next: HandlerFn) => Promise<Result<unknown>>;
