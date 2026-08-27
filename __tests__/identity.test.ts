import {
  createIdentityRegistry,
  supportsWeakSymbolKeys,
} from "../lib/utils/identity";

describe("identity registry", () => {
  describe("supportsWeakSymbolKeys", () => {
    test("should report a boolean for the running engine", () => {
      expect(typeof supportsWeakSymbolKeys()).toBe("boolean");
    });

    test("should report true on engines accepting symbol weak keys", () => {
      expect(supportsWeakSymbolKeys()).toBe(true);
    });

    test("should report false when WeakMap rejects symbol keys", () => {
      const original = WeakMap.prototype.set;
      const spy = jest
        .spyOn(WeakMap.prototype, "set")
        .mockImplementation(function (this: WeakMap<object, unknown>, key, value) {
          if (typeof key === "symbol") {
            throw new TypeError("Invalid value used as weak map key");
          }
          return original.call(this, key, value) as WeakMap<object, unknown>;
        });

      expect(supportsWeakSymbolKeys()).toBe(false);
      spy.mockRestore();
    });
  });

  describe("object identities", () => {
    test("should give a stable id per object", () => {
      const registry = createIdentityRegistry();
      const obj = {};

      expect(registry.ofObject(obj)).toBe(registry.ofObject(obj));
    });

    test("should give distinct ids to distinct objects", () => {
      const registry = createIdentityRegistry();

      expect(registry.ofObject({})).not.toBe(registry.ofObject({}));
    });

    test("should number objects and symbols from one sequence", () => {
      const registry = createIdentityRegistry();
      const ids = [
        registry.ofObject({}),
        registry.ofSymbol(Symbol("a")),
        registry.ofObject({}),
      ];

      expect(new Set(ids).size).toBe(3);
    });

    test("should keep registries independent", () => {
      const first = createIdentityRegistry();
      const second = createIdentityRegistry();
      const obj = {};

      expect(first.ofObject(obj)).toBe(1);
      expect(second.ofObject(obj)).toBe(1);
    });
  });

  describe("symbol identities", () => {
    test.each([
      ["weak storage", true],
      ["strong storage", false],
    ])("should give a stable id per symbol using %s", (_label, weak) => {
      const registry = createIdentityRegistry(weak);
      const symbol = Symbol("a");

      expect(registry.ofSymbol(symbol)).toBe(registry.ofSymbol(symbol));
      expect(registry.ofSymbol(symbol)).not.toBe(
        registry.ofSymbol(Symbol("a"))
      );
    });

    test("should work when the engine lacks weak symbol keys", () => {
      const registry = createIdentityRegistry(false);
      const symbol = Symbol("fallback");

      expect(registry.ofSymbol(symbol)).toBe(1);
      expect(registry.ofSymbol(symbol)).toBe(1);
      expect(registry.ofSymbol(Symbol("other"))).toBe(2);
    });
  });
});
