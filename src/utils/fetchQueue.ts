export interface FetchQueue {
  /** Enqueue a key; repeats and already-run keys are ignored. */
  push: (key: string) => void;
  pending: () => number;
  inFlight: () => number;
  /** Stop admitting new work; in-flight promises are left to settle. */
  stop: () => void;
}

export interface FetchQueueOptions {
  run: (key: string) => Promise<unknown>;
  maxInFlight?: number;
  /** Stop admitting after this many consecutive rejections. */
  maxConsecutiveFailures?: number;
}

/**
 * Admission control for speculative background fetches.
 *
 * Spotify calls are already serialized globally by `enqueueSpotifyTask`, so
 * this cannot make anything faster. What it bounds is queue *depth*: without
 * it, flicking through a 60-album discography enqueues 60 multi-page fetches,
 * and every user-initiated request then waits behind minutes of speculative
 * work. Capping admission keeps a real interaction a few tasks from the front.
 */
export function createFetchQueue(opts: FetchQueueOptions): FetchQueue {
  const { run, maxInFlight = 3, maxConsecutiveFailures = 3 } = opts;
  const queued: string[] = [];
  const seen = new Set<string>();
  let inFlight = 0;
  let failures = 0;
  let stopped = false;

  function pump(): void {
    while (!stopped && inFlight < maxInFlight && queued.length > 0) {
      const key = queued.shift()!;
      inFlight += 1;
      void run(key)
        .then(
          () => {
            failures = 0;
          },
          () => {
            // A rejection must never wedge the pump, and must never be
            // retried — an offline scroll would become an infinite loop.
            failures += 1;
            if (failures >= maxConsecutiveFailures) stopped = true;
          },
        )
        .finally(() => {
          inFlight -= 1;
          pump();
        });
    }
  }

  return {
    push: (key) => {
      if (stopped || seen.has(key)) return;
      seen.add(key);
      queued.push(key);
      pump();
    },
    pending: () => queued.length,
    inFlight: () => inFlight,
    stop: () => {
      stopped = true;
      queued.length = 0;
    },
  };
}
