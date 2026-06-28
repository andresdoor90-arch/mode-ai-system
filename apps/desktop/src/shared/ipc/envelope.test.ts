import { describe, it, expect } from 'vitest';

import {
  fromResult,
  ipcFailure,
  ipcSuccess,
  isIpcSuccess,
  toIpcError,
  type IpcResponse,
} from './envelope';
import { ALL_IPC_CHANNELS, IpcChannels, isIpcChannel } from './channels';

describe('ipc envelope', () => {
  it('wraps a value in a success envelope', () => {
    const res = ipcSuccess(42);
    expect(res.ok).toBe(true);
    expect(res.value).toBe(42);
    expect(isIpcSuccess(res)).toBe(true);
  });

  it('builds a failure envelope', () => {
    const res = ipcFailure({ name: 'ValidationError', message: 'bad' });
    expect(res.ok).toBe(false);
    expect(isIpcSuccess(res as IpcResponse<unknown>)).toBe(false);
    expect(res.error.message).toBe('bad');
  });

  it('narrows envelopes with the type guard', () => {
    const res: IpcResponse<string> = ipcSuccess('hello');
    if (isIpcSuccess(res)) {
      // Type narrowed to IpcSuccess<string>.
      expect(res.value.toUpperCase()).toBe('HELLO');
    } else {
      throw new Error('expected success');
    }
  });
});

describe('toIpcError', () => {
  it('serialises a native Error preserving name and message', () => {
    const info = toIpcError(new TypeError('boom'));
    expect(info.name).toBe('TypeError');
    expect(info.message).toBe('boom');
  });

  it('captures a string code when present', () => {
    const error = Object.assign(new Error('nope'), { code: 'E_NOPE' });
    expect(toIpcError(error).code).toBe('E_NOPE');
  });

  it('handles bare string errors', () => {
    expect(toIpcError('plain')).toEqual({ name: 'Error', message: 'plain' });
  });

  it('handles plain object errors', () => {
    expect(toIpcError({ name: 'X', message: 'y', code: 'Z' })).toEqual({
      name: 'X',
      message: 'y',
      code: 'Z',
    });
  });

  it('falls back for unknown values', () => {
    expect(toIpcError(null)).toEqual({ name: 'Error', message: 'An unknown error occurred.' });
    expect(toIpcError(123).name).toBe('Error');
  });
});

describe('fromResult', () => {
  it('maps an ok Result to a success envelope', () => {
    expect(fromResult({ ok: true, value: 'v' })).toEqual({ ok: true, value: 'v' });
  });

  it('maps a failed Result to a failure envelope with serialised error', () => {
    const res = fromResult({ ok: false, error: new Error('domain failed') });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toBe('domain failed');
    }
  });
});

describe('ipc channels', () => {
  it('exposes a unique set of channel names', () => {
    const unique = new Set(ALL_IPC_CHANNELS);
    expect(unique.size).toBe(ALL_IPC_CHANNELS.length);
  });

  it('recognises known channels and rejects unknown ones', () => {
    expect(isIpcChannel(IpcChannels.wardrobeGet)).toBe(true);
    expect(isIpcChannel('totally:made-up')).toBe(false);
    expect(isIpcChannel(123)).toBe(false);
  });
});
