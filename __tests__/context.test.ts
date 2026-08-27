import Memofy from "../lib/index";

describe("context binding", () => {
  let memofy: Memofy;

  beforeEach(() => {
    memofy = new Memofy();
  });

  test("should call the function with the given context", () => {
    function greet(this: { name: string }): string {
      return `hi ${this.name}`;
    }
    const greetAda = memofy.memoize(greet, [], { name: "Ada" });

    expect(greetAda()).toBe("hi Ada");
  });

  test("should not leak results between two contexts", () => {
    function greet(this: { name: string }): string {
      return `hi ${this.name}`;
    }
    const greetAda = memofy.memoize(greet, [], { name: "Ada" });
    const greetGrace = memofy.memoize(greet, [], { name: "Grace" });

    expect(greetAda()).toBe("hi Ada");
    expect(greetGrace()).toBe("hi Grace");
  });

  test("should isolate instances of the same class", () => {
    class Counter {
      public readonly read: () => number;

      constructor(private value: number) {
        this.read = memofy.memoize(
          function (this: Counter): number {
            return this.value;
          },
          [],
          this
        );
      }
    }

    const first = new Counter(1);
    const second = new Counter(2);

    expect(first.read()).toBe(1);
    expect(second.read()).toBe(2);
  });

  test("should memoize a method plucked off an object", () => {
    const service = {
      multiplier: 3,
      scale(value: number): number {
        return value * this.multiplier;
      },
    };
    const scale = memofy.memoize(service.scale, [], service);

    expect(scale(2)).toBe(6);
    expect(scale(2)).toBe(6);
  });

  test("should re-run when the context is tracked as a dependency", () => {
    const owner = { name: "Ada" };
    const spy = jest.fn(function (this: { name: string }): string {
      return this.name;
    });
    const read = memofy.memoize(spy, [owner], owner);

    expect(read()).toBe("Ada");
    owner.name = "Grace";
    expect(read()).toBe("Grace");
    expect(spy).toHaveBeenCalledTimes(2);
  });

  test("should work without a context", () => {
    const spy = jest.fn((n: number) => n * 2);
    const double = memofy.memoize(spy);

    expect(double(2)).toBe(4);
  });

  test("should pass the context to a custom resolver", () => {
    const owner = { prefix: "p" };
    const resolver = jest.fn(function (this: typeof owner, n: number) {
      return `${this.prefix}:${n}`;
    });
    const run = memofy.memoize((n: number) => n, [], owner, { resolver });

    run(1);
    expect(resolver).toHaveBeenCalled();
    expect(resolver.mock.results[0].value).toBe("p:1");
  });
});
