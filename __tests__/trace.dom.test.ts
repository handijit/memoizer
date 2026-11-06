/**
 * @jest-environment jsdom
 */
import Memoizer from "../lib/index";

describe("browser tracing", () => {
  afterEach(() => {
    delete window.__memoizer__;
  });

  test("should not touch window by default", () => {
    new Memoizer();
    expect(window.__memoizer__).toBeUndefined();
  });

  test("should expose the instance when trace is enabled", () => {
    const info = jest.spyOn(console, "info").mockImplementation(() => undefined);
    const memoizer = new Memoizer({ trace: true });

    expect(window.__memoizer__).toBe(memoizer);
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("tracing enabled")
    );
  });

  test("should allow clearing every cache from the console handle", () => {
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    const memoizer = new Memoizer({ trace: true });
    const spy = jest.fn((n: number) => n);
    const run = memoizer.memoize(spy);

    run(1);
    window.__memoizer__?.clear();
    run(1);

    expect(spy).toHaveBeenCalledTimes(2);
  });

  test("should re-expose the instance after init", () => {
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    const memoizer = new Memoizer({ trace: true });

    delete window.__memoizer__;
    memoizer.init();

    expect(window.__memoizer__).toBe(memoizer);
  });

  test("should ignore a non-boolean trace value", () => {
    new Memoizer({ trace: "yes" as unknown as boolean });
    expect(window.__memoizer__).toBeUndefined();
  });

  test("should log cache hits when hasLogs is enabled", () => {
    const info = jest.spyOn(console, "info").mockImplementation(() => undefined);
    const memoizer = new Memoizer({ hasLogs: true });
    const double = memoizer.memoize(function double(n: number) {
      return n * 2;
    });

    double(2);
    expect(info).not.toHaveBeenCalled();

    double(2);
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("double"),
      4
    );
  });

  test("should label anonymous functions in logs", () => {
    const info = jest.spyOn(console, "info").mockImplementation(() => undefined);
    const memoizer = new Memoizer({ hasLogs: true });
    const run = memoizer.memoize(((n: number) => n) as (n: number) => number);
    Object.defineProperty(run, "name", { value: "" });

    const anonymous = memoizer.memoize(
      Object.defineProperty((n: number) => n, "name", { value: "" }) as (
        n: number
      ) => number
    );

    anonymous(1);
    anonymous(1);

    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("anonymous"),
      1
    );
    expect(run).toBeDefined();
  });
});
