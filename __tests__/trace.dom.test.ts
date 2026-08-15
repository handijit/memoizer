/**
 * @jest-environment jsdom
 */
import Memofy from "../lib/index";

describe("browser tracing", () => {
  afterEach(() => {
    delete window.__memofy__;
  });

  test("should not touch window by default", () => {
    new Memofy();
    expect(window.__memofy__).toBeUndefined();
  });

  test("should expose the instance when trace is enabled", () => {
    const info = jest.spyOn(console, "info").mockImplementation(() => undefined);
    const memofy = new Memofy({ trace: true });

    expect(window.__memofy__).toBe(memofy);
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("tracing enabled")
    );
  });

  test("should allow clearing every cache from the console handle", () => {
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    const memofy = new Memofy({ trace: true });
    const spy = jest.fn((n: number) => n);
    const run = memofy.memoize(spy);

    run(1);
    window.__memofy__?.clear();
    run(1);

    expect(spy).toHaveBeenCalledTimes(2);
  });

  test("should re-expose the instance after init", () => {
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    const memofy = new Memofy({ trace: true });

    delete window.__memofy__;
    memofy.init();

    expect(window.__memofy__).toBe(memofy);
  });

  test("should ignore a non-boolean trace value", () => {
    new Memofy({ trace: "yes" as unknown as boolean });
    expect(window.__memofy__).toBeUndefined();
  });

  test("should log cache hits when hasLogs is enabled", () => {
    const info = jest.spyOn(console, "info").mockImplementation(() => undefined);
    const memofy = new Memofy({ hasLogs: true });
    const double = memofy.memoize(function double(n: number) {
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
    const memofy = new Memofy({ hasLogs: true });
    const run = memofy.memoize(((n: number) => n) as (n: number) => number);
    Object.defineProperty(run, "name", { value: "" });

    const anonymous = memofy.memoize(
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
