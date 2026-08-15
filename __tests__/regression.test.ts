import Memofy from "../lib/index";

/**
 * One test per defect confirmed against the published v2 bundle. Each name
 * states the old behaviour so a reintroduction is unambiguous.
 */
describe("v2 regressions", () => {
  let memofy: Memofy;

  beforeEach(() => {
    memofy = new Memofy();
  });

  test("falsy results were recomputed on every call and re-inserted", () => {
    const spy = jest.fn((n: number) => n % 2 === 0);
    const isEven = memofy.memoize(spy);

    for (let i = 0; i < 5; i++) expect(isEven(3)).toBe(false);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(isEven.size).toBe(1);
  });

  test("a dependency change surfaced once, then reverted to the stale value", () => {
    const dep = { p: 10 };
    const scale = memofy.memoize((x: number) => dep.p * x, [dep]);

    expect(scale(1)).toBe(10);
    dep.p = 20;
    expect(scale(1)).toBe(20);
    expect(scale(1)).toBe(20);
  });

  test("objects without own enumerable keys collapsed into one cache slot", () => {
    const hostname = memofy.memoize((url: URL) => url.hostname);

    expect(hostname(new URL("https://a.com"))).toBe("a.com");
    expect(hostname(new URL("https://b.com"))).toBe("b.com");
  });

  test("Map, Set, RegExp and Error arguments all collided", () => {
    const mapSize = memofy.memoize((m: Map<string, number>) => m.size);
    expect(mapSize(new Map([["a", 1]]))).toBe(1);
    expect(
      mapSize(
        new Map([
          ["a", 1],
          ["b", 2],
        ])
      )
    ).toBe(2);

    const setSize = memofy.memoize((s: Set<number>) => s.size);
    expect(setSize(new Set([1]))).toBe(1);
    expect(setSize(new Set([1, 2]))).toBe(2);

    const source = memofy.memoize((r: RegExp) => r.source);
    expect(source(/foo/)).toBe("foo");
    expect(source(/bar/)).toBe("bar");

    const message = memofy.memoize((e: Error) => e.message);
    expect(message(new Error("a"))).toBe("a");
    expect(message(new Error("b"))).toBe("b");
  });

  test("a circular argument threw RangeError after running the function", () => {
    const spy = jest.fn((node: { name: string }) => node.name);
    const read = memofy.memoize(spy);
    const node: Record<string, unknown> = { name: "x" };
    node.self = node;

    expect(() => read(node as { name: string })).not.toThrow();
    expect(read(node as { name: string })).toBe("x");
  });

  test("two contexts shared one cache", () => {
    function greet(this: { name: string }): string {
      return `hi ${this.name}`;
    }

    expect(memofy.memoize(greet, [], { name: "Alice" })()).toBe("hi Alice");
    expect(memofy.memoize(greet, [], { name: "Bob" })()).toBe("hi Bob");
  });

  test("a rejected promise was cached permanently", async () => {
    let attempt = 0;
    const spy = jest.fn(async () => {
      attempt++;
      if (attempt < 3) throw new Error(`network down #${attempt}`);
      return "ok";
    });
    const load = memofy.memoize(spy);

    await expect(load()).rejects.toThrow("network down #1");
    await expect(load()).rejects.toThrow("network down #2");
    await expect(load()).resolves.toBe("ok");
    expect(spy).toHaveBeenCalledTimes(3);
  });

  test("NaN arguments never hit and appended an entry per call", () => {
    const spy = jest.fn((n: number) => String(n));
    const run = memofy.memoize(spy);

    for (let i = 0; i < 4; i++) run(NaN);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(run.size).toBe(1);
  });

  test("f(-0) returned f(0)'s cached result", () => {
    const reciprocal = memofy.memoize((n: number) => 1 / n);

    expect(reciprocal(0)).toBe(Infinity);
    expect(reciprocal(-0)).toBe(-Infinity);
  });

  test("zero-argument functions were never cached", () => {
    const spy = jest.fn(() => "value");
    const get = memofy.memoize(spy);

    get();
    get();
    get();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  test("lookup cost grew linearly with the number of cached entries", () => {
    const HITS = 20_000;

    const measureHitCost = (entries: number): number => {
      const run = memofy.memoize((n: number) => n, [], undefined, {
        maxSize: 0,
      });
      for (let i = 0; i < entries; i++) run(i);

      const target = entries - 1;
      for (let i = 0; i < 2000; i++) run(target); // warm up
      const start = performance.now();
      for (let i = 0; i < HITS; i++) run(target);
      return performance.now() - start;
    };

    const small = measureHitCost(100);
    const large = measureHitCost(10_000);

    // A ratio, not an absolute time, so the assertion survives slow CI hosts
    // while still catching a return to non-constant lookups. Both the v2 linear
    // deep-equality scan and a Map delete+set LRU promotion (which makes V8
    // rehash the whole map) showed 40x or worse here.
    expect(large / small).toBeLessThan(6);
  });

  test("deps compared by index missed a shrinking dependency list", () => {
    let deps: unknown[] = [{ a: 1 }, { b: 2 }];
    const spy = jest.fn(() => deps.length);
    const count = memofy.memoize(spy, () => deps);

    expect(count()).toBe(2);
    deps = [{ a: 1 }];
    expect(count()).toBe(1);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
