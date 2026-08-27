import { writeToConsole } from "../lib/helpers/logger";

describe("writeToConsole", () => {
  test("should report the function name and pass the value separately", () => {
    const info = jest.spyOn(console, "info").mockImplementation(() => undefined);

    writeToConsole("getTotal", 42);

    expect(info).toHaveBeenCalledWith(
      'memofy: "getTotal" returned a cached value.',
      42
    );
  });

  test("should fall back to a placeholder for unnamed functions", () => {
    const info = jest.spyOn(console, "info").mockImplementation(() => undefined);

    writeToConsole("", null);

    expect(info).toHaveBeenCalledWith(
      'memofy: "anonymous" returned a cached value.',
      null
    );
  });

  test("should not stringify the value", () => {
    const info = jest.spyOn(console, "info").mockImplementation(() => undefined);
    const value = {
      toString(): string {
        throw new Error("must not be stringified");
      },
    };

    expect(() => writeToConsole("fn", value)).not.toThrow();
    expect(info).toHaveBeenCalledWith(expect.any(String), value);
  });
});
