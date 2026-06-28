import { describe, expect, it } from 'vitest';

import { ConsoleLogger, MemorySink, NoopLogger } from './ConsoleLogger';
import { LogLevel } from './Logger';

const fixedClock = (): Date => new Date('2026-07-01T00:00:00.000Z');

describe('ConsoleLogger', () => {
  it('emits structured entries at or above the threshold', () => {
    const sink = new MemorySink();
    const logger = new ConsoleLogger({ level: LogLevel.Info, sink, now: fixedClock });

    logger.debug('ignored');
    logger.info('hello', { userId: 7 });
    logger.error('boom');

    expect(sink.entries).toHaveLength(2);
    expect(sink.entries[0]).toMatchObject({
      level: LogLevel.Info,
      message: 'hello',
      time: '2026-07-01T00:00:00.000Z',
      context: { userId: 7 },
    });
    expect(sink.entries[1]?.level).toBe(LogLevel.Error);
  });

  it('suppresses everything below the configured level', () => {
    const sink = new MemorySink();
    const logger = new ConsoleLogger({ level: LogLevel.Warn, sink });
    logger.trace('no');
    logger.debug('no');
    logger.info('no');
    logger.warn('yes');
    expect(sink.entries).toHaveLength(1);
    expect(sink.entries[0]?.message).toBe('yes');
  });

  it('merges bound context from child loggers', () => {
    const sink = new MemorySink();
    const root = new ConsoleLogger({ level: LogLevel.Info, sink, now: fixedClock });
    const child = root.child({ name: 'db', context: { component: 'repo' } });
    child.info('saved', { id: 'g-1' });

    expect(sink.entries[0]).toMatchObject({
      name: 'db',
      context: { component: 'repo', id: 'g-1' },
    });
  });
});

describe('NoopLogger', () => {
  it('never throws and returns itself for children', () => {
    const logger = new NoopLogger();
    expect(() => logger.info('x')).not.toThrow();
    expect(logger.child({ name: 'y' })).toBe(logger);
  });
});
