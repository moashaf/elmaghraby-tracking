export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  const guarded = Promise.resolve(promise).then(
    (value) => value,
    () => null
  );

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    void guarded.then((value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

export async function mapPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;

  async function run() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current]!, current);
    }
  }

  if (!items.length) return results;
  const workers = Math.min(Math.max(1, limit), items.length);
  await Promise.all(Array.from({ length: workers }, () => run()));
  return results;
}
