import Memofy from "../lib/index";
import type { Memoized } from "../lib/types";

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

const expectType = <Expected>(): (<Actual>(
  value: Actual & (Equals<Actual, Expected> extends true ? unknown : never)
) => void) => {
  return () => undefined;
};

describe("type surface", () => {
  const memofy = new Memofy();

  test("should preserve parameter and return types", () => {
    const sum = memofy.memoize((a: number, b: string) => ({ a, b }));

    expectType<{ a: number; b: string }>()(sum(1, "x"));

    // @ts-expect-error second parameter must be a string
    sum(1, 2);
    // @ts-expect-error the second parameter is required
    sum(1);

    expect(sum(1, "x")).toEqual({ a: 1, b: "x" });
  });

  test("should preserve optional and rest parameters", () => {
    const withOptional = memofy.memoize((a: number, b?: string) => [a, b]);
    const withRest = memofy.memoize((...values: number[]) => values.length);

    expectType<(number | string | undefined)[]>()(withOptional(1));
    expectType<number>()(withRest(1, 2, 3));

    expect(withOptional(1)).toEqual([1, undefined]);
    expect(withRest(1, 2, 3)).toBe(3);
  });

  test("should drop the this parameter once a context is bound", () => {
    function greet(this: { name: string }, greeting: string): string {
      return `${greeting} ${this.name}`;
    }
    const greetAda = memofy.memoize(greet, [], { name: "Ada" });

    expectType<string>()(greetAda("hi"));

    type Actual = typeof greetAda;
    type ExpectedCall = (greeting: string) => string;
    const assertCallable: Equals<
      Parameters<Actual>,
      Parameters<ExpectedCall>
    > = true;

    expect(assertCallable).toBe(true);
    expect(greetAda("hi")).toBe("hi Ada");
  });

  test("should reject a context that does not match the this parameter", () => {
    function greet(this: { name: string }): string {
      return this.name;
    }

    // @ts-expect-error the context must provide `name`
    memofy.memoize(greet, [], { wrong: true });

    expect(memofy.memoize(greet, [], { name: "Ada" })()).toBe("Ada");
  });

  test("should expose cache controls on the memoized function", () => {
    const run = memofy.memoize((n: number) => n);

    expectType<number>()(run.size);
    expectType<() => void>()(run.clear);

    expect(typeof run.clear).toBe("function");
  });

  test("should type the resolver against the original parameters", () => {
    memofy.memoize((a: number, b: string) => a + b, [], undefined, {
      resolver: (a, b) => {
        expectType<number>()(a);
        expectType<string>()(b);
        return `${a}:${b}`;
      },
    });

    memofy.memoize((a: number) => a, [], undefined, {
      // @ts-expect-error the resolver must return a string
      resolver: (a) => a,
    });

    expect(true).toBe(true);
  });

  test("should keep Memoized assignable to the original signature", () => {
    type Fn = (n: number) => string;
    const run: Memoized<Fn> = memofy.memoize((n: number) => String(n));
    const plain: Fn = run;

    expect(plain(1)).toBe("1");
  });

  test("should accept both dependency forms", () => {
    const fromArray = memofy.memoize((n: number) => n, [{ a: 1 }]);
    const fromGetter = memofy.memoize((n: number) => n, () => [{ a: 1 }]);

    expect(fromArray(1)).toBe(1);
    expect(fromGetter(1)).toBe(1);
  });
});
