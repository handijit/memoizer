import { describe, expect, expectTypeOf, test } from "vitest";

import Memoizer from "../lib/index";
import type { Memoized } from "../lib/types";

describe("type surface", () => {
  const memoizer = new Memoizer();

  test("should preserve parameter and return types", () => {
    const sum = memoizer.memoize((a: number, b: string) => ({ a, b }));

    expectTypeOf(sum(1, "x")).toEqualTypeOf<{ a: number; b: string }>();

    // @ts-expect-error second parameter must be a string
    sum(1, 2);
    // @ts-expect-error the second parameter is required
    sum(1);

    expect(sum(1, "x")).toEqual({ a: 1, b: "x" });
  });

  test("should preserve optional and rest parameters", () => {
    const withOptional = memoizer.memoize((a: number, b?: string) => [a, b]);
    const withRest = memoizer.memoize((...values: number[]) => values.length);

    expectTypeOf(withOptional(1)).toEqualTypeOf<
      (number | string | undefined)[]
    >();
    expectTypeOf(withRest(1, 2, 3)).toEqualTypeOf<number>();

    expect(withOptional(1)).toEqual([1, undefined]);
    expect(withRest(1, 2, 3)).toBe(3);
  });

  test("should drop the this parameter once a context is bound", () => {
    function greet(this: { name: string }, greeting: string): string {
      return `${greeting} ${this.name}`;
    }
    const greetAda = memoizer.memoize(greet, [], { name: "Ada" });

    expectTypeOf(greetAda("hi")).toEqualTypeOf<string>();
    expectTypeOf(greetAda).parameters.toEqualTypeOf<
      Parameters<(greeting: string) => string>
    >();

    expect(greetAda("hi")).toBe("hi Ada");
  });

  test("should reject a context that does not match the this parameter", () => {
    function greet(this: { name: string }): string {
      return this.name;
    }

    // @ts-expect-error the context must provide `name`
    memoizer.memoize(greet, [], { wrong: true });

    expect(memoizer.memoize(greet, [], { name: "Ada" })()).toBe("Ada");
  });

  test("should expose cache controls on the memoized function", () => {
    const run = memoizer.memoize((n: number) => n);

    expectTypeOf(run.size).toEqualTypeOf<number>();
    expectTypeOf(run.clear).toEqualTypeOf<() => void>();

    expect(typeof run.clear).toBe("function");
  });

  test("should type the resolver against the original parameters", () => {
    const run = memoizer.memoize(
      (a: number, b: string) => a + b,
      [],
      undefined,
      {
        resolver: (a, b) => {
          expectTypeOf(a).toEqualTypeOf<number>();
          expectTypeOf(b).toEqualTypeOf<string>();
          return `${a}:${b}`;
        },
      }
    );

    memoizer.memoize((a: number) => a, [], undefined, {
      // @ts-expect-error the resolver must return a string
      resolver: (a) => a,
    });

    expect(run(1, "x")).toBe("1x");
  });

  test("should keep Memoized assignable to the original signature", () => {
    type Fn = (n: number) => string;
    const run: Memoized<Fn> = memoizer.memoize((n: number) => String(n));
    const plain: Fn = run;

    expect(plain(1)).toBe("1");
  });

  test("should accept both dependency forms", () => {
    const fromArray = memoizer.memoize((n: number) => n, [{ a: 1 }]);
    const fromGetter = memoizer.memoize(
      (n: number) => n,
      () => [{ a: 1 }]
    );

    expect(fromArray(1)).toBe(1);
    expect(fromGetter(1)).toBe(1);
  });
});
