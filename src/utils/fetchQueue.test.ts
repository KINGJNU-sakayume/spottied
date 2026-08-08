import { describe, expect, it } from 'vitest';
import { createFetchQueue } from './fetchQueue';

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
  reject: () => void;
}

function deferred(): Deferred {
  let resolve!: () => void;
  let reject!: () => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = () => res();
    reject = () => rej(new Error('failed'));
  });
  return { promise, resolve, reject };
}

/** Lets queued `.then`/`.finally` callbacks run before the next assertion. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function harness(options: { maxInFlight?: number; maxConsecutiveFailures?: number } = {}) {
  const started: string[] = [];
  const pendingRuns = new Map<string, Deferred>();
  const queue = createFetchQueue({
    ...options,
    run: (key) => {
      started.push(key);
      const d = deferred();
      pendingRuns.set(key, d);
      return d.promise;
    },
  });
  return { queue, started, pendingRuns };
}

describe('createFetchQueue', () => {
  it('never exceeds maxInFlight concurrent runs', async () => {
    const { queue, started, pendingRuns } = harness({ maxInFlight: 3 });
    for (let i = 0; i < 10; i++) queue.push(`k${i}`);

    expect(started).toEqual(['k0', 'k1', 'k2']);
    expect(queue.inFlight()).toBe(3);
    expect(queue.pending()).toBe(7);

    pendingRuns.get('k0')!.resolve();
    await flush();
    expect(started).toEqual(['k0', 'k1', 'k2', 'k3']);
    expect(queue.inFlight()).toBe(3);
  });

  it('runs a repeated key only once', () => {
    const { queue, started } = harness();
    queue.push('same');
    queue.push('same');
    expect(started).toEqual(['same']);
  });

  it('releases the slot when a run rejects', async () => {
    const { queue, started, pendingRuns } = harness({ maxInFlight: 1 });
    queue.push('a');
    queue.push('b');
    expect(started).toEqual(['a']);

    pendingRuns.get('a')!.reject();
    await flush();
    expect(started).toEqual(['a', 'b']);
  });

  it('stops admitting after consecutive failures, and a success resets', async () => {
    const { queue, started, pendingRuns } = harness({
      maxInFlight: 1,
      maxConsecutiveFailures: 2,
    });
    queue.push('a');
    pendingRuns.get('a')!.reject();
    await flush();

    queue.push('b');
    pendingRuns.get('b')!.resolve();
    await flush();
    expect(started).toEqual(['a', 'b']);

    // Counter was reset by 'b', so two more failures are needed to trip it.
    queue.push('c');
    pendingRuns.get('c')!.reject();
    await flush();
    queue.push('d');
    pendingRuns.get('d')!.reject();
    await flush();

    queue.push('e');
    expect(started).toEqual(['a', 'b', 'c', 'd']);
  });

  it('drops queued work and admits nothing after stop()', () => {
    const { queue, started } = harness({ maxInFlight: 1 });
    queue.push('a');
    queue.push('b');
    expect(queue.pending()).toBe(1);

    queue.stop();
    expect(queue.pending()).toBe(0);
    queue.push('c');
    expect(started).toEqual(['a']);
  });
});
