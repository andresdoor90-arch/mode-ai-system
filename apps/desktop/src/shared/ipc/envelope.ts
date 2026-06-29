/**
 * IPC response envelope.
 *
 * The application layer in `@mas/core` models expected failures with a
 * railway-style `Result` rather than thrown exceptions. We mirror that across
 * the IPC boundary with a discriminated-union envelope so the renderer can
 * handle success and failure explicitly without try/catch, and so domain
 * errors propagate as structured, serialisable data instead of opaque strings.
 *
 * This module is pure (no Electron, React or Node imports) which makes the
 * serialisation logic unit-testable in any runtime.
 */

/** A successful IPC result carrying a value. */
export interface IpcSuccess<T> {
  readonly ok: true;
  readonly value: T;
}

/** A structured, serialisable error crossing the IPC boundary. */
export interface IpcErrorInfo {
  /** Error class name, e.g. `ValidationError`, when available. */
  readonly name: string;
  /** Human-readable message. */
  readonly message: string;
  /** Optional stable error code for programmatic handling. */
  readonly code?: string;
}

/** A failed IPC result. */
export interface IpcFailure {
  readonly ok: false;
  readonly error: IpcErrorInfo;
}

/** The envelope every IPC handler returns. */
export type IpcResponse<T> = IpcSuccess<T> | IpcFailure;

/** Build a successful envelope. */
export function ipcSuccess<T>(value: T): IpcSuccess<T> {
  return { ok: true, value };
}

/** Build a failed envelope from structured error info. */
export function ipcFailure(error: IpcErrorInfo): IpcFailure {
  return { ok: false, error };
}

/** Narrow an envelope to its success branch. */
export function isIpcSuccess<T>(response: IpcResponse<T>): response is IpcSuccess<T> {
  return response.ok;
}

/**
 * Convert an arbitrary thrown/returned error into a serialisable
 * {@link IpcErrorInfo}. Plain `Error`, objects with `name`/`message`, and bare
 * strings are all handled; anything else falls back to a generic shape.
 */
export function toIpcError(error: unknown): IpcErrorInfo {
  if (error instanceof Error) {
    const info: IpcErrorInfo = { name: error.name, message: error.message };
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? { ...info, code } : info;
  }
  if (typeof error === 'string') {
    return { name: 'Error', message: error };
  }
  if (typeof error === 'object' && error !== null) {
    const maybe = error as { name?: unknown; message?: unknown; code?: unknown };
    const name = typeof maybe.name === 'string' ? maybe.name : 'Error';
    const message =
      typeof maybe.message === 'string' ? maybe.message : 'An unknown error occurred.';
    return typeof maybe.code === 'string' ? { name, message, code: maybe.code } : { name, message };
  }
  return { name: 'Error', message: 'An unknown error occurred.' };
}

/**
 * Adapt a `@mas/core`-style `Result` (`{ ok, value } | { ok, error }`) into an
 * IPC envelope, mapping the domain error to serialisable info. Kept structural
 * (duck-typed) so this module needs no dependency on `@mas/core`.
 */
export function fromResult<T>(
  result: { ok: true; value: T } | { ok: false; error: unknown },
): IpcResponse<T> {
  return result.ok ? ipcSuccess(result.value) : ipcFailure(toIpcError(result.error));
}
