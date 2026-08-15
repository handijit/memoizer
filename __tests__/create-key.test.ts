import createKey from "../lib/utils/create-key";

/** Asserts that no two of the given values share a cache key. */
const expectAllDistinct = (values: unknown[]): void => {
  const byKey = new Map<string, unknown>();

  for (const value of values) {
    const key = createKey([value]);
    if (byKey.has(key)) {
      throw new Error(
        `key collision: ${String(value)} and ${String(byKey.get(key))}`
      );
    }
    byKey.set(key, value);
  }

  expect(byKey.size).toBe(values.length);
};

describe("createKey", () => {
  describe("stability", () => {
    test("should be deterministic for the same input", () => {
      expect(createKey([1, "a", { b: 2 }])).toBe(createKey([1, "a", { b: 2 }]));
    });

    test("should produce a stable key for an empty argument list", () => {
      expect(createKey([])).toBe(createKey([]));
      expect(typeof createKey([])).toBe("string");
    });

    test("should distinguish argument counts", () => {
      expect(createKey([])).not.toBe(createKey([undefined]));
      expect(createKey([1])).not.toBe(createKey([1, undefined]));
    });
  });

  describe("primitive separation", () => {
    test("should never collide across primitive types", () => {
      expectAllDistinct([
        1,
        "1",
        true,
        false,
        null,
        undefined,
        BigInt(1),
        0,
        -0,
        NaN,
        Infinity,
        -Infinity,
        "",
        "true",
        "null",
        "undefined",
        "NaN",
      ]);
    });

    test("should treat NaN as a usable key", () => {
      expect(createKey([NaN])).toBe(createKey([NaN]));
    });

    test("should separate 0 from -0", () => {
      expect(createKey([0])).not.toBe(createKey([-0]));
    });

    test("should separate strings that could merge under naive joining", () => {
      expect(createKey(["a", "b"])).not.toBe(createKey(["ab"]));
      expect(createKey(["a,b"])).not.toBe(createKey(["a", "b"]));
      expect(createKey(["1"])).not.toBe(createKey([1]));
    });

    test("should handle strings containing delimiter-like characters", () => {
      expect(createKey(["s1:x"])).not.toBe(createKey(["x"]));
      expect(createKey(["A2"])).not.toBe(createKey([["A2"]]));
    });
  });

  describe("symbols", () => {
    test("should key a symbol by identity", () => {
      const symbol = Symbol("a");
      expect(createKey([symbol])).toBe(createKey([symbol]));
      expect(createKey([symbol])).not.toBe(createKey([Symbol("a")]));
    });

    test("should key registered symbols by their registry key", () => {
      expect(createKey([Symbol.for("shared")])).toBe(
        createKey([Symbol.for("shared")])
      );
      expect(createKey([Symbol.for("shared")])).not.toBe(
        createKey([Symbol.for("other")])
      );
    });

    test("should include enumerable symbol properties", () => {
      const key = Symbol("k");
      expect(createKey([{ [key]: 1 }])).not.toBe(createKey([{ [key]: 2 }]));
      expect(createKey([{ [key]: 1 }])).not.toBe(createKey([{}]));
    });

    test("should order multiple symbol properties deterministically", () => {
      const first = Symbol("first");
      const second = Symbol("second");

      const forward = { [first]: 1, [second]: 2 };
      const backward = { [second]: 2, [first]: 1 };

      expect(createKey([forward])).toBe(createKey([backward]));
      expect(createKey([forward])).not.toBe(
        createKey([{ [first]: 2, [second]: 1 }])
      );
    });

    test("should ignore non-enumerable symbol properties", () => {
      const key = Symbol("hidden");
      const withHidden = {};
      Object.defineProperty(withHidden, key, { value: 1, enumerable: false });
      expect(createKey([withHidden])).toBe(createKey([{}]));
    });
  });

  describe("functions", () => {
    test("should key a function by identity", () => {
      const fn = (): number => 1;
      expect(createKey([fn])).toBe(createKey([fn]));
      expect(createKey([fn])).not.toBe(createKey([(): number => 1]));
    });
  });

  describe("objects", () => {
    test("should be insensitive to key order", () => {
      expect(createKey([{ a: 1, b: 2 }])).toBe(createKey([{ b: 2, a: 1 }]));
    });

    test("should distinguish key names and values", () => {
      expect(createKey([{ a: 1 }])).not.toBe(createKey([{ b: 1 }]));
      expect(createKey([{ a: 1 }])).not.toBe(createKey([{ a: 2 }]));
      expect(createKey([{ a: undefined }])).not.toBe(createKey([{}]));
    });

    test("should distinguish nesting shape", () => {
      expect(createKey([{ a: { b: 1 } }])).not.toBe(createKey([{ a: 1 }]));
      expect(createKey([{ a: { b: 1 } }])).toBe(createKey([{ a: { b: 1 } }]));
    });

    test("should treat prototype-less objects like plain objects", () => {
      const bare = Object.create(null) as Record<string, unknown>;
      bare.a = 1;
      expect(createKey([bare])).toBe(createKey([{ a: 1 }]));
    });

    test("should ignore inherited properties", () => {
      const instance = Object.create({ inherited: 1 }) as Record<
        string,
        unknown
      >;
      instance.own = 2;
      expect(createKey([instance])).not.toBe(createKey([{ own: 2 }]));
    });
  });

  describe("class instances", () => {
    class Point {
      constructor(
        public x: number,
        public y: number
      ) {}
    }
    class Vector {
      constructor(
        public x: number,
        public y: number
      ) {}
    }

    test("should match instances of the same class with equal fields", () => {
      expect(createKey([new Point(1, 2)])).toBe(createKey([new Point(1, 2)]));
    });

    test("should separate different field values", () => {
      expect(createKey([new Point(1, 2)])).not.toBe(
        createKey([new Point(3, 4)])
      );
    });

    test("should separate different classes with identical fields", () => {
      expect(createKey([new Point(1, 2)])).not.toBe(
        createKey([new Vector(1, 2)])
      );
    });

    test("should separate a class instance from a plain object", () => {
      expect(createKey([new Point(1, 2)])).not.toBe(
        createKey([{ x: 1, y: 2 }])
      );
    });
  });

  describe("arrays", () => {
    test("should respect order and length", () => {
      expect(createKey([[1, 2]])).not.toBe(createKey([[2, 1]]));
      expect(createKey([[1]])).not.toBe(createKey([[1, 2]]));
      expect(createKey([[1, 2]])).toBe(createKey([[1, 2]]));
    });

    test("should separate a hole from an explicit undefined", () => {
      const sparse = [, 1] as unknown[];
      expect(createKey([sparse])).not.toBe(createKey([[undefined, 1]]));
      expect(createKey([sparse])).toBe(createKey([[, 1] as unknown[]]));
    });

    test("should separate an array from an object", () => {
      expect(createKey([[1]])).not.toBe(createKey([{ 0: 1 }]));
    });
  });

  describe("built-in types", () => {
    test("should key dates by their timestamp", () => {
      expect(createKey([new Date(5)])).toBe(createKey([new Date(5)]));
      expect(createKey([new Date(5)])).not.toBe(createKey([new Date(6)]));
      expect(createKey([new Date(5)])).not.toBe(createKey([5]));
    });

    test("should key invalid dates consistently", () => {
      expect(createKey([new Date("nope")])).toBe(createKey([new Date("nope")]));
    });

    test("should key regexps by source and flags", () => {
      expect(createKey([/a/g])).toBe(createKey([/a/g]));
      expect(createKey([/a/g])).not.toBe(createKey([/a/i]));
      expect(createKey([/a/])).not.toBe(createKey([/b/]));
    });

    test("should key maps by content, ignoring insertion order", () => {
      expect(
        createKey([
          new Map([
            ["a", 1],
            ["b", 2],
          ]),
        ])
      ).toBe(
        createKey([
          new Map([
            ["b", 2],
            ["a", 1],
          ]),
        ])
      );
      expect(createKey([new Map([["a", 1]])])).not.toBe(
        createKey([new Map([["a", 2]])])
      );
      expect(createKey([new Map([["a", 1]])])).not.toBe(
        createKey([new Map([["b", 1]])])
      );
    });

    test("should key sets by content, ignoring insertion order", () => {
      expect(createKey([new Set([1, 2])])).toBe(createKey([new Set([2, 1])]));
      expect(createKey([new Set([1])])).not.toBe(createKey([new Set([2])]));
      expect(createKey([new Set([1])])).not.toBe(
        createKey([new Map([[1, 1]])])
      );
    });

    test("should key errors by name and message", () => {
      expect(createKey([new Error("x")])).toBe(createKey([new Error("x")]));
      expect(createKey([new Error("x")])).not.toBe(createKey([new Error("y")]));
      expect(createKey([new TypeError("x")])).not.toBe(
        createKey([new RangeError("x")])
      );
    });

    test("should key URLs by their string form", () => {
      expect(createKey([new URL("https://a.com/")])).toBe(
        createKey([new URL("https://a.com/")])
      );
      expect(createKey([new URL("https://a.com/")])).not.toBe(
        createKey([new URL("https://b.com/")])
      );
      expect(createKey([new URLSearchParams("a=1")])).not.toBe(
        createKey([new URLSearchParams("a=2")])
      );
    });

    test("should key boxed primitives by value but apart from primitives", () => {
      /* eslint-disable no-new-wrappers */
      expect(createKey([new Number(1)])).toBe(createKey([new Number(1)]));
      expect(createKey([new Number(1)])).not.toBe(createKey([new Number(2)]));
      expect(createKey([new Number(1)])).not.toBe(createKey([1]));
      expect(createKey([new String("a")])).not.toBe(createKey(["a"]));
      expect(createKey([new Boolean(true)])).not.toBe(createKey([true]));
      /* eslint-enable no-new-wrappers */
    });

    test("should key typed arrays and buffers by bytes", () => {
      expect(createKey([new Uint8Array([1, 2])])).toBe(
        createKey([new Uint8Array([1, 2])])
      );
      expect(createKey([new Uint8Array([1, 2])])).not.toBe(
        createKey([new Uint8Array([1, 3])])
      );
      expect(createKey([new Uint8Array([1])])).not.toBe(
        createKey([new Int8Array([1])])
      );
      expect(createKey([new ArrayBuffer(2)])).toBe(
        createKey([new ArrayBuffer(2)])
      );
      expect(createKey([new ArrayBuffer(2)])).not.toBe(
        createKey([new ArrayBuffer(3)])
      );
      expect(createKey([new DataView(new ArrayBuffer(2))])).toBe(
        createKey([new DataView(new ArrayBuffer(2))])
      );
    });

    test("should key opaque objects by identity", () => {
      const weakMap = new WeakMap();
      const promise = Promise.resolve(1);
      expect(createKey([weakMap])).toBe(createKey([weakMap]));
      expect(createKey([weakMap])).not.toBe(createKey([new WeakMap()]));
      expect(createKey([promise])).toBe(createKey([promise]));
      expect(createKey([promise])).not.toBe(createKey([Promise.resolve(1)]));
      expect(createKey([new WeakSet()])).not.toBe(createKey([new WeakSet()]));
      expect(createKey([new WeakRef({})])).not.toBe(
        createKey([new WeakRef({})])
      );
    });

    test("should key unrecognised exotic objects by identity", () => {
      function* generate(): Generator<number> {
        yield 1;
      }
      const generator = generate();
      expect(createKey([generator])).toBe(createKey([generator]));
      expect(createKey([generate()])).not.toBe(createKey([generate()]));
    });

    test("should key arguments objects structurally", () => {
      function collector(): IArguments {
        // eslint-disable-next-line prefer-rest-params
        return arguments;
      }
      const collect = collector as (...args: unknown[]) => IArguments;
      expect(createKey([collect(1, 2)])).toBe(createKey([collect(1, 2)]));
      expect(createKey([collect(1, 2)])).not.toBe(createKey([collect(1, 3)]));
    });
  });

  describe("circular and shared references", () => {
    test("should not overflow on a self-referential object", () => {
      const node: Record<string, unknown> = { name: "a" };
      node.self = node;
      expect(() => createKey([node])).not.toThrow();
    });

    test("should key structurally identical cycles identically", () => {
      const one: Record<string, unknown> = { name: "a" };
      one.self = one;
      const two: Record<string, unknown> = { name: "a" };
      two.self = two;
      expect(createKey([one])).toBe(createKey([two]));
    });

    test("should still separate differences behind a cycle", () => {
      const one: Record<string, unknown> = { name: "a" };
      one.self = one;
      const two: Record<string, unknown> = { name: "b" };
      two.self = two;
      expect(createKey([one])).not.toBe(createKey([two]));
    });

    test("should treat shared references like equal separate values", () => {
      const shared = { v: 1 };
      expect(createKey([{ a: shared, b: shared }])).toBe(
        createKey([{ a: { v: 1 }, b: { v: 1 } }])
      );
    });

    test("should handle cycles through arrays, maps and sets", () => {
      const arr: unknown[] = [1];
      arr.push(arr);
      const map = new Map<string, unknown>();
      map.set("self", map);
      const set = new Set<unknown>();
      set.add(set);

      expect(() => createKey([arr, map, set])).not.toThrow();
      expect(createKey([arr])).toBe(createKey([arr]));
    });

    const buildChain = (depth: number): Record<string, unknown> => {
      let node: Record<string, unknown> = {};
      const head = node;
      for (let i = 0; i < depth; i++) {
        const next: Record<string, unknown> = {};
        node.next = next;
        node = next;
      }
      return head;
    };

    test("should handle realistically deep structures", () => {
      expect(() => createKey([buildChain(400)])).not.toThrow();
    });

    test("should fail deterministically past the depth guard", () => {
      // A predictable RangeError beats an engine-dependent stack overflow;
      // `memoize` turns it into an uncached call.
      expect(() => createKey([buildChain(5000)])).toThrow(RangeError);
      expect(() => createKey([buildChain(5000)])).toThrow(/nesting exceeded/);
    });
  });
});
