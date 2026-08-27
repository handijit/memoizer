import Memofy from "../lib/index";

describe("memoize", () => {
  let memofy: Memofy;

  beforeEach(() => {
    memofy = new Memofy();
  });

  describe("caching by arguments", () => {
    test("should run the function once for repeated arguments", () => {
      const spy = jest.fn((a: number, b: number) => a + b);
      const sum = memofy.memoize(spy);

      expect(sum(1, 2)).toBe(3);
      expect(sum(1, 2)).toBe(3);
      expect(sum(1, 2)).toBe(3);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    test("should re-run for different arguments", () => {
      const spy = jest.fn((a: number) => a * 2);
      const double = memofy.memoize(spy);

      expect(double(1)).toBe(2);
      expect(double(2)).toBe(4);
      expect(spy).toHaveBeenCalledTimes(2);
    });

    test("should cache zero-argument calls", () => {
      const spy = jest.fn(() => "value");
      const get = memofy.memoize(spy);

      expect(get()).toBe("value");
      expect(get()).toBe("value");
      expect(spy).toHaveBeenCalledTimes(1);
    });

    test("should distinguish argument counts", () => {
      const spy = jest.fn((...args: unknown[]) => args.length);
      const count = memofy.memoize(spy);

      expect(count()).toBe(0);
      expect(count(undefined)).toBe(1);
      expect(count(undefined, undefined)).toBe(2);
      expect(spy).toHaveBeenCalledTimes(3);
    });

    test("should match structurally equal object arguments", () => {
      const spy = jest.fn((user: { id: number }) => user.id);
      const read = memofy.memoize(spy);

      expect(read({ id: 1 })).toBe(1);
      expect(read({ id: 1 })).toBe(1);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    test("should re-run when an object argument changes", () => {
      const spy = jest.fn((user: { id: number }) => user.id);
      const read = memofy.memoize(spy);

      read({ id: 1 });
      read({ id: 2 });
      expect(spy).toHaveBeenCalledTimes(2);
    });

    test("should observe mutation of an object argument", () => {
      const spy = jest.fn((product: { price: number }) => product.price * 2);
      const total = memofy.memoize(spy);
      const product = { price: 10 };

      expect(total(product)).toBe(20);
      product.price = 15;
      expect(total(product)).toBe(30);
      expect(spy).toHaveBeenCalledTimes(2);
    });

    test("should not let a later mutation corrupt an existing entry", () => {
      const spy = jest.fn((product: { price: number }) => product.price * 2);
      const total = memofy.memoize(spy);
      const product = { price: 10 };

      expect(total(product)).toBe(20);
      product.price = 15;
      expect(total(product)).toBe(30);
      product.price = 10;
      expect(total(product)).toBe(20);
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  describe("return values", () => {
    test("should cache falsy results", () => {
      const falsy = [0, -0, "", false, null, undefined, NaN];

      falsy.forEach((value) => {
        const spy = jest.fn(() => value);
        const get = memofy.memoize(spy);

        const first = get();
        const second = get();

        expect(spy).toHaveBeenCalledTimes(1);
        if (typeof value === "number" && Number.isNaN(value)) {
          expect(first).toBeNaN();
          expect(second).toBeNaN();
        } else {
          expect(first).toBe(value);
          expect(second).toBe(value);
        }
      });
    });

    test("should return the identical object reference on a hit", () => {
      const spy = jest.fn(() => ({ built: true }));
      const build = memofy.memoize(spy);

      expect(build()).toBe(build());
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe("argument edge cases", () => {
    test("should treat NaN arguments as a stable key", () => {
      const spy = jest.fn((n: number) => String(n));
      const stringify = memofy.memoize(spy);

      stringify(NaN);
      stringify(NaN);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    test("should separate 0 from -0", () => {
      const spy = jest.fn((n: number) => 1 / n);
      const reciprocal = memofy.memoize(spy);

      expect(reciprocal(0)).toBe(Infinity);
      expect(reciprocal(-0)).toBe(-Infinity);
      expect(spy).toHaveBeenCalledTimes(2);
    });

    test("should separate a number from its string form", () => {
      const spy = jest.fn((v: unknown) => typeof v);
      const typeOf = memofy.memoize(spy);

      expect(typeOf(1)).toBe("number");
      expect(typeOf("1")).toBe("string");
      expect(spy).toHaveBeenCalledTimes(2);
    });

    test("should not collide on objects that hide state behind accessors", () => {
      const spy = jest.fn((url: URL) => url.hostname);
      const hostname = memofy.memoize(spy);

      expect(hostname(new URL("https://a.com"))).toBe("a.com");
      expect(hostname(new URL("https://b.com"))).toBe("b.com");
      expect(spy).toHaveBeenCalledTimes(2);
    });

    test("should handle circular arguments without throwing", () => {
      const spy = jest.fn((node: { name: string }) => node.name);
      const read = memofy.memoize(spy);
      const node: Record<string, unknown> = { name: "root" };
      node.self = node;

      expect(read(node as { name: string })).toBe("root");
      expect(read(node as { name: string })).toBe("root");
      expect(spy).toHaveBeenCalledTimes(1);
    });

    test("should fall back to an uncached call when a key cannot be built", () => {
      const hostile = {
        get boom(): never {
          throw new Error("getter exploded");
        },
      };
      const spy = jest.fn((_input: unknown) => "ok");
      const run = memofy.memoize(spy);

      expect(run(hostile)).toBe("ok");
      expect(run(hostile)).toBe("ok");
      expect(spy).toHaveBeenCalledTimes(2);
    });

    test("should fall back to an uncached call for absurdly deep arguments", () => {
      let node: Record<string, unknown> = {};
      const head = node;
      for (let i = 0; i < 5000; i++) {
        const next: Record<string, unknown> = {};
        node.next = next;
        node = next;
      }

      const spy = jest.fn((_input: unknown) => "deep");
      const run = memofy.memoize(spy);

      expect(run(head)).toBe("deep");
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe("errors", () => {
    test("should propagate a thrown error", () => {
      const spy = jest.fn(() => {
        throw new Error("boom");
      });
      const run = memofy.memoize(spy);

      expect(() => run()).toThrow("boom");
    });

    test("should not cache a thrown error", () => {
      let attempt = 0;
      const spy = jest.fn(() => {
        attempt++;
        if (attempt === 1) throw new Error("transient");
        return "recovered";
      });
      const run = memofy.memoize(spy);

      expect(() => run()).toThrow("transient");
      expect(run()).toBe("recovered");
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  describe("cache controls", () => {
    test("should expose the number of cached results", () => {
      const double = memofy.memoize((n: number) => n * 2);

      expect(double.size).toBe(0);
      double(1);
      double(2);
      double(1);
      expect(double.size).toBe(2);
    });

    test("should clear a single memoized function", () => {
      const spy = jest.fn((n: number) => n * 2);
      const double = memofy.memoize(spy);

      double(1);
      double.clear();
      double(1);

      expect(double.size).toBe(1);
      expect(spy).toHaveBeenCalledTimes(2);
    });

    test("should clear every function of the instance", () => {
      const first = jest.fn((n: number) => n);
      const second = jest.fn((n: number) => n);
      const a = memofy.memoize(first);
      const b = memofy.memoize(second);

      a(1);
      b(1);
      memofy.clear();
      a(1);
      b(1);

      expect(first).toHaveBeenCalledTimes(2);
      expect(second).toHaveBeenCalledTimes(2);
    });

    test("should reset caches through init", () => {
      const spy = jest.fn((n: number) => n);
      const run = memofy.memoize(spy);

      run(1);
      memofy.init();
      run(1);

      expect(spy).toHaveBeenCalledTimes(2);
    });

    test("should keep clearing effective across repeated cycles", () => {
      const spy = jest.fn((n: number) => n);
      const run = memofy.memoize(spy);

      for (let i = 0; i < 5; i++) {
        run(1);
        memofy.clear();
      }

      expect(spy).toHaveBeenCalledTimes(5);
    });
  });

  describe("instance isolation", () => {
    test("should not share caches between instances", () => {
      const spy = jest.fn((n: number) => n * 2);
      const first = new Memofy().memoize(spy);
      const second = new Memofy().memoize(spy);

      first(1);
      second(1);

      expect(spy).toHaveBeenCalledTimes(2);
    });

    test("should not share caches between memoizations of one function", () => {
      const spy = jest.fn((n: number) => n * 2);
      const first = memofy.memoize(spy);
      const second = memofy.memoize(spy);

      first(1);
      second(1);

      expect(spy).toHaveBeenCalledTimes(2);
    });

    test("clearing one instance should not affect another", () => {
      const spy = jest.fn((n: number) => n);
      const otherMemofy = new Memofy();
      const mine = memofy.memoize(spy);
      const theirs = otherMemofy.memoize(spy);

      mine(1);
      theirs(1);
      memofy.clear();
      mine(1);
      theirs(1);

      expect(spy).toHaveBeenCalledTimes(3);
    });
  });

  describe("options", () => {
    test("should honour a per-function maxSize", () => {
      const spy = jest.fn((n: number) => n);
      const run = memofy.memoize(spy, [], undefined, { maxSize: 2 });

      run(1);
      run(2);
      run(3);

      expect(run.size).toBe(2);
    });

    test("should honour an instance-wide maxSize", () => {
      const bounded = new Memofy({ maxSize: 2 });
      const run = bounded.memoize((n: number) => n);

      run(1);
      run(2);
      run(3);

      expect(run.size).toBe(2);
    });

    test("should default to a bounded cache", () => {
      const run = memofy.memoize((n: number) => n);
      for (let i = 0; i < 1500; i++) run(i);

      expect(run.size).toBe(1000);
    });

    test("should accept an unbounded cache explicitly", () => {
      const unbounded = new Memofy({ maxSize: 0 });
      const run = unbounded.memoize((n: number) => n);
      for (let i = 0; i < 1500; i++) run(i);

      expect(run.size).toBe(1500);
    });

    test("should ignore invalid maxSize values", () => {
      const run = memofy.memoize((n: number) => n, [], undefined, {
        maxSize: -5,
      });
      for (let i = 0; i < 1500; i++) run(i);

      expect(run.size).toBe(1000);
    });

    test("should expire results after ttl", () => {
      jest.useFakeTimers();
      const spy = jest.fn((n: number) => n);
      const run = memofy.memoize(spy, [], undefined, { ttl: 1000 });

      run(1);
      jest.advanceTimersByTime(500);
      run(1);
      expect(spy).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(500);
      run(1);
      expect(spy).toHaveBeenCalledTimes(2);
    });

    test("should honour an instance-wide ttl", () => {
      jest.useFakeTimers();
      const spy = jest.fn((n: number) => n);
      const expiring = new Memofy({ ttl: 100 });
      const run = expiring.memoize(spy);

      run(1);
      jest.advanceTimersByTime(101);
      run(1);

      expect(spy).toHaveBeenCalledTimes(2);
    });

    test("should ignore invalid ttl values", () => {
      jest.useFakeTimers();
      const spy = jest.fn((n: number) => n);
      const run = memofy.memoize(spy, [], undefined, { ttl: -1 });

      run(1);
      jest.advanceTimersByTime(10_000_000);
      run(1);

      expect(spy).toHaveBeenCalledTimes(1);
    });

    test("should use a custom resolver when given", () => {
      const spy = jest.fn((user: { id: number; seenAt: number }) => user.id);
      const read = memofy.memoize(spy, [], undefined, {
        resolver: (user) => String(user.id),
      });

      expect(read({ id: 1, seenAt: 100 })).toBe(1);
      expect(read({ id: 1, seenAt: 999 })).toBe(1);
      expect(spy).toHaveBeenCalledTimes(1);

      read({ id: 2, seenAt: 100 });
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });
});
