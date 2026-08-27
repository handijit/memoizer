import Memofy from "../lib/index";

describe("promise results", () => {
  let memofy: Memofy;

  beforeEach(() => {
    memofy = new Memofy();
  });

  test("should cache a resolved promise", async () => {
    const spy = jest.fn(async (id: number) => `user-${id}`);
    const load = memofy.memoize(spy);

    await expect(load(1)).resolves.toBe("user-1");
    await expect(load(1)).resolves.toBe("user-1");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test("should deduplicate concurrent calls onto one promise", async () => {
    const spy = jest.fn(async (id: number) => `user-${id}`);
    const load = memofy.memoize(spy);

    const [a, b, c] = await Promise.all([load(1), load(1), load(1)]);

    expect([a, b, c]).toEqual(["user-1", "user-1", "user-1"]);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test("should not keep a rejected promise in the cache", async () => {
    let attempt = 0;
    const spy = jest.fn(async () => {
      attempt++;
      if (attempt === 1) throw new Error("network down");
      return "recovered";
    });
    const load = memofy.memoize(spy);

    await expect(load()).rejects.toThrow("network down");
    await expect(load()).resolves.toBe("recovered");
    expect(spy).toHaveBeenCalledTimes(2);
  });

  test("should evict only the rejected argument set", async () => {
    const spy = jest.fn(async (id: number) => {
      if (id === 1) throw new Error("bad id");
      return `user-${id}`;
    });
    const load = memofy.memoize(spy);

    await expect(load(1)).rejects.toThrow("bad id");
    await expect(load(2)).resolves.toBe("user-2");
    await expect(load(2)).resolves.toBe("user-2");

    expect(spy).toHaveBeenCalledTimes(2);

    await expect(load(1)).rejects.toThrow("bad id");
    expect(spy).toHaveBeenCalledTimes(3);
  });

  test("should keep a rejected promise when explicitly asked to", async () => {
    const spy = jest.fn(async () => {
      throw new Error("permanent");
    });
    const load = memofy.memoize(spy, [], undefined, {
      cacheRejectedPromises: true,
    });

    await expect(load()).rejects.toThrow("permanent");
    await expect(load()).rejects.toThrow("permanent");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test("should honour the instance-wide rejection setting", async () => {
    const keeping = new Memofy({ cacheRejectedPromises: true });
    const spy = jest.fn(async () => {
      throw new Error("permanent");
    });
    const load = keeping.memoize(spy);

    await expect(load()).rejects.toThrow("permanent");
    await expect(load()).rejects.toThrow("permanent");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test("should let a per-function option override the instance setting", async () => {
    const keeping = new Memofy({ cacheRejectedPromises: true });
    const spy = jest.fn(async () => {
      throw new Error("transient");
    });
    const load = keeping.memoize(spy, [], undefined, {
      cacheRejectedPromises: false,
    });

    await expect(load()).rejects.toThrow("transient");
    await expect(load()).rejects.toThrow("transient");
    expect(spy).toHaveBeenCalledTimes(2);
  });

  test("should handle a custom thenable", async () => {
    const thenable = {
      then(resolve: (value: string) => void): void {
        resolve("done");
      },
    };
    const spy = jest.fn(() => thenable);
    const run = memofy.memoize(spy);

    expect(run()).toBe(thenable);
    expect(run()).toBe(thenable);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test("should drop the entry only after the rejection settles", async () => {
    const spy = jest.fn(async () => {
      throw new Error("late");
    });
    const load = memofy.memoize(spy);

    const first = load();
    const second = load();
    expect(first).toBe(second);

    await expect(first).rejects.toThrow("late");
    await expect(second).rejects.toThrow("late");
    expect(spy).toHaveBeenCalledTimes(1);

    await expect(load()).rejects.toThrow("late");
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
