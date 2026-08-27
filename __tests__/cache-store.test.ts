import CacheStore, { MISS } from "../lib/store/CacheStore";

const UNBOUNDED = 0;
const NO_TTL = 0;

describe("CacheStore", () => {
  describe("basic storage", () => {
    test("should report a miss for an unknown key", () => {
      const store = new CacheStore(UNBOUNDED, NO_TTL);
      expect(store.read("missing")).toBe(MISS);
      expect(store.size).toBe(0);
    });

    test("should store and return a value", () => {
      const store = new CacheStore(UNBOUNDED, NO_TTL);
      store.set("a", 1);
      expect(store.read("a")).toBe(1);
      expect(store.size).toBe(1);
    });

    test("should treat falsy values as present", () => {
      const store = new CacheStore(UNBOUNDED, NO_TTL);
      const falsy: unknown[] = [0, -0, "", false, null, undefined, NaN];

      falsy.forEach((value, index) => {
        store.set(String(index), value);
        expect(store.read(String(index))).not.toBe(MISS);
      });

      expect(store.read("5")).toBeUndefined();
      expect(store.read("6")).toBeNaN();
      expect(store.size).toBe(falsy.length);
    });

    test("should overwrite an existing key without growing", () => {
      const store = new CacheStore(UNBOUNDED, NO_TTL);
      store.set("a", 1);
      store.set("a", 2);
      expect(store.size).toBe(1);
      expect(store.read("a")).toBe(2);
    });

    test("should delete a key", () => {
      const store = new CacheStore(UNBOUNDED, NO_TTL);
      store.set("a", 1);
      expect(store.delete("a")).toBe(true);
      expect(store.delete("a")).toBe(false);
      expect(store.read("a")).toBe(MISS);
      expect(store.size).toBe(0);
    });

    test("should clear every key", () => {
      const store = new CacheStore(UNBOUNDED, NO_TTL);
      store.set("a", 1);
      store.set("b", 2);
      store.clear();
      expect(store.size).toBe(0);
      expect(store.read("a")).toBe(MISS);
    });

    test("should stay usable after being cleared", () => {
      const store = new CacheStore(2, NO_TTL);
      store.set("a", 1);
      store.clear();

      store.set("b", 2);
      store.set("c", 3);
      store.set("d", 4);

      expect(store.size).toBe(2);
      expect(store.read("b")).toBe(MISS);
      expect(store.read("d")).toBe(4);
    });
  });

  describe("LRU eviction", () => {
    test("should never exceed maxSize", () => {
      const store = new CacheStore(3, NO_TTL);
      for (let i = 0; i < 100; i++) store.set(String(i), i);
      expect(store.size).toBe(3);
    });

    test("should evict the least recently inserted entry", () => {
      const store = new CacheStore(2, NO_TTL);
      store.set("a", 1);
      store.set("b", 2);
      store.set("c", 3);

      expect(store.read("a")).toBe(MISS);
      expect(store.read("b")).toBe(2);
      expect(store.read("c")).toBe(3);
    });

    test("should promote an entry on read so it survives eviction", () => {
      const store = new CacheStore(2, NO_TTL);
      store.set("a", 1);
      store.set("b", 2);

      store.read("a");
      store.set("c", 3);

      expect(store.read("a")).toBe(1);
      expect(store.read("b")).toBe(MISS);
      expect(store.read("c")).toBe(3);
    });

    test("should move a rewritten key to the most recent position", () => {
      const store = new CacheStore(2, NO_TTL);
      store.set("a", 1);
      store.set("b", 2);
      store.set("a", 10);
      store.set("c", 3);

      expect(store.read("a")).toBe(10);
      expect(store.read("b")).toBe(MISS);
    });

    test("should evict in strict least-recently-used order", () => {
      const store = new CacheStore(3, NO_TTL);
      store.set("a", 1);
      store.set("b", 2);
      store.set("c", 3);

      store.read("a");
      store.read("b");

      store.set("d", 4);
      expect(store.read("c")).toBe(MISS);

      store.set("e", 5);
      expect(store.read("a")).toBe(MISS);
      expect(store.read("b")).toBe(2);
    });

    test("should keep a single entry when maxSize is 1", () => {
      const store = new CacheStore(1, NO_TTL);
      store.set("a", 1);
      store.set("b", 2);

      expect(store.size).toBe(1);
      expect(store.read("b")).toBe(2);
      expect(store.read("a")).toBe(MISS);
    });

    test("should handle deleting the head, tail and middle nodes", () => {
      const store = new CacheStore(UNBOUNDED, NO_TTL);
      store.set("a", 1);
      store.set("b", 2);
      store.set("c", 3);

      store.delete("a");
      store.delete("c");
      expect(store.size).toBe(1);
      expect(store.read("b")).toBe(2);

      store.set("d", 4);
      store.set("e", 5);
      store.delete("d");
      expect(store.read("b")).toBe(2);
      expect(store.read("e")).toBe(5);
      expect(store.size).toBe(2);
    });

    test("should keep the list consistent after emptying by deletion", () => {
      const store = new CacheStore(2, NO_TTL);
      store.set("a", 1);
      store.set("b", 2);
      store.delete("a");
      store.delete("b");

      expect(store.size).toBe(0);

      store.set("c", 3);
      store.set("d", 4);
      store.set("e", 5);

      expect(store.size).toBe(2);
      expect(store.read("c")).toBe(MISS);
      expect(store.read("e")).toBe(5);
    });

    test("should stay unbounded when maxSize is 0 or Infinity", () => {
      const zero = new CacheStore(0, NO_TTL);
      const infinite = new CacheStore(Infinity, NO_TTL);
      for (let i = 0; i < 500; i++) {
        zero.set(String(i), i);
        infinite.set(String(i), i);
      }
      expect(zero.size).toBe(500);
      expect(infinite.size).toBe(500);
    });

    test("should re-read a promoted single entry without corrupting the list", () => {
      const store = new CacheStore(UNBOUNDED, NO_TTL);
      store.set("a", 1);

      expect(store.read("a")).toBe(1);
      expect(store.read("a")).toBe(1);

      store.set("b", 2);
      expect(store.read("a")).toBe(1);
      expect(store.read("b")).toBe(2);
    });
  });

  describe("time to live", () => {
    test("should keep entries before expiry", () => {
      jest.useFakeTimers();
      const store = new CacheStore(UNBOUNDED, 1000);
      store.set("a", 1);

      jest.advanceTimersByTime(999);
      expect(store.read("a")).toBe(1);
    });

    test("should drop entries once expired", () => {
      jest.useFakeTimers();
      const store = new CacheStore(UNBOUNDED, 1000);
      store.set("a", 1);

      jest.advanceTimersByTime(1000);
      expect(store.read("a")).toBe(MISS);
      expect(store.size).toBe(0);
    });

    test("should restart the clock when a key is rewritten", () => {
      jest.useFakeTimers();
      const store = new CacheStore(UNBOUNDED, 1000);
      store.set("a", 1);

      jest.advanceTimersByTime(900);
      store.set("a", 2);
      jest.advanceTimersByTime(900);

      expect(store.read("a")).toBe(2);
    });

    test("should expire an entry that sits in the middle of the list", () => {
      jest.useFakeTimers();
      const store = new CacheStore(UNBOUNDED, 1000);
      store.set("a", 1);
      jest.advanceTimersByTime(600);
      store.set("b", 2);
      store.set("c", 3);

      jest.advanceTimersByTime(500);
      expect(store.read("a")).toBe(MISS);
      expect(store.read("b")).toBe(2);
      expect(store.read("c")).toBe(3);
      expect(store.size).toBe(2);
    });

    test("should never expire when ttl is 0", () => {
      jest.useFakeTimers();
      const store = new CacheStore(UNBOUNDED, NO_TTL);
      store.set("a", 1);

      jest.advanceTimersByTime(10_000_000);
      expect(store.read("a")).toBe(1);
    });

    test("should not schedule timers", () => {
      jest.useFakeTimers();
      const store = new CacheStore(UNBOUNDED, 1000);
      store.set("a", 1);

      expect(jest.getTimerCount()).toBe(0);
      expect(store.size).toBe(1);
    });
  });

  describe("recency integrity under churn", () => {
    test("should keep exactly the most recently used entries", () => {
      const store = new CacheStore(100, NO_TTL);

      for (let i = 0; i < 1000; i++) store.set(`k${i}`, i);
      expect(store.size).toBe(100);

      for (let i = 0; i < 900; i++) expect(store.read(`k${i}`)).toBe(MISS);
      for (let i = 900; i < 1000; i++) expect(store.read(`k${i}`)).toBe(i);
    });

    test("should protect a repeatedly read entry indefinitely", () => {
      const store = new CacheStore(10, NO_TTL);
      store.set("pinned", "keep");

      for (let i = 0; i < 1000; i++) {
        store.set(`k${i}`, i);
        store.read("pinned");
      }

      expect(store.read("pinned")).toBe("keep");
      expect(store.size).toBe(10);
    });
  });
});
