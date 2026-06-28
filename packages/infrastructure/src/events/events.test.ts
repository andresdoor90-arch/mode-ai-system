import { describe, expect, it } from 'vitest';

import { type DomainEventEnvelope, InMemoryEventBus } from './EventBus';

describe('InMemoryEventBus', () => {
  it('delivers events to type-specific subscribers', async () => {
    const bus = new InMemoryEventBus();
    const received: number[] = [];
    bus.subscribe<number>('garment.saved', (event) => {
      received.push(event.payload);
    });

    await bus.publish('garment.saved', 1);
    await bus.publish('garment.saved', 2);
    await bus.publish('other.event', 99);

    expect(received).toEqual([1, 2]);
  });

  it('delivers every event to wildcard subscribers', async () => {
    const bus = new InMemoryEventBus();
    const types: string[] = [];
    bus.subscribeAll((event: DomainEventEnvelope) => {
      types.push(event.type);
    });

    await bus.publish('a', null);
    await bus.publish('b', null);

    expect(types).toEqual(['a', 'b']);
  });

  it('stops delivering after unsubscribe', async () => {
    const bus = new InMemoryEventBus();
    let count = 0;
    const off = bus.subscribe('x', () => {
      count += 1;
    });
    await bus.publish('x', null);
    off();
    await bus.publish('x', null);
    expect(count).toBe(1);
    expect(bus.handlerCount).toBe(0);
  });

  it('isolates a failing handler via onHandlerError', async () => {
    const errors: unknown[] = [];
    const bus = new InMemoryEventBus({ onHandlerError: (e) => errors.push(e) });
    let reachedSecond = false;
    bus.subscribe('x', () => {
      throw new Error('handler blew up');
    });
    bus.subscribe('x', () => {
      reachedSecond = true;
    });

    await bus.publish('x', null);

    expect(errors).toHaveLength(1);
    expect(reachedSecond).toBe(true);
  });

  it('stamps an ISO timestamp using the injected clock', async () => {
    const bus = new InMemoryEventBus({ now: () => new Date('2026-01-02T03:04:05.000Z') });
    let occurredAt = '';
    bus.subscribe('x', (event) => {
      occurredAt = event.occurredAt;
    });
    await bus.publish('x', null);
    expect(occurredAt).toBe('2026-01-02T03:04:05.000Z');
  });
});
