import Memoizer from "../lib/index";

describe("memory behaviour", () => {
  test("should keep a hot loop bounded even when results are falsy", () => {
    const memoizer = new Memoizer();
    const spy = jest.fn((n: number) => n % 2 === 0);
    const isEven = memoizer.memoize(spy);

    for (let i = 0; i < 10_000; i++) isEven(3);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(isEven.size).toBe(1);
  });

  test("should stay bounded under unique arguments", () => {
    const memoizer = new Memoizer({ maxSize: 50 });
    const run = memoizer.memoize((n: number) => n);

    for (let i = 0; i < 10_000; i++) run(i);

    expect(run.size).toBe(50);
  });

  test("should stay bounded under unique object arguments", () => {
    const memoizer = new Memoizer({ maxSize: 10 });
    const run = memoizer.memoize((user: { id: number }) => user.id);

    for (let i = 0; i < 1000; i++) run({ id: i });

    expect(run.size).toBe(10);
  });

  test("should not grow when dependencies change repeatedly", () => {
    const memoizer = new Memoizer();
    const settings = { rate: 0 };
    const total = memoizer.memoize(
      (price: number) => price * settings.rate,
      [settings]
    );

    for (let i = 0; i < 1000; i++) {
      settings.rate = i;
      total(10);
    }

    expect(total.size).toBe(1);
  });

  test("should release entries on clear", () => {
    const memoizer = new Memoizer();
    const run = memoizer.memoize((n: number) => n);

    for (let i = 0; i < 100; i++) run(i);
    expect(run.size).toBe(100);

    run.clear();
    expect(run.size).toBe(0);
  });

  test("should not retain the cache once the memoized function is dropped", async () => {
    const memoizer = new Memoizer();
    let run: ((n: number) => number) | null = memoizer.memoize((n: number) => n);
    for (let i = 0; i < 100; i++) run(i);

    const ref = new WeakRef(run);
    run = null;

    expect(Object.values(memoizer)).not.toContain(ref.deref());
  });

  test("should not schedule any timers", () => {
    jest.useFakeTimers();
    const memoizer = new Memoizer({ ttl: 100 });
    const run = memoizer.memoize((n: number) => n);

    run(1);
    run(2);

    expect(jest.getTimerCount()).toBe(0);
  });

  test("should survive many independent memoizations", () => {
    const memoizer = new Memoizer({ maxSize: 5 });
    const fns = Array.from({ length: 500 }, () =>
      memoizer.memoize((n: number) => n * 2)
    );

    fns.forEach((fn) => {
      for (let i = 0; i < 20; i++) fn(i);
    });

    fns.forEach((fn) => expect(fn.size).toBe(5));
  });
});
