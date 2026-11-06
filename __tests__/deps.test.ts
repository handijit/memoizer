import Memoizer from "../lib/index";

describe("dependencies", () => {
  let memoizer: Memoizer;

  beforeEach(() => {
    memoizer = new Memoizer();
  });

  describe("array form", () => {
    test("should reuse the cache while dependencies are unchanged", () => {
      const settings = { rate: 2 };
      const spy = jest.fn((price: number) => price * settings.rate);
      const total = memoizer.memoize(spy, [settings]);

      expect(total(10)).toBe(20);
      expect(total(10)).toBe(20);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    test("should re-run when a dependency object mutates", () => {
      const settings = { rate: 2 };
      const spy = jest.fn((price: number) => price * settings.rate);
      const total = memoizer.memoize(spy, [settings]);

      expect(total(10)).toBe(20);
      settings.rate = 3;
      expect(total(10)).toBe(30);
      expect(spy).toHaveBeenCalledTimes(2);
    });

    test("should return the fresh value on every later call, not the stale one", () => {
      const settings = { rate: 2 };
      const total = memoizer.memoize(
        (price: number) => price * settings.rate,
        [settings]
      );

      expect(total(10)).toBe(20);
      settings.rate = 3;
      expect(total(10)).toBe(30);
      expect(total(10)).toBe(30);
      expect(total(10)).toBe(30);
    });

    test("should drop the whole cache when dependencies change", () => {
      const settings = { rate: 2 };
      const spy = jest.fn((price: number) => price * settings.rate);
      const total = memoizer.memoize(spy, [settings]);

      total(10);
      total(20);
      expect(spy).toHaveBeenCalledTimes(2);

      settings.rate = 3;
      expect(total(10)).toBe(30);
      expect(total(20)).toBe(60);
      expect(spy).toHaveBeenCalledTimes(4);
    });

    test("should react to a mutated array dependency", () => {
      const items: number[] = [1];
      const spy = jest.fn(() => items.length);
      const count = memoizer.memoize(spy, [items]);

      expect(count()).toBe(1);
      items.push(2);
      expect(count()).toBe(2);
      expect(spy).toHaveBeenCalledTimes(2);
    });

    test("should track several dependencies", () => {
      const a = { v: 1 };
      const b = { v: 1 };
      const spy = jest.fn(() => a.v + b.v);
      const sum = memoizer.memoize(spy, [a, b]);

      expect(sum()).toBe(2);
      b.v = 5;
      expect(sum()).toBe(6);
      expect(spy).toHaveBeenCalledTimes(2);
    });

    test("should not invalidate on the first observation", () => {
      const settings = { rate: 2 };
      const spy = jest.fn((price: number) => price * settings.rate);
      const total = memoizer.memoize(spy, [settings]);

      total(10);
      total(10);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    test("should behave like a plain memoize when deps are empty", () => {
      const spy = jest.fn((n: number) => n);
      const run = memoizer.memoize(spy, []);

      run(1);
      run(1);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe("getter form", () => {
    test("should observe primitive dependencies changing", () => {
      let rate = 2;
      const spy = jest.fn((price: number) => price * rate);
      const total = memoizer.memoize(spy, () => [rate]);

      expect(total(10)).toBe(20);
      expect(total(10)).toBe(20);
      expect(spy).toHaveBeenCalledTimes(1);

      rate = 3;
      expect(total(10)).toBe(30);
      expect(spy).toHaveBeenCalledTimes(2);
    });

    test("should keep the cache while the getter returns equal values", () => {
      let rate = 2;
      const spy = jest.fn((price: number) => price * rate);
      const total = memoizer.memoize(spy, () => [rate]);

      total(10);
      rate = 2;
      total(10);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    test("should support an empty getter result", () => {
      const spy = jest.fn((n: number) => n);
      const run = memoizer.memoize(spy, () => []);

      run(1);
      run(1);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    test("should fall back to an uncached call when the getter throws", () => {
      const spy = jest.fn((n: number) => n);
      const run = memoizer.memoize(spy, () => {
        throw new Error("deps exploded");
      });

      expect(run(1)).toBe(1);
      expect(run(1)).toBe(1);
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });
});
