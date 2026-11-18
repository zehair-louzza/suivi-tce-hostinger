export const MIN_SCHEDULER_BACKOFF_MS = 15 * 60_000;
export const MAX_SCHEDULER_BACKOFF_MS = 2 * 3600_000;
export const DEFAULT_SEND_TIMEOUT_MS = 10_000;

export async function withWallTimeout<T>(promise: Promise<T>, timeoutMs = DEFAULT_SEND_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('SCHEDULER_SEND_TIMEOUT')), timeoutMs);
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function computeSchedulerBackoffMs(fails: number): number {
  const safeFails = Math.max(1, fails);
  return Math.min(MAX_SCHEDULER_BACKOFF_MS, MIN_SCHEDULER_BACKOFF_MS * Math.pow(2, safeFails - 1));
}

export function setBoundedRetryEntry<V>(map: Map<string, V>, key: string, value: V, maxSize = 2000): void {
  if (!map.has(key) && map.size >= maxSize) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
  map.set(key, value);
}
